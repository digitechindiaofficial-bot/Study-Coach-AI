---
name: Freemium plan enforcement
description: How free vs pro plan limits are enforced across the app
---

## Rule
Quiz daily limit (10/day for free) is enforced **server-side** in `POST /api/quiz/attempts` — returns 429 with `{ error: "daily_limit_reached" }` when hit.

Frontend tracks limits locally via `usePlan()` hook at `artifacts/study-os/src/hooks/use-plan.ts`.

**Why:** Server enforcement prevents client-side bypass. Frontend enforcement gives instant UX feedback without a roundtrip.

## How to apply
- `usePlan()` reads from profile: `quizCountToday` (int) and `quizCountDate` (date) in DB.
- If `quizCountDate !== today`, treat count as 0 (auto-reset).
- Free plan limits: quiz=10/day, current affairs=last 3 days, study plan=no regeneration, MCQ from news=blocked.
- Free study-plan visibility: first 3 calendar entries show full sessions; every later entry is a locked stub with no session or subject-topic details.
- Apply the study-plan gate to current, cached, and newly generated API responses. Preview mode must apply the same rule locally.
- Pro plan: everything unlimited.
- `planType` column in `profiles` table: "free" | "pro" (default "free").
- Two new columns added: `quiz_count_today` (int, default 0), `quiz_count_date` (date).

## Key files
- `lib/db/src/schema/profiles.ts` — schema with quizCountToday, quizCountDate
- `artifacts/api-server/src/routes/quiz.ts` — limit enforcement in POST /quiz/attempts
- `artifacts/study-os/src/hooks/use-plan.ts` — usePlan() hook
- `artifacts/study-os/src/components/upgrade-modal.tsx` — reusable modal (variants: quiz_limit, study_plan, current_affairs, syllabus)
- `artifacts/study-os/src/pages/upgrade.tsx` — /upgrade page, Rs 199/month, "Coming Soon - Razorpay"

## Pricing
- Free: Rs 0/month
- Pro: Rs 199/month or Rs 999/year (save 58%)
- Payment: "Coming Soon — Razorpay Integration" (not yet wired)

**Why:** Free users must be able to preview the planner without receiving the complete personalized topic schedule through either the UI or an API response.
