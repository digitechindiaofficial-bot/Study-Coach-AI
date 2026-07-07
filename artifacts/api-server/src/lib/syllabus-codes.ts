/**
 * Shared utilities for generating deterministic subject_code and topic_code.
 * These codes are permanent — never change them once assigned.
 */

const SUBJECT_CODE_MAP: Record<string, string> = {
  "Quantitative Aptitude": "QA",
  "English Language": "ENG",
  "General Intelligence & Reasoning": "GIR",
  "General Awareness": "GA",
  "Reasoning Ability": "REAS",
  "Reasoning & Computer Aptitude": "RCA",
  "Computer Knowledge": "COMP",
  "Computer Aptitude": "COMP",
  "General/Economy/Banking Awareness": "BANK",
  "General/Financial Awareness": "GFIN",
  "Mathematics": "MATH",
  "History & Culture": "HIST",
  "Geography": "GEO",
  "Geography & Environment": "GEO",
  "Indian Polity & Governance": "POL",
  "Economy & Science": "ESCI",
  "Economy & Development": "ECON",
  "Science & Technology": "SCI",
  "General Science": "SCI",
  "Ethics & Aptitude": "ETHICS",
  "General Hindi": "HINDI",
  "Descriptive Paper": "DESC",
  "Aptitude & Reasoning (CSAT)": "APT",
  "Quantitative Aptitude & Reasoning": "QAR",
  "Mathematics & Reasoning": "MREAS",
  "Bihar Special": "BIHAR",
  "General Studies I": "GS1",
  "General Studies II": "GS2",
  "General Studies III": "GS3",
  "General Studies IV": "GS4",
  "General Studies V": "GS5",
};

/** Derive a short subject code from the subject name. */
export function deriveSubjectCode(subjectName: string): string {
  if (SUBJECT_CODE_MAP[subjectName]) return SUBJECT_CODE_MAP[subjectName];
  return subjectName
    .split(/[\s&\/\-\(\)]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6);
}

/**
 * Build a deterministic topic_code.
 * Format: {EXAM_CODE}_{SUBJECT_CODE}_{NNN}  e.g. SSC_CGL_QA_001
 * topicIndex is 0-based; output sequence is 1-based (001, 002, …).
 */
export function buildTopicCode(examCode: string, subjectCode: string, topicIndex: number): string {
  const seq = String(topicIndex + 1).padStart(3, "0");
  return `${examCode}_${subjectCode}_${seq}`;
}
