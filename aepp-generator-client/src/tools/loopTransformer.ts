import { parseProgram } from '../interpreter/parser'
import { expressionText } from '../whiteboard/flowchart'
import type { Declaration, Expression, Program, Statement, ValueType } from '../interpreter/types'

export type Loop = Extract<Statement, {kind:'for'|'while'|'repeat'}>
export type LoopTarget = 'while'|'repeat'
const e = expressionText
const types: Record<ValueType,string> = {integer:'ΑΚΕΡΑΙΕΣ',real:'ΠΡΑΓΜΑΤΙΚΕΣ',boolean:'ΛΟΓΙΚΕΣ',string:'ΧΑΡΑΚΤΗΡΕΣ'}
const singular: Record<ValueType,string> = {integer:'ΑΚΕΡΑΙΑ',real:'ΠΡΑΓΜΑΤΙΚΗ',boolean:'ΛΟΓΙΚΗ',string:'ΧΑΡΑΚΤΗΡΑΣ'}
export function children(s:Statement):Statement[][] {
  if(s.kind==='if') return [...s.branches.map(b=>b.body),s.otherwise]
  if(s.kind==='select') return [...s.cases.map(b=>b.body),s.otherwise]
  return s.kind==='for'||s.kind==='while'||s.kind==='repeat'?[s.body]:[]
}
export function listLoops(program:Program):Loop[] {
  const result:Loop[]=[]
  function visit(body:Statement[]) {for(const s of body){if(s.kind==='for'||s.kind==='while'||s.kind==='repeat') result.push(s);children(s).forEach(visit)}}
  visit(program.body);program.subprograms.forEach(s=>visit(s.body));return result
}
export function statementsText(body:Statement[],depth=1):string {
  const pad='  '.repeat(depth), inner=(b:Statement[])=>statementsText(b,depth+1)
  return body.map(s=>{
    switch(s.kind){
      case 'assign':return pad+s.name+(s.indexes.length?'['+s.indexes.map(e).join(', ')+']':'')+' <- '+e(s.expression)
      case 'read':return pad+'ΔΙΑΒΑΣΕ '+s.targets.map(t=>t.name+(t.indexes.length?'['+t.indexes.map(e).join(', ')+']':'')).join(', ')
      case 'write':return pad+'ΓΡΑΨΕ '+s.expressions.map(e).join(', ')
      case 'procedureCall':return pad+'ΚΑΛΕΣΕ '+s.name+'('+s.arguments.map(e).join(', ')+')'
      case 'while':return pad+'ΟΣΟ '+e(s.condition)+' ΕΠΑΝΑΛΑΒΕ\n'+inner(s.body)+'\n'+pad+'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'
      case 'repeat':return pad+'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n'+inner(s.body)+'\n'+pad+'ΜΕΧΡΙΣ_ΟΤΟΥ '+e(s.condition)
      case 'for':return pad+`ΓΙΑ ${s.name} ΑΠΟ ${e(s.from)} ΜΕΧΡΙ ${e(s.to)} ΜΕ ΒΗΜΑ ${e(s.step)}\n`+inner(s.body)+'\n'+pad+'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'
      case 'if':return s.branches.map((b,i)=>pad+(i?'ΑΛΛΙΩΣ_ΑΝ ':'ΑΝ ')+e(b.condition)+' ΤΟΤΕ\n'+inner(b.body)).join('\n')+(s.otherwise.length?'\n'+pad+'ΑΛΛΙΩΣ\n'+inner(s.otherwise):'')+'\n'+pad+'ΤΕΛΟΣ_ΑΝ'
      case 'select':return pad+'ΕΠΙΛΕΞΕ '+e(s.expression)+'\n'+s.cases.map(b=>pad+'  ΠΕΡΙΠΤΩΣΗ '+b.patterns.map(p=>p.kind==='range'?e(p.from)+'..'+e(p.to):p.kind==='comparison'?p.operator+' '+e(p.expression):e(p.expression)).join(', ')+'\n'+statementsText(b.body,depth+2)).join('\n')+(s.otherwise.length?'\n'+pad+'  ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\n'+statementsText(s.otherwise,depth+2):'')+'\n'+pad+'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'
    }
  }).join('\n')
}
function declarationsText(ds:Declaration[]) {return 'ΜΕΤΑΒΛΗΤΕΣ\n'+ds.map(d=>'  '+types[d.type]+': '+d.name+(d.dimensions?'['+d.dimensions.join(', ')+']':'')).join('\n')}
export function programText(p:Program):string {
  return 'ΠΡΟΓΡΑΜΜΑ '+p.name+'\n'+(p.constants.length?'ΣΤΑΘΕΡΕΣ\n'+p.constants.map(c=>'  '+c.name+' = '+e(c.expression)).join('\n')+'\n':'')+declarationsText(p.declarations)+'\nΑΡΧΗ\n'+statementsText(p.body)+'\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'+p.subprograms.map(s=>'\n\n'+(s.kind==='procedure'?'ΔΙΑΔΙΚΑΣΙΑ ':'ΣΥΝΑΡΤΗΣΗ ')+s.name+'('+s.parameters.join(', ')+')'+(s.returnType?': '+singular[s.returnType]:'')+'\n'+declarationsText(s.declarations)+'\nΑΡΧΗ\n'+statementsText(s.body)+'\n'+(s.kind==='procedure'?'ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ':'ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ')).join('')
}
const variable=(name:string,line:number):Extract<Expression,{kind:'variable'}>=>({kind:'variable',name,line})
const binary=(operator:string,left:Expression,right:Expression,line:number):Expression=>({kind:'binary',operator,left,right,line})
const not=(operand:Expression):Expression=>({kind:'unary',operator:'ΟΧΙ',operand,line:operand.line})
function integer(x:Expression):number|null {if(x.kind==='literal'&&x.value.type==='integer')return Number(x.value.value);if(x.kind==='unary'&&['+','-'].includes(x.operator)){const n=integer(x.operand);return n===null?null:x.operator==='-'?-n:n}return null}

