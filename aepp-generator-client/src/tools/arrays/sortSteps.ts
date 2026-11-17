import type { SortVisualizerId } from '../../data/courses/lesson1'
import { line, range, recorder, type ArrayAlgorithm, type ArrayStep } from './types'

// ---------------------------------------------------------------- Φυσαλίδα

const bubbleCode = [
  line(0, 'ΓΙΑ i ΑΠΟ 2 ΜΕΧΡΙ Ν'),
  line(1, 'ΓΙΑ j ΑΠΟ Ν ΜΕΧΡΙ i ΜΕ ΒΗΜΑ -1'),
  line(2, 'ΑΝ table[j-1] > table[j] ΤΟΤΕ'),
  line(3, 'temp <- table[j-1]'),
  line(3, 'table[j-1] <- table[j]'),
  line(3, 'table[j] <- temp'),
  line(2, 'ΤΕΛΟΣ_ΑΝ'),
  line(1, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
]

function bubbleSteps(values: number[]): ArrayStep[] {
  const { arr, steps, count, push } = recorder(values)
  const n = arr.length
  const sorted: number[] = []
  push({
    description: `Αρχικός πίνακας με Ν = ${n}. Σε κάθε πέρασμα το j κατεβαίνει από το Ν μέχρι το i και συγκρίνονται τα γειτονικά table[j-1] και table[j].`,
  })
  for (let i = 2; i <= n; i++) {
    for (let j = n; j >= i; j--) {
      const a = arr[j - 2]
      const b = arr[j - 1]
      count.comparisons++
      const swap = a > b
      push({
        lines: [2],
        roles: { [j - 2]: 'compare', [j - 1]: 'compare' },
        sorted: [...sorted],
        vars: { i: String(i), j: String(j) },
        description: `i = ${i}, j = ${j}: table[${j - 1}] > table[${j}] → ${a} > ${b} → ${swap ? 'ΑΛΗΘΗΣ, γίνεται αντιμετάθεση' : 'ΨΕΥΔΗΣ, καμία αλλαγή'}.`,
      })
      if (swap) {
        arr[j - 2] = b
        arr[j - 1] = a
        count.writes += 2
        count.moves++
        push({
          lines: [3, 4, 5],
          roles: { [j - 2]: 'swap', [j - 1]: 'swap' },
          sorted: [...sorted],
          vars: { i: String(i), j: String(j), temp: String(a) },
          description: `Αντιμετάθεση με το temp: το ${b} πηγαίνει στη θέση ${j - 1} και το ${a} στη θέση ${j}.`,
        })
      }
    }
    sorted.push(i - 2)
    push({
      lines: [7],
      sorted: [...sorted],
      vars: { i: String(i) },
      description: `Τέλος περάσματος i = ${i}: το ${arr[i - 2]} «ανέβηκε» και κλείδωσε στη θέση ${i - 1}.`,
    })
  }
  push({
    lines: [8],
    sorted: range(0, n - 1),
    description: 'Η ταξινόμηση ολοκληρώθηκε. Το τελευταίο στοιχείο είναι αυτόματα στη σωστή θέση.',
  })
  return steps
}

// ---------------------------------------------------------------- Επιλογή

const selectionCode = [
  line(0, 'ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ Ν - 1'),
  line(1, 'k <- i'),
  line(1, 'ΓΙΑ j ΑΠΟ i + 1 ΜΕΧΡΙ Ν'),
  line(2, 'ΑΝ table[j] < table[k] ΤΟΤΕ'),
  line(3, 'k <- j'),
  line(2, 'ΤΕΛΟΣ_ΑΝ'),
  line(1, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(1, 'temp <- table[i]'),
  line(1, 'table[i] <- table[k]'),
  line(1, 'table[k] <- temp'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
]

function selectionSteps(values: number[]): ArrayStep[] {
  const { arr, steps, count, push } = recorder(values)
  const n = arr.length
  const sorted: number[] = []
  push({
    description: `Αρχικός πίνακας με Ν = ${n}. Σε κάθε πέρασμα βρίσκουμε τη θέση k του ελάχιστου από το i μέχρι το Ν και το φέρνουμε στη θέση i.`,
  })
  for (let i = 1; i <= n - 1; i++) {
    let k = i
    push({
      lines: [1],
      roles: { [i - 1]: 'min' },
      sorted: [...sorted],
      vars: { i: String(i), k: String(k) },
      description: `Πέρασμα i = ${i}: υποθέτουμε ότι το ελάχιστο είναι το table[${i}] = ${arr[i - 1]}, άρα k = ${i}.`,
    })
    for (let j = i + 1; j <= n; j++) {
      count.comparisons++
      const smaller = arr[j - 1] < arr[k - 1]
      push({
        lines: [3],
        roles: { [k - 1]: 'min', [j - 1]: 'compare' },
        sorted: [...sorted],
        vars: { i: String(i), j: String(j), k: String(k) },
        description: `j = ${j}: table[${j}] < table[${k}] → ${arr[j - 1]} < ${arr[k - 1]} → ${smaller ? 'ΑΛΗΘΗΣ, νέο ελάχιστο' : 'ΨΕΥΔΗΣ'}.`,
      })
      if (smaller) {
        k = j
        push({
          lines: [4],
          roles: { [k - 1]: 'min' },
          sorted: [...sorted],
          vars: { i: String(i), j: String(j), k: String(k) },
          description: `k <- ${j}: το μέχρι τώρα ελάχιστο είναι το ${arr[k - 1]} στη θέση ${k}.`,
        })
      }
    }
    const a = arr[i - 1]
    const b = arr[k - 1]
    arr[i - 1] = b
    arr[k - 1] = a
    count.writes += 2
    count.moves++
    push({
      lines: [7, 8, 9],
      roles: k === i ? { [i - 1]: 'swap' } : { [i - 1]: 'swap', [k - 1]: 'swap' },
      sorted: [...sorted],
      vars: { i: String(i), k: String(k), temp: String(a) },
      description:
        k === i
          ? `Το ελάχιστο ήταν ήδη στη θέση ${i}. Ο αλγόριθμος εκτελεί την αντιμετάθεση με τον εαυτό του, χωρίς αλλαγή.`
          : `Αντιμετάθεση table[${i}] και table[${k}]: το ελάχιστο ${b} πηγαίνει στη θέση ${i}.`,
    })
    sorted.push(i - 1)
  }
  push({
    lines: [10],
    sorted: range(0, n - 1),
    description:
      'Η ταξινόμηση ολοκληρώθηκε. Μετά τα Ν - 1 περάσματα, το τελευταίο στοιχείο είναι αυτόματα το μεγαλύτερο.',
  })
  return steps
}

// ---------------------------------------------------------------- Ευθεία εισαγωγή

const insertionCode = [
  line(0, 'ΓΙΑ i ΑΠΟ 2 ΜΕΧΡΙ Ν'),
  line(1, 'temp <- table[i]'),
  line(1, 'j <- i - 1'),
  line(1, 'flag <- ΨΕΥΔΗΣ'),
  line(1, 'ΟΣΟ flag = ΨΕΥΔΗΣ ΕΠΑΝΑΛΑΒΕ'),
  line(2, 'ΑΝ j = 0 ΤΟΤΕ'),
  line(3, 'flag <- ΑΛΗΘΗΣ'),
  line(2, 'ΑΛΛΙΩΣ_ΑΝ temp < table[j] ΤΟΤΕ'),
  line(3, 'table[j + 1] <- table[j]'),
  line(3, 'j <- j - 1'),
  line(2, 'ΑΛΛΙΩΣ'),
  line(3, 'flag <- ΑΛΗΘΗΣ'),
  line(2, 'ΤΕΛΟΣ_ΑΝ'),
  line(1, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
  line(1, 'table[j + 1] <- temp'),
  line(0, 'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),
]

function insertionSteps(values: number[]): ArrayStep[] {
  const { arr, steps, count, push } = recorder(values)
  const n = arr.length
  push({
    sorted: n > 0 ? [0] : [],
    description: `Αρχικός πίνακας με Ν = ${n}. Τα στοιχεία προορισμού (ταξινομημένα) είναι αρχικά μόνο το table[1]· τα υπόλοιπα είναι στοιχεία πηγής.`,
  })
  for (let i = 2; i <= n; i++) {
    const done = range(0, i - 2)
    const temp = arr[i - 1]
    let j = i - 1
    push({
      lines: [1, 2, 3],
      roles: { [i - 1]: 'free' },
      sorted: done,
      vars: { i: String(i), j: String(j), temp: String(temp), flag: 'ΨΕΥΔΗΣ' },
      floating: temp,
      description: `i = ${i}: παίρνουμε το στοιχείο πηγής temp = ${temp}. Η θέση ${i} μένει «ελεύθερη» για όσο ψάχνουμε πού θα μπει.`,
    })
    let flag = false
    while (!flag) {
      const free = j
      if (j === 0) {
        flag = true
        push({
          lines: [5, 6],
          roles: { [free]: 'free' },
          sorted: done,
          vars: { i: String(i), j: '0', temp: String(temp), flag: 'ΑΛΗΘΗΣ' },
          floating: temp,
          description: 'j = 0: φτάσαμε στην αρχή του πίνακα. Το temp είναι το μικρότερο μέχρι τώρα.',
        })
      } else {
        count.comparisons++
        const smaller = temp < arr[j - 1]
        push({
          lines: [7],
          roles: { [j - 1]: 'compare', [free]: 'free' },
          sorted: done,
          vars: { i: String(i), j: String(j), temp: String(temp), flag: 'ΨΕΥΔΗΣ' },
          floating: temp,
          description: `temp < table[${j}] → ${temp} < ${arr[j - 1]} → ${smaller ? 'ΑΛΗΘΗΣ, μετακινούμε το στοιχείο δεξιά' : 'ΨΕΥΔΗΣ, βρέθηκε η θέση'}.`,
        })
        if (smaller) {
          arr[j] = arr[j - 1]
          count.writes++
          count.moves++
          push({
            lines: [8, 9],
            roles: { [j]: 'shift', [j - 1]: 'free' },
            sorted: done,
            vars: { i: String(i), j: String(j - 1), temp: String(temp), flag: 'ΨΕΥΔΗΣ' },
            floating: temp,
            description: `table[${j + 1}] <- table[${j}]: το ${arr[j]} μετακινείται μία θέση δεξιά και j = ${j - 1}.`,
          })
          j--
        } else {
          flag = true
          push({
            lines: [10, 11],
            roles: { [j - 1]: 'compare', [free]: 'free' },
            sorted: done,
            vars: { i: String(i), j: String(j), temp: String(temp), flag: 'ΑΛΗΘΗΣ' },
            floating: temp,
            description: `Το table[${j}] = ${arr[j - 1]} δεν είναι μεγαλύτερο από το temp, άρα σταματάμε.`,
          })
        }
      }
    }
    arr[j] = temp
    count.writes++
    push({
      lines: [14],
      roles: { [j]: 'insert' },
      sorted: range(0, i - 1),
      vars: { i: String(i), j: String(j), temp: String(temp), flag: 'ΑΛΗΘΗΣ' },
      description: `table[${j + 1}] <- temp: το ${temp} εισάγεται στη θέση ${j + 1}. Τα στοιχεία προορισμού είναι πλέον ${i}.`,
    })
  }
  push({
    lines: [15],
    sorted: range(0, n - 1),
    description: 'Η ταξινόμηση ολοκληρώθηκε. Όλα τα στοιχεία πηγής εισήχθησαν στη σωστή θέση.',
  })
  return steps
}

export const sortAlgorithms: Record<SortVisualizerId, ArrayAlgorithm> = {
  'bubble-sort': {
    id: 'bubble-sort',
    title: 'Ταξινόμηση ευθείας ανταλλαγής (φυσαλίδα)',
    shortTitle: 'Φυσαλίδα',
    idea: 'Συγκρίνει γειτονικά στοιχεία από το τέλος προς την αρχή και τα αντιμεταθέτει όταν δεν είναι στη σωστή σειρά. Σε κάθε πέρασμα το μικρότερο «ανεβαίνει» στην αρχή.',
    movesLabel: 'Αντιμεταθέσεις',
    comparisonsLabel: 'Συγκρίσεις',
    needsKey: false,
    requiresSorted: false,
    legend: ['compare', 'swap'],
    code: bubbleCode,
    generate: bubbleSteps,
  },
  'selection-sort': {
    id: 'selection-sort',
    title: 'Ταξινόμηση με επιλογή',
    shortTitle: 'Επιλογή',
    idea: 'Σε κάθε πέρασμα βρίσκει τη θέση του ελάχιστου από το αταξινόμητο τμήμα και κάνει μία μόνο αντιμετάθεση, φέρνοντάς το στη θέση i.',
    movesLabel: 'Αντιμεταθέσεις',
    comparisonsLabel: 'Συγκρίσεις',
    needsKey: false,
    requiresSorted: false,
    legend: ['compare', 'min', 'swap'],
    code: selectionCode,
    generate: selectionSteps,
  },
  'insertion-sort': {
    id: 'insertion-sort',
    title: 'Ταξινόμηση ευθείας εισαγωγής',
    shortTitle: 'Ευθεία εισαγωγή',
    idea: 'Παίρνει ένα-ένα τα στοιχεία πηγής, μετακινεί δεξιά τα μεγαλύτερα στοιχεία προορισμού και το εισάγει στη θέση που ελευθερώθηκε.',
    movesLabel: 'Μετακινήσεις',
    comparisonsLabel: 'Συγκρίσεις',
    needsKey: false,
    requiresSorted: false,
    legend: ['compare', 'free', 'shift', 'insert'],
    code: insertionCode,
    generate: insertionSteps,
  },
}

export const sortAlgorithmIds = Object.keys(sortAlgorithms) as SortVisualizerId[]
