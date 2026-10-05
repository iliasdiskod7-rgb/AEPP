import { parseProgram } from '../interpreter/parser'
import { normalize, type Statement } from '../interpreter/types'
import type { AnswerSheet, AnswerValue, AssessmentExam, AssessmentQuestion, AssessmentReport, ProgramCaseResult, ProgramTestCase, QuestionResult, SectionResult } from './model'
import { validateAssessmentExam } from './practiceExam'

export type ProgramRunner = (source: string, cases: ProgramTestCase[]) => Promise<ProgramCaseResult[]>
const round = (value: number) => Math.round(value * 100) / 100
const same = (left: string, right: string) => normalize(left).replace(/\s+/gu, '') === normalize(right).replace(/\s+/gu, '')
const asMap = (answer: AnswerValue | undefined): Record<string, string> => answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
const asText = (answer: AnswerValue | undefined) => typeof answer === 'string' ? answer : ''
const asRows = (answer: AnswerValue | undefined): string[][] => Array.isArray(answer) ? answer : []
const points = (correct: number, total: number, max: number) => round(max * correct / total)

function structureScore(source: string, rubric: Extract<AssessmentQuestion, { kind: 'program' }>['rubric']): { marks: number; note: string; astSummary: string } {
  try {
    const program = parseProgram(source)
    const found = new Set<Statement['kind']>()
    const visit = (statements: Statement[]) => {
      for (const statement of statements) {
        found.add(statement.kind)
        if (statement.kind === 'if') { statement.branches.forEach(branch => visit(branch.body)); visit(statement.otherwise) }
        else if ('body' in statement) visit(statement.body)
      }
    }
    visit(program.body)
    const marks = rubric.reduce((sum, criterion) => sum + (found.has(criterion.kind) ? criterion.points : 0), 0)
    return { marks, note: `Δομικά κριτήρια από το συντακτικό δέντρο: ${marks}/${rubric.reduce((sum, item) => sum + item.points, 0)}.`, astSummary: [...found].join(', ') }
  } catch (cause) {
    return { marks: 0, note: `Δεν ολοκληρώθηκε η συντακτική ανάλυση: ${cause instanceof Error ? cause.message : 'άγνωστο σφάλμα'}`, astSummary: '' }
  }
}

function shortResult(question: AssessmentQuestion, correct: number, total: number, studentAnswer: string, expectedAnswer: string): QuestionResult {
  const earned = points(correct, total, question.marks)
  return { questionId: question.id, code: question.code, earned, max: question.marks, pending: 0,
    feedback: `${correct} από ${total} σωστά επιμέρους στοιχεία.`, studentAnswer, expectedAnswer, chapter: question.chapter }
}

