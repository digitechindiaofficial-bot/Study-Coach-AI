type PlanRecord = {
  planType?: string | null;
  planExpiry?: Date | string | null;
};

export function hasActiveProAccess(
  profile: PlanRecord | null | undefined,
  now = new Date(),
): boolean {
  if (profile?.planType !== "pro" || !profile.planExpiry) return false;

  const expiry = profile.planExpiry instanceof Date
    ? profile.planExpiry
    : new Date(profile.planExpiry);

  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > now.getTime();
}

export function withEffectivePlan<T extends PlanRecord>(profile: T): T {
  if (profile.planType !== "pro" || hasActiveProAccess(profile)) return profile;
  return { ...profile, planType: "free" };
}