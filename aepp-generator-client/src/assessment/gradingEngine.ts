import { gradeAssessment, type ProgramRunner } from './grading'
import { runTestCases } from './execution'
import type { AssessmentReport, QuestionResult } from './model'

export { inspectProgramAst } from './astInspectors'
export type { AstInspection, StructuralCheckKind, StructuralEvidence } from './astInspectors'
export { normalizeAnswer, matchesAcceptedAnswer, matchesBooleanAnswer } from './answerMatching'
export type {
  AnswerSheet as StudentAnswers,
  AssessmentExam as ExamTemplate,
  ProgramGradingBreakdown,
  RubricCriterion,
} from './model'

export interface ThemeGradingResult {
  score: number
  max: number
  pending: number
  details: QuestionResult[]
  testCasesPassed?: string
  structuralScore?: string
  feedback?: string
}
export interface ExamGradingResult {
  totalScore: number
  maxScore: number
  pendingScore: number
  breakdown: Record<'themeA' | 'themeB' | 'themeC' | 'themeD', ThemeGradingResult>
}

/** Η κατανομή μονάδων προέρχεται από το πρότυπο, χωρίς αναστάθμιση υφιστάμενων θεμάτων. */
export function toGradingResult(report: AssessmentReport): ExamGradingResult {
  const breakdown = {} as ExamGradingResult['breakdown']
  const themes = ['Θέμα Α', 'Θέμα Β', 'Θέμα Γ', 'Θέμα Δ']
  const keys = ['themeA', 'themeB', 'themeC', 'themeD'] as const
  for (const [index, key] of keys.entries()) {
    const section = report.sections.find(value => value.theme === themes[index])
    const details = section?.questions ?? []
    const programs = details.flatMap(result => (result.grading ? [result.grading] : []))
    const round = (number: number) => Math.round(number * 100) / 100
    breakdown[key] = {
      score: section?.earned ?? 0,
      max: section?.max ?? 0,
      pending: section?.pending ?? 0,
      details,
      ...(programs.length
        ? {
            testCasesPassed: `${programs.reduce((sum, value) => sum + value.testCasesPassed, 0)}/${programs.reduce((sum, value) => sum + value.testCasesTotal, 0)}`,
            structuralScore: `${round(programs.reduce((sum, value) => sum + value.structuralScore, 0))}/${round(programs.reduce((sum, value) => sum + value.structuralMax, 0))}`,
            feedback: details.map(result => result.feedback).join('\n'),
          }
        : {}),
    }
  }
  return { totalScore: report.earned, maxScore: report.max, pendingScore: report.pending, breakdown }
}

/** Χρήση σε Worker ή στον απομονωμένο server grader με έμπιστο πρότυπο διαγωνίσματος.
 * Τα κρυφά δεδομένα δεν αποστέλλονται στον browser πριν από την υποβολή.
 */
export async function gradeExam(
  studentAnswers: unknown,
  examTemplate: unknown,
  runProgram: ProgramRunner = async (source, cases) => runTestCases(source, cases),
): Promise<ExamGradingResult> {
  return toGradingResult(await gradeAssessment(examTemplate, studentAnswers, runProgram))
}
