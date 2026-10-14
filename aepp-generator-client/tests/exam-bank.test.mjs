import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const bank = JSON.parse(await readFile(new URL('../../AeppGenerator/src/AeppGenerator.Infrastructure/ExamBank/pregenerated_exams.json', import.meta.url), 'utf8'))
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { runTestCases } = await server.ssrLoadModule('/src/assessment/execution.ts')
const { generatedToAssessment } = await server.ssrLoadModule('/src/assessment/generatedAdapter.ts')

test('τρία πλήρη πρότυπα: Α–Δ, λύσεις, 100 μονάδες και δοκιμές', () => {
  assert.equal(bank.schemaVersion, 1)
  assert.ok(bank.exams.length >= 3)
  assert.equal(new Set(bank.exams.map(e => e.id)).size, bank.exams.length)
  for (const { exam } of bank.exams) {
    assert.deepEqual(exam.sections.map(s => s.theme), ['Θέμα Α', 'Θέμα Β', 'Θέμα Γ', 'Θέμα Δ'])
    assert.equal(exam.sections.reduce((sum, s) => sum + s.totalMarks, 0), 100)
    for (const section of exam.sections) {
      assert.equal(section.questions.reduce((sum, q) => sum + q.marks, 0), section.totalMarks)
      for (const q of section.questions) {
        assert.ok(q.questionText && q.solutionText)
        if (section.theme === 'Θέμα Γ' || section.theme === 'Θέμα Δ') assert.ok(q.testCases.length >= 2)
      }
    }
  }
})
for (const entry of bank.exams) {
  for (const section of entry.exam.sections.filter(s => s.theme === 'Θέμα Γ' || s.theme === 'Θέμα Δ')) {
    for (const question of section.questions) test(entry.id + ' / ' + question.code + ': εκτέλεση όλων των δοκιμών λύσης', () => {
      const source = /```glossa\n([\s\S]*?)```/u.exec(question.solutionText)?.[1]
      assert.ok(source)
      const results = runTestCases(source, question.testCases)
      assert.ok(results.every(result => result.passed), JSON.stringify(results, null, 2))
    })
  }
}
test('οι δοκιμές της τράπεζας μεταφέρονται στη διαδραστική επίλυση', () => {
  const converted = generatedToAssessment(bank.exams[0].exam)
  const program = converted.sections[2].questions[0]
  assert.equal(program.kind, 'program')
  assert.deepEqual(program.testCases, bank.exams[0].exam.sections[2].questions[0].testCases)
})
