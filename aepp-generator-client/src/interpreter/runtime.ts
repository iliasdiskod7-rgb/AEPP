import { analyzeProgram } from './staticChecker'
import { builtinNames, evaluateBuiltin } from './builtins'
import { resolveConstants } from './constants'
import { SwapTracker } from './memory'
import type { MemoryEvent, MemoryReference, NodeExecutionEvent, AstIdentity, CallStackFrame } from './types'
import { GlossaError, normalize, type CasePattern, type ExecutionEvent, type Expression, type Program, type Statement, type Subprogram, type Value, type ValueType, type VariableSnapshot } from './types'

type Cell = { type: ValueType; value: Value | null; constant: boolean; dimensions?: number[]; elements?: Map<string, Value> }
type Frame = { cells: Map<string, Cell>; routine?: Subprogram; id: number; line?: number }
type LValueReference =
  | { type: 'VARIABLE'; name: string }
  | { type: 'ARRAY_ELEMENT'; arrayName: string; indices: number[] }
  | { type: 'VALUE_ONLY' }
type ParameterBinding = { cell: Cell; reference: LValueReference }
const typeError = (line: number, message: string) => new GlossaError(line, message, 'type')
const runtimeError = (line: number, message: string) => new GlossaError(line, message, 'runtime')
const MAX_LOOP_ITERATIONS = 100_000
const MAX_CALL_DEPTH = 100
const isNumber = (value: Value) => value.type === 'integer' || value.type === 'real'
const label: Record<ValueType, string> = { integer: 'ΑΚΕΡΑΙΑ', real: 'ΠΡΑΓΜΑΤΙΚΗ', boolean: 'ΛΟΓΙΚΗ', string: 'ΧΑΡΑΚΤΗΡΑΣ' }
const numeric = (value: Value, line: number): number => {
  if (!isNumber(value)) throw typeError(line, 'Η πράξη απαιτεί αριθμητική τιμή.')
  return value.value as number
}
const logical = (value: Value, line: number): boolean => {
  if (value.type !== 'boolean') throw typeError(line, 'Χρήση λογικού τελεστή ή συνθήκης σε μη λογική έκφραση.')
  return value.value as boolean
}
const numberValue = (result: number, type: 'integer' | 'real', line: number): Value => {
  if (!Number.isFinite(result) || type === 'integer' && !Number.isSafeInteger(result)) throw runtimeError(line, 'Το αριθμητικό αποτέλεσμα δεν μπορεί να αναπαρασταθεί.')
  return { type, value: result }
}
export interface ExecutionMetrics { comparisonsCount: number; assignmentsCount: number; loopIterations: number }
export const displayValue = (value: Value) => value.type === 'boolean' ? value.value ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ' : String(value.value)

export function parseInput(text: string, type: ValueType, line: number): Value {
  const trimmed = text.trim()
  if (type === 'string') return { type, value: text }
  if (type === 'boolean') {
    const value = normalize(trimmed)
    if (value === 'ΑΛΗΘΗΣ' || value === 'ΨΕΥΔΗΣ') return { type, value: value === 'ΑΛΗΘΗΣ' }
    throw typeError(line, 'Δώσε ΑΛΗΘΗΣ ή ΨΕΥΔΗΣ για λογική μεταβλητή.')
  }
  if (type === 'integer' && !/^[+-]?\d+$/u.test(trimmed)) throw typeError(line, 'Αναμενόταν ακέραιος αριθμός.')
  if (type === 'real' && !/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/u.test(trimmed)) throw typeError(line, 'Αναμενόταν πραγματικός αριθμός.')
  return numberValue(Number(trimmed.replace(',', '.')), type, line)
}

