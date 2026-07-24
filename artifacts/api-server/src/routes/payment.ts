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

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: 19900, // paise
      currency: "INR",
      receipt: `receipt_${userId}_${Date.now()}`,
      notes: { userId, plan: "pro" },
    });

    // Insert pending payment record
    await db.execute(`
      INSERT INTO payments (user_id, order_id, amount, currency, status, plan)
      VALUES ('${userId}', '${order.id}', 19900, 'INR', 'pending', 'pro')
    `);

    res.json({ order_id: order.id, amount: order.amount, currency: order.currency });
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

  // Upgrade user to pro, set expiry 1 month from now
  const planExpiry = new Date();
  planExpiry.setMonth(planExpiry.getMonth() + 1);

  await db
    .update(profilesTable)
    .set({ planType: "pro", planExpiry: planExpiry.toISOString() } as any)
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
