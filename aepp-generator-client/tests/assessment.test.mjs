import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { practiceExam, validateAssessmentExam } = await server.ssrLoadModule('/src/assessment/practiceExam.ts')
const { runTestCases } = await server.ssrLoadModule('/src/assessment/execution.ts')
const { applyTeacherScore, gradeAssessment } = await server.ssrLoadModule('/src/assessment/grading.ts')
const { generatedToAssessment } = await server.ssrLoadModule('/src/assessment/generatedAdapter.ts')
const programC = practiceExam.sections[2].questions[0]

test('το διαγώνισμα έχει 25 μόρια ανά θέμα και ο πίνακας καταλήγει στην ΕΞΟΔΟΣ', () => {
  assert.doesNotThrow(() => validateAssessmentExam(practiceExam))
  assert.deepEqual(practiceExam.sections.map(section => section.marks), [25, 25, 25, 25])
  assert.equal(practiceExam.sections[1].questions[1].columns.at(-1), 'ΕΞΟΔΟΣ')
})

test('η ενδεικτική λύση του Γ περνά τέσσερις δοκιμές, συμπεριλαμβανομένων μηδενικών και άκυρης εισόδου', () => {
  const results = runTestCases(programC.referenceCode, programC.testCases)
  assert.equal(results.length, 4)
  assert.ok(results.every(result => result.passed), JSON.stringify(results))
})

test('η αυτόματη βαθμολόγηση δίνει αναλυτικά μόρια και αφήνει το Δ σε εκκρεμότητα', async () => {
  const answers = {
    a1: Object.fromEntries(practiceExam.sections[0].questions[0].statements.map(item => [item.id, item.answer ? 'Σωστό' : 'Λάθος'])),
    a2: Object.fromEntries(practiceExam.sections[0].questions[1].pairs.map(item => [item.id, item.rightId])),
    a3: practiceExam.sections[0].questions[2].correctId,
    a4: 'καλεσε',
    b1: Object.fromEntries(practiceExam.sections[1].questions[0].blanks.map(item => [item.id, item.accepted[0]])),
    b2: practiceExam.sections[1].questions[1].expected,
    c1: programC.referenceCode,
    d1: practiceExam.sections[3].questions[0].referenceCode,
  }
  const report = await gradeAssessment(practiceExam, answers, async (source, cases) => runTestCases(source, cases))
  assert.equal(report.earned, 75)
  assert.equal(report.pending, 25)
  assert.equal(report.grade20, 15)
  assert.deepEqual(report.sections.map(section => section.earned), [25, 25, 25, 0])
  assert.equal(report.sections[2].questions[0].programCases.length, 4)
  const finalized = applyTeacherScore(report, 'd1', 18)
  assert.equal(finalized.earned, 93)
  assert.equal(finalized.pending, 0)
  assert.equal(finalized.grade20, 18.6)
  assert.equal(report.pending, 25)
  assert.throws(() => applyTeacherScore(finalized, 'd1', 30), /έγκυρο βαθμό/u)
})

test('λανθασμένες τιμές και κώδικας δεν λαμβάνουν πλήρη βαθμό', async () => {
  const report = await gradeAssessment(practiceExam, { a1: { 'a1-1': 'Λάθος' }, c1: 'ΠΡΟΓΡΑΜΜΑ Λ\nΑΡΧΗ' },
    async (source, cases) => runTestCases(source, cases))
  assert.ok(report.sections[0].questions[0].earned < 10)
  assert.equal(report.sections[2].questions[0].earned, 0)
  assert.equal(report.pending, 25)
})

test('η μερική βαθμολογία μοιράζεται σωστά σε προτάσεις, κενά και κελιά', async () => {
  const trace = practiceExam.sections[1].questions[1].expected.map(row => [...row])
  trace[1][4] = 'λάθος'
  const report = await gradeAssessment(practiceExam, {
    a1: { 'a1-1': 'Σωστό', 'a1-2': 'Λάθος', 'a1-3': 'Σωστό', 'a1-4': 'Σωστό', 'a1-5': 'Σωστό' },
    b1: { '1': '0', '2': '1', '3': 'ΤΟΤΕ', '4': '-', '5': 'ΓΡΑΨΕ' },
    b2: trace,
  }, async (source, cases) => runTestCases(source, cases))
  assert.equal(report.sections[0].questions[0].earned, 8)
  assert.equal(report.sections[1].questions[0].earned, 12)
  assert.equal(report.sections[1].questions[1].earned, 9)
})

test('παραγόμενο διαγώνισμα χωρίς δομημένο κλειδί παραμένει για έλεγχο καθηγητή', async () => {
  const generated = generatedToAssessment({ title: 'Δείγμα', durationMinutes: 180, sections: [
    { theme: 'Θέμα Α', totalMarks: 50, questions: [{ code: 'Α1', questionText: 'Ερώτηση', glowCodeSnippet: null, solutionText: 'Λύση', marks: 50 }] },
    { theme: 'Θέμα Γ', totalMarks: 50, questions: [{ code: 'Γ1', questionText: 'Πρόγραμμα', glowCodeSnippet: null, solutionText: 'Λύση', marks: 50 }] },
  ] })
  const report = await gradeAssessment(generated, { 'Θέμα Α-Α1': 'Απάντηση', 'Θέμα Γ-Γ1': 'Κώδικας' }, async () => { throw new Error('Δεν πρέπει να εκτελεστεί') })
  assert.equal(report.earned, 0)
  assert.equal(report.pending, 100)
})