/** Μετασχηματίζει έναν επιλεγμένο βρόχο, χωρίς να μεταλλάσσει το αρχικό AST. */
export function transformLoop(source:string,nodeId:string,target:LoopTarget,guard=true) {
  const original=parseProgram(source), program=structuredClone(original), warnings:string[]=[]
  let found=false
  const used=new Set([...program.declarations,...program.subprograms.flatMap(s=>s.declarations),...program.constants].map(d=>d.name))
  let serial=0
  function fresh(ds:Declaration[],line:number){let name:string;do{name='ΒΟΗΘ_ΒΡΟΧΟΥ_'+(++serial)}while(used.has(name));used.add(name);ds.push({name,type:'integer',line});return variable(name,line)}
  function visit(body:Statement[],ds:Declaration[]):Statement[] {return body.flatMap(s=>{
    if(s.nodeId!==nodeId){children(s).forEach(b=>{b.splice(0,b.length,...visit(b,ds))});return [s]}
    if(s.kind!=='for'&&s.kind!=='while'&&s.kind!=='repeat')throw new Error('Επίλεξε δομή επανάληψης.')
    if(s.kind===target)throw new Error('Επίλεξε διαφορετική δομή προορισμού.')
    found=true
    if(s.kind==='while'){
      warnings.push('Η ΟΣΟ μπορεί να εκτελεστεί 0 φορές, ενώ η ΜΕΧΡΙΣ_ΟΤΟΥ τουλάχιστον 1. '+(guard?'Προστέθηκε ΑΝ για διατήρηση της μηδενικής εκτέλεσης.':'Χωρίς ΑΝ η μετατροπή δεν είναι γενικά ισοδύναμη.'))
      const loop:Statement={kind:'repeat',body:s.body,condition:not(s.condition),line:s.line}
      return guard?[{kind:'if',branches:[{condition:s.condition,body:[loop]}],otherwise:[],line:s.line}]:[loop]
    }
    if(s.kind==='repeat'){
      warnings.push('Το σώμα εκτελείται μία φορά πριν την ΟΣΟ, ώστε να διατηρείται η υποχρεωτική πρώτη επανάληψη.')
      return [...structuredClone(s.body),{kind:'while',condition:not(s.condition),body:s.body,line:s.line}]
    }
    const step=integer(s.step)
    if(step===0)throw new Error('Το βήμα της ΓΙΑ δεν μπορεί να είναι μηδέν.')
    const from=fresh(ds,s.line),to=fresh(ds,s.line)
    const savedStep=step===null?fresh(ds,s.line):null
    const assign=(name:string,expression:Expression):Statement=>({kind:'assign',name,indexes:[],expression,line:s.line})
    const zero:Expression={kind:'literal',value:{type:'integer',value:0},line:s.line}
    const condition=step!==null?binary(step>0?'<=':'>=',variable(s.name,s.line),to,s.line)
      :binary('Η',binary('ΚΑΙ',binary('>',savedStep!,zero,s.line),binary('<=',variable(s.name,s.line),to,s.line),s.line),binary('ΚΑΙ',binary('<',savedStep!,zero,s.line),binary('>=',variable(s.name,s.line),to,s.line),s.line),s.line)
    const body=[...s.body,assign(s.name,binary('+',variable(s.name,s.line),savedStep??s.step,s.line))]
    const loop:Statement=target==='while'?{kind:'while',condition,body,line:s.line}:{kind:'repeat',condition:not(condition),body,line:s.line}
    warnings.push('Τα αρχικά όρια αποθηκεύονται μία φορά σε βοηθητικές μεταβλητές. Οι βοηθητικές μεταβλητές εξαιρούνται από τη σύγκριση.')
    if(savedStep)warnings.push('Το μεταβλητό βήμα αποθηκεύεται πριν την αρχικοποίηση του μετρητή και πρέπει να είναι μη μηδενικό, όπως απαιτεί η ΓΙΑ. Δοκίμασε και θετικό και αρνητικό βήμα. Η είσοδος 0 είναι άκυρη και δεν θεωρείται ισοδύναμη εκτέλεση.')
    if(target==='repeat'&&!guard)warnings.push('Χωρίς έλεγχο ΑΝ, μια ΓΙΑ με μηδενικές επαναλήψεις δεν είναι ισοδύναμη.')
    return [assign(from.name,eClone(s.from)),assign(to.name,eClone(s.to)),...(savedStep?[assign(savedStep.name,eClone(s.step))]:[]),assign(s.name,from),...(target==='repeat'&&guard?[{kind:'if' as const,branches:[{condition,body:[loop]}],otherwise:[],line:s.line}]:[loop])]
  })}
  program.body=visit(program.body,program.declarations);for(const s of program.subprograms)s.body=visit(s.body,s.declarations)
  if(!found)throw new Error('Ο επιλεγμένος βρόχος δεν υπάρχει στον τρέχοντα κώδικα.')
  const code=programText(program);parseProgram(code)
  return {program:parseProgram(code),code,warnings,semanticallySafe:guard||target==='while'}
}
const eClone=(x:Expression)=>structuredClone(x)
