---
name: IST date handling for streaks and daily activity
description: Why all "today"/date-cutoff logic in this app must use IST, not UTC or server local time
---

## Rule
Every server-side calculation of "today", "this week", or "N days ago" for study activity, streaks, and daily-task dates must use India Standard Time (Asia/Kolkata), not `new Date().toISOString()` (UTC) or raw server local time.

**Why:** This app serves Indian government-exam aspirants. Computing dates in UTC misattributes activity happening between 12:00am-5:30am IST to the previous UTC day, which silently breaks streak increments and daily task/chart bucketing (task completed at 2am IST gets filed under yesterday's UTC date). This was the root cause of a "streak not updating" and "wrong chart data" bug report.

**How to apply:** Use `getISTDateString(offsetDays?)` and `dateStringDiffDays(a, b)` from `artifacts/api-server/src/lib/date.ts` for any date bucketing, streak comparisons, or "last N days" cutoffs server-side. Do not reintroduce `toISOString().split("T")[0]` in new backend code.

## Streak update pattern
Streaks don't auto-update just by existing in the DB — something must call the increment logic when the user does qualifying activity, and something must "self-heal" a stale streak when it's displayed after a missed day (otherwise a broken streak keeps showing its last nonzero value indefinitely).

**How to apply:** `recordActivityForStreak(profile)` (call on activity, e.g. task completion) and `resetStreakIfBroken(profile)` (call whenever streak is read/displayed, e.g. profile GET) in `artifacts/api-server/src/lib/streak.ts`. Frontend must invalidate profile/progress-summary queries after actions that call the activity endpoint, or the UI won't reflect the update without a manual refresh.

Note: a known caller of the UTC-date bug pattern still exists client-side in `usePlan()` (`artifacts/study-os/src/hooks/use-plan.ts`, quiz daily-limit reset) — out of scope when this was found, but should use the same IST convention if revisited.
