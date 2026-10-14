import type { z } from 'zod'
import { CounterExampleReportSchema, ExecutionResultSchema, ProgramCaseResultsSchema, WorkerEnvelopeSchema } from './schemas'
import type { ExecutionResult } from './execution'
import type { CounterExampleReport } from './counterExampleEngine'
import type { ProgramCaseResult, ProgramTestCase } from './model'
import type { FuzzSpecification } from './fuzzSpecification'

let sequence = 0
function requestWorker<T>(request: object, schema: z.ZodType<T>,fuzz=false,signal?:AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if(signal?.aborted){reject(new DOMException('Η εκτέλεση ακυρώθηκε.','AbortError'));return}
    const worker = fuzz?new Worker(new URL('./counterExample.worker.ts', import.meta.url), { type: 'module' }):new Worker(new URL('./execution.worker.ts', import.meta.url), { type: 'module' })
    const id = ++sequence
    let settled=false
    const cancelWorker=()=>{if(fuzz){worker.postMessage({action:'cancel'});window.setTimeout(()=>worker.terminate(),100)}else worker.terminate()}
    const cleanup=()=>{window.clearTimeout(timer);signal?.removeEventListener('abort',abort)}
    const fail=(error:Error)=>{if(settled)return;settled=true;cleanup();cancelWorker();reject(error)}
    const abort=()=>fail(new DOMException('Η εκτέλεση ακυρώθηκε.','AbortError'))
    const timer = window.setTimeout(() => fail(new Error('Η δοκιμή ξεπέρασε το χρονικό όριο. Έλεγξε μήπως υπάρχει ατέρμονας βρόχος.')), fuzz?30_000:8_000)
    signal?.addEventListener('abort',abort,{once:true})
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if(settled)return
      const envelope = WorkerEnvelopeSchema.safeParse(event.data)
      if (!envelope.success || envelope.data.id !== id) {fail(new Error('Μη έγκυρη απόκριση εκτέλεσης.'));return}
      if(envelope.data.error){fail(new Error(envelope.data.error));return}
      const result = schema.safeParse(envelope.data.result)
      if(!result.success){fail(new Error('Τα αποτελέσματα εκτέλεσης δεν είναι έγκυρα.'));return}
      settled=true;cleanup();worker.terminate();resolve(result.data)
    }
    worker.onerror = () => fail(new Error('Δεν ήταν δυνατή η εκτέλεση του κώδικα.'))
    worker.postMessage({ id, ...request })
  })
}

export const previewProgram = (source: string, inputs: string[],signal?:AbortSignal) =>
  requestWorker<ExecutionResult>({ action: 'preview', source, inputs }, ExecutionResultSchema,false,signal)
export const checkProgram = (source: string, cases: ProgramTestCase[]) =>
  requestWorker<ProgramCaseResult[]>({ action: 'cases', source, cases }, ProgramCaseResultsSchema)
export const findProgramCounterExample = (studentSource: string, referenceSource: string, cases: ProgramTestCase[],specification?:FuzzSpecification,signal?:AbortSignal) =>
  requestWorker<CounterExampleReport>({ studentSource, referenceSource, cases,specification }, CounterExampleReportSchema,true,signal)
