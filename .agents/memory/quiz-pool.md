---
name: Quiz question pool approach
description: How the quiz system fetches and tracks questions to avoid repeats
---

## Rule
Frontend manages a 50-question pool in React state. Never uses React Query cache for quiz questions (would cause repeats). Uses `useRef<Set<string>>` for seenIds that persists across renders without triggering re-renders.

**Why:** React Query caching means the same questions would be returned on refetch. The pool approach ensures Fisher-Yates shuffled fresh questions are served.

## How it works
1. Fetch pool of 50 questions from `/api/quiz/questions?exclude=<seenIds>`
2. Walk through pool one by one
3. When pool exhausted, fetch new pool excluding all seenIds
4. If exclude filter returns 0 results, seenIds are cleared and pool resets
5. Backend also does Fisher-Yates shuffle before responding

## Bulk generation script
- Location: `scripts/src/generate-questions.ts`
- Run: `pnpm --filter @workspace/scripts run generate-questions`
- Generates 1800 questions across 7 subjects, 180 topics (10 per topic)
- Progress saved to `.local/question-gen-progress.json` — safe to interrupt and resume
- Requires GEMINI_API_KEY quota (free tier resets daily at midnight Pacific)
- Current DB counts (before bulk gen): English 71, Computer 34, GA 27, QA 23, Reasoning 15
