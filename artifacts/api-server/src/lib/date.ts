const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * Returns a YYYY-MM-DD calendar date string for "now" in India Standard Time,
 * optionally offset by a number of days (negative = past, positive = future).
 *
 * This app serves Indian government-exam aspirants, so all "today" calculations
 * (task dates, streaks, chart cutoffs) must use IST rather than server/UTC time.
 * Using UTC would misattribute activity that happens between 12:00am-5:30am IST
 * (still "yesterday" in UTC) to the wrong calendar day.
 */
export function getISTDateString(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/** Whole-day difference between two YYYY-MM-DD calendar date strings (b - a). */
export function dateStringDiffDays(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}
