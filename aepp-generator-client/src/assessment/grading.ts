import { formatDiagnostic, toDiagnostic } from '../interpreter/diagnostics'
import { parseProgram } from '../interpreter/parser'
import type {
  AnswerValue,
  AssessmentQuestion,
  AssessmentReport,
  ProgramCaseResult,
  ProgramTestCase,
  QuestionResult,
  SectionResult,
} from './model'
import { AssessmentExamSchema, AnswerSheetSchema, ProgramCaseResultsSchema, parseBoundary } from './schemas'
import { evaluateStructure } from './structuralGrading'
import { matchesAcceptedAnswer, matchesBooleanAnswer } from './answerMatching'

export type ProgramRunner = (source: string, cases: ProgramTestCase[]) => Promise<ProgramCaseResult[]>
const round = (value: number) => Math.round(value * 100) / 100
const same = (left: string, right: string) => matchesAcceptedAnswer(left, [right])
const asMap = (answer: AnswerValue | undefined): Record<string, string> =>
  answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {}
const asText = (answer: AnswerValue | undefined) => (typeof answer === 'string' ? answer : '')
const asRows = (answer: AnswerValue | undefined): string[][] => (Array.isArray(answer) ? answer : [])
const points = (correct: number, total: number, max: number) => round((max * correct) / total)

function shortResult(
  question: AssessmentQuestion,
  itemResults: boolean[],
  studentAnswer: string,
  expectedAnswer: string,
): QuestionResult {
  const correct = itemResults.filter(Boolean).length
  const total = itemResults.length
  const earned = points(correct, total, question.marks)
  return {
    questionId: question.id,
    code: question.code,
    earned,
    max: question.marks,
    pending: 0,
    feedback: `${correct} από ${total} σωστά επιμέρους στοιχεία.`,
    studentAnswer,
    expectedAnswer,
    chapter: question.chapter,
    itemResults,
  }
}

async function gradeQuestion(
  question: AssessmentQuestion,
  answer: AnswerValue | undefined,
  runProgram: ProgramRunner,
): Promise<QuestionResult> {
  if (question.kind === 'trueFalse') {
    const values = asMap(answer)
    return shortResult(
      question,
      question.statements.map(item => matchesBooleanAnswer(values[item.id] ?? '', item.answer)),
      question.statements.map(item => `${item.id}: ${values[item.id] || '—'}`).join('\n'),
      question.solution,
    )
  }
  if (question.kind === 'matching') {
    const values = asMap(answer)
    return shortResult(
      question,
      question.pairs.map(pair => values[pair.id] === pair.rightId),
      question.pairs
        .map(pair => `${pair.left}: ${question.choices.find(choice => choice.id === values[pair.id])?.text ?? '—'}`)
        .join('\n'),
      question.solution,
    )
  }
  if (question.kind === 'choice') {
    const value = asText(answer)
    return shortResult(
      question,
      [value === question.correctId],
      question.options.find(option => option.id === value)?.text ?? '—',
      question.solution,
    )
  }
  if (question.kind === 'fill') {
    const value = asText(answer)
    return shortResult(
      question,
      [question.accepted.some(expected => same(value, expected))],
      value || '—',
      question.solution,
    )
  }
  if (question.kind === 'codeBlanks') {
    const values = asMap(answer)
    return shortResult(
      question,
      question.blanks.map(blank => blank.accepted.some(expected => same(values[blank.id] ?? '', expected))),
      question.blanks.map(blank => `(${blank.id}) ${values[blank.id] || '—'}`).join('\n'),
      question.solution,
    )
  }
  if (question.kind === 'trace') {
    const rows = asRows(answer)
    // Ένα αποτέλεσμα ανά κελί, γραμμή προς γραμμή.
    const cells = question.expected.flatMap((row, rowIndex) =>
      row.map((cell, columnIndex) => same(rows[rowIndex]?.[columnIndex] ?? '', cell)),
    )
    const display = (values: string[][]) =>
      `| ${question.columns.join(' | ')} |\n| ${question.columns.map(() => '---').join(' | ')} |\n${values.map(row => `| ${row.map(cell => cell || '—').join(' | ')} |`).join('\n')}`
    return shortResult(
      question,
      cells,
      display(rows.length ? rows : question.expected.map(row => row.map(() => ''))),
      display(question.expected),
    )
  }
  if (question.kind === 'open') {
    const value = asText(answer)
    return {
      questionId: question.id,
      code: question.code,
      earned: 0,
      pending: question.marks,
      max: question.marks,
      feedback: 'Η απάντηση δεν βαθμολογείται αυτόματα. Σύγκρινέ τη με την ενδεικτική λύση.',
      studentAnswer: value || 'Δεν δόθηκε απάντηση.',
      expectedAnswer: question.solution,
      chapter: question.chapter,
    }
  }
  const source = asText(answer)
  if (question.gradingMode === 'review')
    return {
      questionId: question.id,
      code: question.code,
      earned: 0,
      pending: question.marks,
      max: question.marks,
      feedback:
        'Δεν υπάρχουν δομημένες δοκιμές και κριτήρια για αυτό το θέμα. Σύγκρινε την απάντησή σου με την ενδεικτική λύση.',
      studentAnswer: source || 'Δεν δόθηκε πρόγραμμα.',
      expectedAnswer: question.solution,
      chapter: question.chapter,
      studentCode: source,
      referenceCode: question.referenceCode,
    }
  if (!source.trim())
    return {
      questionId: question.id,
      code: question.code,
      earned: 0,
      pending: 0,
      max: question.marks,
      feedback: 'Δεν δόθηκε πρόγραμμα.',
      studentAnswer: 'Δεν δόθηκε πρόγραμμα.',
      expectedAnswer: question.solution,
      chapter: question.chapter,
      studentCode: '',
      referenceCode: question.referenceCode,
    }
  return evaluateCodeSubmission(question, source, runProgram)
}