export class Interpreter {
  private frames: Frame[] = [{ cells: new Map(), id: 0 }]
  private nextFrameId = 1
  private memoryEvents: MemoryEvent[] = []
  private references = new WeakMap<Expression, MemoryReference>()
  private swapTracker = new SwapTracker()
  private options: { memory?: boolean; maxLoopIterations?: number | (() => number); onNodeExecute?: (event: NodeExecutionEvent) => void; debug?: boolean; captureState?: () => boolean; activeBreakpoints?: (line: number) => boolean }
  private subprograms: Map<string, Subprogram>
  private output: string[] = []
  private loopIterations = 0
  private comparisonsCount = 0
  private assignmentsCount = 0
  private activeForCounters = new Set<Cell>()
  private program: Program
  constructor(program: Program, options: { memory?: boolean; maxLoopIterations?: number | (() => number); onNodeExecute?: (event: NodeExecutionEvent) => void; debug?: boolean; captureState?: () => boolean; activeBreakpoints?: (line: number) => boolean } = {}) {
    analyzeProgram(program)
    this.options = options
    this.program = program
    this.subprograms = new Map(program.subprograms.map(item => [item.name, item]))
    for (const [name,value] of resolveConstants(program.constants)) this.cells.set(name,{type:value.type,value,constant:true})
    for (const item of program.declarations) this.cells.set(item.name, { type: item.type, value: null, constant: false, dimensions: item.dimensions, elements: item.dimensions ? new Map() : undefined })
  }

  private get frame() { return this.frames[this.frames.length - 1] }
  private get cells() { return this.frame.cells }
  get metrics(): ExecutionMetrics {
    return { comparisonsCount: this.comparisonsCount, assignmentsCount: this.assignmentsCount, loopIterations: this.loopIterations }
  }

