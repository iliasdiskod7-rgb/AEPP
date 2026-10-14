import type { AnswerSheet, AssessmentExam, AssessmentReport } from './model'
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED_BY_TEACHER'
export interface GradeRevision { id: string; teacherId: string; teacherName: string; revisedScore: number; teacherComments: string; revisedAt: string; version: number }
export interface AttemptDetail { attemptId: string; examId: string; examTitle: string; studentName: string; startedAt: string; submittedAt: string | null; autoGradeScore: number; finalScore: number; status: AttemptStatus; version: number; exam: AssessmentExam; report: AssessmentReport | null; questionSubmissions: { questionId: string; studentAnswerJson: string; testResultsJson: string; autoPoints: number; maxPoints: number }[]; gradeRevisions: GradeRevision[] }
export interface AttemptSummary { id: string; examTitle: string; studentName: string; startedAt: string; submittedAt: string | null; autoGradeScore: number; finalScore: number; status: AttemptStatus; sections: { theme: string; autoPoints: number; maxPoints: number }[] }
export interface AttemptPage { items: AttemptSummary[]; total: number; page: number; pageSize: number }
export interface GradeRequest { revisedScore: number; teacherComments: string; expectedVersion: number }
export function buildAttemptSubmission(attemptId: string, exam: AssessmentExam, answers: AnswerSheet, report: AssessmentReport) {
  const results = new Map(report.sections.flatMap(section => section.questions).map(result => [result.questionId, result]))
  return { attemptId, questions: exam.sections.flatMap(section => section.questions.map(question => {
    const result = results.get(question.id)
    if (!result) throw new Error('Λείπει η διόρθωση ερωτήματος.')
    return { questionId: question.id, studentAnswerJson: JSON.stringify(answers[question.id] ?? ''), testResultsJson: JSON.stringify(result.programCases ?? []), autoPoints: result.earned, maxPoints: question.marks, feedback: result.feedback, studentAnswer: result.studentAnswer, astSummary: result.astSummary }
  })) }
}
