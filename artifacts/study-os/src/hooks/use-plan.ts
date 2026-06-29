import { useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

export const FREE_DAILY_QUIZ_LIMIT = 10;
export const FREE_CURRENT_AFFAIRS_DAYS = 3;

export interface PlanStatus {
  isLoaded: boolean;
  isPro: boolean;
  planType: "free" | "pro";
  quizCountToday: number;
  quizQuestionsLeft: number;
  canTakeQuiz: boolean;
  canRegeneratePlan: boolean;
  canViewFullCurrentAffairs: boolean;
}

export function usePlan(): PlanStatus {
  const { user } = useUser();
  const { data: profile } = useGetMyProfile({
    query: {
      queryKey: getGetMyProfileQueryKey(),
      enabled: !!user,
      staleTime: 30_000,
    },
  });

  const isPro = profile?.planType === "pro";
  const today = new Date().toISOString().split("T")[0];

  const rawCount = (profile as any)?.quizCountToday ?? 0;
  const countDate = (profile as any)?.quizCountDate ?? null;
  const quizCountToday = countDate === today ? rawCount : 0;

  const quizQuestionsLeft = isPro
    ? Infinity
    : Math.max(0, FREE_DAILY_QUIZ_LIMIT - quizCountToday);

  return {
    isLoaded: !!profile,
    isPro,
    planType: (profile?.planType ?? "free") as "free" | "pro",
    quizCountToday,
    quizQuestionsLeft,
    canTakeQuiz: isPro || quizCountToday < FREE_DAILY_QUIZ_LIMIT,
    canRegeneratePlan: isPro,
    canViewFullCurrentAffairs: isPro,
  };
}
