export interface SyllabusTopic {
  subject: string;
  topic: string;
  subtopic: string;
}

export function getSyllabusForExam(_examType: string): SyllabusTopic[] {
  return [];
}

export function getSyllabusText(_examType: string): string {
  return "";
}
