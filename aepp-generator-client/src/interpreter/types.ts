export type ValueType = 'integer' | 'real' | 'boolean' | 'string'
export type Scalar = number | boolean | string
export interface Value { type: ValueType; value: Scalar }
export interface Token { kind: 'word' | 'number' | 'string' | 'symbol' | 'newline' | 'eof'; text: string; line: number; column: number }
export interface Declaration { name: string; type: ValueType; line: number }
export interface Constant { name: string; expression: Expression; line: number }
export type Expression =
  | { kind: 'literal'; value: Value; line: number }
  | { kind: 'variable'; name: string; line: number }
  | { kind: 'unary'; operator: string; operand: Expression; line: number }
  | { kind: 'binary'; operator: string; left: Expression; right: Expression; line: number }
  | { kind: 'call'; name: string; argument: Expression; line: number }
export type Statement =
  | { kind: 'assign'; name: string; expression: Expression; line: number }
  | { kind: 'read'; names: string[]; line: number }
  | { kind: 'write'; expressions: Expression[]; line: number }
  | { kind: 'if'; branches: Array<{ condition: Expression; body: Statement[] }>; otherwise: Statement[]; line: number }
  | { kind: 'while'; condition: Expression; body: Statement[]; line: number }
  | { kind: 'repeat'; condition: Expression; body: Statement[]; line: number }
  | { kind: 'for'; name: string; from: Expression; to: Expression; step: Expression; body: Statement[]; line: number }
export interface Program { name: string; constants: Constant[]; declarations: Declaration[]; body: Statement[] }
export interface VariableSnapshot { name: string; type: ValueType; value: Value | null; constant: boolean }
export type ExecutionEvent =
  | { kind: 'step'; line: number; variables: VariableSnapshot[]; output: string[] }
  | { kind: 'input'; line: number; name: string; type: ValueType; variables: VariableSnapshot[]; output: string[] }
  | { kind: 'done'; variables: VariableSnapshot[]; output: string[] }

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
