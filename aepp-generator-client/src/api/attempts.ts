import { z } from 'zod'
import { apiClient } from './client'
import type { ExamJsonResponseDto } from '../types/exam'
import type { GradeRequest } from '../assessment/attempts'
import { buildAttemptSubmission } from '../assessment/attempts'
import { AttemptDetailSchema, AttemptPageSchema, RandomExamResponseSchema, parseBoundary } from '../assessment/schemas'
const base = '/exams/attempts'
export async function getRandomPracticeExam(signal?: AbortSignal) { return parseBoundary(RandomExamResponseSchema, (await apiClient.get<unknown>('/exams/random',{signal,timeout:8000})).data) }
export async function startExamAttempt(attemptId: string, examId: string, generatedExam?: ExamJsonResponseDto) { return parseBoundary(AttemptDetailSchema, (await apiClient.post<unknown>(base + '/start', { attemptId, examId, generatedExam }, { timeout: 30000 })).data) }
export async function submitExamAttempt(payload: ReturnType<typeof buildAttemptSubmission>) { return parseBoundary(AttemptDetailSchema, (await apiClient.post<unknown>(base + '/submit', payload, { timeout: 30000 })).data) }
export async function getExamAttempt(id: string) { return parseBoundary(AttemptDetailSchema, (await apiClient.get<unknown>(base + '/' + encodeURIComponent(id))).data) }
export async function getAttemptHistory(page = 1, teacher = false, signal?: AbortSignal) { return parseBoundary(AttemptPageSchema, (await apiClient.get<unknown>(base + (teacher ? '/review-history' : '/my-history'), { params: { page, pageSize: 20 }, signal })).data) }
export async function gradeExamAttempt(id: string, payload: GradeRequest) { return parseBoundary(AttemptDetailSchema, (await apiClient.post<unknown>(base + '/' + encodeURIComponent(id) + '/grade', payload)).data) }
export function attemptError(cause: unknown): string {
  const parsed = z.object({ response: z.object({ status: z.number().optional(), data: z.object({ message: z.string() }).optional() }).optional() }).safeParse(cause)
  const response = parsed.success ? parsed.data.response : undefined
  if (response?.status === 401) return 'Συνδέσου ξανά για να συνεχίσεις.'
  if (response?.status === 403) return 'Δεν έχεις δικαίωμα για αυτή την ενέργεια.'
  if (response?.status === 400) return response.data?.message ?? 'Έλεγξε τον βαθμό, τα σχόλια και τα στοιχεία της υποβολής.'
  if (!response && cause instanceof Error && /[Α-Ωα-ω]/u.test(cause.message)) return cause.message
  return response?.data?.message ?? 'Η αποθήκευση δεν ολοκληρώθηκε. Οι απαντήσεις σου παραμένουν διαθέσιμες. Δοκίμασε ξανά.'
}
