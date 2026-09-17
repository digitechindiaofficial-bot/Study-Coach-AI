---
name: pnpm 11 deployment policy
description: Compatibility rules for pnpm 11 package-manager metadata and dependency build-script permissions
---

Declare pnpm 11 in `devEngines.packageManager` with an exact version and `onFail: "warn"`. Put dependency lifecycle-script permissions in the `allowBuilds` map in `pnpm-workspace.yaml`.

**Why:** pnpm 11 ignores settings under the `pnpm` field in `package.json`, and Corepack rejects version ranges in `devEngines.packageManager` before pnpm can honor `onFail`. An exact version plus warning behavior works with Corepack while avoiding hard failures when an environment invokes a different version.

**How to apply:** When changing pnpm versions or deployment dependency policy, regenerate the lockfile with the target pnpm, then verify a frozen clean install and confirm `pnpm ignored-builds` reports none.