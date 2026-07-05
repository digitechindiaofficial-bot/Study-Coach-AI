---
name: Testing hardcoded admin-email gating
description: How to verify an admin panel gated by a secret ADMIN_EMAIL when the agent can never read that secret's value.
---

When an admin feature is gated by comparing the signed-in user's email to a secret env var (e.g. `ADMIN_EMAIL`), the agent cannot read that secret's value (environment-secrets tooling only reports existence, never the value). This means the agent cannot construct a Clerk test session whose email matches the real admin account.

**How to apply:** Use `runTest` (with `testClerkAuth: true`) to verify only the deny path — sign in as a random non-admin test user and confirm:
- Client-side: navigating to the admin route(s) redirects away (e.g. to `/dashboard`)
- Server-side: the protected API routes return 403 for a non-admin session (not just hidden client-side)

For the allow path (actual admin login), ask the user to log in with their real admin account and confirm the panel loads — do not attempt to fake or guess the admin email.

Also note: `runTest`'s Clerk programmatic sign-in requires passing `testClerkAuth: true` as a top-level argument to the `runTest` call itself, not just a `[Clerk Auth]` line inside the test plan text. Omitting the flag causes the sign-in step to silently try (and fail) against the real Clerk UI.
