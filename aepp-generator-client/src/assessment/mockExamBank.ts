import { AssessmentExamSchema } from './schemas'
import type { AssessmentExam } from './model'
export async function getMockExamBank(): Promise<AssessmentExam[]> {
  const { default: bank } = await import('./exam-bank-mock.json')
  return bank.map(item => AssessmentExamSchema.parse(item))
}
export async function getMockExam(id?: string): Promise<AssessmentExam> {
  const bank = await getMockExamBank()
  return (id ? bank.find(exam => exam.id === id) : bank[0]) ?? bank[0]
}
export async function getRandomMockExam(excludeId?: string): Promise<AssessmentExam> {
  const bank = await getMockExamBank(),
    candidates = bank.filter(exam => exam.id !== excludeId)
  return (candidates.length ? candidates : bank)[Math.floor(Math.random() * (candidates.length || bank.length))]
}
