---
name: Hostinger esbuild execution
description: Non-obvious compatibility tradeoff used to avoid esbuild binary EACCES failures in Hostinger automated builds
---

Keep esbuild forced to 0.23.1 while Hostinger requires the binary-execution workaround, and retain the root postinstall chmod safeguard for both the esbuild launcher and platform binary.

**Why:** Hostinger's automated pnpm install denied execution of esbuild 0.27.3. Version 0.23.1 completed clean installs and both production builds locally, but Vite 7 officially requests esbuild 0.27.x, so this override is a deliberate hosting compatibility tradeoff rather than a normal dependency upgrade path.

**How to apply:** After changing Vite or esbuild, test a clean pnpm 11 frozen install, verify execute bits on both binaries, and run the API and frontend production builds before removing or changing the override.