import { executeSource, type ExecutionResult } from './execution'
import type { ProgramTestCase } from './model'
import { FuzzSpecificationSchema, type FuzzSpecification } from './fuzzSpecification'

export interface CounterExample {
  inputs: string[]
  inputDescription: string
  expectedOutput: string[]
  actualOutput: string[]
  studentError?: string
  metrics: ExecutionResult['metrics']
}

export interface CounterExampleReport {
  testedCases: number
  counterExample: CounterExample | null
  skippedCases?: number
  specificationApplied?: boolean
}

interface InputArray { name: string; indexes: number[] }
interface Candidate { inputs: string[]; names: string[]; description: string }

const MAX_FUZZ_CASES = 200
const comparable = (text: string) => text.trim().replace(/\s+/gu, ' ')
const normalizedName = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleUpperCase('el-GR')
const parseNumber = (value: string) => /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/u.test(value.trim()) ? Number(value.trim().replace(',', '.')) : null
const isDifferent = (student: ExecutionResult, reference: ExecutionResult, studentInputs: number, referenceInputs: number) => {
  // Μια προβληματική πρότυπη εκτέλεση δεν είναι έγκυρος oracle.
  if(reference.error || reference.inputsUsed !== referenceInputs) return false
  if (Boolean(student.error) !== Boolean(reference.error)) return true
  if (student.error && reference.error) return false
  return student.inputsUsed !== studentInputs || reference.inputsUsed !== referenceInputs ||
    student.output.length !== reference.output.length ||
    student.output.some((line, index) => comparable(line) !== comparable(reference.output[index] ?? ''))
}

function findArrays(names: string[]): InputArray[] {
  const groups = new Map<string, number[]>()
  names.forEach((name, index) => {
    const match = /^(.+?)\[(\d+)\]$/u.exec(name)
    if (!match) return
    const indexes = groups.get(match[1]) ?? []
    indexes.push(index)
    groups.set(match[1], indexes)
  })
  return [...groups].map(([name, indexes]) => ({ name, indexes })).filter(group => group.indexes.length > 0)
}

export function candidatesFor(inputs: string[], names: string[], specification?:FuzzSpecification): Candidate[] {
  const arrays = findArrays(names)
  const candidates: Candidate[] = []
  const add = (values: string[], description: string) => {
    if (values.length === inputs.length && !candidates.some(candidate => candidate.inputs.every((value, index) => value === values[index]))) {
      candidates.push({ inputs: values, names, description })
    }
  }
  add(inputs, 'δοκιμαστική είσοδος')
  const arrayIndexes = new Set(arrays.flatMap(array => array.indexes))
  const countNames = new Set(['N', 'Ν', 'M', 'Μ', 'SIZE', 'LENGTH', 'PLITHOS', 'ARITHMOS', 'ΠΛΗΘΟΣ', 'ΜΕΓΕΘΟΣ'])
  const searchNames = new Set(['X', 'KEY', 'TARGET', 'SEARCH', 'KLEIDI', 'ANAZITISI', 'STOXOS', 'ΚΛΕΙΔΙ', 'ΣΤΟΧΟΣ'])
  const searchIndexes: number[] = []
  names.forEach((name, index) => {
    if (arrayIndexes.has(index)) return
    const numeric = parseNumber(inputs[index] ?? '')
    if (numeric === null) return
    const key = normalizedName(name)
    const scalar=specification?.scalars.find(s=>normalizedName(s.name)===normalizedName(name.split('[')[0]))
    if (searchNames.has(key)||scalar?.role==='searchKey') searchIndexes.push(index)
    const isArrayLength = countNames.has(key) && arrays.some(array => numeric === array.indexes.length)
    if (isArrayLength || scalar?.role==='count' || searchNames.has(key)||scalar?.role==='searchKey') return
    for (const value of [-10, 0, 1_000_000,...(scalar?.min!==undefined?[scalar.min]:[]),...(scalar?.max!==undefined?[scalar.max]:[])]) add(inputs.map((item, slot) => slot === index ? String(value) : item), `${name} = ${value}`)
  })

  for (const array of arrays) {
    const spec=specification?.arrays.find(s=>normalizedName(s.name)===normalizedName(array.name))
    const original = array.indexes.map(index => inputs[index] ?? '')
    const numbers = original.map(parseNumber)
    const allNumeric = numbers.every(value => value !== null)
    const sorted = allNumeric
      ? [...numbers as number[]].sort((a, b) => a - b).map(String)
      : [...original].sort((a, b) => a.localeCompare(b, 'el-GR'))
    const reversed = [...sorted].reverse()
    const variants: Array<[string, string[]]> = [
      ['αύξουσα ταξινόμηση', sorted],
      ['φθίνουσα ταξινόμηση', reversed],
      ['ίδια στοιχεία', original.map(() => original[0] ?? '')],
    ]
    if (allNumeric) variants.push(
      ['αρνητικά στοιχεία', original.map(() => '-10')],
      ['μηδενικά στοιχεία', original.map(() => '0')],
      ['μεγάλα στοιχεία', original.map(() => '1000000')],
      ...(spec?.min!==undefined?[['ελάχιστα επιτρεπτά στοιχεία',original.map(()=>String(spec.min))] as [string,string[]]]:[]),
      ...(spec?.max!==undefined?[['μέγιστα επιτρεπτά στοιχεία',original.map(()=>String(spec.max))] as [string,string[]]]:[]),
    )
    for (const [label, values] of variants) {
      const next = [...inputs]
      array.indexes.forEach((index, item) => { next[index] = values[item] ?? '' })
      add(next, `${array.name}: ${label}`)
    }
    if (!allNumeric) continue
    const numericValues = numbers as number[]
    for (const index of searchIndexes) {
      const edgeValues = [numericValues[0], numericValues[numericValues.length - 1], Math.max(...numericValues) + 1]
      for (const [edge, value] of [['πρώτο στοιχείο', edgeValues[0]], ['τελευταίο στοιχείο', edgeValues[1]], ['στοιχείο που απουσιάζει', edgeValues[2]]] as const) {
        if (value === undefined) continue
        add(inputs.map((item, slot) => slot === index ? String(value) : item), `${names[index]}: ${edge}`)
      }
    }
  }
  return candidates.slice(0, MAX_FUZZ_CASES)
}

