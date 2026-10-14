import { z } from 'zod'
import type { AnswerSheet, AssessmentExam, AssessmentReport, AssessmentInsight } from './model'
import type { AttemptDetail, AttemptPage } from './attempts'
import { FuzzSpecificationSchema } from './fuzzSpecification'
const text = z.string().max(100000)
const id = z.string().min(1).max(200).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value))
const marks = z.number().finite().positive().max(100)
const score = z.number().finite().min(0).max(100)
export const ThemeSchema = z.enum(['Θέμα Α', 'Θέμα Β', 'Θέμα Γ', 'Θέμα Δ'])
export const ProgramTestCaseSchema = z.object({ id, inputs: z.array(text).max(1000), expectedOutput: z.array(text).max(1000) })
export const ExecutionMetricsSchema = z.object({ comparisonsCount: z.number().int().nonnegative(), assignmentsCount: z.number().int().nonnegative(), loopIterations: z.number().int().nonnegative() })
export const ProgramCaseResultSchema = z.object({ id, passed: z.boolean(), actual: z.array(text).max(1000), error: text.optional(), executedLines: z.array(z.number().int().positive()).max(10000).optional(), executedSubprograms: z.array(id).max(1000).optional(), metrics: ExecutionMetricsSchema.optional() })
export const ProgramCaseResultsSchema = z.array(ProgramCaseResultSchema).max(50)
export const ExecutionResultSchema = z.object({ output: z.array(text).max(1000), inputsUsed: z.number().int().nonnegative(), error: text.optional(), executedLines: z.array(z.number().int().positive()).max(10000).optional(), executedSubprograms: z.array(id).max(1000).optional(), inputNames: z.array(text).max(1000).optional(), metrics: ExecutionMetricsSchema })
export const CounterExampleReportSchema = z.object({
  testedCases: z.number().int().nonnegative(),
  skippedCases:z.number().int().nonnegative().optional(),specificationApplied:z.boolean().optional(),
  counterExample: z.object({
    inputs: z.array(text).max(1000), inputDescription: text, expectedOutput: z.array(text).max(1000),
    actualOutput: z.array(text).max(1000), studentError: text.optional(), metrics: ExecutionMetricsSchema,
  }).nullable(),
})
export const RubricCriterionSchema = z.object({ kind: z.enum(['assign','read','write','if','select','while','repeat','for','procedureCall','functionCall','arrayAccess','arrayWrite','accumulation','subprogramParameters']), points: marks, subprogram: id.optional(), variableName: id.optional(), arrayName: id.optional(), parameters: z.array(z.object({ name: id.optional(), type: z.enum(['integer','real','boolean','string']), dimensions: z.array(z.number().int().positive()).min(1).max(2).optional() })).max(30).optional() })
const base = { id, code: id, title: text, prompt: text, marks, chapter: text, solution: text }
const item = z.object({ id, text })
export const AssessmentQuestionSchema = z.discriminatedUnion('kind', [
 z.object({ ...base, kind: z.literal('trueFalse'), statements: z.array(item.extend({ answer: z.boolean() })).min(1).max(100) }),
 z.object({ ...base, kind: z.literal('matching'), pairs: z.array(z.object({ id, left: text, rightId: id })).min(1).max(100), choices: z.array(item).min(1).max(100) }),
 z.object({ ...base, kind: z.literal('choice'), options: z.array(item).min(1).max(100), correctId: id }),
 z.object({ ...base, kind: z.literal('fill'), accepted: z.array(text).min(1).max(100) }),
 z.object({ ...base, kind: z.literal('codeBlanks'), template: text, blanks: z.array(z.object({ id, accepted: z.array(text).min(1).max(100) })).min(1).max(100) }),
 z.object({ ...base, kind: z.literal('trace'), columns: z.array(id).min(1).max(100), rowLabels: z.array(text).min(1).max(1000), expected: z.array(z.array(text).min(1).max(100)).min(1).max(1000) }),
 z.object({ ...base, kind: z.literal('program'), referenceCode: text, gradingMode: z.enum(['runtime','review']), testCases: z.array(ProgramTestCaseSchema).max(50), previewCases:z.array(ProgramTestCaseSchema).max(5).optional(), rubric: z.array(RubricCriterionSchema).max(50),fuzzSpecification:FuzzSpecificationSchema.optional() }),
 z.object({ ...base, kind: z.literal('open') }),
]).superRefine((question, context) => {
 const fail = (message: string) => context.addIssue({ code: 'custom', message })
 if (question.kind === 'trace' && (question.expected.length !== question.rowLabels.length || question.columns.at(-1) !== 'ΕΞΟΔΟΣ' || question.expected.some(row => row.length !== question.columns.length))) fail('Μη έγκυρες διαστάσεις πίνακα τιμών.')
 if (question.kind === 'choice' && !question.options.some(option => option.id === question.correctId)) fail('Λείπει η σωστή επιλογή.')
 if (question.kind === 'matching' && question.pairs.some(pair => !question.choices.some(choice => choice.id === pair.rightId))) fail('Μη έγκυρο κλειδί αντιστοίχισης.')
 if (question.kind === 'program' && question.gradingMode === 'runtime' && (question.testCases.length < 3 || question.testCases.length > 5 || !question.rubric.length)) fail('Απαιτούνται 3–5 δοκιμές και δομικά κριτήρια.')
 const collections = question.kind === 'program' ? [question.testCases] : question.kind === 'matching' ? [question.pairs, question.choices] : question.kind === 'choice' ? [question.options] : question.kind === 'trueFalse' ? [question.statements] : question.kind === 'codeBlanks' ? [question.blanks] : []
 if (collections.some(items => new Set(items.map(value => value.id)).size !== items.length)) fail('Διπλό αναγνωριστικό στοιχείου.')
})
export const AssessmentExamSchema: z.ZodType<AssessmentExam> = z.object({ id, title: text, durationMinutes: z.number().int().min(1).max(480), source: z.enum(['practice','generated']), sections: z.array(z.object({ theme: ThemeSchema, marks, questions: z.array(AssessmentQuestionSchema).min(1).max(50) })).min(1).max(4) }).superRefine((exam, context) => {
 const themes = ['Θέμα Α','Θέμα Β','Θέμα Γ','Θέμα Δ']
 const ids = exam.sections.flatMap(section => section.questions.map(question => question.id))
 if (new Set(ids).size !== ids.length || new Set(exam.sections.map(section=>section.theme)).size !== exam.sections.length || Math.abs(exam.sections.reduce((sum,section)=>sum+section.marks,0)-100)>0.000001 || exam.sections.some((section,index) => (index > 0 && themes.indexOf(section.theme) <= themes.indexOf(exam.sections[index-1].theme)) || Math.abs(section.questions.reduce((sum,question) => sum + question.marks,0)-section.marks)>0.000001)) context.addIssue({ code: 'custom', message: 'Απαιτούνται μοναδικά, ταξινομημένα θέματα και συνεπής κατανομή 100 μονάδων.' })
})
export const RandomExamResponseSchema = z.object({ examId: id, title: text, exam: AssessmentExamSchema, hiddenTestCases: z.number().int().nonnegative() })
export const AnswerValueSchema = z.union([text, z.record(id,text), z.array(z.array(text).max(100)).max(1000)])
export const AnswerSheetSchema: z.ZodType<AnswerSheet> = z.record(id, AnswerValueSchema.optional()).refine(value => Object.keys(value).length <= 200)
const result = z.object({ questionId: id, code: id, earned: score, max: marks, pending: score, feedback: text, studentAnswer: text, expectedAnswer: text, chapter: text, programCases: ProgramCaseResultsSchema.optional(), referenceCode: text.optional(), studentCode: text.optional(), astSummary: text.optional() }).refine(value => value.earned + value.pending <= value.max + 0.01)
export const AssessmentReportSchema: z.ZodType<AssessmentReport> = z.object({ title: text, earned: score, pending: score, max: z.literal(100), grade20: z.number().finite().min(0).max(20), sections: z.array(z.object({ theme: ThemeSchema, earned: score, pending: score, max: marks, questions: z.array(result).min(1).max(50) })).min(1).max(4), recommendations: z.array(text).max(100) }).superRefine((report,context) => {
 if (Math.abs(report.grade20-report.earned/5)>0.011 || new Set(report.sections.map(section=>section.theme)).size!==report.sections.length || report.sections.some(section=>Math.abs(section.questions.reduce((sum,q)=>sum+q.max,0)-section.max)>0.01 || section.earned+section.pending>section.max+0.01) || report.earned + report.pending > 100.01 || report.sections.some(section => Math.abs(section.questions.reduce((sum,q)=>sum+q.earned,0)-section.earned) > 0.01 || Math.abs(section.questions.reduce((sum,q)=>sum+q.pending,0)-section.pending) > 0.01) || Math.abs(report.sections.reduce((sum,s)=>sum+s.earned,0)-report.earned) > 0.01 || Math.abs(report.sections.reduce((sum,s)=>sum+s.pending,0)-report.pending) > 0.01) context.addIssue({code:'custom',message:'Μη συνεπής αναφορά βαθμολογίας.'})
})
export const AssessmentInsightSchema: z.ZodType<AssessmentInsight> = z.object({ summary: text, recommendations: z.array(text).max(100), partialCreditSuggestions: z.array(z.object({ code: id, points: score, reason: text })).max(200) })
const status = z.enum(['IN_PROGRESS','SUBMITTED','GRADED_BY_TEACHER'])
const timestamp = z.iso.datetime({ offset: true })
const revision = z.object({ id: z.uuid(), teacherId: id, teacherName: text, revisedScore: score, teacherComments: z.string().min(1).max(5000), revisedAt: timestamp, version: z.number().int().positive() })
export const AttemptDetailSchema: z.ZodType<AttemptDetail> = z.object({ attemptId: z.uuid(), examId: id, examTitle: text, studentName: text, startedAt: timestamp, submittedAt: timestamp.nullable(), autoGradeScore: score, finalScore: score, status, version: z.number().int().nonnegative(), exam: AssessmentExamSchema, report: AssessmentReportSchema.nullable(), questionSubmissions: z.array(z.object({ questionId: id, studentAnswerJson: text, testResultsJson: z.string().max(200000), autoPoints: score, maxPoints: marks })).max(200), gradeRevisions: z.array(revision).max(1000) }).superRefine((attempt,context) => {
 const fail = (message: string) => context.addIssue({code:'custom',message})
 if (attempt.examId !== attempt.exam.id || (attempt.status === 'IN_PROGRESS' ? attempt.submittedAt !== null || attempt.report !== null : attempt.submittedAt === null || attempt.report === null) || attempt.status === 'GRADED_BY_TEACHER' && !attempt.gradeRevisions.length) fail('Μη έγκυρη κατάσταση προσπάθειας.')
 const questions = new Map(attempt.exam.sections.flatMap(section=>section.questions).map(question=>[question.id,question]))
 if(attempt.report){
  const graded = attempt.report.sections.flatMap(section=>section.questions)
  if(graded.length!==questions.size || new Set(graded.map(result=>result.questionId)).size!==graded.length || graded.some(result=>questions.get(result.questionId)?.marks!==result.max) || attempt.report.sections.some(section=>attempt.exam.sections.find(value=>value.theme===section.theme)?.marks!==section.max)) fail('Η αναφορά δεν αντιστοιχεί στο διαγώνισμα.')
 }
 if(new Set(attempt.questionSubmissions.map(value=>value.questionId)).size!==attempt.questionSubmissions.length)fail('Διπλή υποβολή ερωτήματος.')
 for(const submission of attempt.questionSubmissions){
  if(questions.get(submission.questionId)?.marks!==submission.maxPoints || submission.autoPoints>submission.maxPoints)fail('Μη έγκυρα μόρια υποβολής.')
  try { if(!AnswerValueSchema.nullable().safeParse(JSON.parse(submission.studentAnswerJson)).success || !ProgramCaseResultsSchema.safeParse(JSON.parse(submission.testResultsJson)).success)fail('Μη έγκυρη αποθηκευμένη απάντηση.') } catch { fail('Μη έγκυρο JSON υποβολής.') }
 }
})
export const AttemptPageSchema: z.ZodType<AttemptPage> = z.object({ items: z.array(z.object({ id: z.uuid(), examTitle: text, studentName: text, startedAt: timestamp, submittedAt: timestamp.nullable(), autoGradeScore: score, finalScore: score, status, sections: z.array(z.object({ theme: ThemeSchema, autoPoints: score, maxPoints: marks })).max(4) })).max(50), total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().min(1).max(50) })
export const WorkerEnvelopeSchema = z.object({ id: z.number().int().positive(), result: z.unknown().optional(),error:z.string().max(2000).optional() })
export function parseBoundary<T>(schema: z.ZodType<T>, value: unknown): T {
 const parsed = schema.safeParse(value)
 if (!parsed.success) throw new Error('Τα δεδομένα αξιολόγησης δεν είναι έγκυρα. Δοκίμασε ξανά.')
 return parsed.data
}