export async function evaluateCodeSubmission(
  question: Extract<AssessmentQuestion, { kind: 'program' }>,
  source: string,
  runProgram: ProgramRunner,
): Promise<QuestionResult> {
  const base = {
    questionId: question.id,
    code: question.code,
    max: question.marks,
    pending: 0,
    studentAnswer: source || 'Δεν δόθηκε πρόγραμμα.',
    expectedAnswer: question.solution,
    chapter: question.chapter,
    studentCode: source,
    referenceCode: question.referenceCode,
  }
  if (question.gradingMode === 'review')
    return {
      ...base,
      earned: 0,
      pending: question.marks,
      feedback: 'Δεν υπάρχει αυτόματη αξιολόγηση. Σύγκρινε την απάντησή σου με την ενδεικτική λύση.',
    }
  if (!source.trim()) return { ...base, earned: 0, feedback: 'Δεν δόθηκε πρόγραμμα.' }
  let program
  try {
    program = parseProgram(source)
  } catch (cause) {
    return { ...base, earned: 0, feedback: formatDiagnostic(toDiagnostic(cause, 'syntax')) }
  }
  let cases: ProgramCaseResult[] = []
  const strategy = question.evaluationStrategy ?? (/^(?:Β|B)2$/u.test(question.code) ? 'functional' : 'hybrid')
  let tests = question.testCases
  const validateCases = (values: unknown, expected: ProgramTestCase[]) => {
    const results = parseBoundary(ProgramCaseResultsSchema, values)
    const ids = new Set(expected.map(test => test.id))
    if (
      results.length !== expected.length ||
      new Set(results.map(test => test.id)).size !== results.length ||
      results.some(test => !ids.has(test.id))
    )
      throw new Error('Μη έγκυρα ή ελλιπή αποτελέσματα δοκιμών.')
    return results
  }
  try {
    if (strategy === 'functional') {
      if (tests.length !== 2 || !question.referenceCode.trim())
        throw new Error('Η λειτουργική ισοδυναμία απαιτεί δύο εισόδους και πρότυπο πρόγραμμα.')
      const reference = validateCases(await runProgram(question.referenceCode, tests), tests)
      if (reference.some(test => test.error))
        return {
          ...base,
          earned: 0,
          pending: question.marks,
          feedback: 'Δεν ολοκληρώθηκε η πρότυπη λύση. Απαιτείται έλεγχος του θέματος.',
        }
      tests = tests.map(test => ({ ...test, expectedOutput: reference.find(result => result.id === test.id)!.actual }))
    }
    cases = validateCases(await runProgram(source, tests), tests)
  } catch (cause) {
    return { ...base, earned: 0, feedback: cause instanceof Error ? cause.message : 'Η εκτέλεση δεν ολοκληρώθηκε.' }
  }
  const structure = evaluateStructure(program, cases, question.rubric)
  const passed = cases.filter(test => test.passed && !test.error).length
  const functional = tests.length ? passed / tests.length : 0
  const executionMax = round(question.marks * (strategy === 'functional' ? 1 : 0.6))
  const structuralMax = round(question.marks - executionMax)
  const executionScore = round(executionMax * functional)
  const structuralScore = round(structuralMax * structure.ratio)
  const earned = round(executionScore + structuralScore)
  const labels: Record<string, string> = {
    hasValidDeclarations: 'Έγκυρες δηλώσεις',
    hasValidationLoop: 'Βρόχος ελέγχου εγκυρότητας',
    hasNestedLoops: 'Εμφωλευμένοι βρόχοι',
    hasSubprogramCall: 'Κλήση υποπρογράμματος',
  }
  const failed = cases
    .filter(test => !test.passed || test.error)
    .map(
      test =>
        test.id +
        (tests.find(value => value.id === test.id)?.description
          ? ' (' + tests.find(value => value.id === test.id)!.description + ')'
          : ''),
    )
  const feedback =
    passed +
    '/' +
    tests.length +
    ' δοκιμές επιτυχείς. Λειτουργικότητα: ' +
    executionScore +
    '/' +
    executionMax +
    '. Δομή: ' +
    structuralScore +
    '/' +
    structuralMax +
    '. ' +
    (strategy === 'functional'
      ? 'Σύγκριση εξόδου με την πρότυπη λύση.'
      : structure.results
          .map(
            result => (labels[result.kind] ?? result.kind) + ': ' + (result.met ? 'εντοπίστηκε' : 'δεν τεκμηριώθηκε'),
          )
          .join(', ')) +
    (failed.length ? ' Απέτυχαν οι δοκιμές: ' + failed.join(', ') + '.' : '')
  const errorFeedback = cases.some(test => test.error)
    ? 'Λάθος κατά την εκτέλεση: Μία ή περισσότερες δοκιμές δεν ολοκληρώθηκαν. '
    : cases.some(test => !test.passed)
      ? 'Λογικό λάθος: Τα αποτελέσματα διαφέρουν από τα αναμενόμενα στις δοκιμές. '
      : ''
  return {
    ...base,
    earned,
    feedback: errorFeedback + feedback,
    programCases: cases,
    astSummary: structure.astSummary,
    grading: {
      strategy,
      executionScore,
      executionMax,
      structuralScore,
      structuralMax,
      testCasesPassed: passed,
      testCasesTotal: tests.length,
      structuralChecks: strategy === 'functional' ? [] : structure.results,
    },
  }
}

