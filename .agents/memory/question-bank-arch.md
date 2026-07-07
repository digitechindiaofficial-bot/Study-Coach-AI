---
name: Question Bank Architecture
description: question_bank table is the canonical question store; quiz routes dual-write to question_attempts + quiz_attempts for backward compat
---

## Rule
`question_bank` is the authoritative question store. Never write new questions to `quiz_questions` (legacy). All quiz fetching reads from `question_bank`. Attempt recording dual-writes to `question_attempts` (new) + `quiz_attempts` (legacy, for backward compat).

**Why:** The old `quiz_questions` table used a jsonb `options` field and had no `updatedAt`, `source`, `language`, `tags`, `examYear`, or `isActive`. The new `question_bank` has separate `option_a/b/c/d` columns, proper metadata, and soft-delete support.

**How to apply:**
- New question generation/import → insert into `question_bank` only
- Quiz fetch → SELECT from `question_bank` (with `is_active = true` filter)
- Attempt submission → insert into BOTH `question_attempts` AND `quiz_attempts`
- Stats queries → `question_bank` for counts + `question_attempts` + `quiz_attempts` (UNION for legacy data)
- Unseen-first JOIN → unions `question_attempts` + `quiz_attempts` to cover all historical data

## Migration
- 170 questions migrated from `quiz_questions` → `question_bank` preserving original UUIDs (so legacy `quiz_attempts` FK references remain valid)
- Run script: `pnpm --filter @workspace/scripts run migrate-to-question-bank` (safe to re-run — ON CONFLICT DO NOTHING)

## Admin Import Endpoints
- `POST /api/admin/question-bank/import/json` — `{ questions: [...] }`
- `POST /api/admin/question-bank/import/csv` — text/plain CSV or `{ csv: "..." }` JSON
- `POST /api/admin/question-bank/import/bulk` — `{ questions: [...], options: { skipErrors, dryRun } }`

## Frontend backward compat
Quiz API response still returns `questionText`, `options: {a,b,c,d}`, `correctOption` (shimmed from `question`, `optionA-D`, `correctAnswer`) so no UI changes needed.

## Orval codegen gotcha
Inline requestBody schemas in OpenAPI spec generate the same type name in both `api.ts` (Zod) and `types/` (TS), causing TS2308 conflict. Fix: always use `$ref` to named components for requestBody schemas.
