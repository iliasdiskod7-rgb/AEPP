import { apiClient } from './client'
import { CodeNoteSchema, SharedNoteSchema, NoteInputSchema, type NoteInput } from '../notes/model'
import { z } from 'zod'
function responseData<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new Error('Η υπηρεσία επέστρεψε μη έγκυρα δεδομένα σημειώσεων. Δοκίμασε ξανά.')
  return result.data
}
export const notesApi = {
  async share(id: string) {
    const { data } = await apiClient.post('/notes/' + encodeURIComponent(id) + '/share', {}, { timeout: 15000 })
    return responseData(
      z.object({ url: z.url().refine(url => ['http:', 'https:'].includes(new URL(url).protocol)) }),
      data,
    )
  },
  async unshare(id: string) {
    await apiClient.delete('/notes/' + encodeURIComponent(id) + '/share', { timeout: 15000 })
  },
  async shared(token: string, signal?: AbortSignal) {
    const { data } = await apiClient.get('/notes/shared/' + encodeURIComponent(token), { signal, timeout: 15000 })
    return responseData(SharedNoteSchema, data)
  },
  async list(signal?: AbortSignal) {
    const { data } = await apiClient.get<unknown>('/notes', { signal, timeout: 15000 })
    return responseData(CodeNoteSchema.array(), data)
  },
  async get(id: string, signal?: AbortSignal) {
    const { data } = await apiClient.get<unknown>('/notes/' + encodeURIComponent(id), { signal, timeout: 15000 })
    return responseData(CodeNoteSchema, data)
  },
  async save(input: NoteInput, id?: string, signal?: AbortSignal) {
    const body = NoteInputSchema.parse(input)
    const { data } = id
      ? await apiClient.put<unknown>('/notes/' + encodeURIComponent(id), body, { signal, timeout: 15000 })
      : await apiClient.post<unknown>('/notes', body, { signal, timeout: 15000 })
    return responseData(CodeNoteSchema, data)
  },
  async remove(id: string) {
    await apiClient.delete('/notes/' + encodeURIComponent(id), { timeout: 15000 })
  },
}
