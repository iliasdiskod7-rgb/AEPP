import { AssessmentExamSchema } from './schemas'
import type { AssessmentExam } from './model'
import exam from './practice-exam-public.json'

/** Public fallback only; answer keys and hidden tests stay server-side. */
export const practiceExam = AssessmentExamSchema.parse(exam)

export function validateAssessmentExam(exam: AssessmentExam): void {
  const ids = new Set<string>()
  if (!exam.sections.length || exam.sections.reduce((sum, section) => sum + section.marks, 0) !== 100)
    throw new Error('Το διαγώνισμα πρέπει να έχει συνολικά 100 μονάδες.')
  for (const section of exam.sections) {
    if (section.marks <= 0 || !section.questions.length) throw new Error(`Το ${section.theme} δεν έχει έγκυρα ερωτήματα.`)
    if (section.questions.reduce((sum, question) => sum + question.marks, 0) !== section.marks)
      throw new Error(`Οι μονάδες του ${section.theme} δεν αθροίζονται σωστά.`)
    for (const question of section.questions) {
      if (ids.has(question.id)) throw new Error(`Διπλό αναγνωριστικό: ${question.id}`)
      ids.add(question.id)
      if (question.marks <= 0) throw new Error(`Μη έγκυρες μονάδες στο ${question.code}.`)
      if (question.kind === 'trace' && (question.columns.at(-1) !== 'ΕΞΟΔΟΣ' || question.expected.some(row => row.length !== question.columns.length)))
        throw new Error(`Λανθασμένος Πίνακας Τιμών στο ${question.code}.`)
      if (question.kind === 'program' && question.gradingMode === 'runtime' &&
          (question.testCases.length < 3 || question.testCases.length > 5 ||
            question.rubric.reduce((sum, criterion) => sum + criterion.points, 0) > question.marks))
        throw new Error(`Λανθασμένα κριτήρια εκτέλεσης στο ${question.code}.`)
    }
  }
}
