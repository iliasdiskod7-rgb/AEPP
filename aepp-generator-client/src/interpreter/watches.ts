import { normalize, type VariableSnapshot } from './types'
import { displayValue } from './runtime'
export function resolveWatch(text: string, variables: VariableSnapshot[]): string {
  const match=/^([\p{L}_][\p{L}\p{N}_]*)(?:\[([^\]]+)\])?$/u.exec(text.trim())
  if(!match)return 'Γράψε μεταβλητή ή στοιχείο πίνακα, π.χ. Α[Ι].'
  const variable=variables.find(item=>normalize(item.name)===normalize(match[1]))
  if(!variable)return 'Δεν υπάρχει σε αυτό το πλαίσιο.'
  if(!match[2]) {
    if(variable.dimensions)return 'Πίνακας ['+variable.dimensions.join(', ')+']'
    return variable.value?displayValue(variable.value):'Χωρίς αρχική τιμή'
  }
  if(!variable.dimensions)return 'Δεν είναι πίνακας.'
  const indexes=match[2].split(',').map(part=>{
    if(/^\d+$/u.test(part.trim()))return Number(part)
    const index=variables.find(item=>normalize(item.name)===normalize(part.trim()))
    return index?.value?.type==='integer'&&typeof index.value.value==='number'?index.value.value:NaN
  })
  if(indexes.length!==variable.dimensions.length||indexes.some((index,i)=>!Number.isInteger(index)||index<1||index>variable.dimensions![i]))return 'Μη έγκυροι δείκτες.'
  const value=variable.elements?.[indexes.join(',')]
  return value?displayValue(value):'Χωρίς αρχική τιμή'
}
