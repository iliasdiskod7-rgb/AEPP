import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { sortAlgorithms, sortAlgorithmIds } = await server.ssrLoadModule('/src/tools/arrays/sortSteps.ts')
const { searchAlgorithms } = await server.ssrLoadModule('/src/tools/arrays/searchSteps.ts')
const { parseArrayValues, parseKey } = await server.ssrLoadModule('/src/tools/arrays/algorithms.ts')
const { lesson19Data } = await server.ssrLoadModule('/src/data/courses/lesson19.ts')
const { lesson20Data } = await server.ssrLoadModule('/src/data/courses/lesson20.ts')

const samples = [
  [45, 18, 72, 12, 60, 33, 24],
  [1, 2, 3, 4, 5],
  [5, 4, 3, 2, 1],
  [7, 7, 3, 7, 1],
  [2, 1],
  [-5, 0, 999, -999, 3, 3],
]
for (let s = 0; s < 40; s++) {
  samples.push(Array.from({ length: 2 + (s % 11) }, (_, k) => ((s * 37 + k * 53) % 41) - 20))
}

const assertStepsInBounds = (algorithm, steps, n) => {
  for (const step of steps) {
    assert.equal(step.array.length, n)
    const indexes = [...Object.keys(step.roles), ...Object.keys(step.pointers)].map(Number).concat(step.sorted)
    for (const index of indexes) assert.ok(index >= 0 && index < n, `${algorithm.id}: δείκτης ${index} εκτός ορίων`)
    for (const lineIndex of step.lines) assert.ok(lineIndex >= 0 && lineIndex < algorithm.code.length)
  }
}

for (const id of sortAlgorithmIds) {
  test(`${id}: ταξινομεί σωστά και κλειδώνει όλες τις θέσεις`, () => {
    for (const values of samples) {
      const steps = sortAlgorithms[id].generate(values, 0)
      const final = steps.at(-1)
      assert.deepEqual(
        final.array,
        [...values].sort((a, b) => a - b),
        `${id} ${values}`,
      )
      assert.deepEqual(
        [...final.sorted].sort((a, b) => a - b),
        values.map((_, k) => k),
      )
      assertStepsInBounds(sortAlgorithms[id], steps, values.length)
    }
  })
}

test('ταξινόμηση: πλήθος συγκρίσεων όπως στη θεωρία', () => {
  const n = 7
  const reversed = [7, 6, 5, 4, 3, 2, 1]
  const ordered = [1, 2, 3, 4, 5, 6, 7]
  const final = (id, values) => sortAlgorithms[id].generate(values, 0).at(-1)
  for (const id of sortAlgorithmIds) assert.equal(final(id, reversed).comparisons, (n * (n - 1)) / 2)
  assert.equal(final('insertion-sort', ordered).comparisons, n - 1)
  assert.equal(final('bubble-sort', ordered).moves, 0)
})

// Ταξινομημένοι πίνακες διαφορετικών τιμών και κάθε δυνατό key (υπάρχον, ενδιάμεσο, εκτός άκρων).
const searchCases = []
for (let n = 1; n <= 12; n++) {
  const values = Array.from({ length: n }, (_, k) => 3 * k + 2)
  for (let key = 0; key <= 3 * n + 3; key++) searchCases.push({ values, key })
}

test('αναζητήσεις: σωστή θέση ή «δεν βρέθηκε»', () => {
  for (const algorithm of Object.values(searchAlgorithms)) {
    for (const { values, key } of searchCases) {
      const steps = algorithm.generate(values, key)
      const final = steps.at(-1)
      const expected = values.indexOf(key) + 1
      assert.equal(final.vars['θέση'], String(expected), `${algorithm.id} key=${key} [${values}]`)
      assert.equal(final.output.length, 1)
      assert.equal(final.output[0].startsWith('Η τιμή βρέθηκε'), expected > 0)
      if (expected > 0) assert.equal(final.roles[expected - 1], 'found')
      assertStepsInBounds(algorithm, steps, values.length)
    }
  }
})

test('αναζητήσεις: πλήθος εξετάσεων', () => {
  for (const { values, key } of searchCases) {
    const n = values.length
    const position = values.indexOf(key) + 1
    const firstGreater = values.findIndex(value => value > key) + 1
    const run = id => searchAlgorithms[id].generate(values, key).at(-1).comparisons
    assert.equal(run('sequential-search'), position || n)
    assert.equal(run('sequential-search-sorted'), position || firstGreater || n)
    assert.ok(run('binary-search') <= Math.floor(Math.log2(n) + 1), `δυαδική n=${n} key=${key}`)
  }
  // Σε μη ταξινομημένο πίνακα η σειριακή βρίσκει την πρώτη εμφάνιση.
  const final = searchAlgorithms['sequential-search'].generate([45, 18, 72, 12, 60], 12).at(-1)
  assert.equal(final.vars['θέση'], '4')
})

test('ο κώδικας κάθε οπτικοποίησης υπάρχει αυτούσιος στην απάντηση του μαθήματος', () => {
  const normalize = text => text.replace(/!.*$/gm, '').replace(/\s+/g, ' ').trim()
  const all = { ...sortAlgorithms, ...searchAlgorithms }
  const questions = [...lesson19Data.theoryQuestions, ...lesson20Data.theoryQuestions].filter(q => q.visualizer)
  assert.equal(questions.length, 6)
  for (const question of questions) {
    const code = all[question.visualizer].code.map(line => line.text).join('\n')
    assert.ok(
      normalize(question.answer).includes(normalize(code)),
      `${question.id}: ο κώδικας διαφέρει από την απάντηση`,
    )
  }
})

test('έλεγχος εισόδου', () => {
  assert.deepEqual(parseArrayValues('3, -1; 2'), { values: [3, -1, 2] })
  assert.ok('error' in parseArrayValues('5'))
  assert.ok('error' in parseArrayValues('1, 2.5'))
  assert.ok('error' in parseArrayValues('1, 1000'))
  assert.deepEqual(parseKey(' 46 '), { key: 46 })
  assert.ok('error' in parseKey(''))
  assert.ok('error' in parseKey('4.5'))
})
