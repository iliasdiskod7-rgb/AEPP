import { builtinNames } from './builtins'
import { resolveConstants } from './constants'
import { analyzeProgram } from './staticChecker'
import { tokenize } from './lexer'
import { GlossaError, normalize, type CasePattern, type SelectionCase, type Value, type Constant, type Declaration, type Expression, type Program, type Statement, type Subprogram, type Token, type ValueType } from './types'

const typeNames: Record<string, ValueType> = { ΑΚΕΡΑΙΕΣ: 'integer', ΠΡΑΓΜΑΤΙΚΕΣ: 'real', ΛΟΓΙΚΕΣ: 'boolean', ΧΑΡΑΚΤΗΡΕΣ: 'string' }
const returnTypes: Record<string, ValueType> = { ΑΚΕΡΑΙΑ: 'integer', ΠΡΑΓΜΑΤΙΚΗ: 'real', ΛΟΓΙΚΗ: 'boolean', ΧΑΡΑΚΤΗΡΑΣ: 'string' }
// Κοινή προτεραιότητα για τον parser και την εκτύπωση εκφράσεων.
export const precedence: Readonly<Record<string, number>> = { 'Η': 1, 'ΚΑΙ': 2, '=': 3, '<>': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, DIV: 5, MOD: 5, '^': 7 }
const reserved = new Set(['ΠΡΟΓΡΑΜΜΑ', 'ΣΤΑΘΕΡΕΣ', 'ΜΕΤΑΒΛΗΤΕΣ', 'ΑΡΧΗ', 'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', 'ΑΚΕΡΑΙΕΣ', 'ΠΡΑΓΜΑΤΙΚΕΣ', 'ΛΟΓΙΚΕΣ', 'ΧΑΡΑΚΤΗΡΕΣ', 'ΑΚΕΡΑΙΑ', 'ΠΡΑΓΜΑΤΙΚΗ', 'ΛΟΓΙΚΗ', 'ΧΑΡΑΚΤΗΡΑΣ', 'ΔΙΑΒΑΣΕ', 'ΓΡΑΨΕ', 'ΑΝ', 'ΤΟΤΕ', 'ΑΛΛΙΩΣ', 'ΑΛΛΙΩΣ_ΑΝ', 'ΤΕΛΟΣ_ΑΝ', 'ΟΣΟ', 'ΕΠΑΝΑΛΑΒΕ', 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ', 'ΜΕΧΡΙΣ_ΟΤΟΥ', 'ΓΙΑ', 'ΑΠΟ', 'ΜΕΧΡΙ', 'ΜΕ', 'ΒΗΜΑ', 'ΜΕ_ΒΗΜΑ', 'ΚΑΙ', 'Η', 'ΟΧΙ', 'DIV', 'MOD', 'ΑΛΗΘΗΣ', 'ΨΕΥΔΗΣ', 'ΕΠΙΛΕΞΕ', 'ΠΕΡΙΠΤΩΣΗ', 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ', 'ΔΙΑΔΙΚΑΣΙΑ', 'ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ', 'ΣΥΝΑΡΤΗΣΗ', 'ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ', 'ΚΑΛΕΣΕ'])
const closers = new Set(['ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', 'ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ', 'ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ', 'ΑΛΛΙΩΣ_ΑΝ', 'ΑΛΛΙΩΣ', 'ΤΕΛΟΣ_ΑΝ', 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', 'ΜΕΧΡΙΣ_ΟΤΟΥ', 'ΠΕΡΙΠΤΩΣΗ', 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'])
export const highlightWords = reserved

