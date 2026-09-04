export const FREE_VISIBLE_PLAN_DAYS = 3;

export interface LockablePlanDay {
  date: string;
  day_name: string;
  day_type: string;
  days_left: number;
  sessions: unknown[];
  _locked?: boolean;
}

export function applyPlanDayVisibility<T extends LockablePlanDay>(
  days: readonly T[],
  isPro: boolean,
): T[] {
  return days.map((day, index) => {
    const isLocked = !isPro && index >= FREE_VISIBLE_PLAN_DAYS;

    if (!isLocked) {
      return { ...day, _locked: false } as T;
    }

    return {
      ...day,
      sessions: [],
      _locked: true,
    } as T;
  });
}