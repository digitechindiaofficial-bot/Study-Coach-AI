---
name: Syllabus system — dynamic JSON import
description: How the syllabus works — DB-driven tables, JSON import API, user progress tracking
---

## Architecture

Syllabus data lives in 4 DB tables (lib/db/src/schema/syllabus.ts):
- `syllabus_exams` — master exam list (name, code unique, description)
- `syllabus_subjects` — subjects per exam (examId FK, displayOrder)
- `syllabus_topics` — topics per subject (subjectId FK, displayOrder)
- `user_topic_progress` — per-user topic status (userId+topicId unique, status: not_started|in_progress|completed)

Old `syllabus_progress` table still exists (for old data) but is no longer written to.

## Import format

```json
{
  "exam": "SSC CGL",
  "code": "SSC_CGL",
  "description": "...",
  "subjects": [{ "name": "Quant", "topics": ["Number System", "Percentage"] }]
}
```
Also accepts an array of the above. Re-importing with the same `code` replaces the exam's subjects/topics.

## API routes
- GET /api/syllabus → nested exams→subjects→topics with user progress status
- PATCH /api/syllabus/topics/:topicId → upsert user_topic_progress
- GET /api/admin/syllabus/exams → list with counts
- POST /api/admin/syllabus/import → JSON import
- DELETE /api/admin/syllabus/exams/:id → cascades to subjects/topics

## Key pitfall
`zod` must be in api-server's package.json `dependencies` (not just workspace libs). esbuild bundles the server and can't resolve `zod` or `zod/v4` if it's not a direct dep. Use `import { z } from "zod"` (not `zod/v4`) in server route files.

**Why:** esbuild resolves modules from the artifact's own node_modules. libs can use `zod/v4` because they compile via tsc (not bundled). Server routes that were previously import-free of zod now need it directly.
