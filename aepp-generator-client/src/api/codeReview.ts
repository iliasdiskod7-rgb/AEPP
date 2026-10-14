import { z } from 'zod'
import { apiClient } from './client'
import { parseBoundary } from '../assessment/schemas'
import type { ExecutionMetrics } from '../interpreter/runtime'

export const CodeReviewResponseSchema = z.object({
  efficiency: z.string().min(1).max(1200),
  algorithmicRisks: z.string().min(1).max(1200),
  styleAndAeppRules: z.string().min(1).max(1200),
})
export type CodeReviewResponse = z.infer<typeof CodeReviewResponseSchema>

export async function reviewCode(studentCode: string, metrics: ExecutionMetrics,signal?:AbortSignal): Promise<CodeReviewResponse> {
  const { data } = await apiClient.post<unknown>('/code-review', { studentCode, metrics },{signal})
  return parseBoundary(CodeReviewResponseSchema, data)
}
