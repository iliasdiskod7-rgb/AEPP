import { parseProgram } from '../interpreter/parser'
import type { Expression, Statement } from '../interpreter/types'
import { emptyBoard, newId, type BoardDocument, type LinkRoute, type ShapeItem, type ShapeKind } from './model'

export function expressionText(expression: Expression): string {
  switch (expression.kind) {
    case 'literal': return expression.value.type === 'string'
      ? `'${String(expression.value.value).replaceAll("'", "''")}'`
      : expression.value.type === 'boolean' ? expression.value.value ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ' : String(expression.value.value)
    case 'variable': return expression.name
    case 'unary': return expression.operator === '-' || expression.operator === '+'
      ? `${expression.operator}${expressionText(expression.operand)}`
      : `${expression.operator} ${expressionText(expression.operand)}`
    case 'binary': return `${expressionText(expression.left)} ${expression.operator} ${expressionText(expression.right)}`
    case 'call': return `${expression.name}(${expressionText(expression.argument)})`
  }
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
  const program = parseProgram(source)
  const board = emptyBoard()
  const add = (kind: ShapeKind, text: string, x: number, y: number): ShapeItem => {
    const width = kind === 'connector' ? 28 : kind === 'decision' ? 230 : 210
    const height = kind === 'connector' ? 28 : kind === 'decision' ? 126 : kind === 'start' ? 74 : 90
    const item: ShapeItem = { id: newId(), type: 'shape', kind, text, x: x - width / 2, y, width, height, rotation: 0 }
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
        const result = walkIf(statement.branches, statement.otherwise, x, nextY, exit)
        exit = result.exit; nextY = result.y
      } else if (statement.kind === 'while' || statement.kind === 'for') {
        if (statement.kind === 'for') {
          const initialize = add('process', `${statement.name} <- ${expressionText(statement.from)}`, x, nextY)
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
        const decision = add('decision', condition, x, nextY)
        connect(exit, decision)
        const bodyEntry = add('connector', '', x, nextY + 190)
        connect(decision, bodyEntry, 'Αληθής')
        const body = walk(statement.body, x, nextY + 280, bodyEntry)
        let loopExit = body.exit, loopY = body.y
        if (statement.kind === 'for') {
          const increment = add('process', `${statement.name} <- ${statement.name} + ${expressionText(statement.step)}`, x, loopY)
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
        const decision = add('decision', expressionText(statement.condition), x, body.y + 15)
        connect(body.exit, decision)
        const leftRail = x - BRANCH
        connect(decision, entry, 'Ψευδής', { from: 'left', to: 'left', via: [
          { x: leftRail, y: centerY(decision) }, { x: leftRail, y: centerY(entry) },
        ] })
        const join = add('connector', '', x, bottom(decision) + 65)
        connect(decision, join, 'Αληθής')
        exit = join; nextY = bottom(join) + 80
      } else {
        const kind: ShapeKind = statement.kind === 'read' || statement.kind === 'write' ? 'io' : 'process'
        const caption = statement.kind === 'read' ? `ΔΙΑΒΑΣΕ ${statement.names.join(', ')}`
          : statement.kind === 'write' ? `ΓΡΑΨΕ ${statement.expressions.map(expressionText).join(', ')}`
            : `${statement.name} <- ${expressionText(statement.expression)}`
        const item = add(kind, caption, x, nextY)
        connect(exit, item)
        exit = item; nextY = bottom(item) + 55
      }
    }
    return { exit, y: nextY }
  }

  function walkIf(branches: Extract<Statement, { kind: 'if' }>['branches'], otherwise: Statement[], x: number, y: number, incoming: ShapeItem): Cursor {
    const decision = add('decision', expressionText(branches[0].condition), x, y)
    connect(incoming, decision)
    const falseX = x + BRANCH
    const trueEntry = add('connector', '', x, y + 190)
    const falseEntry = add('connector', '', falseX, y + 190)
    connect(decision, trueEntry, 'Αληθής')
    connect(decision, falseEntry, 'Ψευδής', { from: 'right', to: 'top', via: [{ x: falseX, y: centerY(decision) }] })
    const trueBranch = walk(branches[0].body, x, y + 280, trueEntry)
    const falseBranch = branches.length > 1
      ? walkIf(branches.slice(1), otherwise, falseX, y + 280, falseEntry)
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
  return board
}
