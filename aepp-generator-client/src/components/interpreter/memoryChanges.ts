import type { ExecutionEvent, MemoryReference } from '../../interpreter/types'
import { displayValue } from '../../interpreter/runtime'
export const referenceLabel = (ref: MemoryReference) => ref.name + (ref.indexes.length ? '[' + ref.indexes.join(', ') + ']' : '')
export function describeChanges(event: ExecutionEvent | null) {
  return (event?.memoryEvents ?? []).filter(effect => effect.kind === 'ON_MUTATE').map(effect => referenceLabel(effect.target) + ': ' + (effect.previous ? displayValue(effect.previous) : '—') + ' → ' + displayValue(effect.value)).join(' · ')
}
