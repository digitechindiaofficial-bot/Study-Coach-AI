---
name: Clerk production key and Replit preview
description: Why the app uses a preview-only auth shell when production Clerk keys cannot initialize on Replit preview domains
---

## Rule
The production Clerk publishable key is restricted to govtguru.com, so it cannot initialize from a .replit.dev or .replit.app preview hostname. Preview must not wait indefinitely for Clerk's loading state.

**Why:** Clerk rejects the preview origin before `isLoaded` becomes usable, which leaves the root redirect on the splash screen.

**How to apply:** Keep real ClerkProvider/authentication unchanged for non-preview hosts. On localhost and Replit preview hosts, use the local preview auth provider and clearly label that API calls still require a real production session.