---
name: Quiz question pool approach
description: How the quiz system fetches and tracks questions to avoid repeats
---

## Rule
Frontend manages a growing question pool in React state, fetched in batches (20 at a time) and appended rather than replaced. Never uses React Query cache for quiz questions (would cause repeats). Uses `useRef<Set<string>>` for `loadedIds` (every id ever fetched into the pool this session) and a separate `seenIds` ref (answered-only, for the UI counter).

**Why:** React Query caching means the same questions would be returned on refetch. Per-subject seeded question banks can be very small (as few as ~15 rows), so naive fixed-size pool fetching caused visible repeats well before the whole bank was shown — batching + background prefetch + an explicit exhaustion/reset step fixes this while keeping practice feeling infinite.

## How it works
1. On mount, fetch a batch of 20 questions from `/api/quiz/questions?exclude=<loadedIds>`, append to pool.
2. A background `useEffect` silently prefetches the next batch once the user is within 5 questions of the end of the loaded pool (`PREFETCH_THRESHOLD`), so there's no loading spinner between questions in normal use.
3. When a fetch with `exclude=<loadedIds>` returns 0 results (whole bank for that subject/filter exhausted this session), `loadedIds`/`seenIds` are cleared and a fresh batch is fetched with no exclude — a toast tells the user practice is cycling back to the full set.
4. If that second fetch also returns 0, the subject genuinely has zero questions; a `noMoreQuestionsRef` kill-switch stops further fetch attempts (avoids an infinite retry loop).
5. Backend also does a Fisher-Yates shuffle before responding.

## Bulk generation script
- Location: `scripts/src/generate-questions.ts`
- Run: `pnpm --filter @workspace/scripts run generate-questions`
- Generates 1800 questions across 7 subjects, 180 topics (10 per topic)
- Progress saved to `.local/question-gen-progress.json` — safe to interrupt and resume
- Requires GEMINI_API_KEY quota (free tier resets daily at midnight Pacific)
- Current DB counts (before bulk gen): English 71, Computer 34, GA 27, QA 23, Reasoning 15