class Parser {
  private at = 0
  private constantValues = new Map<string, Value>()
  private tokens: Token[]
  constructor(tokens: Token[]) { this.tokens = tokens }
  private get current() { return this.tokens[this.at] }
  private is(text: string) { return this.current.kind !== 'string' && normalize(this.current.text) === text }
  private take() { return this.tokens[this.at++] }
  private accept(text: string) { if (this.is(text)) { this.take(); return true } return false }
  private expect(text: string) { if (!this.accept(text)) throw new GlossaError(this.current.line, `Αναμενόταν «${text}».`) }
  private name(): string {
    const token = this.current
    if (token.kind !== 'word' || reserved.has(normalize(token.text))) throw new GlossaError(token.line, 'Αναμενόταν όνομα μεταβλητής ή προγράμματος.')
    return normalize(this.take().text)
  }
  private endLine() {
    if (this.current.kind === 'eof') return
    if (this.current.kind !== 'newline') throw new GlossaError(this.current.line, `Απροσδόκητο «${this.current.text}» στο τέλος της εντολής.`)
    this.skipLines()
  }
  private skipLines() { while (this.current.kind === 'newline') this.take() }
  private arguments(): Expression[] {
    this.expect('(')
    const argumentsList: Expression[] = []
    if (!this.is(')')) {
      do { argumentsList.push(this.expression()) } while (this.accept(','))
    }
    this.expect(')')
    return argumentsList
  }
  private indexes(): Expression[] {
    if (!this.accept('[')) return []
    const indexes = [this.expression()]
    while (this.accept(',')) indexes.push(this.expression())
    this.expect(']')
    return indexes
  }
  private target() {
    const name = this.name()
    return { name, indexes: this.indexes() }
  }
  private declarations(): Declaration[] {
    const declarations: Declaration[] = []
    if (!this.accept('ΜΕΤΑΒΛΗΤΕΣ')) return declarations
    this.endLine()
    while (this.current.kind !== 'eof' && !this.is('ΑΡΧΗ')) {
      const token = this.take()
      const type = typeNames[normalize(token.text)]
      if (!type) throw new GlossaError(token.line, 'Αναμενόταν τύπος μεταβλητής: ΑΚΕΡΑΙΕΣ, ΠΡΑΓΜΑΤΙΚΕΣ, ΛΟΓΙΚΕΣ ή ΧΑΡΑΚΤΗΡΕΣ.')
      this.expect(':')
      do {
        const name = this.name()
        let dimensions: number[] | undefined
        if (this.accept('[')) {
          dimensions = []
          do {
            const size = this.current
            const symbolic = size.kind === 'word' ? this.constantValues.get(normalize(size.text)) : undefined
            const value = size.kind === 'number' && /^\d+$/u.test(size.text) ? Number(size.text) : symbolic?.type === 'integer' ? symbolic.value : undefined
            if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new GlossaError(size.line, 'Οι διαστάσεις πίνακα πρέπει να είναι θετικοί ακέραιοι ή προηγουμένως δηλωμένες ακέραιες σταθερές.')
            this.take(); dimensions.push(value)
          } while (this.accept(','))
          this.expect(']')
          if (dimensions.length > 2) throw new GlossaError(token.line, 'Υποστηρίζονται πίνακες μίας ή δύο διαστάσεων.')
        }
        declarations.push({ name, type, line: token.line, column: token.column, dimensions })
      } while (this.accept(','))
      this.endLine()
    }
    return declarations
  }
  private subprogram(): Subprogram {
    const line = this.current.line, column = this.current.column
    const kind = this.accept('ΔΙΑΔΙΚΑΣΙΑ') ? 'procedure' : (this.expect('ΣΥΝΑΡΤΗΣΗ'), 'function')
    const name = this.name()
    this.expect('(')
    const parameters: string[] = []
    if (!this.is(')')) do { parameters.push(this.name()) } while (this.accept(','))
    this.expect(')')
    let returnType: ValueType | undefined
    if (kind === 'function') {
      this.expect(':')
      returnType = returnTypes[normalize(this.current.text)]
      if (!returnType) throw new GlossaError(this.current.line, 'Αναμενόταν τύπος συνάρτησης: ΑΚΕΡΑΙΑ, ΠΡΑΓΜΑΤΙΚΗ, ΛΟΓΙΚΗ ή ΧΑΡΑΚΤΗΡΑΣ.')
      this.take()
    }
    this.endLine()
    const declarations = this.declarations()
    const seen = new Set<string>([name])
    for (const item of declarations) {
      if (seen.has(item.name)) throw new GlossaError(item.line, `Το όνομα «${item.name}» έχει δηλωθεί ξανά.`)
      seen.add(item.name)
    }
    for (const parameter of parameters) if (!seen.has(parameter)) throw new GlossaError(line, `Η παράμετρος «${parameter}» πρέπει να δηλωθεί στο τμήμα ΜΕΤΑΒΛΗΤΕΣ.`)
    if (new Set(parameters).size !== parameters.length) throw new GlossaError(line, 'Μια παράμετρος δηλώθηκε περισσότερες από μία φορές.')
    this.expect('ΑΡΧΗ'); this.endLine()
    const closer = kind === 'function' ? 'ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ' : 'ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
    const body = this.statements(new Set([closer]), `Ανοιχτό υποπρόγραμμα: Λείπει το ${closer}.`)
    this.expect(closer); this.endLine()
    return { kind, name, parameters, returnType, declarations, body, line, column }
  }

