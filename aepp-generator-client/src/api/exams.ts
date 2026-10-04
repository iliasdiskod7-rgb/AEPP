import { useMutation, useQuery } from '@tanstack/react-query'
import type { Exam, ExamJsonResponseDto, GenerateExamRequest } from '../types/exam'
import { apiClient } from './client'
import { createStructuredSampleExam } from './structuredSampleExam'

export const isDemoMode = import.meta.env.VITE_USE_DEMO !== 'false'

export function useGenerateExam() {
  return useMutation({
    mutationFn: async (request: GenerateExamRequest): Promise<ExamJsonResponseDto> => {
      if (isDemoMode) return createStructuredSampleExam(request)
      const { data } = await apiClient.post<ExamJsonResponseDto>('/exams/generate', request)
      return data
    },
    retry: false,
  })
}

// Prepared for the future GET /api/exams/{id} endpoint; inactive without an ID.
export function useExam(id?: string) {
  return useQuery({
    queryKey: ['exams', id],
    queryFn: async ({ signal }): Promise<Exam> => {
      const { data } = await apiClient.get<Exam>(`/exams/${encodeURIComponent(id!)}`, { signal })
      return data
    },
    enabled: Boolean(id) && !isDemoMode,
    staleTime: 60_000,
  })
}