  private snapshot(frame = this.frame): VariableSnapshot[] {
    if (this.options.captureState && !this.options.captureState()) return []
    return [...frame.cells].map(([name, cell]) => ({
      name, type: cell.type,
      value: cell.dimensions ? { type: 'string' as const, value: 'Πίνακας[' + cell.dimensions.join(', ') + ']' } : cell.value ? { ...cell.value } : null,
      constant: cell.constant,
      ...((this.options.memory || this.options.debug) && cell.dimensions ? {
        dimensions: [...cell.dimensions], elements: Object.fromEntries([...cell.elements!].map(([key, value]) => [key, { ...value }]))
      } : {}),
    }))
  }
  private memoryMetadata() {
    if (!this.options.memory) return { scopeId: this.frame.id, scopeName: this.frame.routine?.name ?? this.program.name }
    const memoryEvents = this.memoryEvents
    this.memoryEvents = []
    return { memoryEvents, scopeId: this.frame.id, scopeName: this.frame.routine?.name ?? this.program.name }
  }
  private emitMemory(event: MemoryEvent) { if (this.options.memory) this.memoryEvents.push(event) }
  private reference(name: string, indexes: number[] = []): MemoryReference {
    return { scopeId: this.frame.id, name, indexes: [...indexes] }
  }
  private clearExpressionReferences(expression: Expression) {
    this.references.delete(expression)
    if (expression.kind === 'binary') { this.clearExpressionReferences(expression.left); this.clearExpressionReferences(expression.right) }
    if (expression.kind === 'unary') this.clearExpressionReferences(expression.operand)
  }
  private expressionReferences(expression: Expression): MemoryReference[] {
    const resolved = this.references.get(expression)
    if (resolved) return [resolved]
    if (expression.kind === 'binary') return [...this.expressionReferences(expression.left), ...this.expressionReferences(expression.right)]
    if (expression.kind === 'unary') return this.expressionReferences(expression.operand)
    return []
  }
  private nodeEvent(node: AstIdentity & {line?: number}, line: number, varsState: VariableSnapshot[], phase: NodeExecutionEvent['phase'], condition?: boolean): NodeExecutionEvent {
    const event: NodeExecutionEvent = { kind: 'ON_NODE_EXECUTE', nodeId: node.nodeId ?? 'legacy_line_' + line, line, originLine: node.line ?? line, varsState, phase, ...(condition !== undefined ? { condition } : {}) }
    this.options.onNodeExecute?.(event)
    return event
  }
  private event(kind: 'step' | 'done', line = 0, node?: AstIdentity, phase: NodeExecutionEvent['phase'] = 'statement', condition?: boolean): ExecutionEvent {
    this.frame.line = line || this.frame.line
    const variables = this.snapshot(), metadata = { ...this.memoryMetadata(), ...(this.options.debug ? {callStack: this.stackSnapshot(variables), debugPhase: 'after' as const} : {}) }, output = [...this.output]
    if (kind === 'done') return { kind, variables, output, ...metadata }
    return { kind, line, variables, output, ...metadata, ...(node ? { nodeExecution: this.nodeEvent(node, line, variables, phase, condition) } : {}) }
  }
  private stackSnapshot(current = this.snapshot()): CallStackFrame[] {
    return this.frames.map(frame => ({scopeId:frame.id,name:frame.routine?.name ?? this.program.name,
      kind:frame.routine?.kind ?? 'program',line:frame.line ?? frame.routine?.line ?? 1,
      variables:frame===this.frame ? current : this.snapshot(frame)}))
  }
  private *checkpoint(node: AstIdentity & {line: number}, phase: NodeExecutionEvent['phase']='statement', line=node.line): Generator<ExecutionEvent, void, Value | undefined> {
    if (!this.options.debug) return
    this.frame.line=line
    const variables=this.snapshot(), callStack=this.stackSnapshot(variables)
    yield {kind:'step',line,variables,output:[...this.output],scopeId:this.frame.id,
      scopeName:this.frame.routine?.name ?? this.program.name,callStack,debugPhase:'before',memoryEvents:[],
      nodeExecution:this.nodeEvent(node,line,variables,phase),
      ...(this.options.activeBreakpoints?.(line) ? {breakpointHit:{kind:'ON_BREAKPOINT_HIT' as const,line,state:callStack}} : {})}
  }
  private guardLoop(line: number) {
    const requested = typeof this.options.maxLoopIterations === 'function' ? this.options.maxLoopIterations() : this.options.maxLoopIterations
    const limit = requested === 10000 || requested === 50000 || requested === 100000 ? requested : MAX_LOOP_ITERATIONS
    if (++this.loopIterations > limit) throw runtimeError(line, 'Ανιχνεύθηκε πιθανός ατέρμονας βρόχος (ξεπεράστηκε το όριο των ' + limit.toLocaleString('el-GR') + ' επαναλήψεων).')
  }
  private cell(name: string, line: number): Cell {
    const cell = this.cells.get(name)
    if (!cell) throw typeError(line, `Η μεταβλητή «${name}» δεν έχει δηλωθεί στο τμήμα ΜΕΤΑΒΛΗΤΕΣ.`)
    return cell
  }
  private arrayKey(cell: Cell, indexes: number[], line: number): string {
    if (!cell.dimensions || cell.dimensions.length !== indexes.length) throw typeError(line, `Λανθασμένο πλήθος δεικτών για τον πίνακα «${cell.dimensions ? cell.dimensions.join(', ') : 'απλή μεταβλητή'}».`)
    indexes.forEach((index, position) => {
      if (!Number.isInteger(index) || index < 1 || index > cell.dimensions![position]) throw runtimeError(line, `Ο δείκτης ${index} είναι εκτός ορίων 1..${cell.dimensions![position]} του πίνακα.`)
    })
    return indexes.join(',')
  }
  private *arrayIndexes(cell: Cell, indexes: Expression[], line: number): Generator<ExecutionEvent, number[], Value | undefined> {
    const values: number[] = []
    for (const expression of indexes) {
      const value = yield* this.evaluate(expression)
      if (value.type !== 'integer') throw typeError(line, 'Ο δείκτης πίνακα πρέπει να είναι ακέραιος.')
      values.push(value.value as number)
    }
    this.arrayKey(cell, values, line)
    return values
  }
  private assign(name: string, value: Value, line: number, indexes: number[] = [], source?: MemoryReference, detectSwap = false) {
    const cell = this.cell(name, line)
    if (cell.constant) throw typeError(line, `Η σταθερά «${name}» δεν επιτρέπεται να αλλάξει.`)
    if (this.activeForCounters.has(cell)) throw typeError(line, `Απαγορεύεται η αλλαγή της μεταβλητής ελέγχου «${name}» μέσα στο σώμα της ΓΙΑ.`)
    if (cell.dimensions && !indexes.length) throw typeError(line, `Ο πίνακας «${name}» χρειάζεται δείκτη στοιχείου.`)
    if (!cell.dimensions && indexes.length) throw typeError(line, `Η μεταβλητή «${name}» δεν είναι πίνακας.`)
    if (cell.type !== value.type && !(cell.type === 'real' && value.type === 'integer')) {
      const detail = cell.type === 'integer' && value.type === 'real'
        ? 'Προσπάθεια εκχώρησης πραγματικού αριθμού σε ακέραια μεταβλητή χωρίς χρήση div/mod ή Α_Μ().'
        : value.type === 'string' && (cell.type === 'integer' || cell.type === 'real')
          ? 'Προσπάθεια εκχώρησης αλφαριθμητικού σε αριθμητική μεταβλητή.'
          : `Η «${name}» είναι ${label[cell.type]}, αλλά η έκφραση είναι ${label[value.type]}.`
      throw typeError(line, `Ασυμβίβαστοι τύποι: ${detail}`)
    }
    const stored: Value = cell.type === 'real' && value.type === 'integer' ? { type: 'real', value: value.value } : value
    const key = cell.dimensions ? this.arrayKey(cell, indexes, line) : null
    const previous = key ? cell.elements!.get(key) ?? null : cell.value
    if (key) cell.elements!.set(key, stored)
    else cell.value = stored
    this.assignmentsCount++
    if (this.options.memory) {
      const mutation: Extract<MemoryEvent, { kind: 'ON_MUTATE' }> = {
        kind: 'ON_MUTATE', target: this.reference(name, indexes),
        previous: previous ? { ...previous } : null, value: { ...stored }, source,
      }
      this.emitMemory(mutation)
      if (detectSwap) {
        const swap = this.swapTracker.record(mutation)
        if (swap) this.emitMemory(swap)
      } else this.swapTracker.reset()
    }
  }

