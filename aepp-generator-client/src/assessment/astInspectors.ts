import { analyzeProgram } from '../interpreter/staticChecker'
import { normalize, type Expression, type Program, type Statement } from '../interpreter/types'

export type StructuralCheckKind = 'hasValidDeclarations' | 'hasValidationLoop' | 'hasNestedLoops' | 'hasSubprogramCall'
export interface StructuralEvidence {
  kind: StructuralCheckKind
  scope: string
  line: number
  names: string[]
}
export interface AstInspection {
  hasValidDeclarations: boolean
  hasValidationLoop: boolean
  hasNestedLoops: boolean
  hasSubprogramCall: boolean
  evidence: StructuralEvidence[]
}

function expressionNames(expression: Expression): string[] {
  if (expression.kind === 'variable') return [expression.name]
  if (expression.kind === 'arrayAccess') return [expression.name, ...expression.indexes.flatMap(expressionNames)]
  if (expression.kind === 'binary') return [...expressionNames(expression.left), ...expressionNames(expression.right)]
  if (expression.kind === 'unary') return expressionNames(expression.operand)
  if (expression.kind === 'call') return expression.arguments.flatMap(expressionNames)
  return []
}

function children(statement: Statement): Statement[][] {
  if (statement.kind === 'if') return [...statement.branches.map(branch => branch.body), statement.otherwise]
  if (statement.kind === 'select') return [...statement.cases.map(branch => branch.body), statement.otherwise]
  return 'body' in statement ? [statement.body] : []
}

/** Στατικό checklist, ανεξάρτητο από το αν οι δοκιμές ολοκληρώθηκαν επιτυχώς.
 * Ο έλεγχος εγκυρότητας αναγνωρίζεται ως επαναληπτική είσοδος που ελέγχεται στη συνθήκη.
 * Πρόκειται για δομική ένδειξη, όχι απόδειξη ορθότητας του αλγορίθμου.
 */
export function inspectProgramAst(program: Program): AstInspection {
  let valid = true
  try {
    analyzeProgram(program)
  } catch {
    valid = false
  }
  const evidence: StructuralEvidence[] = []
  const add = (kind: StructuralCheckKind, scope: string, line: number, names: string[] = []) =>
    evidence.push({ kind, scope, line, names: names.map(normalize) })
  const routines = new Map(program.subprograms.map(routine => [normalize(routine.name), routine]))
  const pending = [normalize(program.name)],
    visited = new Set<string>()
  const readNames = (body: Statement[]): string[] =>
    body.flatMap(statement =>
      statement.kind === 'read' ? statement.targets.map(target => target.name) : children(statement).flatMap(readNames),
    )
  function expressionVisit(expression: Expression, scope: string): void {
    if (expression.kind === 'call') {
      const routine = routines.get(normalize(expression.name))
      if (valid && routine?.kind === 'function') {
        add('hasSubprogramCall', scope, expression.line, [routine.name])
        pending.push(normalize(routine.name))
      }
      expression.arguments.forEach(argument => expressionVisit(argument, scope))
    } else if (expression.kind === 'binary') {
      expressionVisit(expression.left, scope)
      expressionVisit(expression.right, scope)
    } else if (expression.kind === 'unary') expressionVisit(expression.operand, scope)
    else if (expression.kind === 'arrayAccess') expression.indexes.forEach(index => expressionVisit(index, scope))
  }
  function walk(body: Statement[], scope: string, loopDepth = 0): void {
    for (const statement of body) {
      const loop = ['for', 'while', 'repeat'].includes(statement.kind)
      if (loop && loopDepth > 0) add('hasNestedLoops', scope, statement.line)
      if (statement.kind === 'repeat' || statement.kind === 'while') {
        const tested = new Set(expressionNames(statement.condition).map(normalize))
        const inputs = readNames(statement.body).filter(name => tested.has(normalize(name)))
        if (inputs.length) add('hasValidationLoop', scope, statement.line, inputs)
        expressionVisit(statement.condition, scope)
      } else if (statement.kind === 'for') {
        expressionVisit(statement.from, scope)
        expressionVisit(statement.to, scope)
        expressionVisit(statement.step, scope)
      } else if (statement.kind === 'procedureCall') {
        const routine = routines.get(normalize(statement.name))
        if (valid && routine?.kind === 'procedure') {
          add('hasSubprogramCall', scope, statement.line, [routine.name])
          pending.push(normalize(routine.name))
        }
        statement.arguments.forEach(argument => expressionVisit(argument, scope))
      } else if (statement.kind === 'assign') {
        expressionVisit(statement.expression, scope)
        statement.indexes.forEach(index => expressionVisit(index, scope))
      } else if (statement.kind === 'write') statement.expressions.forEach(value => expressionVisit(value, scope))
      else if (statement.kind === 'read')
        statement.targets.forEach(target => target.indexes.forEach(index => expressionVisit(index, scope)))
      else if (statement.kind === 'if') statement.branches.forEach(branch => expressionVisit(branch.condition, scope))
      else if (statement.kind === 'select') {
        expressionVisit(statement.expression, scope)
        statement.cases.forEach(branch =>
          branch.patterns.forEach(pattern => {
            if (pattern.kind === 'range') {
              expressionVisit(pattern.from, scope)
              expressionVisit(pattern.to, scope)
            } else expressionVisit(pattern.expression, scope)
          }),
        )
      }
      children(statement).forEach(child => walk(child, scope, loopDepth + Number(loop)))
    }
  }
  while (pending.length) {
    const scope = pending.shift()!
    if (visited.has(scope)) continue
    visited.add(scope)
    const owner = scope === normalize(program.name) ? program : routines.get(scope)!
    if (valid) {
      if (!owner.declarations.length) add('hasValidDeclarations', scope, routines.get(scope)?.line ?? 1)
      owner.declarations.forEach(declaration =>
        add('hasValidDeclarations', scope, declaration.line, [declaration.name]),
      )
    }
    walk(owner.body, scope)
  }
  return {
    hasValidDeclarations: valid,
    hasValidationLoop: evidence.some(item => item.kind === 'hasValidationLoop'),
    hasNestedLoops: evidence.some(item => item.kind === 'hasNestedLoops'),
    hasSubprogramCall: evidence.some(item => item.kind === 'hasSubprogramCall'),
    evidence,
  }
}
