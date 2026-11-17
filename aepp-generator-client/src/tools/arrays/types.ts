import type { VisualizerId } from '../../data/courses/lesson1'

// Κάθε αλγόριθμος παράγει μια λίστα στιγμιότυπων. Το κοινό πρόγραμμα αναπαραγωγής
// (ArrayVisualizer) απλώς τα προβάλλει. Οι δείκτες στα στιγμιότυπα είναι 0-based,
// ενώ οι τιμές μεταβλητών (i, j, k, μέσος) και τα κείμενα είναι 1-based, όπως στη ΓΛΩΣΣΑ.

export type CellRole = 'compare' | 'swap' | 'min' | 'free' | 'shift' | 'insert' | 'found' | 'discarded'

export interface CodeLine {
  text: string
  indent: number
}

export interface ArrayStep {
  array: number[]
  lines: number[]
  roles: Record<number, CellRole>
  sorted: number[]
  vars: Record<string, string>
  /** Τιμή που κρατιέται «έξω» από τον πίνακα (π.χ. temp στην ευθεία εισαγωγή). */
  floating: number | null
  /** Ετικέτες δεικτών κάτω από τα κουτάκια (π.χ. αρχικός, μέσος, τελικός). */
  pointers: Record<number, string[]>
  /** Ό,τι έχει εμφανίσει μέχρι τώρα η ΓΡΑΨΕ. */
  output: string[]
  description: string
  comparisons: number
  writes: number
  moves: number
}

export interface ArrayAlgorithm {
  id: VisualizerId
  title: string
  shortTitle: string
  idea: string
  comparisonsLabel: string
  movesLabel: string
  legend: CellRole[]
  /** Αναζήτηση: χρειάζεται τιμή key. */
  needsKey: boolean
  /** Ο αλγόριθμος προϋποθέτει αύξουσα ταξινόμηση· η είσοδος ταξινομείται πριν εκτελεστεί. */
  requiresSorted: boolean
  code: CodeLine[]
  generate: (values: number[], key: number) => ArrayStep[]
}

export const line = (indent: number, text: string): CodeLine => ({ indent, text })

export const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k)

export function recorder(initial: number[]) {
  const arr = [...initial]
  const steps: ArrayStep[] = []
  const count = { comparisons: 0, writes: 0, moves: 0 }
  const output: string[] = []
  const push = (step: Partial<ArrayStep> & Pick<ArrayStep, 'description'>) =>
    steps.push({
      array: [...arr],
      lines: [],
      roles: {},
      sorted: [],
      vars: {},
      floating: null,
      pointers: {},
      output: [...output],
      ...count,
      ...step,
    })
  return { arr, steps, count, output, push }
}
