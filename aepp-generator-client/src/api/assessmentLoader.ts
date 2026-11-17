import { getRandomPracticeExam } from './attempts'
import { getRandomMockExam } from '../assessment/mockExamBank'
export async function loadPracticeExam(authenticated: boolean, signal?: AbortSignal, excludeId?: string) {
  if (authenticated)
    try {
      const result = await getRandomPracticeExam(signal, excludeId)
      return { exam: result.exam, local: false, notice: '' }
    } catch (cause) {
      if (signal?.aborted) throw cause
    }
  const exam = await getRandomMockExam(excludeId)
  return {
    exam,
    local: true,
    notice: authenticated
      ? 'Αποτυχία φόρτωσης διαγωνίσματος από το API. Μπορείς να συνεχίσεις με το τοπικό διαγώνισμα εξάσκησης ή να δοκιμάσεις ξανά.'
      : 'Τοπικό διαγώνισμα εξάσκησης. Συνδέσου για αποθήκευση της προσπάθειας στον λογαριασμό σου.',
  }
}
