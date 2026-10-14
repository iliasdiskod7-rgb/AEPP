import { parseProgram, precedence } from '../interpreter/parser'
import type { Expression, Statement, Program, AstIdentity, NodeExecutionEvent } from '../interpreter/types'
import { emptyBoard, newId, type BoardDocument, type LinkRoute, type ShapeItem, type ShapeKind } from './model'

export function expressionText(expression: Expression): string {
  switch (expression.kind) {
    case 'literal': return expression.value.type === 'string'
      ? `'${String(expression.value.value).replaceAll("'", "''")}'`
      : expression.value.type === 'boolean' ? expression.value.value ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ' : String(expression.value.value)
    case 'variable': return expression.name
    case 'arrayAccess': return `${expression.name}[${expression.indexes.map(expressionText).join(', ')}]`
    case 'unary': return expression.operator === '-' || expression.operator === '+'
      ? `${expression.operator}${operandText(expression.operand, expression)}`
      : `${expression.operator} ${operandText(expression.operand, expression)}`
    case 'binary': return `${operandText(expression.left, expression, 'left')} ${expression.operator} ${operandText(expression.right, expression, 'right')}`
    case 'call': return `${expression.name}(${expression.arguments.map(expressionText).join(', ')})`
  }
}

function expressionPriority(expression: Expression): number {
  if (expression.kind === 'binary') return precedence[expression.operator]
  // Το ΟΧΙ δεσμεύει συγκρίσεις, αλλά όχι ΚΑΙ/Η. Τα πρόσημα δεσμεύουν τη δύναμη.
  if (expression.kind === 'unary') return expression.operator === 'ΟΧΙ' ? 2.5 : 6
  return Number.POSITIVE_INFINITY
}

function operandText(child: Expression, parent: Extract<Expression, { kind: 'unary' | 'binary' }>, side?: 'left' | 'right'): string {
  const childPriority = expressionPriority(child), parentPriority = expressionPriority(parent)
  const lowerPriority = childPriority < parentPriority
  // Διατηρείται η δομή του AST ακόμη και σε ισόβαθμους τελεστές.
  // Η δύναμη συνδέεται δεξιά· οι υπόλοιποι δυαδικοί τελεστές αριστερά.
  const regrouped = parent.kind === 'binary' && child.kind === 'binary' && childPriority === parentPriority
    && (parent.operator === '^' ? side === 'left' : side === 'right')
  const logicalComparison = parent.kind === 'binary' && ['ΚΑΙ', 'Η'].includes(parent.operator)
    && child.kind === 'binary' && childPriority === precedence['=']
  const text = expressionText(child)
  return lowerPriority || regrouped || logicalComparison ? `(${text})` : text
}

interface Cursor { exit: ShapeItem; y: number }
const AXIS = 600
const BRANCH = 330
const GAP = 56
function numericLiteral(expression: Expression): number | null {
  if (expression.kind === 'literal' && expression.value.type === 'integer') return Number(expression.value.value)
  if (expression.kind === 'unary' && (expression.operator === '-' || expression.operator === '+')) {
    const operand = numericLiteral(expression.operand)
    return operand === null ? null : expression.operator === '-' ? -operand : operand
  }
  return null
}

export function flowchartFromCode(source: string): BoardDocument {
  return flowchartFromProgram(parseProgram(source))
}

