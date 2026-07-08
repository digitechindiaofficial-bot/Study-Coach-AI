---
name: Mock Test System Architecture
description: Full mock test system — DB schema, APIs, frontend pages, and wiring details
---

## Schema (7 tables in lib/db/src/schema/mock-tests.ts)
- mock_tests — top-level test (examCode, name, mockType, timeLimitMinutes, difficulty, version, totalMarks)
- mock_test_sections — sections per test (orderNum, questionCount, marksPerQuestion, negativeMarks)
- mock_test_section_rules — per-section question selection (fixed|dynamic, difficulty distribution easyCount/mediumCount/hardCount, randomize)
- mock_test_fixed_questions — explicit question list for fixed-type rules
- mock_test_attempts — per-user attempt (clerkUserId text, status: in_progress|submitted, score, accuracy)
- mock_test_attempt_questions — materialized question snapshot (created at attempt start, never changes)
- mock_test_responses — per-question response (selectedOption, isMarkedForReview, isCorrect, marksAwarded, timeSpentSeconds)

## API Routes
- User: GET/POST /api/mock-tests, GET/POST /api/mock-tests/:id/attempts, PUT/POST/GET on attempt
- Admin: CRUD /api/admin/mock-tests, section/rule/fixed-question management, import JSON
- Auth: user routes use getAuth(req), admin routes use requireAdmin() which checks Clerk email == ADMIN_EMAIL env

**Why:** Using clerkUserId (text) directly in attempts avoids UUID profile lookup roundtrip.

## Key implementation details
- Materialization: for dynamic rules, queries question_bank with difficulty distribution; for fixed rules, uses ordered fixed question list
- Auto-save: debounced 3s PUT with full response array
- Time tracking: per-question time accumulates when navigating away
- Score: marks - negative_marks on wrong; 0 for unattempted; never negative total

## Frontend pages
- /mock-tests → src/pages/mock-tests/index.tsx (list with status/score)
- /mock-tests/:id → src/pages/mock-tests/session.tsx (fullscreen-style test UI)
- /mock-tests/:id/results/:attemptId → src/pages/mock-tests/result.tsx (score + analytics)
- /admin/mock-tests → src/pages/admin/mock-tests.tsx (CRUD + section builder + JSON import)

## Wiring
- layout.tsx navItems: Mock Tests → /mock-tests (ClipboardList icon)
- admin-layout.tsx navItems: Mock Tests → /admin/mock-tests (ClipboardList icon)
- App.tsx: mock-tests routes added BEFORE quiz routes to prevent route conflict

## JSON import format
```json
{ "name": "...", "examCode": "SSC_CGL", "mockType": "FULL_MOCK", "timeLimitMinutes": 60,
  "difficulty": "mixed", "instructions": "...",
  "sections": [{ "name": "...", "subjectCode": "QA", "orderNum": 1, "questionCount": 25,
    "marksPerQuestion": 2, "negativeMarks": 0.5,
    "rule": { "selectionType": "dynamic", "examCode": "SSC_CGL", "subjectCode": "QA",
      "easyCount": 10, "mediumCount": 10, "hardCount": 5, "randomize": true } }] }
```

## Important: lib rebuild
After adding new tables to lib/db, always run `pnpm run typecheck:libs` before leaf package typechecks.
The esbuild runtime bundle picks up changes immediately (built fresh on restart), but TS declarations lag until rebuilt.
