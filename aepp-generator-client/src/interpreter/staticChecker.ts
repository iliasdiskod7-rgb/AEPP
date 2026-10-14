import { builtinNames, builtinType } from './builtins'
import { resolveConstants } from './constants'
import { GlossaError, type Expression, type Program, type Statement, type Subprogram, type ValueType } from './types'
interface SymbolInfo { type: ValueType; dimensions?: number[]; constant?: boolean }
type Scope = Map<string,SymbolInfo>
const numeric = (type: ValueType) => type === 'integer' || type === 'real'
const compatible = (left: ValueType,right: ValueType) => left === right || numeric(left) && numeric(right)
const fail = (line: number,message: string): never => { throw new GlossaError(line,message,'type') }

/** Ελέγχει όλους τους κλάδους και υποπρογράμματα, χωρίς ανάγνωση εισόδου ή εκτέλεση. */
export function analyzeProgram(program: Program): void {
  const constants=resolveConstants(program.constants)
  const routines=new Map(program.subprograms.map(routine=>[routine.name,routine]))
  const main: Scope=new Map([...constants].map(([name,value])=>[name,{type:value.type,constant:true}]))
  for(const declaration of program.declarations)main.set(declaration.name,declaration)
  function lookup(name: string,line: number,scope: Scope): SymbolInfo {
    return scope.get(name) ?? fail(line,'Η μεταβλητή «'+name+'» δεν έχει δηλωθεί στο τμήμα ΜΕΤΑΒΛΗΤΕΣ.')
  }
  function indexed(name: string,indexes: Expression[],line: number,scope: Scope,wholeArray=false): SymbolInfo {
    const symbol=lookup(name,line,scope)
    indexes.forEach(index=>{if(infer(index,scope)!=='integer')fail(index.line,'Ο δείκτης πίνακα πρέπει να είναι ακέραιος.')})
    if(indexes.length && !symbol.dimensions)fail(line,'Η μεταβλητή «'+name+'» δεν είναι πίνακας.')
    if(symbol.dimensions && !indexes.length && !wholeArray)fail(line,'Ο πίνακας «'+name+'» χρειάζεται δείκτη στοιχείου.')
    if(indexes.length && indexes.length!==symbol.dimensions?.length)fail(line,'Λανθασμένο πλήθος δεικτών για τον πίνακα «'+name+'».')
    return symbol
  }
  function argumentsFor(routine: Subprogram,args: Expression[],line: number,scope: Scope): void {
    if(args.length!==routine.parameters.length)fail(line,'Πλήθος ορισμάτων ('+args.length+') δεν ταιριάζει με το πλήθος παραμέτρων ('+routine.parameters.length+').')
    args.forEach((argument,index)=>{
      const formal=routine.declarations.find(declaration=>declaration.name===routine.parameters[index]) ?? fail(routine.line,'Η παράμετρος πρέπει να δηλωθεί στο τμήμα ΜΕΤΑΒΛΗΤΕΣ.')
      const type=infer(argument,scope,true)
      if(type!==formal.type)fail(line,'Ασυμβατότητα τύπων μεταξύ ορίσματος και παραμέτρου «'+formal.name+'».')
      const dimensions=argument.kind==='variable' ? lookup(argument.name,argument.line,scope).dimensions ?? [] : []
      if(JSON.stringify(dimensions)!==JSON.stringify(formal.dimensions??[]))fail(line,'Οι διαστάσεις του ορίσματος δεν ταιριάζουν με την παράμετρο «'+formal.name+'».')
    })
  }
  function infer(expression: Expression,scope: Scope,wholeArray=false): ValueType {
    const line=expression.line
    if(expression.kind==='literal')return expression.value.type
    if(expression.kind==='variable')return indexed(expression.name,[],line,scope,wholeArray).type
    if(expression.kind==='arrayAccess')return indexed(expression.name,expression.indexes,line,scope).type
    if(expression.kind==='call'){
      const routine=routines.get(expression.name)
      if(routine){
        if(routine.kind!=='function')fail(line,'Η διαδικασία «'+routine.name+'» καλείται μόνο με ΚΑΛΕΣΕ.')
        argumentsFor(routine,expression.arguments,line,scope)
        return routine.returnType ?? fail(line,'Λείπει ο τύπος επιστροφής συνάρτησης.')
      }
      if(!builtinNames.has(expression.name))fail(line,'Η συνάρτηση «'+expression.name+'» δεν βρέθηκε ή δεν έχει δηλωθεί.')
      if(expression.arguments.length!==1)fail(line,'Πλήθος ορισμάτων ('+expression.arguments.length+') δεν ταιριάζει με το πλήθος παραμέτρων (1).')
      const type=infer(expression.arguments[0],scope)
      if(!numeric(type))fail(line,'Η συνάρτηση «'+expression.name+'» απαιτεί αριθμητικό όρισμα.')
      return builtinType(expression.name,type)
    }
    if(expression.kind==='unary'){
      const type=infer(expression.operand,scope)
      if(expression.operator==='ΟΧΙ'){
        if(type!=='boolean')fail(line,'Χρήση λογικού τελεστή ή συνθήκης σε μη λογική έκφραση.')
        return 'boolean'
      }
      if(!numeric(type))fail(line,'Η πράξη απαιτεί αριθμητική τιμή.')
      return type
    }
    // Και τα δύο σκέλη ελέγχονται ακόμη και όταν η εκτέλεση θα έκανε short circuit.
    const left=infer(expression.left,scope),right=infer(expression.right,scope),op=expression.operator
    if(op==='ΚΑΙ'||op==='Η'){
      if(left!=='boolean'||right!=='boolean')fail(line,'Χρήση λογικού τελεστή ή συνθήκης σε μη λογική έκφραση.')
      return 'boolean'
    }
    if(['=','<>','<','<=','>','>='].includes(op)){
      if(!compatible(left,right))fail(line,'Η σύγκριση απαιτεί συμβατούς τύπους.')
      if(left==='boolean'&&!['=','<>'].includes(op))fail(line,'Οι λογικές τιμές συγκρίνονται μόνο με = ή <>.')
      return 'boolean'
    }
    if(!numeric(left)||!numeric(right))fail(line,'Η πράξη απαιτεί αριθμητική τιμή.')
    if(['DIV','MOD'].includes(op)&&(left!=='integer'||right!=='integer'))fail(line,'Οι DIV και MOD απαιτούν ακέραιους τελεστέους.')
    const negativePower=op==='^'&&expression.right.kind==='unary'&&expression.right.operator==='-'&&expression.right.operand.kind==='literal'&&typeof expression.right.operand.value.value==='number'&&expression.right.operand.value.value>0
    return op==='/'||left==='real'||right==='real'||negativePower ? 'real' : 'integer'
  }
  const condition=(expression: Expression,scope: Scope)=>{if(infer(expression,scope)!=='boolean')fail(expression.line,'Χρήση λογικού τελεστή ή συνθήκης σε μη λογική έκφραση.')}
  function body(statements: Statement[],scope: Scope): void {
    for(const statement of statements){
      const line=statement.line
      switch(statement.kind){
        case 'assign': {
          const symbol=indexed(statement.name,statement.indexes,line,scope),type=infer(statement.expression,scope)
          if(symbol.constant)fail(line,'Η σταθερά «'+statement.name+'» δεν επιτρέπεται να αλλάξει.')
          if(symbol.type!==type&&!(symbol.type==='real'&&type==='integer'))fail(line,'Ασυμβίβαστοι τύποι στην εκχώρηση: '+(symbol.type==='integer'&&type==='real'?'Προσπάθεια εκχώρησης πραγματικού αριθμού σε ακέραια μεταβλητή.':type==='string'&&numeric(symbol.type)?'Προσπάθεια εκχώρησης αλφαριθμητικού σε αριθμητική μεταβλητή.':'Η έκφραση δεν συμφωνεί με τον τύπο της μεταβλητής.'))
          break
        }
        case 'read': statement.targets.forEach(target=>{if(indexed(target.name,target.indexes,line,scope).constant)fail(line,'Η σταθερά «'+target.name+'» δεν μπορεί να διαβαστεί.')});break
        case 'write': statement.expressions.forEach(expression=>infer(expression,scope));break
        case 'procedureCall': {
          const routine=routines.get(statement.name) ?? fail(line,'Η διαδικασία «'+statement.name+'» δεν βρέθηκε ή δεν έχει δηλωθεί.')
          if(routine.kind!=='procedure')fail(line,'Η συνάρτηση «'+statement.name+'» χρησιμοποιείται μέσα σε έκφραση και όχι με ΚΑΛΕΣΕ.')
          argumentsFor(routine,statement.arguments,line,scope);break
        }
        case 'if': statement.branches.forEach(branch=>{condition(branch.condition,scope);body(branch.body,scope)});body(statement.otherwise,scope);break
        case 'select': {
          const type=infer(statement.expression,scope)
          for(const branch of statement.cases){
            for(const pattern of branch.patterns){
              const expressions=pattern.kind==='range'?[pattern.from,pattern.to]:[pattern.expression]
              for(const expression of expressions)if(!compatible(type,infer(expression,scope)))fail(expression.line,'Η ΠΕΡΙΠΤΩΣΗ απαιτεί συμβατό τύπο με την ΕΠΙΛΕΞΕ.')
              if(type==='boolean'&&(pattern.kind==='range'||pattern.kind==='comparison'&&!['=','<>'].includes(pattern.operator)))fail(branch.line,'Οι λογικές τιμές συγκρίνονται μόνο με = ή <>.')
            }
            body(branch.body,scope)
          }
          body(statement.otherwise,scope);break
        }
        case 'for': {
          const symbol=lookup(statement.name,line,scope)
          if(symbol.constant||symbol.type!=='integer'||symbol.dimensions)fail(line,'Η μεταβλητή ελέγχου της ΓΙΑ πρέπει να είναι ακέραια μεταβλητή.')
          for(const expression of [statement.from,statement.to,statement.step])if(infer(expression,scope)!=='integer')fail(expression.line,'Τα όρια και το βήμα της ΓΙΑ πρέπει να είναι ακέραια.')
          body(statement.body,scope);break
        }
        case 'while': case 'repeat': condition(statement.condition,scope);body(statement.body,scope);break
      }
    }
  }
  body(program.body,main)
  for(const routine of program.subprograms){
    const scope: Scope=new Map(routine.declarations.map(declaration=>[declaration.name,declaration]))
    if(routine.kind==='function')scope.set(routine.name,{type:routine.returnType??fail(routine.line,'Λείπει ο τύπος επιστροφής.')})
    body(routine.body,scope)
  }
}
