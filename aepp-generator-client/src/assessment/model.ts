import type { ExamTheme } from '../types/exam'
import type { Statement } from '../interpreter/types'

export interface QuestionBase {
  id: string
  code: string
  title: string
  prompt: string
  marks: number
  chapter: string
  solution: string
}

export type AssessmentQuestion =
  | (QuestionBase & { kind: 'trueFalse'; statements: { id: string; text: string; answer: boolean }[] })
  | (QuestionBase & { kind: 'matching'; pairs: { id: string; left: string; rightId: string }[]; choices: { id: string; text: string }[] })
  | (QuestionBase & { kind: 'choice'; options: { id: string; text: string }[]; correctId: string })
  | (QuestionBase & { kind: 'fill'; accepted: string[] })
  | (QuestionBase & { kind: 'codeBlanks'; template: string; blanks: { id: string; accepted: string[] }[] })
  | (QuestionBase & { kind: 'trace'; columns: string[]; rowLabels: string[]; expected: string[][] })
  | (QuestionBase & { kind: 'program'; referenceCode: string; gradingMode: 'runtime' | 'review'; testCases: ProgramTestCase[]; rubric: { kind: Statement['kind']; points: number }[] })
  | (QuestionBase & { kind: 'open' })

export interface ProgramTestCase { id: string; inputs: string[]; expectedOutput: string[] }
export interface AssessmentSection { theme: ExamTheme; marks: number; questions: AssessmentQuestion[] }
export interface AssessmentExam { id: string; title: string; durationMinutes: number; sections: AssessmentSection[]; source: 'practice' | 'generated' }
export type AnswerValue = string | Record<string, string> | string[][]
export type AnswerSheet = Record<string, AnswerValue | undefined>

export interface ProgramCaseResult {
  id: string
  passed: boolean
  actual: string[]
  error?: string
}
export interface QuestionResult {
  questionId: string
  code: string
  earned: number
  max: number
  pending: number
  feedback: string
  studentAnswer: string
  expectedAnswer: string
  chapter: string
  programCases?: ProgramCaseResult[]
  referenceCode?: string
  studentCode?: string
  astSummary?: string
}
export interface SectionResult { theme: ExamTheme; earned: number; pending: number; max: number; questions: QuestionResult[] }
export interface AssessmentReport {
  title: string
  earned: number
  pending: number
  max: number
  grade20: number
  sections: SectionResult[]
  recommendations: string[]
}

export interface AssessmentInsight {
  summary: string
  recommendations: string[]
  partialCreditSuggestions: { code: string; points: number; reason: string }[]
}
