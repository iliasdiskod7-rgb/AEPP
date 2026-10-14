import { useMutation, useQuery } from '@tanstack/react-query'
import type { Exam, ExamJsonResponseDto, GenerateExamRequest } from '../types/exam'
import { ExamResponseSchema, GeneratedExamSchema } from '../assessment/examSchemas'
import { parseBoundary } from '../assessment/schemas'
import { apiClient } from './client'
import { createStructuredSampleExam } from './structuredSampleExam'

export const isDemoMode = import.meta.env.VITE_USE_DEMO !== 'false'

export function useGenerateExam() {
  return useMutation({
    mutationFn: async (request: GenerateExamRequest): Promise<ExamJsonResponseDto> => {
      if (isDemoMode) return createStructuredSampleExam(request)
      const { data } = await apiClient.post<unknown>('/exams/generate', request)
      return toClientExam(parseBoundary(ExamResponseSchema,data))
    },
    retry: false,
  })
}

// Prepared for the future GET /api/exams/{id} endpoint; inactive without an ID.
export function useExam(id?: string) {
  return useQuery({
    queryKey: ['exams', id],
    queryFn: async ({ signal }): Promise<Exam> => {
      const { data } = await apiClient.get<unknown>(`/exams/${encodeURIComponent(id!)}`, { signal })
      return parseBoundary(ExamResponseSchema,data)
    },
    enabled: Boolean(id) && !isDemoMode,
    staleTime: 60_000,
  })
}

export function toClientExam(input: unknown): ExamJsonResponseDto {
  const data = parseBoundary(ExamResponseSchema,input)
  return parseBoundary(GeneratedExamSchema,{
        generationSource: data.generationSource,
        fallbackMessage: data.fallbackMessage,
        fallbackDetails: data.fallbackDetails,
        bankExamId: data.bankExamId,
        title: data.title,
        durationMinutes: data.durationMinutes,
        sections: data.sections.map(section => ({
          theme: section.title,
          totalMarks: section.totalMarks,
          questions: section.questions.map(question => {
            const codeBlock = /\n\n```glossa\n([\s\S]*?)\n```\s*$/u.exec(question.contentMarkdown)
            return {
              code: question.subTitle,
              questionText: codeBlock
                ? question.contentMarkdown.slice(0, codeBlock.index)
                : question.contentMarkdown,
              glowCodeSnippet: codeBlock?.[1] ?? null,
              solutionText: question.solutionMarkdown,
              marks: question.marks,
              testCases: question.testCases ?? undefined,
            }
          }),
        })),
      })
}
