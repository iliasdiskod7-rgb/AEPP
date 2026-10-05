// Νέο συμβόλαιο LLM: ίδια ονόματα JSON με τα DTO του .NET.
export type ExamDifficulty = 'Εύκολο' | 'Μεσαίο' | 'Αυξημένης Δυσκολίας'
export type ExamTheme = 'Θέμα Α' | 'Θέμα Β' | 'Θέμα Γ' | 'Θέμα Δ'

export interface GenerateExamRequest {
  targetTopics: string[]
  difficulty: ExamDifficulty
  includeThemes: ExamTheme[]
  customInstructions: string | null
}

export interface QuestionDto {
  code: string
  questionText: string
  glowCodeSnippet: string | null
  solutionText: string
  marks: number
}

export interface ExamSectionDto {
  theme: ExamTheme
  totalMarks: number
  questions: QuestionDto[]
}

export interface ExamJsonResponseDto {
  title: string
  durationMinutes: number
  sections: ExamSectionDto[]
}

// Προηγούμενο συμβόλαιο οντοτήτων, για τα αποθηκευμένα ενδεικτικά θέματα.
export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type SectionType = 'ThemeA' | 'ThemeB' | 'ThemeC' | 'ThemeD'

export interface QuestionItem {
  id: string
  sectionId: string
  orderIndex: number
  subTitle: string
  contentMarkdown: string
  solutionMarkdown: string
  marks: number
  executionTraceJson: string | null
}

export interface ExamSection {
  id: string
  examId: string
  sectionType: SectionType
  title: string
  totalMarks: number
  questions: QuestionItem[]
}
export type Section = ExamSection

export interface Exam {
  id: string
  title: string
  academicYear: string
  targetTopic: string
  difficulty: Difficulty
  createdAt: string // ISO 8601 UTC timestamp
  sections: ExamSection[]
  durationMinutes: number
}

// Matches the existing .NET GenerateExamCommand exactly.
export interface GenerateExamCommand {
  title: string
  academicYear: string
  targetTopic: string
  difficulty: Difficulty
}

export interface GenerationOptions {
  command: GenerateExamCommand
  sections: SectionType[]
}

export interface ExecutionTrace {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}