  parse(): Program {
    this.skipLines()
    if (!this.accept('ΠΡΟΓΡΑΜΜΑ')) throw new GlossaError(this.current.line, 'Λείπει η επικεφαλίδα ΠΡΟΓΡΑΜΜΑ.')
    const name = this.name()
    this.endLine()
    const constants: Constant[] = []
    if (this.accept('ΣΤΑΘΕΡΕΣ')) {
      this.endLine()
      while (this.current.kind !== 'eof' && !this.is('ΜΕΤΑΒΛΗΤΕΣ') && !this.is('ΑΡΧΗ')) {
        const line = this.current.line, column = this.current.column
        const constantName = this.name()
        this.expect('=')
        constants.push({ name: constantName, expression: this.expression(), line, column })
        this.endLine()
      }
    }
    this.constantValues = resolveConstants(constants)
    const declarations = this.declarations()
    this.expect('ΑΡΧΗ')
    this.endLine()
    const body = this.statements(new Set(['ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ']), 'Λείπει το ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ.')
    this.expect('ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')
    this.endLine()
    const subprograms: Subprogram[] = []
    while (this.is('ΔΙΑΔΙΚΑΣΙΑ') || this.is('ΣΥΝΑΡΤΗΣΗ')) subprograms.push(this.subprogram())
    if (this.current.kind !== 'eof') throw new GlossaError(this.current.line, 'Υπάρχει κείμενο μετά το τέλος του προγράμματος ή των υποπρογραμμάτων.')
    const names = new Set<string>()
    for (const item of [...constants, ...declarations]) {
      if (names.has(item.name)) throw new GlossaError(item.line, `Το όνομα «${item.name}» έχει δηλωθεί ξανά.`)
      names.add(item.name)
    }
    const routineNames = new Set([name, ...Object.keys(returnTypes), ...builtinNames])
    for (const item of subprograms) {
      if (routineNames.has(item.name)) throw new GlossaError(item.line, `Το όνομα υποπρογράμματος «${item.name}» έχει δηλωθεί ξανά ή είναι δεσμευμένο.`)
      routineNames.add(item.name)
    }
    return { name, constants, declarations, body, subprograms }
  }

  private statements(stop: Set<string>, missing: string): Statement[] {
    const body: Statement[] = []
    this.skipLines()
    while (this.current.kind !== 'eof' && !stop.has(normalize(this.current.text))) {
      if (closers.has(normalize(this.current.text))) throw new GlossaError(this.current.line, missing)
      body.push(this.statement())
      this.skipLines()
    }
    if (this.current.kind === 'eof') throw new GlossaError(this.current.line, missing)
    return body
  }

