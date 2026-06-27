export interface SyllabusTopic {
  subject: string;
  topic: string;
  subtopic: string;
}

const SSC_CGL: SyllabusTopic[] = [
  { subject: "Quantitative Aptitude", topic: "Number System", subtopic: "HCF & LCM" },
  { subject: "Quantitative Aptitude", topic: "Number System", subtopic: "Simplification" },
  { subject: "Quantitative Aptitude", topic: "Percentage", subtopic: "Basic Percentage" },
  { subject: "Quantitative Aptitude", topic: "Percentage", subtopic: "Applications" },
  { subject: "Quantitative Aptitude", topic: "Profit & Loss", subtopic: "Basic Concepts" },
  { subject: "Quantitative Aptitude", topic: "Profit & Loss", subtopic: "Discount" },
  { subject: "Quantitative Aptitude", topic: "Ratio & Proportion", subtopic: "Ratio" },
  { subject: "Quantitative Aptitude", topic: "Ratio & Proportion", subtopic: "Proportion" },
  { subject: "Quantitative Aptitude", topic: "Time & Work", subtopic: "Work & Efficiency" },
  { subject: "Quantitative Aptitude", topic: "Time & Work", subtopic: "Pipes & Cisterns" },
  { subject: "Quantitative Aptitude", topic: "Time & Distance", subtopic: "Speed & Distance" },
  { subject: "Quantitative Aptitude", topic: "Time & Distance", subtopic: "Trains" },
  { subject: "Quantitative Aptitude", topic: "Simple & Compound Interest", subtopic: "SI" },
  { subject: "Quantitative Aptitude", topic: "Simple & Compound Interest", subtopic: "CI" },
  { subject: "Quantitative Aptitude", topic: "Geometry", subtopic: "Triangles" },
  { subject: "Quantitative Aptitude", topic: "Geometry", subtopic: "Circles" },
  { subject: "Quantitative Aptitude", topic: "Mensuration", subtopic: "2D Shapes" },
  { subject: "Quantitative Aptitude", topic: "Mensuration", subtopic: "3D Shapes" },
  { subject: "Quantitative Aptitude", topic: "Trigonometry", subtopic: "Basics" },
  { subject: "Quantitative Aptitude", topic: "Trigonometry", subtopic: "Heights & Distances" },
  { subject: "Quantitative Aptitude", topic: "Statistics", subtopic: "Mean, Median, Mode" },
  { subject: "Quantitative Aptitude", topic: "Statistics", subtopic: "Data Interpretation" },
  { subject: "English", topic: "Reading Comprehension", subtopic: "Passage Analysis" },
  { subject: "English", topic: "Fill in the Blanks", subtopic: "Grammar" },
  { subject: "English", topic: "Error Detection", subtopic: "Spotting Errors" },
  { subject: "English", topic: "Cloze Test", subtopic: "Vocabulary" },
  { subject: "English", topic: "Para Jumbles", subtopic: "Sentence Ordering" },
  { subject: "English", topic: "Idioms & Phrases", subtopic: "Common Idioms" },
  { subject: "English", topic: "One Word Substitution", subtopic: "Vocabulary" },
  { subject: "English", topic: "Synonyms & Antonyms", subtopic: "Word Meanings" },
  { subject: "General Intelligence", topic: "Analogy", subtopic: "Verbal Analogy" },
  { subject: "General Intelligence", topic: "Series", subtopic: "Number Series" },
  { subject: "General Intelligence", topic: "Coding-Decoding", subtopic: "Letter Coding" },
  { subject: "General Intelligence", topic: "Blood Relations", subtopic: "Family Tree" },
  { subject: "General Intelligence", topic: "Direction Sense", subtopic: "Navigation" },
  { subject: "General Intelligence", topic: "Syllogism", subtopic: "Statements & Conclusions" },
  { subject: "General Intelligence", topic: "Venn Diagrams", subtopic: "Set Theory" },
  { subject: "General Intelligence", topic: "Puzzle", subtopic: "Seating Arrangement" },
  { subject: "General Awareness", topic: "History", subtopic: "Ancient India" },
  { subject: "General Awareness", topic: "History", subtopic: "Modern India" },
  { subject: "General Awareness", topic: "Geography", subtopic: "Indian Geography" },
  { subject: "General Awareness", topic: "Geography", subtopic: "World Geography" },
  { subject: "General Awareness", topic: "Polity", subtopic: "Constitution" },
  { subject: "General Awareness", topic: "Polity", subtopic: "Parliament" },
  { subject: "General Awareness", topic: "Economics", subtopic: "Indian Economy" },
  { subject: "General Awareness", topic: "Science", subtopic: "Physics" },
  { subject: "General Awareness", topic: "Science", subtopic: "Chemistry" },
  { subject: "General Awareness", topic: "Science", subtopic: "Biology" },
  { subject: "General Awareness", topic: "Current Affairs", subtopic: "Monthly Events" },
  { subject: "General Awareness", topic: "Static GK", subtopic: "Books & Authors" },
];

