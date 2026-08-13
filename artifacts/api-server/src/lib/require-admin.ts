/**
 * Shared admin-guard middleware.
 *
 * Used by every admin sub-router so Clerk's user lookup runs only ONCE
 * per request (the top-level admin router in admin.ts ALSO uses this; without
 * a shared export every sub-router was triggering a second Clerk API call,
 * which could rate-limit or fail transiently and return a silent 403).
 */

import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized", message: "No session found." });
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;

  let email: string | null = null;
  try {
    const user = await clerkClient.users.getUser(userId);
    email =
      user.emailAddresses.find(
        (e: { id: string }) => e.id === user.primaryEmailAddressId,
      )?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
  } catch (err) {
    // Clerk API failure — distinguish from email-mismatch in the response
    req.log?.error({ userId, err: String(err) }, "requireAdmin — Clerk lookup failed");
    res.status(403).json({
      error: "forbidden",
      reason: "clerk_api_error",
      message: "Could not verify your identity with Clerk. Try signing out and back in.",
      adminEmailConfigured: !!adminEmail,
    });
    return;
  }

  if (!adminEmail || !email || email.toLowerCase() !== adminEmail.toLowerCase()) {
    req.log?.warn({ userId, email }, "requireAdmin — email mismatch or ADMIN_EMAIL not set");
    res.status(403).json({
      error: "forbidden",
      reason: "email_mismatch",
      message: "Admin access only.",
      clerkEmail: email ? `${email.slice(0, 3)}***@${email.split("@")[1] ?? "?"}` : "none",
      adminEmailConfigured: !!adminEmail,
      adminEmailPrefix: adminEmail ? `${adminEmail.slice(0, 3)}***` : "NOT_SET",
    });
    return;
  }

  next();
}
