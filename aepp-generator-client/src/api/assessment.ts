import { apiClient } from './client'
import type { AssessmentInsight, AssessmentReport } from '../assessment/model'

export async function generateAssessmentInsight(report: AssessmentReport): Promise<AssessmentInsight> {
  const items = report.sections.flatMap(section => section.questions.map(result => {
    return {
      code: result.code, chapter: result.chapter, earned: result.earned, max: result.max,
      feedback: result.feedback, studentCode: result.studentCode ?? null,
      referenceCode: result.referenceCode || null, astSummary: result.astSummary || null,
    }
  }))
  const { data } = await apiClient.post<AssessmentInsight>('/exams/assessment-insight', { items }, { timeout: 90_000 })
  return data
}