const IBPS_PO: SyllabusTopic[] = [
  { subject: "Quantitative Aptitude", topic: "Data Interpretation", subtopic: "Bar Charts" },
  { subject: "Quantitative Aptitude", topic: "Data Interpretation", subtopic: "Pie Charts" },
  { subject: "Quantitative Aptitude", topic: "Number Series", subtopic: "Missing Number" },
  { subject: "Quantitative Aptitude", topic: "Quadratic Equations", subtopic: "Roots" },
  { subject: "Quantitative Aptitude", topic: "Arithmetic", subtopic: "Percentage & Profit" },
  { subject: "Quantitative Aptitude", topic: "Arithmetic", subtopic: "Time-Work & Speed" },
  { subject: "Quantitative Aptitude", topic: "Arithmetic", subtopic: "SI & CI" },
  { subject: "Reasoning", topic: "Puzzle", subtopic: "Linear Arrangement" },
  { subject: "Reasoning", topic: "Puzzle", subtopic: "Circular Arrangement" },
  { subject: "Reasoning", topic: "Seating Arrangement", subtopic: "Row Arrangement" },
  { subject: "Reasoning", topic: "Blood Relation", subtopic: "Family Diagrams" },
  { subject: "Reasoning", topic: "Coding-Decoding", subtopic: "Number Coding" },
  { subject: "Reasoning", topic: "Syllogism", subtopic: "All/Some/No" },
  { subject: "Reasoning", topic: "Input-Output", subtopic: "Word & Number Arrangement" },
  { subject: "Reasoning", topic: "Critical Reasoning", subtopic: "Assumptions" },
  { subject: "English", topic: "Reading Comprehension", subtopic: "Inference" },
  { subject: "English", topic: "Cloze Test", subtopic: "Fill in the blanks" },
  { subject: "English", topic: "Para Jumbles", subtopic: "Rearrangement" },
  { subject: "English", topic: "Error Detection", subtopic: "Grammatical Errors" },
  { subject: "English", topic: "Sentence Improvement", subtopic: "Correction" },
  { subject: "General Awareness", topic: "Banking Awareness", subtopic: "RBI & Policies" },
  { subject: "General Awareness", topic: "Banking Awareness", subtopic: "Financial Terms" },
  { subject: "General Awareness", topic: "Current Affairs", subtopic: "Banking & Economy" },
  { subject: "General Awareness", topic: "Static GK", subtopic: "National Parks & Rivers" },
  { subject: "Computer", topic: "Computer Basics", subtopic: "Hardware & Software" },
  { subject: "Computer", topic: "MS Office", subtopic: "Word, Excel, PowerPoint" },
  { subject: "Computer", topic: "Internet & Networking", subtopic: "Basic Concepts" },
];

const SYLLABI: Record<string, SyllabusTopic[]> = {
  SSC_CGL,
  SSC_CHSL: SSC_CGL.slice(0, 35),
  IBPS_PO,
  IBPS_CLERK: IBPS_PO.slice(0, 22),
  SBI_PO: IBPS_PO,
  RRB_NTPC: SSC_CGL.slice(0, 30),
  UPPSC: SSC_CGL,
  BPSC: SSC_CGL,
  OTHER: SSC_CGL.slice(0, 20),
};

export function getSyllabusForExam(examType: string): SyllabusTopic[] {
  return SYLLABI[examType] ?? SYLLABI["SSC_CGL"];
}

export function getSyllabusText(examType: string): string {
  const topics = getSyllabusForExam(examType);
  const grouped: Record<string, string[]> = {};
  for (const t of topics) {
    if (!grouped[t.subject]) grouped[t.subject] = [];
    grouped[t.subject].push(t.topic);
  }
  return Object.entries(grouped)
    .map(([subj, topics]) => `${subj}: ${[...new Set(topics)].join(", ")}`)
    .join("\n");
}
