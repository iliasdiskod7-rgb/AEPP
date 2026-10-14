import type { AnswerSheet, AssessmentExam, AssessmentReport, ProgramCaseResult } from './model'
import type { AttemptDetail } from './attempts'
import { gradeAssessment, type ProgramRunner } from './grading'

export function localAttempt(exam: AssessmentExam, attemptId: string, studentName = 'Τοπική εξάσκηση'): AttemptDetail {
 return {attemptId,examId:exam.id,examTitle:exam.title,studentName,startedAt:new Date().toISOString(),submittedAt:null,autoGradeScore:0,finalScore:0,status:'IN_PROGRESS',version:0,exam,report:null,questionSubmissions:[],gradeRevisions:[]}
}
export async function prepareAssessment(exam: AssessmentExam, answers: AnswerSheet, run: ProgramRunner, local: boolean): Promise<AssessmentReport> {
 const report = await gradeAssessment(exam,answers,run)
 if(!local)for(const section of exam.sections)for(const question of section.questions) {
  if(question.kind!=='program'||question.gradingMode!=='review'||!question.previewCases?.length)continue
  const source=typeof answers[question.id]==='string'?answers[question.id] as string:''
  let cases: ProgramCaseResult[]
  try{cases=await run(source,question.previewCases)}catch(cause){throw new Error(cause instanceof Error?cause.message:'Δεν ολοκληρώθηκαν οι δοκιμές προγράμματος.')}
  const result=report.sections.flatMap(s=>s.questions).find(q=>q.questionId===question.id)!
  result.programCases=cases
 }
 return report
}
