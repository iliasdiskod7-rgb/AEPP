import type { AssessmentExam } from './model'
export function examOverview(exam: AssessmentExam) {
  return {
    marks: exam.sections.reduce((sum, s) => sum + s.marks, 0),
    topics: [...new Set(exam.sections.flatMap(s => s.questions.map(q => q.chapter)).filter(Boolean))],
  }
}
export function remainingExamSeconds(startedAt: string, durationMinutes: number, now = Date.now()) {
  const start = Date.parse(startedAt)
  return Number.isFinite(start) ? Math.max(0, Math.ceil((start + durationMinutes * 60000 - now) / 1000)) : 0
}
export function formatExamTime(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}
