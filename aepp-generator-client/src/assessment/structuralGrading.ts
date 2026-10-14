import { normalize, type Expression, type Program, type Statement, type Subprogram } from '../interpreter/types'
import type { ProgramCaseResult, RubricCriterion, RubricKind } from './model'
interface Feature { kind: RubricKind; scope: string; line: number; name?: string; routine?: Subprogram }
const merge = (...sets: Set<string>[]) => new Set(sets.flatMap(set => [...set]))
const equal = (left: Set<string>, right: Set<string>) => left.size === right.size && [...left].every(value => right.has(value))

/** Σάρωση όλου του AST και οπισθοδρομική ανάλυση των τιμών που επηρεάζουν την έξοδο. */
export function evaluateStructure(program: Program, cases: ProgramCaseResult[], rubric: RubricCriterion[]) {
 const routines = new Map(program.subprograms.map(routine => [normalize(routine.name),routine]))
 const lines = new Set(cases.filter(result => !result.error).flatMap(result => result.executedLines ?? []))
 const called = new Set(cases.filter(result => !result.error).flatMap(result => result.executedSubprograms ?? []).map(normalize))
 const features: Feature[] = [], featureKeys = new Set<string>(), active = new Set<string>()
 let visited = 0
 const scanExpression = (expression: Expression): void => {
  visited++
  if(expression.kind==='binary'){scanExpression(expression.left);scanExpression(expression.right)}
  else if(expression.kind==='unary')scanExpression(expression.operand)
  else if(expression.kind==='arrayAccess')expression.indexes.forEach(scanExpression)
  else if(expression.kind==='call')expression.arguments.forEach(scanExpression)
 }
 const scan = (body: Statement[]): void => { for(const statement of body){visited++;if(statement.kind==='assign'){statement.indexes.forEach(scanExpression);scanExpression(statement.expression)}else if(statement.kind==='read')statement.targets.forEach(target=>target.indexes.forEach(scanExpression));else if(statement.kind==='write')statement.expressions.forEach(scanExpression);else if(statement.kind==='procedureCall')statement.arguments.forEach(scanExpression);else if(statement.kind==='if'){statement.branches.forEach(branch=>{scanExpression(branch.condition);scan(branch.body)});scan(statement.otherwise)}else if(statement.kind==='select'){scanExpression(statement.expression);statement.cases.forEach(branch=>{branch.patterns.forEach(pattern=>{if(pattern.kind==='range'){scanExpression(pattern.from);scanExpression(pattern.to)}else scanExpression(pattern.expression)});scan(branch.body)});scan(statement.otherwise)}else if(statement.kind==='for'){scanExpression(statement.from);scanExpression(statement.to);scanExpression(statement.step);scan(statement.body)}else {scanExpression(statement.condition);scan(statement.body)}} }
 scan(program.body);program.constants.forEach(constant=>scanExpression(constant.expression));program.subprograms.forEach(routine=>scan(routine.body))
 const mark = (kind: RubricKind, scope: string, line: number, name?: string, routine?: Subprogram) => {
  if(kind!=='subprogramParameters'&&!lines.has(line))return
  const key=kind+':'+scope+':'+line+':'+name
  if(!featureKeys.has(key)){featureKeys.add(key);features.push({kind,scope,line,name,routine})}
 }
 const routineAnalysis = (routine: Subprogram, needed: Set<string>): { live: Set<string>; meaningful: boolean } => {
  const scope=normalize(routine.name)
  if(!called.has(scope)||active.has(scope))return {live:new Set(routine.parameters.map(normalize)),meaningful:false}
  active.add(scope);const before=features.length
  const live=analyze(routine.body,scope,new Set([...needed].map(normalize)))
  active.delete(scope)
  const meaningful=features.length>before || features.some(feature=>feature.scope===scope)
  if(meaningful)mark('subprogramParameters',scope,routine.line,routine.name,routine)
  return {live,meaningful}
 }
 const refs = (expression: Expression, scope: string): Set<string> => {
  if(expression.kind==='variable')return new Set([normalize(expression.name)])
  if(expression.kind==='arrayAccess'){mark('arrayAccess',scope,expression.line,expression.name);return merge(new Set([normalize(expression.name)]),...expression.indexes.map(index=>refs(index,scope)))}
  if(expression.kind==='binary')return merge(refs(expression.left,scope),refs(expression.right,scope))
  if(expression.kind==='unary')return refs(expression.operand,scope)
  if(expression.kind==='call'){
   const routine=routines.get(normalize(expression.name))
   if(routine?.kind==='function'){
    const result=routineAnalysis(routine,new Set([normalize(routine.name)]))
    if(result.meaningful)mark('functionCall',scope,expression.line,routine.name,routine)
    return merge(...expression.arguments.filter((_,index)=>result.live.has(normalize(routine.parameters[index]??''))).map(argument=>refs(argument,scope)))
   }
   return merge(...expression.arguments.map(argument=>refs(argument,scope)))
  }
  return new Set()
 }
 function analyze(body: Statement[], scope: string, after: Set<string>): Set<string> {
  let live=new Set(after)
  for(const statement of [...body].reverse()){
   if(!lines.has(statement.line))continue
   if(statement.kind==='write'){mark('write',scope,statement.line);live=merge(live,...statement.expressions.map(expression=>refs(expression,scope)))}
   else if(statement.kind==='assign'){
    const name=normalize(statement.name)
    if(!live.has(name))continue
    mark('assign',scope,statement.line,statement.name)
    if(statement.indexes.length)mark('arrayWrite',scope,statement.line,statement.name)
    else live.delete(name)
    if(statement.expression.kind==='binary'&&statement.expression.operator==='+'&&[statement.expression.left,statement.expression.right].some(value=>value.kind==='variable'&&normalize(value.name)===name))mark('accumulation',scope,statement.line,statement.name)
    live=merge(live,refs(statement.expression,scope),...statement.indexes.map(index=>refs(index,scope)))
   } else if(statement.kind==='read'){
    for(const target of statement.targets){const name=normalize(target.name);if(live.has(name)){mark('read',scope,statement.line,target.name);if(!target.indexes.length)live.delete(name);live=merge(live,...target.indexes.map(index=>refs(index,scope)))}}
   } else if(statement.kind==='procedureCall'){
    const routine=routines.get(normalize(statement.name))
    if(routine?.kind!=='procedure')continue
    const needed=new Set(routine.parameters.filter((_,index)=>{const argument=statement.arguments[index];return argument&&(argument.kind==='variable'||argument.kind==='arrayAccess')&&live.has(normalize(argument.name))}).map(normalize))
    const result=routineAnalysis(routine,needed)
    if(result.meaningful){mark('procedureCall',scope,statement.line,routine.name,routine);live=merge(live,...statement.arguments.filter((_,index)=>result.live.has(normalize(routine.parameters[index]??''))).map(argument=>refs(argument,scope)))}
   } else if(statement.kind==='select'){
    const branchLives=statement.cases.map(branch=>analyze(branch.body,scope,new Set(live)))
    const otherwise=analyze(statement.otherwise,scope,new Set(live))
    if(statement.cases.some(branch=>hasMeaningfulBody(branch.body,scope))||hasMeaningfulBody(statement.otherwise,scope)){
     mark('select',scope,statement.line)
     live=merge(...branchLives,otherwise,refs(statement.expression,scope),...statement.cases.flatMap(branch=>branch.patterns.flatMap(pattern=>pattern.kind==='range'?[refs(pattern.from,scope),refs(pattern.to,scope)]:[refs(pattern.expression,scope)])))
    }
   } else if(statement.kind==='if'){
    const before=features.length
    const branches=statement.branches.map(branch=>analyze(branch.body,scope,new Set(live)))
    const otherwise=analyze(statement.otherwise,scope,new Set(live))
    if(features.length>before || statement.branches.some(branch=>hasMeaningfulBody(branch.body,scope)) || hasMeaningfulBody(statement.otherwise,scope)){
     mark('if',scope,statement.line);live=merge(...branches,otherwise,...statement.branches.map(branch=>refs(branch.condition,scope)))
    }
   } else {
    const loopAfter=new Set(live)
    let entry=new Set(live)
    for(let iteration=0;iteration<64;iteration++){const next=merge(loopAfter,analyze(statement.body,scope,entry));if(equal(next,entry))break;entry=next}
    if(hasMeaningfulBody(statement.body,scope)){
     if(statement.kind!=='for'){
      entry=merge(entry,refs(statement.condition,scope))
      for(let iteration=0;iteration<64;iteration++){const next=merge(entry,analyze(statement.body,scope,entry));if(equal(next,entry))break;entry=next}
     }
     mark(statement.kind,scope,statement.line)
     if(statement.kind==='for'){if(!loopAfter.has(normalize(statement.name)))entry.delete(normalize(statement.name));live=merge(entry,refs(statement.from,scope),refs(statement.to,scope),refs(statement.step,scope))}
     else live=merge(entry,refs(statement.condition,scope))
    }
   }
  }
  return live
 }
 function hasMeaningfulBody(body: Statement[],scope: string): boolean {
  return body.some(statement=>features.some(feature=>feature.scope===scope&&feature.line===statement.line)||statement.kind==='select'&&(statement.cases.some(branch=>hasMeaningfulBody(branch.body,scope))||hasMeaningfulBody(statement.otherwise,scope))||statement.kind==='if'&&(statement.branches.some(branch=>hasMeaningfulBody(branch.body,scope))||hasMeaningfulBody(statement.otherwise,scope))||('body' in statement&&hasMeaningfulBody(statement.body,scope)))
 }
 analyze(program.body,normalize(program.name),new Set())
 const matches = (criterion: RubricCriterion,feature: Feature) => {
  if(feature.kind!==criterion.kind)return false
  const owner=feature.routine?.name??feature.scope
  if(criterion.subprogram&&normalize(owner)!==normalize(criterion.subprogram))return false
  if(criterion.variableName&&normalize(feature.name??'')!==normalize(criterion.variableName))return false
  if(criterion.arrayName&&normalize(feature.name??'')!==normalize(criterion.arrayName))return false
  if(criterion.kind==='subprogramParameters'){
   const routine=feature.routine
   if(!routine?.parameters.length)return false
   if(!routine.parameters.every(parameter=>routine.declarations.some(declaration=>normalize(declaration.name)===normalize(parameter))))return false
   if(criterion.parameters&&(criterion.parameters.length!==routine.parameters.length||criterion.parameters.some((expected,index)=>{
    const parameter=routine.parameters[index],declaration=routine.declarations.find(value=>normalize(value.name)===normalize(parameter))!
    return expected.name&&normalize(expected.name)!==normalize(parameter)||expected.type!==declaration.type||JSON.stringify(expected.dimensions??[])!==JSON.stringify(declaration.dimensions??[])
   })))return false
  }
  return true
 }
 const results=rubric.map(criterion=>({kind:criterion.kind,points:criterion.points,met:features.some(feature=>matches(criterion,feature))}))
 const weight=rubric.reduce((sum,criterion)=>sum+criterion.points,0)
 const ratio=weight?results.reduce((sum,result)=>sum+(result.met?result.points:0),0)/weight:0
 return { ratio, results, astSummary: ('AST: '+visited+' κόμβοι. Σχετικές εκτελεσμένες δομές: '+features.map(feature=>feature.kind+'@'+feature.scope+':'+feature.line).join(', ')).slice(0,2000) }
}
