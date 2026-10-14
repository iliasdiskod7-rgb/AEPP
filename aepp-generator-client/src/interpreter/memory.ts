import type { MemoryEvent, MemoryReference, Value } from './types'

export const memoryKey = (ref: MemoryReference) => JSON.stringify([ref.scopeId, ref.name, ref.indexes])
const same = (a: MemoryReference | undefined, b: MemoryReference) => a !== undefined && memoryKey(a) === memoryKey(b)
const sameValue = (a: Value | null, b: Value) => a?.type === b.type && a.value === b.value

type Mutation = Extract<MemoryEvent, { kind: 'ON_MUTATE' }>
/** Αναγνωρίζει μόνο τρεις διαδοχικές άμεσες εκχωρήσεις μεταξύ των ίδιων θέσεων μνήμης. */
export class SwapTracker {
  private first: Mutation | null = null
  private second: Mutation | null = null
  reset() { this.first = null; this.second = null }
  record(event: Mutation): Extract<MemoryEvent, { kind: 'ON_SWAP' }> | null {
    const first = this.first, second = this.second
    if (first?.source && second?.source &&
        same(event.target, second.source) && same(event.source, first.target) &&
        sameValue(event.value, first.value) && sameValue(event.previous, second.value)) {
      const swap: Extract<MemoryEvent, { kind: 'ON_SWAP' }> = {
        kind: 'ON_SWAP', first: first.source, second: second.source,
        temporary: first.target, values: [{ ...first.value }, { ...second.value }],
      }
      this.reset()
      return swap
    }
    if (first?.source && !second && event.source &&
        same(event.target, first.source) && event.source.indexes.length > 0 &&
        event.source.name === first.source.name && event.source.scopeId === first.source.scopeId &&
        !same(event.target, event.source) && sameValue(event.previous, first.value)) {
      this.second = event
      return null
    }
    this.reset()
    if (event.target.indexes.length === 0 && event.source?.indexes.length &&
        event.source.scopeId === event.target.scopeId) this.first = event
    return null
  }
}
