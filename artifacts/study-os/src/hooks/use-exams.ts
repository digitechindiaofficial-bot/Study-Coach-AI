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

let cache: ExamOption[] | null = null;
let inflight: Promise<ExamOption[]> | null = null;

async function fetchExams(): Promise<ExamOption[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/exams", { credentials: "include" })
    .then(r => r.json())
    .then((rows: ExamOption[]) => {
      cache = rows;
      inflight = null;
      return rows;
    });
  return inflight;
}

export function useExams() {
  const [exams, setExams] = useState<ExamOption[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setExams(cache); setLoading(false); return; }
    fetchExams().then(rows => { setExams(rows); setLoading(false); });
  }, []);

  return { exams, loading };
}
