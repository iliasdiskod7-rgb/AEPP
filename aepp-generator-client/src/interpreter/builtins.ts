import { GlossaError, type Value, type ValueType } from './types'

export const builtinNames = new Set(['Α_Τ', 'Α_Μ', 'Τ_Ρ', 'ΗΜ', 'ΣΥΝ', 'ΕΦ', 'ΛΟΓ', 'Ε'])
export function builtinType(name: string, argument: ValueType): ValueType {
  return name === 'Α_Μ' ? 'integer' : name === 'Α_Τ' ? argument : 'real'
}
export function evaluateBuiltin(name: string, argument: Value, line: number): Value {
  if (!builtinNames.has(name)) throw new GlossaError(line, 'Άγνωστη ενσωματωμένη συνάρτηση «' + name + '».', 'type')
  if (typeof argument.value !== 'number' || !['integer','real'].includes(argument.type)) throw new GlossaError(line, 'Η συνάρτηση «' + name + '» απαιτεί αριθμητικό όρισμα.', 'type')
  const x = argument.value
  let value: number
  switch (name) {
    case 'Α_Τ': value = Math.abs(x); break
    case 'Α_Μ': value = Math.trunc(x); break
    case 'Τ_Ρ':
      if (x < 0) throw new GlossaError(line, 'Προσπάθεια υπολογισμού τετραγωνικής ρίζας Τ_Ρ() με αρνητικό όρισμα.', 'runtime')
      value = Math.sqrt(x); break
    case 'ΛΟΓ':
      if (x <= 0) throw new GlossaError(line, 'Το όρισμα της ΛΟΓ(Χ) πρέπει να είναι θετικός αριθμός', 'runtime')
      value = Math.log(x); break
    case 'Ε': value = Math.exp(x); break
    case 'ΗΜ': value = Math.sin(x * Math.PI / 180); break
    case 'ΣΥΝ': value = Math.cos(x * Math.PI / 180); break
    default:
      if (Math.abs(Math.cos(x * Math.PI / 180)) < 1e-12) throw new GlossaError(line, 'Η εφαπτομένη δεν ορίζεται για αυτή τη γωνία.', 'runtime')
      value = Math.tan(x * Math.PI / 180)
  }
  const type = builtinType(name,argument.type)
  if (!Number.isFinite(value) || type === 'integer' && !Number.isSafeInteger(value)) throw new GlossaError(line,'Το αριθμητικό αποτέλεσμα δεν μπορεί να αναπαρασταθεί.','runtime')
  return {type,value}
}