function countInputIndex(names: string[]) {
  return names.findIndex(name => new Set(['N', 'Ν', 'SIZE', 'LENGTH', 'PLITHOS', 'ΠΛΗΘΟΣ', 'ΜΕΓΕΘΟΣ']).has(normalizedName(name)))
}

/** Οι περιορισμοί δηλώνονται από τον συντάκτη· δεν εξάγονται από την εκφώνηση με εικασίες. */
export function validFuzzInput(inputs:string[],names:string[],specification?:FuzzSpecification):boolean {
  if(inputs.length!==names.length)return false
  if(!specification)return true
  const numberIn=(text:string,min?:number,max?:number)=>{const n=parseNumber(text);return n!==null&&Number.isFinite(n)&&(min===undefined||n>=min)&&(max===undefined||n<=max)}
  for(const scalar of specification.scalars){
    const slots=names.flatMap((n,i)=>normalizedName(n.split('[')[0])===normalizedName(scalar.name)?[i]:[])
    if(!slots.length)return false
    for(const i of slots){const text=inputs[i];if(scalar.allowed&&!scalar.allowed.includes(text))return false
      if(scalar.type==='integer'||scalar.type==='real'){
        if(!numberIn(text,scalar.min,scalar.max)||scalar.type==='integer'&&!Number.isSafeInteger(parseNumber(text)))return false
      }else if(scalar.type==='boolean'&&!['ΑΛΗΘΗΣ','ΨΕΥΔΗΣ'].includes(normalizedName(text)))return false
    }
  }
  const arrays=findArrays(names)
  for(const spec of specification.arrays){
    const array=arrays.find(a=>normalizedName(a.name)===normalizedName(spec.name))
    if(!array||array.indexes.length<spec.minLength||array.indexes.length>spec.maxLength)return false
    if(spec.countVariable){const i=names.findIndex(n=>normalizedName(n)===normalizedName(spec.countVariable!));if(i<0||Number(inputs[i])!==array.indexes.length)return false}
    const values=array.indexes.map(i=>inputs[i])
    if((spec.min!==undefined||spec.max!==undefined)&&values.some(v=>!numberIn(v,spec.min,spec.max)))return false
    if(spec.sorted){const numeric=values.map(parseNumber),allNumeric=numeric.every(n=>n!==null)
      for(let i=1;i<values.length;i++){const delta=allNumeric?numeric[i]!-numeric[i-1]!:values[i].localeCompare(values[i-1],'el-GR');if(spec.sorted==='ascending'?delta<0:delta>0)return false}
    }
  }
  return true
}