function summarize(title: string, sections: SectionResult[]): AssessmentReport {
  const earned = round(sections.reduce((sum, section) => sum + section.earned, 0))
  const pending = round(sections.reduce((sum, section) => sum + section.pending, 0))
  const weak = sections.flatMap(section =>
    section.questions.filter(question => !question.pending && question.earned < question.max * 0.7),
  )
  const recommendations = [...new Set(weak.map(question => question.chapter))].map(
    chapter => `Επανάλαβε την ενότητα «${chapter}» και ξαναδοκίμασε τις αντίστοιχες ασκήσεις.`,
  )
  if (pending) recommendations.push('Σύγκρινε τις απαντήσεις χωρίς αυτόματη αξιολόγηση με τις ενδεικτικές λύσεις.')
  if (!recommendations.length)
    recommendations.push(
      'Πολύ καλή επίδοση. Έλεγξε ξανά τα οριακά δεδομένα εισόδου και τις ισοβαθμίες στις ασκήσεις προγραμματισμού.',
    )
  return { title, earned, pending, max: 100, grade20: round(earned / 5), sections, recommendations }
}

export async function gradeAssessment(
  examInput: unknown,
  answerInput: unknown,
  runProgram: ProgramRunner,
): Promise<AssessmentReport> {
  const exam = parseBoundary(AssessmentExamSchema, examInput)
  const answers = parseBoundary(AnswerSheetSchema, answerInput)
  const sections: SectionResult[] = []
  for (const section of exam.sections) {
    const questions = []
    for (const question of section.questions)
      questions.push(await gradeQuestion(question, answers[question.id], runProgram))
    sections.push({
      theme: section.theme,
      max: section.marks,
      earned: round(questions.reduce((sum, result) => sum + result.earned, 0)),
      pending: round(questions.reduce((sum, result) => sum + result.pending, 0)),
      questions,
    })
  }
  return summarize(exam.title, sections)
}

export function applyTeacherScore(report: AssessmentReport, questionId: string, score: number): AssessmentReport {
  const target = report.sections
    .flatMap(section => section.questions)
    .find(question => question.questionId === questionId)
  if (!target?.pending || !Number.isFinite(score) || score < 0 || score > target.max)
    throw new Error('Δώσε έγκυρο βαθμό για ερώτημα που εκκρεμεί.')
  const sections = report.sections.map(section => {
    const questions = section.questions.map(question =>
      question.questionId === questionId
        ? {
            ...question,
            earned: round(score),
            pending: 0,
            feedback: `${question.feedback} Βαθμός καθηγητή: ${round(score)}/${question.max}.`,
          }
        : question,
    )
    return {
      ...section,
      questions,
      earned: round(questions.reduce((sum, question) => sum + question.earned, 0)),
      pending: round(questions.reduce((sum, question) => sum + question.pending, 0)),
    }
  })
  return summarize(report.title, sections)
}
