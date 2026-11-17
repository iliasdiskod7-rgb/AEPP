import type { SearchVisualizerId } from '../../data/courses/lesson1'
import { line, range, recorder, type ArrayAlgorithm, type ArrayStep, type CellRole } from './types'

// Ο κώδικας κάθε αλγορίθμου είναι αυτούσιος ο κώδικας της αντίστοιχης απάντησης του Μαθήματος 20.

const rolesFor = (entries: Array<[number[], CellRole]>) => {
  const roles: Record<number, CellRole> = {}
  for (const [indexes, role] of entries) for (const index of indexes) roles[index] = role
  return roles
}

// ---------------------------------------------------------------- Σειριακή (μη ταξινομημένος)

const sequentialCode = [
  line(0, 'flag <- ΨΕΥΔΗΣ'),
  line(0, 'θέση <- 0'),
  line(0, 'i <- 1'),
  line(0, 'ΟΣΟ flag = ΨΕΥΔΗΣ ΚΑΙ i <= Ν ΕΠΑΝΑΛΑΒΕ'),
  line(1, 'ΑΝ table[i] = key ΤΟΤΕ'),
  line(2, 'flag <- ΑΛΗΘΗΣ'),
  line(2, 'θέση <- i'),
  line(1, 'ΑΛΛΙΩΣ'),
  line(2, 'i <- i + 1'),
  line(1, 'ΤΕΛΟΣ_ΑΝ'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(0, 'ΑΝ flag = ΑΛΗΘΗΣ ΤΟΤΕ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή βρέθηκε στη θέση', θέση"),
  line(0, 'ΑΛΛΙΩΣ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή δεν βρέθηκε μέσα στον πίνακα'"),
  line(0, 'ΤΕΛΟΣ_ΑΝ'),
]

const sortedSequentialCode = [
  line(0, 'flag <- ΨΕΥΔΗΣ'),
  line(0, 'θέση <- 0'),
  line(0, 'i <- 1'),
  line(0, 'ΟΣΟ flag = ΨΕΥΔΗΣ ΚΑΙ i <= Ν ΕΠΑΝΑΛΑΒΕ'),
  line(1, 'ΑΝ table[i] = key ΤΟΤΕ'),
  line(2, 'flag <- ΑΛΗΘΗΣ'),
  line(2, 'θέση <- i'),
  line(1, 'ΑΛΛΙΩΣ_ΑΝ table[i] > key ΤΟΤΕ'),
  line(2, 'flag <- ΑΛΗΘΗΣ'),
  line(1, 'ΑΛΛΙΩΣ'),
  line(2, 'i <- i + 1'),
  line(1, 'ΤΕΛΟΣ_ΑΝ'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(0, 'ΑΝ θέση > 0 ΤΟΤΕ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή βρέθηκε στη θέση', θέση"),
  line(0, 'ΑΛΛΙΩΣ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή δεν βρέθηκε'"),
  line(0, 'ΤΕΛΟΣ_ΑΝ'),
]

function sequentialSteps(values: number[], key: number, stopWhenGreater: boolean): ArrayStep[] {
  const { arr, steps, count, output, push } = recorder(values)
  const n = arr.length
  // Θέσεις κώδικα που διαφέρουν ανάμεσα στις δύο εκδοχές.
  const L = stopWhenGreater
    ? { greater: [7, 8], next: [9, 10], loopEnd: 12, test: 13, found: [13, 14], missing: [15, 16] }
    : { greater: [], next: [7, 8], loopEnd: 10, test: 11, found: [11, 12], missing: [13, 14] }
  let flag = false
  let position = 0
  let i = 1
  const vars = () => ({ key: String(key), i: String(i), flag: flag ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ', θέση: String(position) })
  const checked = () => range(0, i - 2)
  push({
    lines: [0, 1, 2],
    vars: vars(),
    pointers: n > 0 ? { 0: ['i'] } : {},
    description: stopWhenGreater
      ? `Ψάχνουμε το key = ${key} στον ταξινομημένο πίνακα, από την αρχή προς το τέλος.`
      : `Ψάχνουμε το key = ${key}. Ο πίνακας δεν είναι ταξινομημένος, άρα εξετάζουμε τα στοιχεία ένα-ένα από την αρχή.`,
  })
  let iterations = 0
  while (!flag && i <= n) {
    iterations++
    count.moves = iterations
    count.comparisons++
    const value = arr[i - 1]
    const equal = value === key
    push({
      lines: [3, 4],
      roles: rolesFor([
        [checked(), 'discarded'],
        [[i - 1], 'compare'],
      ]),
      vars: vars(),
      pointers: { [i - 1]: ['i'] },
      description: `i = ${i}: table[${i}] = key → ${value} = ${key} → ${equal ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ'}.`,
    })
    if (equal) {
      flag = true
      position = i
      push({
        lines: [5, 6],
        roles: rolesFor([
          [checked(), 'discarded'],
          [[i - 1], 'found'],
        ]),
        vars: vars(),
        pointers: { [i - 1]: ['i'] },
        description: `Βρέθηκε! flag <- ΑΛΗΘΗΣ και θέση <- ${i}. Η επανάληψη θα σταματήσει.`,
      })
    } else if (stopWhenGreater && value > key) {
      flag = true
      push({
        lines: L.greater,
        roles: rolesFor([
          [checked(), 'discarded'],
          [range(i - 1, n - 1), 'discarded'],
          [[i - 1], 'compare'],
        ]),
        vars: vars(),
        pointers: { [i - 1]: ['i'] },
        description: `table[${i}] = ${value} > ${key}: αφού ο πίνακας είναι αύξουσα ταξινομημένος, το key δεν μπορεί να βρίσκεται πιο δεξιά. flag <- ΑΛΗΘΗΣ για να σταματήσουμε, αλλά η θέση μένει 0.`,
      })
    } else {
      i++
      push({
        lines: L.next,
        roles: rolesFor([[checked(), 'discarded']]),
        vars: vars(),
        pointers: i <= n ? { [i - 1]: ['i'] } : {},
        description:
          i <= n ? `Όχι εδώ· i <- ${i}, προχωράμε στο επόμενο στοιχείο.` : `i <- ${i}: ξεπεράσαμε το Ν = ${n}.`,
      })
    }
  }
  const found = position > 0
  const notFoundText = stopWhenGreater ? 'Η τιμή δεν βρέθηκε' : 'Η τιμή δεν βρέθηκε μέσα στον πίνακα'
  push({
    lines: [3, L.loopEnd],
    roles: found
      ? rolesFor([
          [checked(), 'discarded'],
          [[position - 1], 'found'],
        ])
      : rolesFor([[range(0, n - 1), 'discarded']]),
    vars: vars(),
    description: flag
      ? 'Η συνθήκη flag = ΨΕΥΔΗΣ είναι πλέον ψευδής, άρα η επανάληψη τερματίζεται.'
      : `Η συνθήκη i <= Ν είναι ψευδής (i = ${i}), άρα εξετάστηκαν όλα τα στοιχεία και η επανάληψη τερματίζεται.`,
  })
  output.push(found ? `Η τιμή βρέθηκε στη θέση ${position}` : notFoundText)
  push({
    lines: found ? L.found : [L.test, ...L.missing],
    roles: found
      ? rolesFor([
          [checked(), 'discarded'],
          [[position - 1], 'found'],
        ])
      : rolesFor([[range(0, n - 1), 'discarded']]),
    vars: vars(),
    description: found
      ? `Αποτέλεσμα: η τιμή ${key} βρέθηκε στη θέση ${position} μετά από ${count.comparisons} εξετάσεις στοιχείων.`
      : `Αποτέλεσμα: η τιμή ${key} δεν υπάρχει. Χρειάστηκαν ${count.comparisons} εξετάσεις στοιχείων.`,
  })
  return steps
}

// ---------------------------------------------------------------- Δυαδική

const binaryCode = [
  line(0, 'flag <- ΨΕΥΔΗΣ'),
  line(0, 'θέση <- 0'),
  line(0, 'αρχικός <- 1'),
  line(0, 'τελικός <- Ν'),
  line(0, 'ΟΣΟ flag = ΨΕΥΔΗΣ ΚΑΙ αρχικός <= τελικός ΕΠΑΝΑΛΑΒΕ'),
  line(1, 'μέσος <- (αρχικός + τελικός) DIV 2'),
  line(1, 'ΑΝ table[μέσος] = key ΤΟΤΕ'),
  line(2, 'flag <- ΑΛΗΘΗΣ'),
  line(2, 'θέση <- μέσος'),
  line(1, 'ΑΛΛΙΩΣ_ΑΝ table[μέσος] < key ΤΟΤΕ'),
  line(2, 'αρχικός <- μέσος + 1'),
  line(1, 'ΑΛΛΙΩΣ'),
  line(2, 'τελικός <- μέσος - 1'),
  line(1, 'ΤΕΛΟΣ_ΑΝ'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(0, 'ΑΝ flag = ΑΛΗΘΗΣ ΤΟΤΕ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή βρέθηκε στη θέση', θέση"),
  line(0, 'ΑΛΛΙΩΣ'),
  line(1, "ΓΡΑΨΕ 'Η τιμή δεν βρέθηκε μέσα στον πίνακα'"),
  line(0, 'ΤΕΛΟΣ_ΑΝ'),
]

function binarySteps(values: number[], key: number): ArrayStep[] {
  const { arr, steps, count, output, push } = recorder(values)
  const n = arr.length
  let flag = false
  let position = 0
  let low = 1
  let high = n
  let mid: number | null = null
  const vars = () => ({
    key: String(key),
    αρχικός: String(low),
    τελικός: String(high),
    μέσος: mid === null ? '—' : String(mid),
    flag: flag ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ',
    θέση: String(position),
  })
  const pointers = () => {
    const result: Record<number, string[]> = {}
    const add = (index: number, label: string) => {
      if (index < 1 || index > n) return
      ;(result[index - 1] ??= []).push(label)
    }
    add(low, 'αρχικός')
    if (mid !== null) add(mid, 'μέσος')
    add(high, 'τελικός')
    return result
  }
  const outside = () => [...range(0, low - 2), ...range(high, n - 1)]
  push({
    lines: [0, 1, 2, 3],
    roles: {},
    vars: vars(),
    pointers: pointers(),
    description: `Ψάχνουμε το key = ${key}. Το διάστημα αναζήτησης είναι αρχικά όλος ο πίνακας, από τη θέση 1 μέχρι τη θέση ${n}.`,
  })
  while (!flag && low <= high) {
    mid = Math.floor((low + high) / 2)
    count.moves++
    count.comparisons++
    const value = arr[mid - 1]
    push({
      lines: [4, 5, 6],
      roles: rolesFor([
        [outside(), 'discarded'],
        [[mid - 1], 'compare'],
      ]),
      vars: vars(),
      pointers: pointers(),
      description: `μέσος = (${low} + ${high}) DIV 2 = ${mid}. Εξετάζουμε το μεσαίο στοιχείο: table[${mid}] = ${value}.`,
    })
    if (value === key) {
      flag = true
      position = mid
      push({
        lines: [7, 8],
        roles: rolesFor([
          [outside(), 'discarded'],
          [[mid - 1], 'found'],
        ]),
        vars: vars(),
        pointers: pointers(),
        description: `${value} = ${key}: βρέθηκε! flag <- ΑΛΗΘΗΣ και θέση <- ${mid}.`,
      })
    } else if (value < key) {
      low = mid + 1
      push({
        lines: [9, 10],
        roles: rolesFor([[outside(), 'discarded']]),
        vars: vars(),
        pointers: pointers(),
        description: `${value} < ${key}: το key μπορεί να είναι μόνο δεξιά. Απορρίπτουμε το αριστερό μισό μαζί με το μεσαίο: αρχικός <- ${low}.`,
      })
    } else {
      high = mid - 1
      push({
        lines: [11, 12],
        roles: rolesFor([[outside(), 'discarded']]),
        vars: vars(),
        pointers: pointers(),
        description: `${value} > ${key}: το key μπορεί να είναι μόνο αριστερά. Απορρίπτουμε το δεξί μισό μαζί με το μεσαίο: τελικός <- ${high}.`,
      })
    }
  }
  const found = position > 0
  push({
    lines: [4, 14],
    roles: found
      ? rolesFor([
          [outside(), 'discarded'],
          [[position - 1], 'found'],
        ])
      : rolesFor([[range(0, n - 1), 'discarded']]),
    vars: vars(),
    pointers: pointers(),
    description: flag
      ? 'Η συνθήκη flag = ΨΕΥΔΗΣ είναι πλέον ψευδής, άρα η επανάληψη τερματίζεται.'
      : `αρχικός = ${low} > τελικός = ${high}: το διάστημα άδειασε, άρα η τιμή δεν υπάρχει και η επανάληψη τερματίζεται.`,
  })
  output.push(found ? `Η τιμή βρέθηκε στη θέση ${position}` : 'Η τιμή δεν βρέθηκε μέσα στον πίνακα')
  push({
    lines: found ? [15, 16] : [15, 17, 18],
    roles: found
      ? rolesFor([
          [outside(), 'discarded'],
          [[position - 1], 'found'],
        ])
      : rolesFor([[range(0, n - 1), 'discarded']]),
    vars: vars(),
    pointers: pointers(),
    description: `${found ? `Αποτέλεσμα: βρέθηκε στη θέση ${position}` : 'Αποτέλεσμα: η τιμή δεν υπάρχει'} μετά από ${count.comparisons} εξετάσεις μεσαίου στοιχείου. Το μέγιστο για Ν = ${n} είναι ⌊log₂(${n}) + 1⌋ = ${Math.floor(Math.log2(n) + 1)}.`,
  })
  return steps
}

const searchCommon = {
  comparisonsLabel: 'Εξετάσεις στοιχείων',
  movesLabel: 'Επαναλήψεις',
  needsKey: true,
} as const

export const searchAlgorithms: Record<SearchVisualizerId, ArrayAlgorithm> = {
  'sequential-search': {
    ...searchCommon,
    id: 'sequential-search',
    title: 'Σειριακή αναζήτηση',
    shortTitle: 'Σειριακή',
    idea: 'Εξετάζει τα στοιχεία ένα-ένα από την αρχή, μέχρι να βρει το key ή να τελειώσει ο πίνακας. Δουλεύει και σε μη ταξινομημένο πίνακα.',
    legend: ['compare', 'found', 'discarded'],
    requiresSorted: false,
    code: sequentialCode,
    generate: (values, key) => sequentialSteps(values, key, false),
  },
  'sequential-search-sorted': {
    ...searchCommon,
    id: 'sequential-search-sorted',
    title: 'Σειριακή αναζήτηση σε ταξινομημένο πίνακα',
    shortTitle: 'Σειριακή (ταξινομημένος)',
    idea: 'Όπως η σειριακή, αλλά σταματά μόλις συναντήσει στοιχείο μεγαλύτερο από το key, γιατί πιο δεξιά υπάρχουν μόνο μεγαλύτερα.',
    legend: ['compare', 'found', 'discarded'],
    requiresSorted: true,
    code: sortedSequentialCode,
    generate: (values, key) => sequentialSteps(values, key, true),
  },
  'binary-search': {
    ...searchCommon,
    id: 'binary-search',
    title: 'Δυαδική αναζήτηση',
    shortTitle: 'Δυαδική',
    idea: 'Εξετάζει το μεσαίο στοιχείο του διαστήματος και κρατά μόνο το μισό όπου μπορεί να βρίσκεται το key. Απαιτεί ταξινομημένο πίνακα.',
    legend: ['compare', 'found', 'discarded'],
    requiresSorted: true,
    code: binaryCode,
    generate: binarySteps,
  },
}
