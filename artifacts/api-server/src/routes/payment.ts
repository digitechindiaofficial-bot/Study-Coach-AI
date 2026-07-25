import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import Razorpay from "razorpay";
import { logger } from "../lib/logger";

const router = Router();

function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// POST /api/payment/create-order
router.post("/payment/create-order", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const billingPeriod: "monthly" | "yearly" = req.body?.billingPeriod === "yearly" ? "yearly" : "monthly";
  const amount = billingPeriod === "yearly" ? 99900 : 12900; // paise: ₹999 or ₹129

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now().toString(36)}`,
      notes: { userId, plan: "pro", billingPeriod },
    });

    // Insert pending payment record
    await db.execute(`
      INSERT INTO payments (user_id, order_id, amount, currency, status, plan)
      VALUES ('${userId}', '${order.id}', ${amount}, 'INR', 'pending', 'pro_${billingPeriod}')
    `);

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    logger.error({ err }, "Razorpay create-order failed");
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

// POST /api/payment/verify
router.post("/payment/verify", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body ?? {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment fields" });
  }

  // Verify signature
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");

  if (expectedSignature !== razorpay_signature) {
    logger.warn({ userId, razorpay_order_id }, "Razorpay signature mismatch");
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  // Determine billing period from the payment record
  const paymentRecord = await db.execute(
    `SELECT plan FROM payments WHERE order_id = '${razorpay_order_id}' AND user_id = '${userId}' LIMIT 1`
  );
  const planField = (paymentRecord.rows[0] as any)?.plan ?? "pro_monthly";
  const isYearly = planField === "pro_yearly";

  // Upgrade user to pro, set expiry based on billing period
  const planExpiry = new Date();
  if (isYearly) {
    planExpiry.setFullYear(planExpiry.getFullYear() + 1);
  } else {
    planExpiry.setMonth(planExpiry.getMonth() + 1);
  }

  await db
    .update(profilesTable)
    .set({ planType: "pro", planExpiry } as any)
    .where(eq(profilesTable.clerkUserId, userId));

  // Mark payment as captured
  await db.execute(`
    UPDATE payments
    SET status = 'captured', payment_id = '${razorpay_payment_id}'
    WHERE order_id = '${razorpay_order_id}' AND user_id = '${userId}'
  `);

  res.json({ ok: true, planType: "pro", planExpiry: planExpiry.toISOString() });
});

export default router;
