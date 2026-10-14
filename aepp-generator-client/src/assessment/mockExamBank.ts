import { AssessmentExamSchema } from './schemas'
import type { AssessmentExam } from './model'

/** Explicit local practice only. These are educational fixtures, not official exam papers. */
export async function getMockExam(): Promise<AssessmentExam> {
 const { default: definition } = await import('./practice-exam.json')
 return AssessmentExamSchema.parse(definition)
}