  private *evaluate(expression: Expression): Generator<ExecutionEvent, Value, Value | undefined> {
    const line = expression.line
    if (this.options.memory) this.clearExpressionReferences(expression)
    if (expression.kind === 'literal') return expression.value
    if (expression.kind === 'variable') {
      const cell = this.cell(expression.name, line)
      if (cell.dimensions) throw typeError(line, `Ο πίνακας «${expression.name}» χρειάζεται δείκτη ή μπορεί να περάσει ως παράμετρος.`)
      if (!cell.value) throw typeError(line, `Χρήση της μεταβλητής «${expression.name}» χωρίς να έχει λάβει αρχική τιμή (με ΔΙΑΒΑΣΕ ή εκχώρηση).`)
      if (this.options.memory) {
        const target = this.reference(expression.name)
        this.references.set(expression, target)
        this.emitMemory({ kind: 'ON_READ', target, value: { ...cell.value } })
      }
      return cell.value
    }
    if (expression.kind === 'arrayAccess') {
      const cell = this.cell(expression.name, line)
      const indexes = yield* this.arrayIndexes(cell, expression.indexes, line)
      const value = cell.elements!.get(this.arrayKey(cell, indexes, line))
      if (!value) throw typeError(line, `Χρήση του στοιχείου «${expression.name}[${indexes.join(', ')}]» χωρίς αρχική τιμή.`)
      if (this.options.memory) {
        const target = this.reference(expression.name, indexes)
        this.references.set(expression, target)
        this.emitMemory({ kind: 'ON_READ', target, value: { ...value } })
      }
      return value
    }
    if (expression.kind === 'unary') {
      const operand = yield* this.evaluate(expression.operand)
      if (expression.operator === 'ΟΧΙ') return { type: 'boolean', value: !logical(operand, line) }
      return numberValue(expression.operator === '-' ? -numeric(operand, line) : numeric(operand, line), operand.type as 'integer' | 'real', line)
    }
    if (expression.kind === 'call') {
      const routine = this.subprograms.get(expression.name)
      if (routine) {
        if (routine.kind !== 'function') throw typeError(line, `Η διαδικασία «${expression.name}» καλείται μόνο με ΚΑΛΕΣΕ.`)
        return yield* this.invoke(routine, expression.arguments, line)
      }
      if (!builtinNames.has(expression.name)) throw typeError(line, 'Η συνάρτηση «'+expression.name+'» δεν βρέθηκε ή δεν έχει δηλωθεί.')
      if(expression.arguments.length!==1)throw typeError(line,'Η ενσωματωμένη συνάρτηση απαιτεί ένα όρισμα.')
      return evaluateBuiltin(expression.name,yield* this.evaluate(expression.arguments[0]),line)
    }

    const left = yield* this.evaluate(expression.left)
    if (expression.operator === 'ΚΑΙ') return { type: 'boolean', value: logical(left, line) && logical(yield* this.evaluate(expression.right), line) }
    if (expression.operator === 'Η') return { type: 'boolean', value: logical(left, line) || logical(yield* this.evaluate(expression.right), line) }
    const right = yield* this.evaluate(expression.right)
    if (['=', '<>', '<', '<=', '>', '>='].includes(expression.operator)) return {type:'boolean',value:this.compare(left,right,expression.operator,line,[...this.expressionReferences(expression.left),...this.expressionReferences(expression.right)])}
    const a = numeric(left, line), b = numeric(right, line)
    if (['DIV', 'MOD'].includes(expression.operator) && (left.type !== 'integer' || right.type !== 'integer')) throw typeError(line, 'Οι DIV και MOD απαιτούν ακέραιους τελεστέους.')
    if (['/', 'DIV', 'MOD'].includes(expression.operator) && b === 0) throw runtimeError(line, 'Προσπάθεια διαίρεσης με το μηδέν (με /, div ή mod).')
    const result = expression.operator === '+' ? a + b : expression.operator === '-' ? a - b
      : expression.operator === '*' ? a * b : expression.operator === '/' ? a / b
        : expression.operator === '^' ? a ** b : expression.operator === 'DIV' ? Math.trunc(a / b) : a % b
    const resultType = expression.operator === '/' || expression.operator === '^' && (!Number.isInteger(result) || b < 0) || left.type === 'real' || right.type === 'real' ? 'real' : 'integer'
    return numberValue(result, resultType, line)
  }

