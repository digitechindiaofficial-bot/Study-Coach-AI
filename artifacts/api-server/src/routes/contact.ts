import { Router } from "express";
import { pool } from "@workspace/db";
import { z } from "zod";

const router = Router();

const ContactSchema = z.object({
  name:    z.string().min(1).max(100),
  email:   z.string().email().max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(10).max(5000),
});

// Ensure the table exists (idempotent)
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      name       text        NOT NULL,
      email      text        NOT NULL,
      subject    text        NOT NULL,
      message    text        NOT NULL,
      created_at timestamptz DEFAULT now()
    )
  `);
}

router.post("/contact", async (req, res) => {
  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { name, email, subject, message } = parsed.data;

  try {
    await ensureTable();
    await pool.query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4)",
      [name, email, subject, message]
    );
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "contact form submission failed");
    res.status(500).json({ error: "Failed to save message. Please try again." });
  }
});

export default router;
