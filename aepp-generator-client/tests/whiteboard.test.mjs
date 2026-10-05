import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { flowchartFromCode } = await server.ssrLoadModule('/src/whiteboard/flowchart.ts')
const { connectionPath } = await server.ssrLoadModule('/src/components/whiteboard/FlowShape.tsx')
const { ensureOutputColumn, moveItem, tableDimensions } = await server.ssrLoadModule('/src/whiteboard/model.ts')

test('η αυτόματη ροή περιλαμβάνει αρχή, εντολές, τέλος και έγκυρες συνδέσεις', () => {
  const board = flowchartFromCode(`ΠΡΟΓΡΑΜΜΑ Δοκιμη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  ΔΙΑΒΑΣΕ Χ
  Χ <- Χ + 1
  ΓΡΑΨΕ Χ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`)
  assert.deepEqual(board.items.map(item => item.kind), ['start', 'io', 'process', 'io', 'start'])
  assert.equal(board.links.length, 4)
  assert.equal(board.items.find(item => item.kind === 'process').text, 'Χ <- Χ + 1')
  const ids = new Set(board.items.map(item => item.id))
  for (const link of board.links) { assert.ok(ids.has(link.from)); assert.ok(ids.has(link.to)) }
})

test('οι διακλαδώσεις και οι βρόχοι φέρουν αληθή και ψευδή διαδρομή', () => {
  const board = flowchartFromCode(`ΠΡΟΓΡΑΜΜΑ Δοκιμη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- 1
  ΑΝ Χ > 0 ΤΟΤΕ
    ΓΡΑΨΕ Χ
  ΑΛΛΙΩΣ
    ΓΡΑΨΕ 0
  ΤΕΛΟΣ_ΑΝ
  ΟΣΟ Χ < 3 ΕΠΑΝΑΛΑΒΕ
    Χ <- Χ + 1
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`)
  assert.equal(board.items.filter(item => item.kind === 'decision').length, 2)
  assert.ok(board.links.some(link => link.label === 'Αληθής'))
  assert.ok(board.links.some(link => link.label === 'Ψευδής'))
  assert.throws(() => flowchartFromCode('ΠΡΟΓΡΑΜΜΑ Α\nΑΡΧΗ'), /ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ/u)
})

test('ο πίνακας τιμών υπολογίζει τις διαστάσεις και η μετακίνηση κρατά αναλλοίωτο το αρχικό στοιχείο', () => {
  assert.deepEqual(tableDimensions(['Χ', 'Συνθήκη'], [['1', 'ΑΛΗΘΗΣ'], ['2', 'ΨΕΥΔΗΣ']]), { width: 456, height: 126 })
  const item = { id: 'α', type: 'shape', kind: 'process', text: 'Χ <- 1', x: 10, y: 20, width: 100, height: 50, rotation: 0 }
  const moved = moveItem(item, 30, -5)
  assert.deepEqual([moved.x, moved.y], [40, 15])
  assert.deepEqual([item.x, item.y], [10, 20])
})

test('όλες οι παραγόμενες συνδέσεις είναι ορθογώνιες και οι ενώσεις μένουν στον κύριο άξονα', () => {
  const board = flowchartFromCode(`ΠΡΟΓΡΑΜΜΑ Ροη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ, Ι
ΑΡΧΗ
  Χ <- 1
  ΑΝ Χ > 0 ΤΟΤΕ
    ΓΡΑΨΕ Χ
  ΑΛΛΙΩΣ_ΑΝ Χ = 0 ΤΟΤΕ
    ΓΡΑΨΕ 0
  ΑΛΛΙΩΣ
    ΓΡΑΨΕ -1
  ΤΕΛΟΣ_ΑΝ
  ΟΣΟ Χ < 3 ΕΠΑΝΑΛΑΒΕ
    Χ <- Χ + 1
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΓΙΑ Ι ΑΠΟ 3 ΜΕΧΡΙ 1 ΜΕ ΒΗΜΑ -1
    ΓΡΑΨΕ Ι
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ
    Χ <- Χ - 1
  ΜΕΧΡΙΣ_ΟΤΟΥ Χ = 0
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`)
  const byId = new Map(board.items.map(item => [item.id, item]))
  for (const link of board.links) {
    const geometry = connectionPath(byId.get(link.from), byId.get(link.to), link)
    assert.doesNotMatch(geometry.path, /[CQ]/u)
    for (let index = 1; index < geometry.points.length; index++) {
      const previous = geometry.points[index - 1], current = geometry.points[index]
      assert.ok(previous.x === current.x || previous.y === current.y, `Διαγώνιο τμήμα: ${geometry.path}`)
    }
  }
  assert.ok(board.items.filter(item => item.kind === 'connector' && item.x + item.width / 2 === 600).length >= 3)
  assert.ok(board.items.some(item => item.kind === 'decision' && item.text === 'Ι >= 1'))
  assert.ok(board.items.filter(item => item.kind === 'io').every(item => /^(ΔΙΑΒΑΣΕ|ΓΡΑΨΕ)/u.test(item.text)))
  assert.ok(board.items.filter(item => item.kind === 'start').every(item => /^(ΑΡΧΗ|ΤΕΛΟΣ)$/u.test(item.text)))
})

test('η ΕΞΟΔΟΣ παραμένει μοναδική και τελευταία σε νέους ή παλιούς πίνακες', () => {
  const table = { id: 'τ', type: 'table', x: 0, y: 0, width: 1, height: 1, rotation: 0, columns: ['ΕΞΟΔΟΣ', 'Χ', 'Εξοδος'], rows: [['5', '2', 'παλιά']] }
  const fixed = ensureOutputColumn(table)
  assert.deepEqual(fixed.columns, ['Χ', 'ΕΞΟΔΟΣ'])
  assert.deepEqual(fixed.rows, [['2', '5']])
  assert.deepEqual([fixed.width, fixed.height], [456, 84])
})
