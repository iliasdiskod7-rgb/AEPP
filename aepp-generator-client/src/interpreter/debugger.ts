import { Interpreter } from './runtime'
import { BreakpointManager } from './breakpoints'
import type { CallStackFrame, ExecutionEvent, Program, Value, VariableSnapshot } from './types'

export type DebugAction = 'continue' | 'step' | 'over'
export interface ExecutionSnapshot {
  stepIndex: number; line: number; symbolTables: Record<number, VariableSnapshot[]>
  arrayStates: Record<number, Record<string, Record<string, Value>>>
  callStack: CallStackFrame[]; outputLog: string[]; event: ExecutionEvent
  yieldIndex: number
}
export interface DebugResult { event: ExecutionEvent; reason: 'step' | 'breakpoint' | 'input' | 'done' }
interface Options { capacity?: 50 | 100; maxLoopIterations?: number; breakpoints?: BreakpointManager }
const MAX_YIELDS = 500_000
export class DebuggerEngine {
  readonly breakpoints: BreakpointManager
  private iterator: Generator<ExecutionEvent, void, Value | undefined>
  private journal = new Map<number, Value>()
  private snapshots: ExecutionSnapshot[] = []
  private ordinal = 0
  private stepIndex = 0
  private initial = true
  private stopped = false
  private overDepth: number | null = null
  private capacity: number
  current: ExecutionEvent
  readonly program: Program
  private options: Options
  constructor(program: Program, options: Options = {}) {
    this.program=program;this.options=options
    this.breakpoints=options.breakpoints ?? new BreakpointManager()
    this.capacity=options.capacity ?? 100
    this.iterator=this.createIterator()
    const first=this.iterator.next()
    if(first.done)throw new Error('Δεν δημιουργήθηκε αρχική κατάσταση εκτέλεσης.')
    this.current=first.value
    this.ordinal=1
    this.capture(first.value)
  }
  private createIterator(captureState?: () => boolean) {
    return new Interpreter(this.program,{memory:true,debug:true,captureState,maxLoopIterations:this.options.maxLoopIterations,
      activeBreakpoints:this.breakpoints.has}).execute()
  }
  get history(): readonly ExecutionSnapshot[] { return this.snapshots }
  get inputsUsed(){return this.journal.size}
  get canStepBack() {return !this.stopped && this.snapshots.length>1}
  get isStopped() {return this.stopped}
  private capture(event: ExecutionEvent) {
    const callStack=event.callStack ?? []
    const snapshot: ExecutionSnapshot={stepIndex:this.stepIndex,line:event.kind==='done'?callStack.at(-1)?.line ?? 0:event.line,
      symbolTables:Object.fromEntries(callStack.map(frame=>[frame.scopeId,frame.variables])),
      arrayStates:Object.fromEntries(callStack.map(frame=>[frame.scopeId,Object.fromEntries(frame.variables.filter(variable=>variable.dimensions).map(variable=>[variable.name,variable.elements ?? {}]))])),
      callStack,outputLog:event.output,event,yieldIndex:this.ordinal}
    if(this.snapshots.at(-1)?.yieldIndex===this.ordinal)this.snapshots[this.snapshots.length-1]=snapshot
    else this.snapshots.push(snapshot)
    if(this.snapshots.length>this.capacity)this.snapshots.shift()
  }
  private result(event: ExecutionEvent, reason: DebugResult['reason']): DebugResult {
    this.current=event
    // Ο τερματισμός δεν είναι νέα εκτελεσμένη εντολή.
    if(reason!=='done') {this.stepIndex++;this.current={...event,debugStepIndex:this.stepIndex};this.capture(this.current)}
    if(reason!=='input')this.overDepth=null
    return {event:this.current,reason}
  }
  advance(action: DebugAction='step', supplied?: Value): DebugResult {
    if(this.stopped)throw new Error('Η εκτέλεση έχει διακοπεί. Πάτησε Επαναφορά για νέα εκτέλεση.')
    if(this.current.kind==='done')return {event:this.current,reason:'done'}
    if(this.current.kind==='input'&&!supplied)return {event:this.current,reason:'input'}
    const depth=action==='over' ? this.overDepth ?? this.current.callStack?.length ?? 1 : null
    this.overDepth=depth
    if(this.initial) {
      this.initial=false
      if(action==='continue'&&this.current.kind==='step'&&this.current.debugPhase==='before'&&this.breakpoints.has(this.current.line))
        return this.hit(this.current)
    }
    if(supplied) {
      if(this.current.kind!=='input')throw new Error('Δεν αναμένεται τιμή εισόδου σε αυτό το βήμα.')
      this.journal.set(this.ordinal,{...supplied})
    }
    let value=supplied
    for(let count=0;count<MAX_YIELDS;count++) {
      const next=this.iterator.next(value);value=undefined
      if(++this.ordinal>MAX_YIELDS)throw new Error('Ξεπεράστηκε το όριο βημάτων του debugger.')
      if(next.done)throw new Error('Ο Evaluator τερμάτισε χωρίς τελική κατάσταση.')
      const event=next.value
      if(event.kind==='done')return this.result(event,'done')
      if(event.kind==='input')return this.result(event,'input')
      if(event.debugPhase==='before') {
        // Επανέλεγχος εδώ ώστε αλλαγές breakpoints κατά την παύση να εφαρμόζονται αμέσως.
        if(this.breakpoints.has(event.line))return this.hit(event)
        continue
      }
      this.stepIndex++
      this.current={...event,debugStepIndex:this.stepIndex}
      this.capture(this.current)
      if(depth!==null && (event.callStack?.length ?? 1)>depth)continue
      this.overDepth=null
      return {event:this.current,reason:'step'}
    }
    throw new Error('Ξεπεράστηκε το όριο βημάτων του debugger.')
  }
  private hit(event: Extract<ExecutionEvent,{kind:'step'}>): DebugResult {
    const hit: ExecutionEvent={...event,breakpointHit:{kind:'ON_BREAKPOINT_HIT',line:event.line,state:event.callStack ?? []}}
    return this.result(hit,'breakpoint')
  }
  stepBack(): ExecutionEvent {
    if(!this.canStepBack)throw new Error('Δεν υπάρχει προηγούμενο βήμα στο διαθέσιμο ιστορικό.')
    const target=this.snapshots[this.snapshots.length-2]
    // Επανακατασκευή generator, bindings, μετρητών βρόχων και swap tracker.
    // Το UI δεν λαμβάνει ενδιάμεσα replay events ή παλιές προτροπές ΔΙΑΒΑΣΕ.
    let capture = false
    const iterator=this.createIterator(() => capture)
    let event: ExecutionEvent | undefined
    const start=performance.now()
    for(let index=1;index<=target.yieldIndex;index++) {
      if(index%512===0&&performance.now()-start>2500)throw new Error('Η επαναφορά χρειάζεται περισσότερο χρόνο από το επιτρεπτό όριο.')
      capture = index === target.yieldIndex
      const next=iterator.next(this.journal.get(index-1))
      if(next.done)throw new Error('Δεν ήταν δυνατή η επαναφορά του βήματος.')
      event=next.value
    }
    if(!event)throw new Error('Δεν βρέθηκε το προηγούμενο βήμα.')
    capture = true
    this.iterator=iterator;this.ordinal=target.yieldIndex;this.stepIndex=target.stepIndex
    this.current={...event,debugStepIndex:target.stepIndex,memoryEvents:[],breakpointHit:undefined}
    this.snapshots.pop()
    for(const key of this.journal.keys())if(key>=this.ordinal)this.journal.delete(key)
    this.initial=event.debugPhase==='before'&&!target.event.breakpointHit;this.overDepth=null
    return this.current
  }
  stop() {
    this.stopped=true
    // Δεν γίνεται return() στον generator: η finally ενεργού υποπρογράμματος μπορεί να έχει semantics.
    this.journal.clear();this.snapshots=[];this.overDepth=null
    this.iterator=(function* (): Generator<ExecutionEvent, void, Value | undefined> {})()
  }
}