export function flowchartFromProgram(program: Program): BoardDocument {
  const board = emptyBoard()
  const add = (kind: ShapeKind, text: string, x: number, y: number, node?: AstIdentity, executionPhase: NodeExecutionEvent['phase'] = 'statement'): ShapeItem => {
    const width = kind === 'connector' ? 28 : kind === 'decision' ? 230 : 210
    const height = kind === 'connector' ? 28 : kind === 'decision' ? 126 : kind === 'start' ? 74 : 90
    const item: ShapeItem = { id: newId(), type: 'shape', kind, text, x: x - width / 2, y, width, height, rotation: 0, ...(node?.nodeId ? { nodeId: node.nodeId, executionPhase } : {}) }
    board.items.push(item)
    return item
  }
  const centerX = (item: ShapeItem) => item.x + item.width / 2
  const centerY = (item: ShapeItem) => item.y + item.height / 2
  const bottom = (item: ShapeItem) => item.y + item.height
  const connect = (from: ShapeItem, to: ShapeItem, label = '', route?: LinkRoute) =>
    board.links.push({ id: newId(), from: from.id, to: to.id, label, route: route ?? { from: 'bottom', to: 'top' } })

  // Η κεντρική ακολουθία ακολουθεί σταθερό x. Οι πλευρικές ροές επιστρέφουν σε αυτόν τον άξονα.
  function walk(statements: Statement[], x: number, y: number, incoming: ShapeItem): Cursor {
    let exit = incoming, nextY = y
    for (const statement of statements) {
      if (statement.kind === 'if') {
        const result = walkIf(statement.branches.map(branch=>({text:expressionText(branch.condition),body:branch.body,node:branch.condition})), statement.otherwise, x, nextY, exit)
        exit = result.exit; nextY = result.y
      } else if (statement.kind === 'select') {
        const selector=add('process','ΕΠΙΛΕΞΕ '+expressionText(statement.expression)+' (υπολογισμός μία φορά)',x,nextY,statement)
        connect(exit,selector)
        const branches=statement.cases.map(branch=>({node:branch,body:branch.body,text:branch.patterns.map(pattern=>pattern.kind==='range'
          ? 'Τιμή ΕΠΙΛΕΞΕ ∈ ['+expressionText(pattern.from)+' .. '+expressionText(pattern.to)+']'
          : 'Τιμή ΕΠΙΛΕΞΕ '+(pattern.kind==='value'?'=':pattern.operator)+' '+expressionText(pattern.expression)).join(' Η ')}))
        const result=walkIf(branches,statement.otherwise,x,bottom(selector)+55,selector,statement.otherwiseLine!==undefined?statement:undefined)
        exit=result.exit;nextY=result.y
      } else if (statement.kind === 'while' || statement.kind === 'for') {
        if (statement.kind === 'for') {
          const initialize = add('process', `${statement.name} <- ${expressionText(statement.from)}`, x, nextY, statement, 'initialize')
          connect(exit, initialize)
          exit = initialize; nextY += 145
        }
        const condition = statement.kind === 'while'
          ? expressionText(statement.condition)
          : numericLiteral(statement.step) !== null && numericLiteral(statement.step)! < 0
            ? `${statement.name} >= ${expressionText(statement.to)}`
            : numericLiteral(statement.step) !== null
              ? `${statement.name} <= ${expressionText(statement.to)}`
              : `(${expressionText(statement.step)} > 0 ΚΑΙ ${statement.name} <= ${expressionText(statement.to)}) Η (${expressionText(statement.step)} < 0 ΚΑΙ ${statement.name} >= ${expressionText(statement.to)})`
        const decision = add('decision', condition, x, nextY, statement, 'condition')
        connect(exit, decision)
        const bodyEntry = add('connector', '', x, nextY + 190)
        connect(decision, bodyEntry, 'Αληθής')
        const body = walk(statement.body, x, nextY + 280, bodyEntry)
        let loopExit = body.exit, loopY = body.y
        if (statement.kind === 'for') {
          const increment = add('process', `${statement.name} <- ${statement.name} + ${expressionText(statement.step)}`, x, loopY, statement, 'increment')
          connect(loopExit, increment)
          loopExit = increment; loopY += 145
        }
        const leftRail = x - BRANCH
        connect(loopExit, decision, '', { from: 'bottom', to: 'left', via: [
          { x, y: bottom(loopExit) + 38 }, { x: leftRail, y: bottom(loopExit) + 38 },
          { x: leftRail, y: centerY(decision) },
        ] })
        const join = add('connector', '', x, Math.max(loopY + GAP, nextY + 350))
        const rightRail = x + BRANCH
        connect(decision, join, 'Ψευδής', { from: 'right', to: 'right', via: [
          { x: rightRail, y: centerY(decision) }, { x: rightRail, y: centerY(join) },
        ] })
        exit = join; nextY = bottom(join) + 80
      } else if (statement.kind === 'repeat') {
        const entry = add('connector', '', x, nextY)
        connect(exit, entry)
        const body = walk(statement.body, x, nextY + 110, entry)
        const decision = add('decision', expressionText(statement.condition), x, body.y + 15, statement, 'condition')
        connect(body.exit, decision)
        const leftRail = x - BRANCH
        connect(decision, entry, 'Ψευδής', { from: 'left', to: 'left', via: [
          { x: leftRail, y: centerY(decision) }, { x: leftRail, y: centerY(entry) },
        ] })
        const join = add('connector', '', x, bottom(decision) + 65)
        connect(decision, join, 'Αληθής')
        exit = join; nextY = bottom(join) + 80
      } else {
        const kind: ShapeKind = statement.kind === 'read' || statement.kind === 'write' ? 'io' : statement.kind === 'procedureCall' ? 'subprogram' : 'process'
        const caption = statement.kind === 'read' ? `ΔΙΑΒΑΣΕ ${statement.targets.map(target => target.name + (target.indexes.length ? `[${target.indexes.map(expressionText).join(', ')}]` : '')).join(', ')}`
          : statement.kind === 'write' ? `ΓΡΑΨΕ ${statement.expressions.map(expressionText).join(', ')}`
            : statement.kind === 'procedureCall' ? `ΚΑΛΕΣΕ ${statement.name}(${statement.arguments.map(expressionText).join(', ')})`
              : `${statement.name}${statement.indexes.length ? `[${statement.indexes.map(expressionText).join(', ')}]` : ''} <- ${expressionText(statement.expression)}`
        const item = add(kind, caption, x, nextY, statement)
        connect(exit, item)
        exit = item; nextY = bottom(item) + 55
      }
    }
    return { exit, y: nextY }
  }

  function walkIf(branches: Array<{text: string; body: Statement[]; node: AstIdentity}>, otherwise: Statement[], x: number, y: number, incoming: ShapeItem, defaultNode?: AstIdentity): Cursor {
    if (!branches.length) {
      if (!defaultNode) return walk(otherwise, x, y, incoming)
      const fallback = add('process', 'ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ', x, y, defaultNode, 'default')
      connect(incoming, fallback)
      return walk(otherwise, x, bottom(fallback) + 55, fallback)
    }
    const decision = add('decision', branches[0].text, x, y, branches[0].node, 'condition')
    connect(incoming, decision)
    const falseX = x + BRANCH
    const trueEntry = add('connector', '', x, y + 190)
    const falseEntry = add('connector', '', falseX, y + 190, branches.length === 1 ? defaultNode : undefined, 'default')
    connect(decision, trueEntry, 'Αληθής')
    connect(decision, falseEntry, 'Ψευδής', { from: 'right', to: 'top', via: [{ x: falseX, y: centerY(decision) }] })
    const trueBranch = walk(branches[0].body, x, y + 280, trueEntry)
    const falseBranch = branches.length > 1
      ? walkIf(branches.slice(1), otherwise, falseX, y + 280, falseEntry, defaultNode)
      : walk(otherwise, falseX, y + 280, falseEntry)
    const join = add('connector', '', x, Math.max(trueBranch.y, falseBranch.y) + GAP)
    connect(trueBranch.exit, join)
    connect(falseBranch.exit, join, '', { from: 'bottom', to: 'right', via: [
      { x: centerX(falseBranch.exit), y: bottom(falseBranch.exit) + 36 },
      { x: centerX(falseBranch.exit), y: centerY(join) },
    ] })
    return { exit: join, y: bottom(join) + 80 }
  }

  const start = add('start', 'ΑΡΧΗ', AXIS, 40)
  const last = walk(program.body, AXIS, 165, start)
  const end = add('start', 'ΤΕΛΟΣ', AXIS, last.y)
  connect(last.exit, end)
  // Κάθε υποπρόγραμμα έχει ξεχωριστή ροή· η εκτέλεση μεταφέρει το ενεργό σχήμα εκεί.
  let routineY = last.y + 220
  for (const routine of program.subprograms) {
    const entry = add('start', routine.name, AXIS, routineY)
    const routineLast = walk(routine.body, AXIS, routineY + 125, entry)
    const finish = add('start', 'ΤΕΛΟΣ ' + routine.name, AXIS, routineLast.y)
    connect(routineLast.exit, finish)
    routineY = routineLast.y + 220
  }
  return board
}
