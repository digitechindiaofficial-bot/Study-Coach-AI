import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { otpVerificationsTable, profilesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

router.post("/otp/send", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = z.object({ phone: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

  const { phone } = parsed.data;
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number. Must be 10 digits starting with 6, 7, 8, or 9." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.delete(otpVerificationsTable).where(eq(otpVerificationsTable.phone, phone));
  await db.insert(otpVerificationsTable).values({ phone, otp, expiresAt, verified: false, attempts: 0 });

  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    req.log.info({ otp, phone }, "FAST2SMS_API_KEY not set — OTP logged for dev");
    return res.json({ success: true, message: "OTP generated (dev mode)" });
  }

  try {
    const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        route: "otp",
        variables_values: otp,
        numbers: phone,
        flash: 0,
      }),
    });
    const data = await response.json() as { return: boolean; message?: string[] };
    if (data.return) {
      return res.json({ success: true, message: "OTP sent successfully" });
    }
    req.log.error({ data }, "Fast2SMS returned failure");
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  } catch (err) {
    req.log.error({ err }, "Fast2SMS request threw");
    return res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

router.post("/otp/verify", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = z.object({ phone: z.string(), otp: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

  const { phone, otp } = parsed.data;
  const now = new Date();

  const records = await db
    .select()
    .from(otpVerificationsTable)
    .where(
      and(
        eq(otpVerificationsTable.phone, phone),
        eq(otpVerificationsTable.verified, false),
        gt(otpVerificationsTable.expiresAt, now),
      )
    )
    .limit(1);

  const record = records[0];
  if (!record) {
    return res.status(400).json({ error: "OTP not found or expired. Please request a new one." });
  }

  if (record.attempts >= 3) {
    return res.status(400).json({ error: "Too many incorrect attempts. Please request a new OTP." });
  }

  if (record.otp !== otp) {
    await db
      .update(otpVerificationsTable)
      .set({ attempts: record.attempts + 1 })
      .where(eq(otpVerificationsTable.id, record.id));
    return res.status(400).json({ error: "Incorrect OTP. Please try again." });
  }

  await db
    .update(otpVerificationsTable)
    .set({ verified: true })
    .where(eq(otpVerificationsTable.id, record.id));

  await db
    .update(profilesTable)
    .set({ phoneNumber: `+91${phone}`, phoneVerified: true })
    .where(eq(profilesTable.clerkUserId, userId));

  return res.json({ success: true, message: "Phone verified successfully!" });
});

export default router;
