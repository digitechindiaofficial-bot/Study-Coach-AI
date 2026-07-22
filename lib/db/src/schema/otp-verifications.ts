import { pgTable, text, integer, boolean, timestamp, uuid } from "drizzle-orm/pg-core";

export const otpVerificationsTable = pgTable("otp_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: text("phone").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verified: boolean("verified").default(false).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OtpVerification = typeof otpVerificationsTable.$inferSelect;
