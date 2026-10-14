import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { flowchartFromCode, expressionText } = await server.ssrLoadModule('/src/whiteboard/flowchart.ts')
const { parseProgram } = await server.ssrLoadModule('/src/interpreter/parser.ts')
const { Interpreter } = await server.ssrLoadModule('/src/interpreter/runtime.ts')
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

test('η ΚΑΛΕΣΕ εμφανίζεται ως προκαθορισμένη επεξεργασία', () => {
  const board = flowchartFromCode(`ΠΡΟΓΡΑΜΜΑ Α
ΑΡΧΗ
  ΚΑΛΕΣΕ Βοηθεια(1)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Βοηθεια(Χ)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  ΓΡΑΨΕ Χ
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ`)
  assert.equal(board.items.find(item => item.kind === 'subprogram').text, 'ΚΑΛΕΣΕ ΒΟΗΘΕΙΑ(1)')
})


const expressionProgram = body => 'ΠΡΟΓΡΑΜΜΑ Παρενθεσεις\nΜΕΤΑΒΛΗΤΕΣ\nΠΡΑΓΜΑΤΙΚΕΣ: X, Y, A, B, C, D\nΑΚΕΡΑΙΕΣ: Π[10], Ι\nΑΡΧΗ\n' + body + '\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
const parseExpression = text => parseProgram(expressionProgram('ΓΡΑΨΕ ' + text)).body[0].expressions[0]
const expressionStructure = expression => JSON.parse(JSON.stringify(expression, (key, value) => ['line', 'column', 'nodeId'].includes(key) ? undefined : value))

