import { evaluateBuiltin } from './builtins'
import { GlossaError, type Constant, type Expression, type Value } from './types'

/** Οι σταθερές επιλύονται με τη σειρά δήλωσης, χωρίς εκτέλεση υποπρογραμμάτων. */
export function resolveConstants(constants: Constant[]): Map<string, Value> {
  const values = new Map<string,Value>()
  function evaluate(expression: Expression): Value {
    const line = expression.line
    const fail = (message: string): never => { throw new GlossaError(line,message,'type') }
    if (expression.kind === 'literal') return expression.value
    if (expression.kind === 'variable') {
      const value = values.get(expression.name)
      if (!value) return fail('Η σταθερά «' + expression.name + '» δεν έχει δηλωθεί προηγουμένως.')
      return value
    }
    if (expression.kind === 'arrayAccess') return fail('Δεν επιτρέπεται πίνακας στον ορισμό σταθεράς.')
    if (expression.kind === 'call') {
      if (expression.arguments.length !== 1) return fail('Η ενσωματωμένη συνάρτηση απαιτεί ένα όρισμα.')
      return evaluateBuiltin(expression.name,evaluate(expression.arguments[0]),line)
    }
    const left = evaluate(expression.kind === 'unary' ? expression.operand : expression.left)
    if (expression.kind === 'unary') {
      if (expression.operator === 'ΟΧΙ') {
        if (left.type !== 'boolean') return fail('Ο ΟΧΙ απαιτεί λογική έκφραση.')
        return {type:'boolean',value:!left.value}
      }
      if (typeof left.value !== 'number') return fail('Η πράξη απαιτεί αριθμητική τιμή.')
      return checked({type:left.type,value:expression.operator === '-' ? -left.value : left.value},line)
    }
    const right = evaluate(expression.right)
    const a = left.value, b = right.value, numeric = typeof a === 'number' && typeof b === 'number'
    const op = expression.operator
    if (op === 'ΚΑΙ' || op === 'Η') {
      if (typeof a !== 'boolean' || typeof b !== 'boolean') return fail('Ο λογικός τελεστής απαιτεί λογικές εκφράσεις.')
      return {type:'boolean',value:op === 'ΚΑΙ' ? a && b : a || b}
    }
    if (['=','<>','<','<=','>','>='].includes(op)) {
      if (!numeric && left.type !== right.type || left.type === 'boolean' && !['=','<>'].includes(op)) return fail('Η σύγκριση απαιτεί συμβατούς τύπους.')
      const cmp = numeric ? a-b : String(a).localeCompare(String(b),'el-GR')
      return {type:'boolean',value:op==='=' ? cmp===0 : op==='<>' ? cmp!==0 : op==='<' ? cmp<0 : op==='<=' ? cmp<=0 : op==='>' ? cmp>0 : cmp>=0}
    }
    if (!numeric) return fail('Η πράξη απαιτεί αριθμητικές τιμές.')
    if (['DIV','MOD'].includes(op) && (left.type !== 'integer' || right.type !== 'integer')) return fail('Οι DIV και MOD απαιτούν ακέραιους τελεστέους.')
    if (['/','DIV','MOD'].includes(op) && b===0) throw new GlossaError(line,'Προσπάθεια διαίρεσης με το μηδέν.','runtime')
    const value = op==='+' ? a+b : op==='-' ? a-b : op==='*' ? a*b : op==='/' ? a/b : op==='^' ? a**b : op==='DIV' ? Math.trunc(a/b) : a%b
    const type = op==='/' || left.type==='real' || right.type==='real' || op==='^' && (!Number.isInteger(value)||b<0) ? 'real' : 'integer'
    return checked({type,value},line)
  }
  for (const constant of constants) {
    if (values.has(constant.name)) throw new GlossaError(constant.line,'Διπλή δήλωση σταθεράς «'+constant.name+'».')
    values.set(constant.name,evaluate(constant.expression))
  }
  return values
}
function checked(value: Value,line: number): Value {
  if (typeof value.value === 'number' && (!Number.isFinite(value.value) || value.type==='integer' && !Number.isSafeInteger(value.value))) throw new GlossaError(line,'Το αριθμητικό αποτέλεσμα δεν μπορεί να αναπαρασταθεί.','runtime')
  return value
}
