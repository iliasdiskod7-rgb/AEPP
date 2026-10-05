import type { ExecutionResult } from './execution'
import type { ProgramCaseResult, ProgramTestCase } from './model'

let sequence = 0
function requestWorker<T>(request: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./execution.worker.ts', import.meta.url), { type: 'module' })
    const id = ++sequence
    const timer = window.setTimeout(() => { worker.terminate(); reject(new Error('Η δοκιμή ξεπέρασε το χρονικό όριο. Έλεγξε μήπως υπάρχει ατέρμονας βρόχος.')) }, 8_000)
    worker.onmessage = (event: MessageEvent<{ id: number; result: T }>) => {
      if (event.data.id !== id) return
      window.clearTimeout(timer)
      worker.terminate()
      resolve(event.data.result)
    }
    worker.onerror = () => { window.clearTimeout(timer); worker.terminate(); reject(new Error('Δεν ήταν δυνατή η εκτέλεση του κώδικα.')) }
    worker.postMessage({ id, ...request })
  })
}

export const previewProgram = (source: string, inputs: string[]) =>
  requestWorker<ExecutionResult>({ action: 'preview', source, inputs })
export const checkProgram = (source: string, cases: ProgramTestCase[]) =>
  requestWorker<ProgramCaseResult[]>({ action: 'cases', source, cases })
