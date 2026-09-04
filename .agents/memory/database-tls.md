---
name: Database TLS selection
description: How to choose PostgreSQL SSL settings across Replit, Hostinger, and hosted providers.
---

Do not enable PostgreSQL SSL solely because the application runs with `NODE_ENV=production`. Select TLS from an explicit `sslmode` in the connection string or a known provider requirement; honor `sslmode=disable`.

**Why:** A production-mode build can connect to a local or proxied PostgreSQL server that does not support TLS. Forcing SSL made every database-backed route fail with “The server does not support SSL connections,” while the development server worked.

**How to apply:** When changing database initialization or deployment configuration, keep application environment and database transport security as separate decisions. Re-test the compiled production server against the target connection type.

Supabase Session Pooler hosts use `*.pooler.supabase.com` and must enable SSL. A pooler response with PostgreSQL code `XX000` and “tenant/user ... not found” means TLS and network connectivity succeeded but the pooler URL's project-reference/region combination is invalid or stale.