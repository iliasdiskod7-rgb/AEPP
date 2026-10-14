import type { ExecutionEvent, Program, VariableSnapshot } from './types'
import { displayValue } from './runtime'

export interface TraceRow {
  executionIndex?: number; step: number; nodeId: string; line: number; instruction: string; scope: string
  values: Record<string, string>; condition?: boolean; output: string
}
export interface LiveExecutionState {
  source: string; program: Program | null; event: ExecutionEvent | null
  rows: TraceRow[]; variables: string[]; totalSteps: number
}
const empty = (): LiveExecutionState => ({source:'', program:null, event:null, rows:[], variables:[], totalSteps:0})
export function traceValues(variables: VariableSnapshot[]): Record<string, string> {
  return Object.fromEntries(variables.filter(variable => !variable.constant).map(variable => [variable.name,
    variable.dimensions ? Object.entries(variable.elements ?? {}).map(([index,value]) => '[' + index + ']=' + displayValue(value)).join('; ') || '—'
      : variable.value ? displayValue(variable.value) : '—']))
}
// Το DOM εμφανίζει σελίδες 100 γραμμών. Διατηρούνται τα τελευταία 10.000 βήματα.
export class LiveExecutionSession {
  private state = empty()
  private listeners = new Set<() => void>()
  private outputLength = 0
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener)}}
  private notify() {this.listeners.forEach(listener => listener())}
  reset() {this.outputLength=0; this.state=empty(); this.notify()}
  start(source: string, program: Program) {
    this.outputLength=0
    this.state={...empty(),source,program}
    this.notify()
  }
  restore(event: ExecutionEvent) {
    const index=event.debugStepIndex ?? 0
    const rows=this.state.rows.filter(row=>(row.executionIndex ?? 0)<=index)
    this.outputLength=event.output.length
    this.state={...this.state,event,rows,totalSteps:rows.at(-1)?.step ?? 0,
      variables:[...new Set(rows.flatMap(row=>Object.keys(row.values)))]}
    this.notify()
  }
  accept(event: ExecutionEvent) {
    let rows=this.state.rows, totalSteps=this.state.totalSteps, variables=this.state.variables
    if(event.kind==='step' && event.debugPhase!=='before' && event.nodeExecution) {
      const node=event.nodeExecution, values=traceValues(node.varsState)
      const sourceLine=this.state.source.split(/\r?\n/u)[node.line-1]?.trim() ?? ''
      const phase = node.phase==='initialize' ? ' · αρχικοποίηση' : node.phase==='increment' ? ' · αύξηση μετρητή' : ''
      const row: TraceRow={executionIndex:event.debugStepIndex,step:++totalSteps,nodeId:node.nodeId,line:node.line,instruction:sourceLine+phase,
        scope:event.scopeName ?? '',values,condition:node.condition,output:event.output.slice(this.outputLength).join('\n')}
      rows=[...rows.slice(-9999),row]
      variables=[...new Set([...variables,...Object.keys(values)])]
      this.outputLength=event.output.length
    }
    this.state={...this.state,event,rows,totalSteps,variables}
    this.notify()
  }
}
export const liveExecution = new LiveExecutionSession()