test('παραλληλόγραμμο εξόδου διατηρεί (2 + 3) * 4', () => {
  const board = flowchartFromCode(expressionProgram('ΓΡΑΨΕ (2 + 3) * 4'))
  assert.equal(board.items.find(item => item.kind === 'io').text, 'ΓΡΑΨΕ (2 + 3) * 4')
})
test('ορθογώνιο εκχώρησης διατηρεί παρενθέσεις αριθμητή και παρονομαστή', () => {
  const board = flowchartFromCode(expressionProgram('X <- (A + B) / (C - D)'))
  assert.equal(board.items.find(item => item.kind === 'process').text, 'X <- (A + B) / (C - D)')
})
test('ρόμβος διατηρεί ευδιάκριτες ομαδοποιημένες συγκρίσεις', () => {
  const board = flowchartFromCode(expressionProgram('ΑΝ (X > 0) ΚΑΙ (Y = 5) ΤΟΤΕ\nΓΡΑΨΕ X\nΤΕΛΟΣ_ΑΝ'))
  assert.equal(board.items.find(item => item.kind === 'decision').text, '(X > 0) ΚΑΙ (Y = 5)')
})
test('ισόβαθμοι τελεστές και δυνάμεις διατηρούν την πλευρά ομαδοποίησης', () => {
  for (const text of ['A - (B - C)', 'A / (B / C)', 'A * (B / C)', '(A ^ B) ^ C', 'A + (B + C)']) {
    assert.equal(expressionText(parseExpression(text)), text)
  }
  assert.equal(expressionText(parseExpression('A ^ (B ^ C)')), 'A ^ B ^ C')
  assert.equal(expressionText(parseExpression('A + B * C')), 'A + B * C')
})
test('πρόσημα και ΟΧΙ διατηρούν τη δέσμευση της εσωτερικής έκφρασης', () => {
  assert.equal(expressionText(parseExpression('-(A + B)')), '-(A + B)')
  assert.equal(expressionText(parseExpression('(-2) ^ 2')), '(-2) ^ 2')
  assert.equal(expressionText(parseExpression('ΟΧΙ (X > 0 ΚΑΙ Y = 5)')), 'ΟΧΙ ((X > 0) ΚΑΙ (Y = 5))')
})
test('ΟΣΟ, ΜΕΧΡΙΣ_ΟΤΟΥ, δείκτες πινάκων και ορίσματα χρησιμοποιούν τον ίδιο printer', () => {
  const board = flowchartFromCode(expressionProgram('ΟΣΟ (X + Y) * 2 > 0 ΕΠΑΝΑΛΑΒΕ\nΓΡΑΨΕ Π[(1 + 2) * 3]\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ Α_Μ((2 + 3) * 4)\nΜΕΧΡΙΣ_ΟΤΟΥ ΟΧΙ (X > 0 ΚΑΙ Y = 5)'))
  assert.ok(board.items.some(item => item.kind === 'decision' && item.text === '(X + Y) * 2 > 0'))
  assert.ok(board.items.some(item => item.kind === 'decision' && item.text === 'ΟΧΙ ((X > 0) ΚΑΙ (Y = 5))'))
  assert.ok(board.items.some(item => item.kind === 'io' && item.text === 'ΓΡΑΨΕ Π[(1 + 2) * 3]'))
  assert.ok(board.items.some(item => item.kind === 'io' && item.text === 'ΓΡΑΨΕ Α_Μ((2 + 3) * 4)'))
})
test('εκτύπωση και νέα ανάλυση παράγουν το ίδιο AST σε αριθμητικές και λογικές εκφράσεις', () => {
  const cases = [
    '(2 + 3) * 4', '2 * (3 + 4)', '20 - (5 - 2)', '20 / (5 / 2)',
    '20 DIV (5 MOD 3)', '20 MOD (5 DIV 2)', '2 + (3 + 4)', '2 * (3 * 4)',
    '(2 ^ 3) ^ 2', '2 ^ (3 ^ 2)', '-(2 + 3)', '(-2) ^ 2', '-(2 ^ 2)', '2 ^ (-3)',
    'ΟΧΙ (X > 0 ΚΑΙ Y = 5)', '(X > 0) ΚΑΙ (Y = 5)',
    '(X = 0 Η Y = 5) ΚΑΙ X < 10', 'ΟΧΙ (ΟΧΙ ΑΛΗΘΗΣ)',
    'ΟΧΙ (ΑΛΗΘΗΣ ΚΑΙ ΨΕΥΔΗΣ)', '(ΟΧΙ ΑΛΗΘΗΣ) = ΨΕΥΔΗΣ',
    'Π[(1 + 2) * 3]', 'Α_Μ((2 + 3) * 4)', "'α\'\'β'", 'ΑΛΗΘΗΣ',
  ]
  for (const source of cases) {
    const original = parseExpression(source)
    const printed = expressionText(original)
    assert.deepEqual(expressionStructure(parseExpression(printed)), expressionStructure(original), source + ' -> ' + printed)
  }
})
test('εκτυπωμένες αριθμητικές εκφράσεις εκτελούνται με την ίδια τιμή', () => {
  const result = text => {
    const iterator = new Interpreter(parseProgram(expressionProgram('ΓΡΑΨΕ ' + text))).execute()
    let next = iterator.next()
    while (!next.done) { if (next.value.kind === 'done') return next.value.output; next = iterator.next() }
    throw new Error('Η δοκιμή δεν ολοκληρώθηκε.')
  }
  for (const source of ['(2 + 3) * 4', '20 - (5 - 2)', '20 / (5 / 2)', '(2 ^ 3) ^ 2', '(-2) ^ 2']) {
    assert.deepEqual(result(expressionText(parseExpression(source))), result(source))
  }
  assert.deepEqual(result(expressionText(parseExpression('(2 + 3) * 4'))), ['20'])
})

test('διάγραμμα ΕΠΙΛΕΞΕ έχει selector μία φορά, όλες τις περιπτώσεις και έγκυρες συνδέσεις',()=>{
 const board=flowchartFromCode("ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΕΠΙΛΕΞΕ Χ+1\nΠΕΡΙΠΤΩΣΗ 1,2\nΓΡΑΨΕ 3\nΠΕΡΙΠΤΩΣΗ 3..10\nΓΡΑΨΕ 4\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 5\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ")
 assert.equal(board.items.filter(item=>item.text.includes('υπολογισμός μία φορά')).length,1)
 assert.equal(board.items.filter(item=>item.kind==='decision').length,2)
 assert.ok(board.items.some(item=>item.text.includes('[3 .. 10]')))
 const ids=new Set(board.items.map(item=>item.id));assert.ok(board.links.every(link=>ids.has(link.from)&&ids.has(link.to)))
})
