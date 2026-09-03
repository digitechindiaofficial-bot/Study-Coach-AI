---
name: Clerk production key and Replit preview
description: Why the app uses a preview-only auth shell when production Clerk keys cannot initialize on Replit preview domains
---

## Rule
The production Clerk publishable key is restricted to govtguru.com, so it cannot initialize from a .replit.dev or .replit.app preview hostname. Preview must not wait indefinitely for Clerk's loading state.

**Why:** Clerk rejects the preview origin before `isLoaded` becomes usable, which leaves the root redirect on the splash screen.

**How to apply:** Keep real ClerkProvider/authentication unchanged for non-preview hosts. On localhost and Replit preview hosts, use the local preview auth provider, disable protected data queries before they run, and use clearly labeled local fixtures for inspection flows.

## Stable preview state

Preview helpers that read local storage return ordinary object values. If one of those values is used as a dependency of an effect that initializes component state, memoize it for the component lifetime or depend on stable primitive fields. Otherwise each render can create a new object, rerun the effect, and trigger React's maximum-update-depth crash.

**Why:** A preview profile read on every render caused a Settings initialization effect to set its form state repeatedly.

**How to apply:** Use a memoized preview profile in state-initializing effects, and keep preview-only flows from entering production API auto-refresh or auto-regeneration paths.