  private compare(left: Value,right: Value,operator: string,line: number,operands: MemoryReference[]=[]): boolean {
    if(left.type!==right.type&&!(isNumber(left)&&isNumber(right)))throw typeError(line,'Η σύγκριση απαιτεί συμβατούς τύπους.')
    if(left.type==='boolean'&&!['=','<>'].includes(operator))throw typeError(line,'Οι λογικές τιμές συγκρίνονται μόνο με = ή <>.')
    this.comparisonsCount++
    const a=left.value,b=right.value
    const cmp=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'el-GR')
    const result=operator==='='?cmp===0:operator==='<>'?cmp!==0:operator==='<'?cmp<0:operator==='<='?cmp<=0:operator==='>'?cmp>0:cmp>=0
    this.emitMemory({kind:'ON_COMPARE',operator,result,leftValue:{...left},rightValue:{...right},operands})
    return result
  }
  private *matchesCase(pattern: CasePattern,selected: Value,references: MemoryReference[],line: number): Generator<ExecutionEvent,boolean,Value|undefined> {
    if(pattern.kind==='range'){
      const from=yield* this.evaluate(pattern.from),to=yield* this.evaluate(pattern.to)
      if(this.compare(from,to,'>',line))throw runtimeError(line,'Το κάτω όριο της ΠΕΡΙΠΤΩΣΗΣ δεν μπορεί να υπερβαίνει το άνω όριο.')
      return this.compare(selected,from,'>=',line,[...references,...this.expressionReferences(pattern.from)]) && this.compare(selected,to,'<=',line,[...references,...this.expressionReferences(pattern.to)])
    }
    const value=yield* this.evaluate(pattern.expression)
    return this.compare(selected,value,pattern.kind==='value'?'=':pattern.operator,line,[...references,...this.expressionReferences(pattern.expression)])
  }

  private writeBack(reference: LValueReference, parameter: Cell, line: number) {
    if (reference.type === 'VALUE_ONLY') return
    const name = reference.type === 'VARIABLE' ? reference.name : reference.arrayName
    const target = this.cell(name, line)
    const changed = (previous: Value | null | undefined, value: Value) =>
      !previous || previous.type !== value.type || previous.value !== value.value
    if (reference.type === 'VARIABLE' && parameter.dimensions) {
      for (const [key, value] of parameter.elements!) {
        if (changed(target.elements!.get(key), value)) this.assign(name, { ...value }, line, key.split(',').map(Number))
      }
    } else if (parameter.value) {
      const indices = reference.type === 'ARRAY_ELEMENT' ? reference.indices : []
      const previous = indices.length ? target.elements!.get(this.arrayKey(target, indices, line)) : target.value
      if (changed(previous, parameter.value)) this.assign(name, { ...parameter.value }, line, indices)
    }
  }

  private *invoke(routine: Subprogram, args: Expression[], line: number): Generator<ExecutionEvent, Value, Value | undefined> {
    if (args.length !== routine.parameters.length) throw typeError(line, `Πλήθος ορισμάτων (${args.length}) δεν ταιριάζει με το πλήθος παραμέτρων (${routine.parameters.length}).`)
    if (this.frames.length >= MAX_CALL_DEPTH) throw runtimeError(line, 'Ξεπεράστηκε το όριο κλήσεων υποπρογραμμάτων (100).')
    const caller = this.frame
    caller.line = line
    const declarations = new Map(routine.declarations.map(item => [item.name, item]))
    const bindings = new Map<string, ParameterBinding>()
    const protectedCounters: Cell[] = []
    for (let index = 0; index < args.length; index++) {
      const actual = args[index], formal = routine.parameters[index]
      const declaration = declarations.get(formal)!
      const expected = declaration.type
      const source = actual.kind === 'variable' || actual.kind === 'arrayAccess' ? this.cell(actual.name, actual.line) : null
      let reference: LValueReference = { type: 'VALUE_ONLY' }
      let value: Value | null
      if (actual.kind === 'arrayAccess') {
        // Οι δείκτες υπολογίζονται μία φορά, στο scope του καλούντος.
        const indices = yield* this.arrayIndexes(source!, actual.indexes, actual.line)
        value = source!.elements!.get(this.arrayKey(source!, indices, actual.line)) ?? null
        if (routine.kind === 'procedure' && !source!.constant) reference = { type: 'ARRAY_ELEMENT', arrayName: actual.name, indices }
        if (this.options.memory && value) {
          const target = this.reference(actual.name, indices)
          this.references.set(actual, target)
          this.emitMemory({ kind: 'ON_READ', target, value: { ...value } })
        }
      } else if (actual.kind === 'variable') {
        value = source!.value
        if (routine.kind === 'procedure' && !source!.constant) reference = { type: 'VARIABLE', name: actual.name }
      } else value = yield* this.evaluate(actual)
      const actualType = source?.type ?? value!.type
      if (actualType !== expected) throw typeError(line, `Ασυμβατότητα τύπων μεταξύ ορίσματος «${actual.kind === 'variable' || actual.kind === 'arrayAccess' ? actual.name : index + 1}» (${label[actualType]}) και παραμέτρου «${formal}» (${label[expected]}).`)
      const expectedDimensions = declaration.dimensions ?? []
      const actualDimensions = actual.kind === 'variable' ? source?.dimensions ?? [] : []
      if (expectedDimensions.length !== actualDimensions.length || expectedDimensions.some((size, axis) => size !== actualDimensions[axis])) throw typeError(line, `Οι διαστάσεις του ορίσματος «${actual.kind === 'variable' || actual.kind === 'arrayAccess' ? actual.name : index + 1}» δεν ταιριάζουν με την παράμετρο «${formal}».`)
      const parameter: Cell = {
        type: expected, value: value ? { ...value } : null, constant: false,
        dimensions: declaration.dimensions,
        elements: actual.kind === 'variable' && source?.elements ? new Map([...source.elements].map(([key, item]) => [key, { ...item }])) : undefined,
      }
      bindings.set(formal, { cell: parameter, reference })
      if (reference.type === 'VARIABLE' && this.activeForCounters.has(source!)) protectedCounters.push(parameter)
    }
    const cells = new Map<string, Cell>()
    for (const item of routine.declarations) cells.set(item.name, bindings.get(item.name)?.cell ?? { type: item.type, value: null, constant: false, dimensions: item.dimensions, elements: item.dimensions ? new Map() : undefined })
    if (routine.kind === 'function') cells.set(routine.name, { type: routine.returnType!, value: null, constant: false })
    for (const counter of protectedCounters) this.activeForCounters.add(counter)
    this.swapTracker.reset()
    this.frames.push({ cells, routine, id: this.nextFrameId++, line: routine.line })
    let result: Value | null | undefined
    try {
      yield* this.statements(routine.body)
      result = cells.get(routine.name)?.value
      if (routine.kind === 'function' && !result) throw runtimeError(line, `Σφάλμα στη Συνάρτηση «${routine.name}»: Δεν εκχωρήθηκε τιμή στο όνομα της συνάρτησης πριν το ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ.`)
    } finally {
      this.frames.pop()
      for (const counter of protectedCounters) this.activeForCounters.delete(counter)
      this.swapTracker.reset()
    }
    // Μόνο μετά από κανονική έξοδο, με ενεργό ξανά το scope του καλούντος.
    if (routine.kind === 'procedure' && this.frame === caller) {
      for (const { cell, reference } of bindings.values()) this.writeBack(reference, cell, line)
    }
    return result ?? { type: 'boolean', value: true }
  }

  *execute(): Generator<ExecutionEvent, void, Value | undefined> {
    yield* this.statements(this.program.body)
    yield this.event('done')
  }

  private *statements(body: Statement[]): Generator<ExecutionEvent, void, Value | undefined> {
    for (const statement of body) {
      const line = statement.line
      if (!['while','if','for'].includes(statement.kind)) yield* this.checkpoint(statement)
      if (statement.kind !== 'assign') this.swapTracker.reset()
      if (statement.kind === 'assign') {
        const cell = this.cell(statement.name, line)
        const indexes = statement.indexes.length ? yield* this.arrayIndexes(cell, statement.indexes, line) : []
        const value = yield* this.evaluate(statement.expression)
        const direct = statement.expression.kind === 'variable' || statement.expression.kind === 'arrayAccess'
        this.assign(statement.name, value, line, indexes,
          this.options.memory && direct ? this.references.get(statement.expression) : undefined, true)
        yield this.event('step', line, statement)
      } else if (statement.kind === 'read') {
        for (const target of statement.targets) {
          const cell = this.cell(target.name, line)
          if (cell.constant) throw typeError(line, `Η σταθερά «${target.name}» δεν μπορεί να διαβαστεί.`)
          const indexes = target.indexes.length ? yield* this.arrayIndexes(cell, target.indexes, line) : []
          if (cell.dimensions && !indexes.length) throw typeError(line, `Ο πίνακας «${target.name}» χρειάζεται δείκτη στοιχείου.`)
          const name = indexes.length ? `${target.name}[${indexes.join(', ')}]` : target.name
          this.emitMemory({ kind: 'ON_READ', target: this.reference(target.name, indexes), value: null, input: true })
          const value: Value | undefined = yield { kind: 'input', line, name, type: cell.type, variables: this.snapshot(), output: [...this.output], ...this.memoryMetadata(), ...(this.options.debug ? {callStack:this.stackSnapshot()} : {}), nodeExecution: this.nodeEvent(statement, line, this.snapshot(), 'input') }
          if (!value) throw runtimeError(line, `Δεν δόθηκε τιμή για τη μεταβλητή «${name}».`)
          this.assign(target.name, value, line, indexes)
          yield this.event('step', line, statement)
        }
      } else if (statement.kind === 'write') {
        const parts: string[] = []
        for (const expression of statement.expressions) parts.push(displayValue(yield* this.evaluate(expression)))
        this.output.push(parts.join(''))
        yield this.event('step', line, statement)
      } else if (statement.kind === 'procedureCall') {
        const routine = this.subprograms.get(statement.name)
        if (!routine) throw typeError(line, `Η διαδικασία «${statement.name}» δεν βρέθηκε ή δεν έχει δηλωθεί.`)
        if (routine.kind !== 'procedure') throw typeError(line, `Η συνάρτηση «${statement.name}» χρησιμοποιείται μέσα σε έκφραση και όχι με ΚΑΛΕΣΕ.`)
        yield* this.invoke(routine, statement.arguments, line)
        yield this.event('step', line, statement)
      } else if (statement.kind === 'if') {
        let chosen = statement.otherwise
        for (const [index, branch] of statement.branches.entries()) {
          yield* this.checkpoint(branch.condition,'condition',index === 0 ? line : branch.condition.line)
          const result = logical(yield* this.evaluate(branch.condition), branch.condition.line)
          yield this.event('step', branch.condition.line, branch.condition, 'condition', result)
          if (result) { chosen = branch.body; break }
        }
        yield* this.statements(chosen)
      } else if (statement.kind === 'select') {
        const selected=yield* this.evaluate(statement.expression)
        const references=this.expressionReferences(statement.expression)
        yield this.event('step',line,statement)
        let chosen: Statement[] | undefined
        for(const branch of statement.cases){
          yield* this.checkpoint(branch,'condition')
          let matched=false
          for(const pattern of branch.patterns)if(yield* this.matchesCase(pattern,selected,references,branch.line)){matched=true;break}
          yield this.event('step',branch.line,branch,'condition',matched)
          if(matched){chosen=branch.body;break}
        }
        if(chosen===undefined){
          chosen=statement.otherwise
          if(statement.otherwiseLine!==undefined) { yield* this.checkpoint(statement,'default',statement.otherwiseLine); yield this.event('step',statement.otherwiseLine,statement,'default') }
        }
        yield* this.statements(chosen)
      } else if (statement.kind === 'while') {
        while (true) {
          yield* this.checkpoint(statement,'condition')
          const proceed = logical(yield* this.evaluate(statement.condition), line)
          yield this.event('step', line, statement, 'condition', proceed)
          if (!proceed) break
          this.guardLoop(line)
          yield* this.statements(statement.body)
        }
      } else if (statement.kind === 'repeat') {
        do {
          this.guardLoop(line)
          yield* this.statements(statement.body)
          yield* this.checkpoint(statement,'condition',statement.condition.line)
          const done = logical(yield* this.evaluate(statement.condition), line)
          yield this.event('step', statement.condition.line, statement, 'condition', done)
          if (done) break
        } while (true)
      } else if (statement.kind === 'for') {
        yield* this.checkpoint(statement,'initialize')
        const cell = this.cell(statement.name, line)
        if (cell.constant || cell.type !== 'integer' || cell.dimensions) throw typeError(line, 'Η μεταβλητή ελέγχου της ΓΙΑ πρέπει να είναι ακέραια μεταβλητή.')
        const from = yield* this.evaluate(statement.from), to = yield* this.evaluate(statement.to), step = yield* this.evaluate(statement.step)
        if (from.type !== 'integer' || to.type !== 'integer' || step.type !== 'integer') throw typeError(line, 'Τα όρια και το βήμα της ΓΙΑ πρέπει να είναι ακέραια.')
        const end = to.value as number, increment = step.value as number
        if (increment === 0) throw runtimeError(line, 'Το βήμα της ΓΙΑ δεν μπορεί να είναι μηδέν.')
        this.assign(statement.name, from, line)
        yield this.event('step', line, statement, 'initialize')
        let firstCheck = true
        while (true) {
          if (!firstCheck) yield* this.checkpoint(statement,'condition')
          firstCheck = false
          const current = this.cell(statement.name, line).value!.value as number
          const proceed = increment > 0 ? current <= end : current >= end
          this.comparisonsCount++
          yield this.event('step', line, statement, 'condition', proceed)
          if (!proceed) break
          this.guardLoop(line)
          this.activeForCounters.add(cell)
          try { yield* this.statements(statement.body) }
          finally { this.activeForCounters.delete(cell) }
          this.assign(statement.name, numberValue(current + increment, 'integer', line), line)
          yield this.event('step', line, statement, 'increment')
        }
      }
    }
  }
}
