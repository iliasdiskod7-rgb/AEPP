import { tokenize } from './lexer'
import { GlossaError, normalize, type Constant, type Declaration, type Expression, type Program, type Statement, type Token, type ValueType } from './types'

const typeNames: Record<string, ValueType> = { ΑΚΕΡΑΙΕΣ: 'integer', ΠΡΑΓΜΑΤΙΚΕΣ: 'real', ΛΟΓΙΚΕΣ: 'boolean', ΧΑΡΑΚΤΗΡΕΣ: 'string' }
const precedence: Record<string, number> = { 'Η': 1, 'ΚΑΙ': 2, '=': 3, '<>': 3, '<': 3, '<=': 3, '>': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, DIV: 5, MOD: 5, '^': 7 }
const reserved = new Set(['ΠΡΟΓΡΑΜΜΑ', 'ΣΤΑΘΕΡΕΣ', 'ΜΕΤΑΒΛΗΤΕΣ', 'ΑΡΧΗ', 'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', 'ΑΚΕΡΑΙΕΣ', 'ΠΡΑΓΜΑΤΙΚΕΣ', 'ΛΟΓΙΚΕΣ', 'ΧΑΡΑΚΤΗΡΕΣ', 'ΔΙΑΒΑΣΕ', 'ΓΡΑΨΕ', 'ΑΝ', 'ΤΟΤΕ', 'ΑΛΛΙΩΣ', 'ΑΛΛΙΩΣ_ΑΝ', 'ΤΕΛΟΣ_ΑΝ', 'ΟΣΟ', 'ΕΠΑΝΑΛΑΒΕ', 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ', 'ΜΕΧΡΙΣ_ΟΤΟΥ', 'ΓΙΑ', 'ΑΠΟ', 'ΜΕΧΡΙ', 'ΜΕ', 'ΒΗΜΑ', 'ΜΕ_ΒΗΜΑ', 'ΚΑΙ', 'Η', 'ΟΧΙ', 'DIV', 'MOD', 'ΑΛΗΘΗΣ', 'ΨΕΥΔΗΣ', 'ΕΠΙΛΕΞΕ', 'ΠΕΡΙΠΤΩΣΗ', 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ', 'ΔΙΑΔΙΚΑΣΙΑ', 'ΣΥΝΑΡΤΗΣΗ', 'ΚΑΛΕΣΕ'])
const closers = new Set(['ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', 'ΑΛΛΙΩΣ_ΑΝ', 'ΑΛΛΙΩΣ', 'ΤΕΛΟΣ_ΑΝ', 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', 'ΜΕΧΡΙΣ_ΟΤΟΥ', 'ΠΕΡΙΠΤΩΣΗ', 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'])
export const highlightWords = reserved

class Parser {
  private at = 0
  private tokens: Token[]
  constructor(tokens: Token[]) { this.tokens = tokens }
  private get current() { return this.tokens[this.at] }
  private is(text: string) { return normalize(this.current.text) === text }
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

