import { db } from "@workspace/db";
import { profilesTable, type Profile } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getISTDateString, dateStringDiffDays } from "./date";

/**
 * Call whenever the user completes an activity (e.g. finishes a daily task).
 * Increments the streak once per IST calendar day, resets it to 1 if a day
 * was missed, and tracks the all-time longest streak. Safe to call multiple
 * times per day (subsequent calls this same day are a no-op).
 */
export async function recordActivityForStreak(profile: Profile): Promise<Profile> {
  const today = getISTDateString();
  const lastActive = profile.lastActiveDate;

  if (lastActive === today) {
    return profile;
  }

  const newStreak = lastActive && dateStringDiffDays(lastActive, today) === 1
    ? profile.streakCount + 1
    : 1;
  const newLongest = Math.max(profile.longestStreak, newStreak);

  const [updated] = await db
    .update(profilesTable)
    .set({ streakCount: newStreak, longestStreak: newLongest, lastActiveDate: today })
    .where(eq(profilesTable.id, profile.id))
    .returning();

  return updated ?? profile;
}

/**
 * Call whenever a streak is displayed (profile fetch, progress summary).
 * If more than one full IST day has passed since the user was last active,
 * the streak is broken — self-heal it to 0 in the DB so future increments
 * compute correctly, and so we never show a stale nonzero streak.
 */
export async function resetStreakIfBroken(profile: Profile): Promise<Profile> {
  if (profile.streakCount === 0 || !profile.lastActiveDate) {
    return profile;
  }

  const today = getISTDateString();
  const diff = dateStringDiffDays(profile.lastActiveDate, today);
  if (diff <= 1) {
    return profile;
  }

  const [updated] = await db
    .update(profilesTable)
    .set({ streakCount: 0 })
    .where(eq(profilesTable.id, profile.id))
    .returning();

  return updated ?? profile;
}
