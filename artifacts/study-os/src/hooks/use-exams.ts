import { useState, useEffect } from "react";

export interface ExamOption {
  id: string;
  code: string;
  name: string;
  exam_full_name: string | null;
  category: string;
  icon_emoji: string;
  display_order: number;
  is_featured: boolean;
}

export const FALLBACK_EXAMS: ExamOption[] = [
  { id: "fallback-sbi-clerk", code: "SBI_CLERK", name: "SBI Clerk", exam_full_name: "State Bank of India Junior Associates", category: "banking", icon_emoji: "🏦", display_order: 0, is_featured: true },
  { id: "fallback-ssc-cgl", code: "SSC_CGL", name: "SSC CGL", exam_full_name: "Staff Selection Commission Combined Graduate Level", category: "central", icon_emoji: "📝", display_order: 1, is_featured: true },
  { id: "fallback-ssc-chsl", code: "SSC_CHSL", name: "SSC CHSL", exam_full_name: "Staff Selection Commission Combined Higher Secondary Level", category: "central", icon_emoji: "📋", display_order: 2, is_featured: true },
  { id: "fallback-ibps-po", code: "IBPS_PO", name: "IBPS PO", exam_full_name: "Institute of Banking Personnel Selection Probationary Officer", category: "banking", icon_emoji: "🏦", display_order: 3, is_featured: true },
  { id: "fallback-ibps-clerk", code: "IBPS_CLERK", name: "IBPS Clerk", exam_full_name: "Institute of Banking Personnel Selection Clerk", category: "banking", icon_emoji: "🏦", display_order: 4, is_featured: false },
  { id: "fallback-sbi-po", code: "SBI_PO", name: "SBI PO", exam_full_name: "State Bank of India Probationary Officer", category: "banking", icon_emoji: "💼", display_order: 5, is_featured: true },
  { id: "fallback-rrb-ntpc", code: "RRB_NTPC", name: "RRB NTPC", exam_full_name: "Railway Recruitment Board Non-Technical Popular Categories", category: "railway", icon_emoji: "🚂", display_order: 6, is_featured: false },
  { id: "fallback-uppsc", code: "UPPSC", name: "UPPSC", exam_full_name: "Uttar Pradesh Public Service Commission", category: "state", icon_emoji: "🗺️", display_order: 7, is_featured: false },
  { id: "fallback-bpsc", code: "BPSC", name: "BPSC", exam_full_name: "Bihar Public Service Commission", category: "state", icon_emoji: "🎯", display_order: 8, is_featured: false },
];

let cache: ExamOption[] = FALLBACK_EXAMS;
let apiLoaded = false;
let inflight: Promise<ExamOption[]> | null = null;

async function fetchExams(): Promise<ExamOption[]> {
  if (apiLoaded) return cache;
  if (inflight) return inflight;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);

  inflight = fetch("/api/exams", {
    credentials: "include",
    signal: controller.signal,
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Exam request failed with ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Exam response was empty or invalid");
      }
      const validRows = (rows as ExamOption[])
        .filter((row) => row && typeof row.code === "string" && typeof row.name === "string")
        .sort((a, b) => a.display_order - b.display_order);
      if (validRows.length === 0) throw new Error("Exam response contained no valid exams");
      cache = validRows;
      apiLoaded = true;
      return cache;
    })
    .catch(() => cache)
    .finally(() => {
      window.clearTimeout(timeout);
      inflight = null;
    });

  return inflight;
}

export function useExams() {
  const [exams, setExams] = useState<ExamOption[]>(cache);

  useEffect(() => {
    let active = true;
    fetchExams().then((rows) => {
      if (active) setExams(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return { exams, loading: false };
}