  parse(): Program {
    this.skipLines()
    if (!this.accept('ΠΡΟΓΡΑΜΜΑ')) throw new GlossaError(this.current.line, 'Λείπει η επικεφαλίδα ΠΡΟΓΡΑΜΜΑ.')
    const name = this.name()
    this.endLine()
    const constants: Constant[] = []
    if (this.accept('ΣΤΑΘΕΡΕΣ')) {
      this.endLine()
      while (this.current.kind !== 'eof' && !this.is('ΜΕΤΑΒΛΗΤΕΣ') && !this.is('ΑΡΧΗ')) {
        const line = this.current.line
        const constantName = this.name()
        this.expect('=')
        constants.push({ name: constantName, expression: this.expression(), line })
        this.endLine()
      }
    }
    const declarations: Declaration[] = []
    if (this.accept('ΜΕΤΑΒΛΗΤΕΣ')) {
      this.endLine()
      while (this.current.kind !== 'eof' && !this.is('ΑΡΧΗ')) {
        const token = this.take()
        const type = typeNames[normalize(token.text)]
        if (!type) throw new GlossaError(token.line, 'Αναμενόταν τύπος μεταβλητής: ΑΚΕΡΑΙΕΣ, ΠΡΑΓΜΑΤΙΚΕΣ, ΛΟΓΙΚΕΣ ή ΧΑΡΑΚΤΗΡΕΣ.')
        this.expect(':')
        do { declarations.push({ name: this.name(), type, line: token.line }) } while (this.accept(','))
        this.endLine()
      }
    }
    this.expect('ΑΡΧΗ')
    this.endLine()
    const body = this.statements(new Set(['ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ']), 'Λείπει το ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ.')
    this.expect('ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')
    this.endLine()
    if (this.current.kind !== 'eof') throw new GlossaError(this.current.line, 'Υπάρχει κείμενο μετά το τέλος του προγράμματος.')
    const names = new Set<string>()
    for (const item of [...constants, ...declarations]) {
      if (names.has(item.name)) throw new GlossaError(item.line, `Το όνομα «${item.name}» έχει δηλωθεί ξανά.`)
      names.add(item.name)
    }
    return { name, constants, declarations, body }
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
    const line = this.current.line
    if (this.accept('ΔΙΑΒΑΣΕ')) {
      const names = [this.name()]
      while (this.accept(',')) names.push(this.name())
      this.endLine()
      return { kind: 'read', names, line }
    }
    if (this.accept('ΓΡΑΨΕ')) {
      const expressions = [this.expression()]
      while (this.accept(',')) expressions.push(this.expression())
      this.endLine()
      return { kind: 'write', expressions, line }
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
      return { kind: 'if', branches, otherwise, line }
    }
    if (this.accept('ΟΣΟ')) {
      const condition = this.expression()
      this.expect('ΕΠΑΝΑΛΑΒΕ'); this.endLine()
      const body = this.statements(new Set(['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ']), 'Ανοιχτή δομή ΟΣΟ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ.')
      this.expect('ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'); this.endLine()
      return { kind: 'while', condition, body, line }
    }
    if (this.accept('ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ')) {
      this.endLine()
      const body = this.statements(new Set(['ΜΕΧΡΙΣ_ΟΤΟΥ']), 'Ανοιχτή δομή ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ: Λείπει το ΜΕΧΡΙΣ_ΟΤΟΥ.')
      this.expect('ΜΕΧΡΙΣ_ΟΤΟΥ')
      const condition = this.expression(); this.endLine()
      return { kind: 'repeat', condition, body, line }
    }
    if (this.accept('ΓΙΑ')) {
      const name = this.name()
      if (!this.accept('ΑΠΟ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στη ΓΙΑ: Απαιτούνται οι λέξεις ΑΠΟ και ΜΕΧΡΙ.')
      const from = this.expression()
      if (!this.accept('ΜΕΧΡΙ')) throw new GlossaError(line, 'Λανθασμένη σύνταξη στη ΓΙΑ: Απαιτούνται οι λέξεις ΑΠΟ και ΜΕΧΡΙ.')
      const to = this.expression()
      let step: Expression = { kind: 'literal', value: { type: 'integer', value: 1 }, line }
      if (this.accept('ΜΕ')) { this.expect('ΒΗΜΑ'); step = this.expression() }
      else if (this.accept('ΜΕ_ΒΗΜΑ')) step = this.expression()
      this.endLine()
      const body = this.statements(new Set(['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ']), 'Ανοιχτή δομή ΓΙΑ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ.')
      this.expect('ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'); this.endLine()
      if (this.changesCounter(body, name)) throw new GlossaError(line, `Η αλλαγή της τιμής της μεταβλητής ελέγχου «${name}» δεν επιτρέπεται μέσα στο σώμα της ΓΙΑ.`)
      return { kind: 'for', name, from, to, step, body, line }
    }
    if (this.accept('ΕΠΙΛΕΞΕ')) {
      let depth = 1
      while (this.current.kind !== 'eof' && depth > 0) {
        if (this.is('ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')) break
        if (this.is('ΕΠΙΛΕΞΕ')) depth++
        if (this.is('ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ')) depth--
        this.take()
      }
      if (depth > 0) throw new GlossaError(line, 'Ανοιχτή δομή ΕΠΙΛΕΞΕ: Λείπει το ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ.')
      throw new GlossaError(line, 'Η δομή ΕΠΙΛΕΞΕ αναγνωρίζεται, αλλά δεν υποστηρίζεται ακόμη η εκτέλεσή της.')
    }
    if (this.current.kind === 'word' && !reserved.has(normalize(this.current.text))) {
      const name = this.name()
      if (!this.accept('<-')) throw new GlossaError(line, `Άγνωστη εντολή ή λανθασμένη εκχώρηση στη μεταβλητή «${name}». Χρησιμοποίησε το <-.`)
      const expression = this.expression(); this.endLine()
      return { kind: 'assign', name, expression, line }
    }
    throw new GlossaError(line, `Άγνωστη εντολή «${this.current.text}» ή λανθασμένο όνομα μεταβλητής/συνάρτησης.`)
  }

  private changesCounter(statements: Statement[], name: string): boolean {
    return statements.some(item => item.kind === 'assign' && item.name === name
      || item.kind === 'read' && item.names.includes(name)
      || item.kind === 'for' && (item.name === name || this.changesCounter(item.body, name))
      || item.kind === 'while' && this.changesCounter(item.body, name)
      || item.kind === 'repeat' && this.changesCounter(item.body, name)
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
      left = { kind: 'binary', operator, left, right, line: token.line }
    }
    return left
  }

  private primary(): Expression {
    const token = this.take()
    const word = normalize(token.text)
    if (token.kind === 'number') return { kind: 'literal', value: { type: token.text.includes('.') ? 'real' : 'integer', value: Number(token.text) }, line: token.line }
    if (token.kind === 'string') return { kind: 'literal', value: { type: 'string', value: token.text }, line: token.line }
    if (word === 'ΑΛΗΘΗΣ' || word === 'ΨΕΥΔΗΣ') return { kind: 'literal', value: { type: 'boolean', value: word === 'ΑΛΗΘΗΣ' }, line: token.line }
    if (word === 'ΟΧΙ') return { kind: 'unary', operator: word, operand: this.expression(3), line: token.line }
    if (word === '+' || word === '-') return { kind: 'unary', operator: word, operand: this.expression(6), line: token.line }
    if (word === '(') { const inner = this.expression(); if (!this.accept(')')) throw new GlossaError(token.line, 'Μη έγκυρη χρήση παρενθέσεων: Λείπει το ).'); return inner }
    if (token.kind === 'word' && !reserved.has(word)) {
      if (this.accept('(')) { const argument = this.expression(); if (!this.accept(')')) throw new GlossaError(token.line, 'Μη έγκυρη χρήση παρενθέσεων: Λείπει το ).'); return { kind: 'call', name: word, argument, line: token.line } }
      return { kind: 'variable', name: word, line: token.line }
    }
    throw new GlossaError(token.line, `Μη έγκυρος τελεστής ή έκφραση κοντά στο «${token.text}». Έλεγξε και τις παρενθέσεις.`)
  }
}

export function parseProgram(source: string): Program { return new Parser(tokenize(source)).parse() }