  private statement(): Statement {
    const line = this.current.line, column = this.current.column
    if (this.accept('ΔΙΑΒΑΣΕ')) {
      const targets = [this.target()]
      while (this.accept(',')) targets.push(this.target())
      this.endLine()
      return { kind: 'read', targets, line, column }
    }
    if (this.accept('ΓΡΑΨΕ')) {
      const expressions = [this.expression()]
      while (this.accept(',')) expressions.push(this.expression())
      this.endLine()
      return { kind: 'write', expressions, line, column }
    }
    if (this.accept('ΚΑΛΕΣΕ')) {
      const name = this.name()
      const args = this.arguments()
      this.endLine()
      return { kind: 'procedureCall', name, arguments: args, line, column }
    }
    if (this.accept('ΑΝ')) {
      const branches: Array<{ condition: Expression; body: Statement[] }> = []
      const condition = this.expression()
      if (!this.accept('ΤΟΤΕ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στην ΑΝ: Λείπει η λέξη ΤΟΤΕ.')
      this.endLine()
      branches.push({ condition, body: this.statements(new Set(['ΑΛΛΙΩΣ_ΑΝ', 'ΑΛΛΙΩΣ', 'ΤΕΛΟΣ_ΑΝ']), 'Ανοιχτή δομή ΑΝ: Λείπει το ΤΕΛΟΣ_ΑΝ.') })
      while (this.accept('ΑΛΛΙΩΣ_ΑΝ')) {
        const next = this.expression()
        if (!this.accept('ΤΟΤΕ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στην ΑΛΛΙΩΣ_ΑΝ: Λείπει η λέξη ΤΟΤΕ.')
        this.endLine()
        branches.push({ condition: next, body: this.statements(new Set(['ΑΛΛΙΩΣ_ΑΝ', 'ΑΛΛΙΩΣ', 'ΤΕΛΟΣ_ΑΝ']), 'Ανοιχτή δομή ΑΝ: Λείπει το ΤΕΛΟΣ_ΑΝ.') })
      }
      let otherwise: Statement[] = []
      if (this.accept('ΑΛΛΙΩΣ')) { this.endLine(); otherwise = this.statements(new Set(['ΤΕΛΟΣ_ΑΝ']), 'Ανοιχτή δομή ΑΝ: Λείπει το ΤΕΛΟΣ_ΑΝ.') }
      this.expect('ΤΕΛΟΣ_ΑΝ'); this.endLine()
      return { kind: 'if', branches, otherwise, line, column }
    }
    if (this.accept('ΟΣΟ')) {
      const condition = this.expression()
      this.expect('ΕΠΑΝΑΛΑΒΕ'); this.endLine()
      const body = this.statements(new Set(['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ']), 'Ανοιχτή δομή ΟΣΟ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ.')
      this.expect('ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'); this.endLine()
      return { kind: 'while', condition, body, line, column }
    }
    if (this.accept('ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ')) {
      this.endLine()
      const body = this.statements(new Set(['ΜΕΧΡΙΣ_ΟΤΟΥ']), 'Ανοιχτή δομή ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ: Λείπει το ΜΕΧΡΙΣ_ΟΤΟΥ.')
      this.expect('ΜΕΧΡΙΣ_ΟΤΟΥ')
      const condition = this.expression(); this.endLine()
      return { kind: 'repeat', condition, body, line, column }
    }
    if (this.accept('ΓΙΑ')) {
      const name = this.name()
      if (!this.accept('ΑΠΟ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στη ΓΙΑ: Απαιτούνται οι λέξεις ΑΠΟ και ΜΕΧΡΙ.')
      const from = this.expression()
      if (!this.accept('ΜΕΧΡΙ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στη ΓΙΑ: Απαιτούνται οι λέξεις ΑΠΟ και ΜΕΧΡΙ.')
      const to = this.expression()
      let step: Expression = { kind: 'literal', value: { type: 'integer', value: 1 }, line, column }
      if (this.accept('ΜΕ')) { this.expect('ΒΗΜΑ'); step = this.expression() }
      else if (this.accept('ΜΕ_ΒΗΜΑ')) step = this.expression()
      this.endLine()
      const body = this.statements(new Set(['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ']), 'Ανοιχτή δομή ΓΙΑ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ.')
      this.expect('ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'); this.endLine()
      if (this.changesCounter(body, name)) throw new GlossaError(line, `Η αλλαγή της τιμής της μεταβλητής ελέγχου «${name}» δεν επιτρέπεται μέσα στο σώμα της ΓΙΑ.`)
      return { kind: 'for', name, from, to, step, body, line, column }
    }
    if (this.accept('ΕΠΙΛΕΞΕ')) {
      const expression = this.expression(); this.endLine()
      const cases: SelectionCase[] = []
      let otherwise: Statement[] = [], otherwiseLine: number | undefined
      const missing = 'Ανοιχτή δομή ΕΠΙΛΕΞΕ: Λείπει το ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ.'
      while (this.accept('ΠΕΡΙΠΤΩΣΗ')) {
        const caseLine = this.tokens[this.at-1].line
        if (otherwiseLine !== undefined) throw new GlossaError(caseLine,'Η ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ πρέπει να είναι η τελευταία περίπτωση.')
        if (this.accept('ΑΛΛΙΩΣ')) {
          otherwiseLine=caseLine; this.endLine()
          otherwise=this.statements(new Set(['ΠΕΡΙΠΤΩΣΗ','ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ']),missing)
        } else {
          const patterns: CasePattern[] = []
          do {
            if (['=','<>','<','<=','>','>='].includes(this.current.text)) {
              const operator=this.take().text
              patterns.push({kind:'comparison',operator,expression:this.expression()})
            } else {
              const from=this.expression()
              patterns.push(this.accept('..') ? {kind:'range',from,to:this.expression()} : {kind:'value',expression:from})
            }
          } while(this.accept(','))
          this.endLine()
          cases.push({patterns,line:caseLine,body:this.statements(new Set(['ΠΕΡΙΠΤΩΣΗ','ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ']),missing)})
        }
      }
      if(!cases.length)throw new GlossaError(line,'Η ΕΠΙΛΕΞΕ απαιτεί τουλάχιστον μία ΠΕΡΙΠΤΩΣΗ τιμών.')
      if(!this.accept('ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'))throw new GlossaError(line,missing)
      this.endLine()
      return {kind:'select',expression,cases,otherwise,otherwiseLine,line,column}
    }
    if (this.current.kind === 'word' && !reserved.has(normalize(this.current.text))) {
      const { name, indexes } = this.target()
      if (!this.accept('<-')) throw new GlossaError(line, `Άγνωστη εντολή ή λανθασμένη εκχώρηση στη μεταβλητή «${name}». Χρησιμοποίησε το <-.`)
      const expression = this.expression(); this.endLine()
      return { kind: 'assign', name, indexes, expression, line, column }
    }
    throw new GlossaError(line, `Άγνωστη εντολή «${this.current.text}» ή λανθασμένο όνομα μεταβλητής/συνάρτησης.`)
  }

  private changesCounter(statements: Statement[], name: string): boolean {
    return statements.some(item => item.kind === 'assign' && item.name === name
      || item.kind === 'read' && item.targets.some(target => target.name === name)
      || item.kind === 'for' && (item.name === name || this.changesCounter(item.body, name))
      || item.kind === 'while' && this.changesCounter(item.body, name)
      || item.kind === 'repeat' && this.changesCounter(item.body, name)
      || item.kind === 'select' && (item.cases.some(branch => this.changesCounter(branch.body, name)) || this.changesCounter(item.otherwise, name))
      || item.kind === 'if' && (item.branches.some(branch => this.changesCounter(branch.body, name)) || this.changesCounter(item.otherwise, name)))
  }

  private expression(minimum = 0): Expression {
    let left = this.primary()
    while (true) {
      const operator = normalize(this.current.text)
      const priority = precedence[operator]
      if (priority === undefined || priority < minimum) break
      const token = this.take()
      const right = this.expression(priority + (operator === '^' ? 0 : 1))
      left = { kind: 'binary', operator, left, right, line: token.line, column: token.column }
    }
    return left
  }

  private primary(): Expression {
    const token = this.take()
    const word = normalize(token.text)
    if (token.kind === 'number') return { kind: 'literal', value: { type: token.text.includes('.') ? 'real' : 'integer', value: Number(token.text) }, line: token.line, column: token.column }
    if (token.kind === 'string') return { kind: 'literal', value: { type: 'string', value: token.text }, line: token.line, column: token.column }
    if (word === 'ΑΛΗΘΗΣ' || word === 'ΨΕΥΔΗΣ') return { kind: 'literal', value: { type: 'boolean', value: word === 'ΑΛΗΘΗΣ' }, line: token.line, column: token.column }
    if (word === 'ΟΧΙ') return { kind: 'unary', operator: word, operand: this.expression(3), line: token.line, column: token.column }
    if (word === '+' || word === '-') return { kind: 'unary', operator: word, operand: this.expression(6), line: token.line, column: token.column }
    if (word === '(') { const inner = this.expression(); if (!this.accept(')')) throw new GlossaError(token.line, 'Μη έγκυρη χρήση παρενθέσεων: Λείπει το ).'); return inner }
    if (token.kind === 'word' && !reserved.has(word)) {
      if (this.is('(')) return { kind: 'call', name: word, arguments: this.arguments(), line: token.line, column: token.column }
      if (this.is('[')) return { kind: 'arrayAccess', name: word, indexes: this.indexes(), line: token.line, column: token.column }
      return { kind: 'variable', name: word, line: token.line, column: token.column }
    }
    throw new GlossaError(token.line, `Μη έγκυρος τελεστής ή έκφραση κοντά στο «${token.text}». Έλεγξε και τις παρενθέσεις.`)
  }
}

// Σταθερή προδιάταξη: ίδιος πηγαίος κώδικας δίνει τα ίδια IDs και σε δεύτερη ανάλυση.
function identifyNodes(value: unknown, tokens: Token[], counts = new Map<string, number>(), inheritedLine = 1): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) { value.forEach(child => identifyNodes(child, tokens, counts, inheritedLine)); return }
  const node = value as Record<string, unknown>
  const line = typeof node.line === 'number' ? node.line : inheritedLine
  // Τα αντικείμενα Value δεν είναι κόμβοι AST.
  if (!('value' in node && 'type' in node) && ('kind' in node || 'body' in node || 'expression' in node || 'indexes' in node || 'declarations' in node || 'patterns' in node || 'condition' in node || 'line' in node)) {
    const column = typeof node.column === 'number' ? node.column : tokens.find(token => token.line === line && token.kind !== 'newline')?.column ?? 1
    const base = 'node_line_' + line + '_col_' + column
    const ordinal = counts.get(base) ?? 0
    counts.set(base, ordinal + 1)
    node.nodeId = base + '_' + ordinal
    node.column = column
  }
  Object.entries(node).forEach(([key, child]) => { if (key !== 'nodeId') identifyNodes(child, tokens, counts, line) })
}
export function parseProgram(source: string): Program {
  const tokens = tokenize(source), program = new Parser(tokens).parse()
  identifyNodes(program, tokens)
  analyzeProgram(program)
  return program
}
