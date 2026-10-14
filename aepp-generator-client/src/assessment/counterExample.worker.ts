import { findCounterExampleAsync } from './counterExampleEngine'
import { ExecutionResultSchema, WorkerEnvelopeSchema, ProgramTestCaseSchema } from './schemas'
import { FuzzSpecificationSchema } from './fuzzSpecification'
import type { ExecutionResult } from './execution'
import { z } from 'zod'

const RequestSchema=z.object({id:z.number().int().positive(),studentSource:z.string().max(12000),referenceSource:z.string().max(12000),cases:z.array(ProgramTestCaseSchema).min(1).max(50),specification:FuzzSpecificationSchema.optional()})
const workers=new Set<Worker>()
function stop(){workers.forEach(w=>w.terminate());workers.clear()}
function executor(source:string){
  const worker=new Worker(new URL('./execution.worker.ts',import.meta.url),{type:'module'});workers.add(worker)
  let sequence=0
  return (inputs:string[]):Promise<ExecutionResult>=>new Promise((resolve,reject)=>{
    const id=++sequence
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Η εκτέλεση μιας δοκιμής ξεπέρασε το χρονικό όριο.'))},2000)
    worker.onmessage=(event:MessageEvent<unknown>)=>{clearTimeout(timer);const envelope=WorkerEnvelopeSchema.safeParse(event.data);if(!envelope.success||envelope.data.id!==id){reject(new Error('Μη έγκυρη απόκριση Worker.'));return}const parsed=ExecutionResultSchema.safeParse(envelope.data.result);if(parsed.success)resolve(parsed.data);else reject(new Error('Μη έγκυρα αποτελέσματα εκτέλεσης.'))}
    worker.onerror=()=>{clearTimeout(timer);reject(new Error('Αποτυχία εκτέλεσης δοκιμής.'))}
    worker.postMessage({id,action:'preview',source,inputs})
  })
}
self.onmessage=async(event:MessageEvent<unknown>)=>{
  if(typeof event.data==='object'&&event.data!==null&&'action' in event.data&&event.data.action==='cancel'){stop();return}
  const request=RequestSchema.safeParse(event.data)
  if(!request.success){self.postMessage({id:0,error:'Μη έγκυρο αίτημα fuzzing.'});return}
  const {id,studentSource,referenceSource,cases,specification}=request.data
  try{
    const student=executor(studentSource),reference=executor(referenceSource)
    const result=await findCounterExampleAsync(cases,inputs=>Promise.all([student(inputs),reference(inputs)]),specification)
    stop()
    self.postMessage({id,result})
  }catch(error){stop();self.postMessage({id,error:error instanceof Error?error.message:'Αποτυχία fuzzing.'})}
  finally{stop()}
}
