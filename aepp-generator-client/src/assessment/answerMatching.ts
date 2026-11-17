import { normalize } from '../interpreter/types'

/** Διατηρούνται πρόσημα, δεκαδικά και τελεστές που αλλάζουν το νόημα. */
export function normalizeAnswer(value: string): string {
  return normalize(value)
    .trim()
    .replace(/[_\s]+/gu, '')
    .replace(/(\p{L})[.!;:]+$/u, '$1')
}

export function matchesAcceptedAnswer(value: string, accepted: readonly string[]): boolean {
  const answer = normalizeAnswer(value)
  return answer !== '' && accepted.some(expected => normalizeAnswer(expected) === answer)
}

/** Η ανοχή τυπογραφικών αφορά μόνο τις δύο λεκτικές απαντήσεις Σ/Λ. */
export function matchesBooleanAnswer(value: string, expected: boolean): boolean {
  const answer = normalizeAnswer(value)
  const target = expected ? 'ΣΩΣΤΟ' : 'ΛΑΘΟΣ'
  if (answer === target) return true
  if (answer.length !== target.length) return false
  for (let index = 0; index < target.length - 1; index++) {
    if (answer === target.slice(0, index) + target[index + 1] + target[index] + target.slice(index + 2)) return true
  }
  return false
}