async function gradeQuestion(question: AssessmentQuestion, answer: AnswerValue | undefined, runProgram: ProgramRunner): Promise<QuestionResult> {
  if (question.kind === 'trueFalse') {
    const values = asMap(answer)
    const correct = question.statements.filter(item => values[item.id] === (item.answer ? 'Σωστό' : 'Λάθος')).length
    return shortResult(question, correct, question.statements.length,
      question.statements.map(item => `${item.id}: ${values[item.id] || '—'}`).join('\n'), question.solution)
  }
  if (question.kind === 'matching') {
    const values = asMap(answer)
    const correct = question.pairs.filter(pair => values[pair.id] === pair.rightId).length
    return shortResult(question, correct, question.pairs.length,
      question.pairs.map(pair => `${pair.left}: ${question.choices.find(choice => choice.id === values[pair.id])?.text ?? '—'}`).join('\n'), question.solution)
  }
  if (question.kind === 'choice') {
    const value = asText(answer)
    return shortResult(question, Number(value === question.correctId), 1,
      question.options.find(option => option.id === value)?.text ?? '—', question.solution)
  }
  if (question.kind === 'fill') {
    const value = asText(answer)
    return shortResult(question, Number(question.accepted.some(expected => same(value, expected))), 1, value || '—', question.solution)
  }
  if (question.kind === 'codeBlanks') {
    const values = asMap(answer)
    const correct = question.blanks.filter(blank => blank.accepted.some(expected => same(values[blank.id] ?? '', expected))).length
    return shortResult(question, correct, question.blanks.length,
      question.blanks.map(blank => `(${blank.id}) ${values[blank.id] || '—'}`).join('\n'), question.solution)
  }
  if (question.kind === 'trace') {
    const rows = asRows(answer)
    const expected = question.expected.flat()
    const correct = question.expected.reduce((sum, row, rowIndex) => sum + row.filter((cell, columnIndex) => same(rows[rowIndex]?.[columnIndex] ?? '', cell)).length, 0)
    const display = (values: string[][]) => `| ${question.columns.join(' | ')} |\n| ${question.columns.map(() => '---').join(' | ')} |\n${values.map(row => `| ${row.map(cell => cell || '—').join(' | ')} |`).join('\n')}`
    return shortResult(question, correct, expected.length, display(rows.length ? rows : question.expected.map(row => row.map(() => ''))), display(question.expected))
  }
  if (question.kind === 'open') {
    const value = asText(answer)
    return { questionId: question.id, code: question.code, earned: 0, pending: question.marks, max: question.marks,
      feedback: 'Η απάντηση χρειάζεται αξιολόγηση από καθηγητή.', studentAnswer: value || 'Δεν δόθηκε απάντηση.', expectedAnswer: question.solution, chapter: question.chapter }
  }
  const source = asText(answer)
  if (question.gradingMode === 'review') return {
    questionId: question.id, code: question.code, earned: 0, pending: question.marks, max: question.marks,
    feedback: 'Η τρέχουσα έκδοση του διερμηνευτή δεν εκτελεί πίνακες και υποπρογράμματα. Η βαθμολόγηση μένει σε εκκρεμότητα για τον καθηγητή.',
    studentAnswer: source || 'Δεν δόθηκε πρόγραμμα.', expectedAnswer: question.solution, chapter: question.chapter,
    studentCode: source, referenceCode: question.referenceCode,
  }
  if (!source.trim()) return { questionId: question.id, code: question.code, earned: 0, pending: 0, max: question.marks,
    feedback: 'Δεν δόθηκε πρόγραμμα.', studentAnswer: 'Δεν δόθηκε πρόγραμμα.', expectedAnswer: question.solution, chapter: question.chapter,
    studentCode: '', referenceCode: question.referenceCode }
  const structure = structureScore(source, question.rubric)
  let cases: ProgramCaseResult[] = []
  let executionError = ''
  try { cases = await runProgram(source, question.testCases) }
  catch (cause) { executionError = cause instanceof Error ? cause.message : 'Η εκτέλεση δεν ολοκληρώθηκε.' }
  const passed = cases.filter(test => test.passed).length
  const structureMaximum = question.rubric.reduce((sum, item) => sum + item.points, 0)
  const testMaximum = question.marks - structureMaximum
  const earned = executionError ? round(structure.marks) : round(points(passed, question.testCases.length, testMaximum) + structure.marks)
  const firstFailure = cases.find(test => !test.passed)
  const feedback = `${passed}/${question.testCases.length} δοκιμές επιτυχείς. ${structure.note}` +
    (executionError ? ` ${executionError}` : firstFailure?.error ? ` ${firstFailure.error}` : '')
  return { questionId: question.id, code: question.code, earned, pending: 0, max: question.marks,
    feedback, studentAnswer: source, expectedAnswer: question.solution, chapter: question.chapter,
    programCases: cases, studentCode: source, referenceCode: question.referenceCode, astSummary: structure.astSummary }
}

function summarize(title: string, sections: SectionResult[]): AssessmentReport {
  const earned = round(sections.reduce((sum, section) => sum + section.earned, 0))
  const pending = round(sections.reduce((sum, section) => sum + section.pending, 0))
  const weak = sections.flatMap(section => section.questions.filter(question => !question.pending && question.earned < question.max * .7))
  const recommendations = [...new Set(weak.map(question => question.chapter))].map(chapter =>
    `Επανάλαβε την ενότητα «${chapter}» και ξαναδοκίμασε τις αντίστοιχες ασκήσεις.`)
  if (pending) recommendations.push('Ζήτησε από τον καθηγητή να ελέγξει τα ερωτήματα που εκκρεμούν πριν θεωρήσεις τη βαθμολογία οριστική.')
  if (!recommendations.length) recommendations.push('Πολύ καλή επίδοση. Έλεγξε ξανά τα οριακά δεδομένα εισόδου και τις ισοβαθμίες στις ασκήσεις προγραμματισμού.')
  return { title, earned, pending, max: 100, grade20: round(earned / 5), sections, recommendations }
}

export async function gradeAssessment(exam: AssessmentExam, answers: AnswerSheet, runProgram: ProgramRunner): Promise<AssessmentReport> {
  validateAssessmentExam(exam)
  const sections: SectionResult[] = []
  for (const section of exam.sections) {
    const questions = []
    for (const question of section.questions) questions.push(await gradeQuestion(question, answers[question.id], runProgram))
    sections.push({ theme: section.theme, max: section.marks, earned: round(questions.reduce((sum, result) => sum + result.earned, 0)),
      pending: round(questions.reduce((sum, result) => sum + result.pending, 0)), questions })
  }
  return summarize(exam.title, sections)
}

export function applyTeacherScore(report: AssessmentReport, questionId: string, score: number): AssessmentReport {
  const target = report.sections.flatMap(section => section.questions).find(question => question.questionId === questionId)
  if (!target?.pending || !Number.isFinite(score) || score < 0 || score > target.max)
    throw new Error('Δώσε έγκυρο βαθμό για ερώτημα που εκκρεμεί.')
  const sections = report.sections.map(section => {
    const questions = section.questions.map(question => question.questionId === questionId
      ? { ...question, earned: round(score), pending: 0, feedback: `${question.feedback} Βαθμός καθηγητή: ${round(score)}/${question.max}.` }
      : question)
    return { ...section, questions, earned: round(questions.reduce((sum, question) => sum + question.earned, 0)),
      pending: round(questions.reduce((sum, question) => sum + question.pending, 0)) }
  })
  return summarize(report.title, sections)
}
