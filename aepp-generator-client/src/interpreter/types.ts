export type ValueType = 'integer' | 'real' | 'boolean' | 'string'
export type Scalar = number | boolean | string
export interface Value { type: ValueType; value: Scalar }
export interface Token { kind: 'word' | 'number' | 'string' | 'symbol' | 'newline' | 'eof'; text: string; line: number; column: number }
export interface AstIdentity { nodeId?: string; column?: number }
export interface Declaration extends AstIdentity { name: string; type: ValueType; line: number; dimensions?: number[] }
export interface Constant extends AstIdentity { name: string; expression: Expression; line: number }
export type Expression = AstIdentity & (
  | { kind: 'literal'; value: Value; line: number }
  | { kind: 'variable'; name: string; line: number }
  | { kind: 'arrayAccess'; name: string; indexes: Expression[]; line: number }
  | { kind: 'unary'; operator: string; operand: Expression; line: number }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression; line: number }
  | { kind: 'call'; name: string; arguments: Expression[]; line: number }
)
export type CasePattern = AstIdentity & (
  | { kind: 'value'; expression: Expression }
  | { kind: 'range'; from: Expression; to: Expression }
  | { kind: 'comparison'; operator: string; expression: Expression }
)
export interface SelectionCase extends AstIdentity { patterns: CasePattern[]; body: Statement[]; line: number }
export type Statement = AstIdentity & (
  | { kind: 'assign'; name: string; indexes: Expression[]; expression: Expression; line: number }
  | { kind: 'read'; targets: Array<{ name: string; indexes: Expression[] }>; line: number }
  | { kind: 'write'; expressions: Expression[]; line: number }
  | { kind: 'if'; branches: Array<{ condition: Expression; body: Statement[] }>; otherwise: Statement[]; line: number }
  | { kind: 'select'; expression: Expression; cases: SelectionCase[]; otherwise: Statement[]; otherwiseLine?: number; line: number }
  | { kind: 'while'; condition: Expression; body: Statement[]; line: number }
  | { kind: 'repeat'; condition: Expression; body: Statement[]; line: number }
  | { kind: 'for'; name: string; from: Expression; to: Expression; step: Expression; body: Statement[]; line: number }
  | { kind: 'procedureCall'; name: string; arguments: Expression[]; line: number }
)
export interface Subprogram extends AstIdentity { kind: 'procedure' | 'function'; name: string; parameters: string[]; returnType?: ValueType; declarations: Declaration[]; body: Statement[]; line: number }
export interface Program extends AstIdentity { name: string; constants: Constant[]; declarations: Declaration[]; body: Statement[]; subprograms: Subprogram[] }
export interface VariableSnapshot {
  name: string; type: ValueType; value: Value | null; constant: boolean
  dimensions?: number[]
  elements?: Record<string, Value>
}
export interface MemoryReference { scopeId: number; name: string; indexes: number[] }
export type MemoryEvent =
  | { kind: 'ON_READ'; target: MemoryReference; value: Value | null; input?: boolean }
  | { kind: 'ON_COMPARE'; operands: MemoryReference[]; operator: string; result: boolean; leftValue: Value; rightValue: Value }
  | { kind: 'ON_MUTATE'; target: MemoryReference; previous: Value | null; value: Value; source?: MemoryReference }
  | { kind: 'ON_SWAP'; first: MemoryReference; second: MemoryReference; temporary: MemoryReference; values: [Value, Value] }
export interface NodeExecutionEvent {
  kind: 'ON_NODE_EXECUTE'; nodeId: string; line: number; originLine: number; varsState: VariableSnapshot[]
  phase: 'statement' | 'condition' | 'initialize' | 'increment' | 'input' | 'default'; condition?: boolean
}
export interface CallStackFrame {
  scopeId: number; name: string; kind: 'program' | 'procedure' | 'function'; line: number
  variables: VariableSnapshot[]
}
export interface BreakpointHitEvent {
  kind: 'ON_BREAKPOINT_HIT'; line: number; state: CallStackFrame[]
}
export interface MemoryFrameEvent {
  debugStepIndex?: number; callStack?: CallStackFrame[]; debugPhase?: 'before' | 'after'; breakpointHit?: BreakpointHitEvent; nodeExecution?: NodeExecutionEvent; memoryEvents?: MemoryEvent[]; scopeId?: number; scopeName?: string }

export type ExecutionEvent = MemoryFrameEvent & (
  | { kind: 'step'; line: number; variables: VariableSnapshot[]; output: string[] }
  | { kind: 'input'; line: number; name: string; type: ValueType; variables: VariableSnapshot[]; output: string[] }
  | { kind: 'done'; variables: VariableSnapshot[]; output: string[] })

export class GlossaError extends Error {
  line: number
  category: 'syntax' | 'type' | 'runtime'
  description: string
  constructor(line: number, message: string, category: 'syntax' | 'type' | 'runtime' = 'syntax') {
    super(`Γραμμή ${line}: ${message}`)
    this.line = line
    this.category = category
    this.description = message
    this.name = 'GlossaError'
  }
}

export const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase('el-GR')
