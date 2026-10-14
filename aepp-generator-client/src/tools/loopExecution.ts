import { parseProgram } from '../interpreter/parser'
import { Interpreter, parseInput } from '../interpreter/runtime'
import type { VariableSnapshot } from '../interpreter/types'
import { listLoops } from './loopTransformer'

export interface LoopRun {output:string[];variables:VariableSnapshot[];iterations:Record<string,number>;steps:number;inputsUsed:number;error?:string}
export function runLoopSource(source:string,inputs:string[]):LoopRun {
  const result:LoopRun={output:[],variables:[],iterations:{},steps:0,inputsUsed:0}
  try {
    const program=parseProgram(source), loops=new Map(listLoops(program).map(s=>[s.nodeId,s]))
    for(const loop of loops.values())result.iterations[`${loop.kind==='for'?'ΓΙΑ':loop.kind==='while'?'ΟΣΟ':'ΜΕΧΡΙΣ_ΟΤΟΥ'} · γραμμή ${loop.line}`]=0
    const iterator=new Interpreter(program,{memory:true,maxLoopIterations:10000}).execute()
    let next=iterator.next()
    while(!next.done){
      const event=next.value
      result.output=event.output;result.variables=event.variables
      if(++result.steps>100000)throw new Error('Ξεπεράστηκε το όριο 100.000 βημάτων.')
      const node=event.nodeExecution,loop=node&&loops.get(node.nodeId)
      if(event.kind==='step'&&node?.phase==='condition'&&loop&&(loop.kind==='repeat'||node.condition===true)){
        const key=`${loop.kind==='for'?'ΓΙΑ':loop.kind==='while'?'ΟΣΟ':'ΜΕΧΡΙΣ_ΟΤΟΥ'} · γραμμή ${loop.line}`
        result.iterations[key]=(result.iterations[key]??0)+1
      }
      if(event.kind==='input'){
        if(result.inputsUsed>=inputs.length)throw new Error('Λείπει είσοδος για '+event.name+'.')
        next=iterator.next(parseInput(inputs[result.inputsUsed++],event.type,event.line))
      }else if(event.kind==='done')break
      else next=iterator.next()
    }
    if(result.inputsUsed!==inputs.length)throw new Error('Υπάρχουν επιπλέον τιμές εισόδου που δεν καταναλώθηκαν.')
  }catch(error){result.error=error instanceof Error?error.message:'Σφάλμα εκτέλεσης.'}
  return result
}
export function runsMatch(original:LoopRun,converted:LoopRun):boolean {
  if(original.error||converted.error||original.inputsUsed!==converted.inputsUsed)return false
  const values=(v:VariableSnapshot)=>JSON.stringify([v.type,v.value,v.dimensions,Object.entries(v.elements??{}).sort(([a],[b])=>a.localeCompare(b))])
  return JSON.stringify(original.output)===JSON.stringify(converted.output)&&original.variables.every(v=>{
    const other=converted.variables.find(w=>w.name===v.name);return other!==undefined&&values(v)===values(other)
  })
}
