import { gradeExam } from './gradingEngine'

self.onmessage = async (event: MessageEvent<{ id: number; examTemplate: unknown; studentAnswers: unknown }>) => {
  const { id, examTemplate, studentAnswers } = event.data
  try {
    self.postMessage({ id, result: await gradeExam(studentAnswers, examTemplate) })
  } catch (cause) {
    self.postMessage({ id, error: cause instanceof Error ? cause.message : 'Δεν ολοκληρώθηκε η βαθμολόγηση.' })
  }
}
