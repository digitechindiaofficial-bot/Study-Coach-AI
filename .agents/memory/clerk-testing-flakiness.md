---
name: Clerk programmatic auth flakiness
description: runTest's Clerk sign-in override is unreliable in this environment; how to work around it
---

## Rule
`runTest(testClerkAuth: true)` with a `[Clerk Auth]` sign-in step intermittently fails in this environment — either with "Couldn't find your account" on the email path, or by falling back to a blocked "Continue with Google" OAuth path that the sandbox can't complete. This happens across unrelated features (not tied to one route or one test plan), so it's an environment characteristic, not a bug in the app under test.

**Why:** The test infra's Clerk override doesn't always register the programmatic session before the app's UI attempts real sign-in, so it degrades to interactive OAuth, which cannot succeed in a headless test run.

**How to apply:** Don't retry the identical failing test call — it rarely resolves on retry and wastes turns. Instead:
- Verify the change through static analysis (read the code path fully, reason through edge cases), a clean typecheck, and workflow/browser logs showing real requests succeeding.
- If end-to-end confirmation is essential, ask the user to manually walk through the flow once, or narrow the test plan to something that doesn't require auth (e.g. an unauthenticated deny-path check) if that still exercises the logic in question.
