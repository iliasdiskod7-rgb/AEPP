import { GlossaError, normalize, type ExecutionEvent, type Expression, type Program, type Statement, type Value, type ValueType, type VariableSnapshot } from './types'

type Cell = { type: ValueType; value: Value | null; constant: boolean }
const typeError = (line: number, message: string) => new GlossaError(line, message, 'type')
const runtimeError = (line: number, message: string) => new GlossaError(line, message, 'runtime')
const MAX_LOOP_ITERATIONS = 100_000
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
  private cells = new Map<string, Cell>()
  private output: string[] = []
  private loopIterations = 0
  private program: Program
  constructor(program: Program) {
    this.program = program
    for (const item of program.constants) {
      const value = this.evaluate(item.expression)
      this.cells.set(item.name, { type: value.type, value, constant: true })
    }
    for (const item of program.declarations) this.cells.set(item.name, { type: item.type, value: null, constant: false })
  }

  private snapshot(): VariableSnapshot[] {
    return [...this.cells].map(([name, cell]) => ({ name, type: cell.type, value: cell.value ? { ...cell.value } : null, constant: cell.constant }))
  }
  private event(kind: 'step' | 'done', line = 0): ExecutionEvent { return { kind, line, variables: this.snapshot(), output: [...this.output] } as ExecutionEvent }
  private guardLoop(line: number) {
    if (++this.loopIterations > MAX_LOOP_ITERATIONS) throw runtimeError(line, 'Ανιχνεύθηκε πιθανός ατέρμονας βρόχος (ξεπεράστηκε το όριο των 100.000 επαναλήψεων).')
  }
  private cell(name: string, line: number): Cell {
    const cell = this.cells.get(name)
    if (!cell) throw typeError(line, `Η μεταβλητή «${name}» δεν έχει δηλωθεί στο τμήμα ΜΕΤΑΒΛΗΤΕΣ.`)
    return cell
  }
  private assign(name: string, value: Value, line: number) {
    const cell = this.cell(name, line)
    if (cell.constant) throw typeError(line, `Η σταθερά «${name}» δεν επιτρέπεται να αλλάξει.`)
    if (cell.type !== value.type && !(cell.type === 'real' && value.type === 'integer')) {
      const detail = cell.type === 'integer' && value.type === 'real'
        ? 'Προσπάθεια εκχώρησης πραγματικού αριθμού σε ακέραια μεταβλητή χωρίς χρήση div/mod ή Α_Μ().'
        : value.type === 'string' && (cell.type === 'integer' || cell.type === 'real')
          ? 'Προσπάθεια εκχώρησης αλφαριθμητικού σε αριθμητική μεταβλητή.'
          : `Η «${name}» είναι ${label[cell.type]}, αλλά η έκφραση είναι ${label[value.type]}.`
      throw typeError(line, `Ασυμβίβαστοι τύποι: ${detail}`)
    }
    cell.value = cell.type === 'real' && value.type === 'integer' ? { type: 'real', value: value.value } : value
  }

  private evaluate(expression: Expression): Value {
    const line = expression.line
    if (expression.kind === 'literal') return expression.value
    if (expression.kind === 'variable') {
      const cell = this.cell(expression.name, line)
      if (!cell.value) throw typeError(line, `Χρήση της μεταβλητής «${expression.name}» χωρίς να έχει λάβει αρχική τιμή (με ΔΙΑΒΑΣΕ ή εκχώρηση).`)
      return cell.value
    }
    if (expression.kind === 'unary') {
      const operand = this.evaluate(expression.operand)
      if (expression.operator === 'ΟΧΙ') return { type: 'boolean', value: !logical(operand, line) }
      return numberValue(expression.operator === '-' ? -numeric(operand, line) : numeric(operand, line), operand.type as 'integer' | 'real', line)
    }
    if (expression.kind === 'call') {
      const arg = this.evaluate(expression.argument)
      const n = numeric(arg, line)
      switch (expression.name) {
        case 'Α_Τ': return numberValue(Math.abs(n), arg.type as 'integer' | 'real', line)
        case 'Α_Μ': return numberValue(Math.trunc(n), 'integer', line)
        case 'Τ_Ρ': if (n < 0) throw runtimeError(line, 'Προσπάθεια υπολογισμού τετραγωνικής ρίζας Τ_Ρ() με αρνητικό όρισμα.')
          return numberValue(Math.sqrt(n), 'real', line)
        case 'ΗΜ': return numberValue(Math.sin(n * Math.PI / 180), 'real', line)
        case 'ΣΥΝ': return numberValue(Math.cos(n * Math.PI / 180), 'real', line)
        case 'ΕΦ': if (Math.abs(Math.cos(n * Math.PI / 180)) < 1e-12) throw runtimeError(line, 'Η εφαπτομένη δεν ορίζεται για αυτή τη γωνία.')
          return numberValue(Math.tan(n * Math.PI / 180), 'real', line)
        default: throw typeError(line, `Η συνάρτηση «${expression.name}» δεν υποστηρίζεται σε αυτή την έκδοση.`)
      }
    }
    const left = this.evaluate(expression.left)
    if (expression.operator === 'ΚΑΙ') return { type: 'boolean', value: logical(left, line) && logical(this.evaluate(expression.right), line) }
    if (expression.operator === 'Η') return { type: 'boolean', value: logical(left, line) || logical(this.evaluate(expression.right), line) }
    const right = this.evaluate(expression.right)
    if (['=', '<>', '<', '<=', '>', '>='].includes(expression.operator)) {
      if (left.type !== right.type && !(isNumber(left) && isNumber(right))) throw typeError(line, 'Η σύγκριση απαιτεί συμβατούς τύπους.')
      if (left.type === 'boolean' && !['=', '<>'].includes(expression.operator)) throw typeError(line, 'Οι λογικές τιμές συγκρίνονται μόνο με = ή <>.')
      const a = left.value, b = right.value
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'el-GR')
      const matched = expression.operator === '=' ? comparison === 0 : expression.operator === '<>' ? comparison !== 0
        : expression.operator === '<' ? comparison < 0 : expression.operator === '<=' ? comparison <= 0
          : expression.operator === '>' ? comparison > 0 : comparison >= 0
      return { type: 'boolean', value: matched }
    }
    const a = numeric(left, line), b = numeric(right, line)
    if (['DIV', 'MOD'].includes(expression.operator) && (left.type !== 'integer' || right.type !== 'integer')) throw typeError(line, 'Οι DIV και MOD απαιτούν ακέραιους τελεστέους.')
    if (['/', 'DIV', 'MOD'].includes(expression.operator) && b === 0) throw runtimeError(line, 'Προσπάθεια διαίρεσης με το μηδέν (με /, div ή mod).')
    const result = expression.operator === '+' ? a + b : expression.operator === '-' ? a - b
      : expression.operator === '*' ? a * b : expression.operator === '/' ? a / b
        : expression.operator === '^' ? a ** b : expression.operator === 'DIV' ? Math.trunc(a / b) : a % b
    const resultType = expression.operator === '/' || expression.operator === '^' && (!Number.isInteger(result) || b < 0) || left.type === 'real' || right.type === 'real' ? 'real' : 'integer'
    return numberValue(result, resultType, line)
  }

  *execute(): Generator<ExecutionEvent, void, Value | undefined> {
    yield* this.statements(this.program.body)
    yield this.event('done')
  }

  private *statements(body: Statement[]): Generator<ExecutionEvent, void, Value | undefined> {
    for (const statement of body) {
      const line = statement.line
      if (statement.kind === 'assign') {
        this.assign(statement.name, this.evaluate(statement.expression), line)
        yield this.event('step', line)
      } else if (statement.kind === 'read') {
        for (const name of statement.names) {
          const cell = this.cell(name, line)
          if (cell.constant) throw typeError(line, `Η σταθερά «${name}» δεν μπορεί να διαβαστεί.`)
          const value: Value | undefined = yield { kind: 'input', line, name, type: cell.type, variables: this.snapshot(), output: [...this.output] }
          if (!value) throw runtimeError(line, `Δεν δόθηκε τιμή για τη μεταβλητή «${name}».`)
          this.assign(name, value, line)
          yield this.event('step', line)
        }
      } else if (statement.kind === 'write') {
        this.output.push(statement.expressions.map(expression => displayValue(this.evaluate(expression))).join(''))
        yield this.event('step', line)
      } else if (statement.kind === 'if') {
        let chosen = statement.otherwise
        for (const branch of statement.branches) if (logical(this.evaluate(branch.condition), line)) { chosen = branch.body; break }
        yield this.event('step', line)
        yield* this.statements(chosen)
      } else if (statement.kind === 'while') {
        while (true) {
          const proceed = logical(this.evaluate(statement.condition), line)
          yield this.event('step', line)
          if (!proceed) break
          this.guardLoop(line)
          yield* this.statements(statement.body)
        }
      } else if (statement.kind === 'repeat') {
        do {
          this.guardLoop(line)
          yield* this.statements(statement.body)
          const done = logical(this.evaluate(statement.condition), line)
          yield this.event('step', line)
          if (done) break
        } while (true)
      } else if (statement.kind === 'for') {
        const cell = this.cell(statement.name, line)
        if (cell.constant || cell.type !== 'integer') throw typeError(line, 'Η μεταβλητή ελέγχου της ΓΙΑ πρέπει να είναι ακέραια μεταβλητή.')
        const from = this.evaluate(statement.from), to = this.evaluate(statement.to), step = this.evaluate(statement.step)
        if (from.type !== 'integer' || to.type !== 'integer' || step.type !== 'integer') throw typeError(line, 'Τα όρια και το βήμα της ΓΙΑ πρέπει να είναι ακέραια.')
        const end = to.value as number, increment = step.value as number
        if (increment === 0) throw runtimeError(line, 'Το βήμα της ΓΙΑ δεν μπορεί να είναι μηδέν.')
        this.assign(statement.name, from, line)
        while (true) {
          const current = this.cell(statement.name, line).value!.value as number
          const proceed = increment > 0 ? current <= end : current >= end
          yield this.event('step', line)
          if (!proceed) break
          this.guardLoop(line)
          yield* this.statements(statement.body)
          this.assign(statement.name, numberValue(current + increment, 'integer', line), line)
        }
      }
    }
  }
}
