import { AnswerSheetSchema } from './schemas'
import type { AnswerSheet, AssessmentExam } from './model'
export const draftKey = (examId: string, userId = 'guest') => 'aepp-assessment-draft:' + userId + ':' + examId
export function readAssessmentDraft(exam: AssessmentExam, userId = 'guest', storage?: Pick<Storage,'getItem'|'removeItem'>): AnswerSheet {
 const key = draftKey(exam.id,userId)
 const clear = () => { try { storage?.removeItem(key) } catch { /* Ο browser μπορεί να μην επιτρέπει αποθήκευση. */ } }
 try {
  storage ??= globalThis.localStorage
  const raw = storage.getItem(key)
  if (raw === null) return {}
  if (raw.length > 1000000) { clear(); return {} }
  const decoded: unknown = JSON.parse(raw)
  const parsed = AnswerSheetSchema.safeParse(decoded)
  if (!parsed.success) { clear(); return {} }
  const questions = new Map(exam.sections.flatMap(section => section.questions).map(question => [question.id,question]))
  for (const [id,answer] of Object.entries(parsed.data)) {
   const question = questions.get(id)
   if (!question || question.kind === 'trace' && (!Array.isArray(answer) || answer.length !== question.rowLabels.length || answer.some(row => row.length !== question.columns.length)) || ['program','open','choice','fill'].includes(question.kind) && typeof answer !== 'string' || ['trueFalse','matching','codeBlanks'].includes(question.kind) && (!answer || typeof answer !== 'object' || Array.isArray(answer))) { clear(); return {} }
  }
  return parsed.data
 } catch { clear(); return {} }
}