type Pair=[ExecutionResult,ExecutionResult]
type Search=Generator<string[],CounterExampleReport,Pair>
/** Κοινός αλγόριθμος για synchronous unit tests και παράλληλους browser Workers. */
function* search(seeds:ProgramTestCase[],rawSpecification?:FuzzSpecification):Search {
  const specification=rawSpecification?FuzzSpecificationSchema.parse(rawSpecification):undefined
  let testedCases=0,skippedCases=0
  const empty=():CounterExampleReport=>({testedCases,skippedCases,specificationApplied:!!specification,counterExample:null})
  for(const seed of seeds.slice(0,10)){
    if(testedCases>=MAX_FUZZ_CASES)return empty()
    const [seedStudent,seedReference]=yield seed.inputs;testedCases++
    if(seedReference.error||seedReference.inputsUsed!==seed.inputs.length){skippedCases++;continue}
    const names=seedReference.inputNames??seedStudent.inputNames??[]
    for(const candidate of candidatesFor(seed.inputs,names,specification)){
      if(!validFuzzInput(candidate.inputs,names,specification)){skippedCases++;continue}
      if(testedCases>=MAX_FUZZ_CASES)return empty()
      let [student,reference]=yield candidate.inputs;testedCases++
      if(reference.error||reference.inputsUsed!==candidate.inputs.length){skippedCases++;continue}
      if(!isDifferent(student,reference,candidate.inputs.length,candidate.inputs.length))continue
      let inputs=[...candidate.inputs],currentNames=reference.inputNames??names
      // Μείωση μήκους μόνο όταν έχει δηλωθεί/αναγνωριστεί πραγματική συσχέτιση πλήθους–πίνακα.
      let attempts=0,changed=true
      while(changed&&attempts<64&&testedCases<MAX_FUZZ_CASES){
        changed=false
        for(const array of findArrays(currentNames)){
          const spec=specification?.arrays.find(a=>normalizedName(a.name)===normalizedName(array.name))
          const countIndex=spec?.countVariable?currentNames.findIndex(n=>normalizedName(n)===normalizedName(spec.countVariable!)):specification?-1:countInputIndex(currentNames)
          if(countIndex<0||array.indexes.length<=(spec?.minLength??1)||Number(inputs[countIndex])!==array.indexes.length)continue
          for(const slot of [...array.indexes].reverse()){
            if(attempts++>=64||testedCases>=MAX_FUZZ_CASES)break
            const trial=inputs.filter((_,i)=>i!==slot),countSlot=countIndex>slot?countIndex-1:countIndex
            trial[countSlot]=String(array.indexes.length-1)
            const pair=yield trial;testedCases++
            const trialNames=pair[1].inputNames??[]
            if(!validFuzzInput(trial,trialNames,specification)||!isDifferent(pair[0],pair[1],trial.length,trial.length))continue
            inputs=trial;[student,reference]=pair;currentNames=trialNames;changed=true;break
          }
          if(changed)break
        }
      }
      // Μείωση αριθμητικών τιμών προς 0, ±1 και διαδοχικά μισά, χωρίς αλλαγή των πλήθων.
      const arrays=findArrays(currentNames)
      const counts=new Set(arrays.flatMap(a=>{
        const spec=specification?.arrays.find(s=>normalizedName(s.name)===normalizedName(a.name))
        const i=spec?.countVariable?currentNames.findIndex(n=>normalizedName(n)===normalizedName(spec.countVariable!)):countInputIndex(currentNames)
        return i>=0&&Number(inputs[i])===a.indexes.length?[i]:[]
      }))
      for(let slot=0;slot<inputs.length&&attempts<128&&testedCases<MAX_FUZZ_CASES;slot++){
        if(counts.has(slot))continue
        const n=parseNumber(inputs[slot]);if(n===null||!Number.isFinite(n))continue
        const options=[0,Math.sign(n),Math.trunc(n/2)]
        for(const value of options){
          if(Math.abs(value)>=Math.abs(Number(inputs[slot]))||attempts++>=128||testedCases>=MAX_FUZZ_CASES)continue
          const trial=inputs.map((v,i)=>i===slot?String(value):v)
          if(!validFuzzInput(trial,currentNames,specification))continue
          const pair=yield trial;testedCases++
          if(!validFuzzInput(trial,pair[1].inputNames??[],specification)||!isDifferent(pair[0],pair[1],trial.length,trial.length))continue
          inputs=trial;[student,reference]=pair;currentNames=reference.inputNames??currentNames
        }
      }
      const groups=findArrays(currentNames),arraySlots=new Set(groups.flatMap(a=>a.indexes))
      const descriptions=[...groups.map(a=>`${a.name} = [${a.indexes.map(i=>inputs[i]).join(', ')}]`),...currentNames.flatMap((n,i)=>arraySlots.has(i)?[]:[`${n} = ${inputs[i]}`])]
      return {testedCases,skippedCases,specificationApplied:!!specification,counterExample:{inputs,inputDescription:'['+descriptions.join('; ')+']',expectedOutput:reference.output,actualOutput:student.output,...(student.error?{studentError:student.error}:{}),metrics:student.metrics}}
    }
  }
  return empty()
}
export function findCounterExample(studentSource:string,referenceSource:string,seeds:ProgramTestCase[],specification?:FuzzSpecification):CounterExampleReport {
  const generator=search(seeds,specification);let next=generator.next()
  while(!next.done)next=generator.next([executeSource(studentSource,next.value),executeSource(referenceSource,next.value)])
  return next.value
}
export async function findCounterExampleAsync(seeds:ProgramTestCase[],runPair:(inputs:string[])=>Promise<Pair>,specification?:FuzzSpecification):Promise<CounterExampleReport>{
  const generator=search(seeds,specification);let next=generator.next()
  while(!next.done)next=generator.next(await runPair(next.value))
  return next.value
}
