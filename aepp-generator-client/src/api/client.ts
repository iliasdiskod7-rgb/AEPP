import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 300_000,
  headers: { 'Content-Type': 'application/json' },
})

export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const problem = error.response?.data as { title?: unknown; detail?: unknown } | undefined
    if (typeof problem?.detail === 'string' && problem.detail.trim()) return problem.detail
    if (typeof problem?.title === 'string' && problem.title.trim()) return problem.title
    if (error.response?.status === 404) return 'Η υπηρεσία δημιουργίας θεμάτων δεν είναι ακόμη διαθέσιμη. Χρησιμοποίησε το ενδεικτικό διαγώνισμα.'
    if (error.code === 'ECONNABORTED') return 'Η δημιουργία καθυστέρησε περισσότερο από το επιτρεπτό. Δοκίμασε ξανά.'
    return 'Δεν ήταν δυνατή η δημιουργία. Έλεγξε τη σύνδεση με τον διακομιστή και δοκίμασε ξανά.'
  }
  return error instanceof Error && /[Α-Ωα-ω]/u.test(error.message)
    ? error.message : 'Παρουσιάστηκε σφάλμα. Δοκίμασε ξανά.'
}
