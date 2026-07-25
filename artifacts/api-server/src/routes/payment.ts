import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, pool } from "@workspace/db";
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

/** Best-effort: log payment record without blocking the checkout flow. */
async function recordPayment(
  userId: string,
  orderId: string,
  amount: number,
  billingPeriod: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO payments (user_id, order_id, amount, currency, status, plan)
       VALUES ($1, $2, $3, 'INR', 'pending', $4)
       ON CONFLICT (order_id) DO NOTHING`,
      [userId, orderId, amount, `pro_${billingPeriod}`],
    );
  } catch (err) {
    // Table may not exist yet — log but don't crash the order
    logger.warn({ err }, "payments INSERT failed (table may not exist — run migration SQL)");
  }
}

// POST /api/payment/create-order
router.post("/payment/create-order", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const billingPeriod: "monthly" | "yearly" =
    req.body?.billingPeriod === "yearly" ? "yearly" : "monthly";
  const amount = billingPeriod === "yearly" ? 99900 : 12900; // paise

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `rcpt_${Date.now().toString(36)}`,
      notes: { userId, plan: "pro", billingPeriod },
    });

    // Non-blocking — won't fail the response even if table is missing
    void recordPayment(userId, order.id, amount, billingPeriod);

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    logger.error({ err }, "Razorpay create-order failed");
    res.status(500).json({
      error: "Failed to create payment order",
      detail: err?.message ?? String(err),
    });
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
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    logger.warn({ userId, razorpay_order_id }, "Razorpay signature mismatch");
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  // Determine billing period from the payment record (best-effort)
  let isYearly = false;
  try {
    const rec = await pool.query(
      `SELECT plan FROM payments WHERE order_id = $1 AND user_id = $2 LIMIT 1`,
      [razorpay_order_id, userId],
    );
    isYearly = (rec.rows[0]?.plan ?? "") === "pro_yearly";
  } catch {
    // payments table missing — default to monthly (safe fallback)
  }

  // Upgrade user to pro
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

  // Best-effort: mark payment captured
  try {
    await pool.query(
      `UPDATE payments SET status = 'captured', payment_id = $1
       WHERE order_id = $2 AND user_id = $3`,
      [razorpay_payment_id, razorpay_order_id, userId],
    );
  } catch {
    // payments table missing — not fatal, user is already upgraded
  }

  res.json({ ok: true, planType: "pro", planExpiry: planExpiry.toISOString() });
});

export default router;
