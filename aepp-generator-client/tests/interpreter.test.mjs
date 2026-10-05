import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { tokenize } = await server.ssrLoadModule('/src/interpreter/lexer.ts')
const { parseProgram } = await server.ssrLoadModule('/src/interpreter/parser.ts')
const { Interpreter, parseInput } = await server.ssrLoadModule('/src/interpreter/runtime.ts')
const { starterProgram } = await server.ssrLoadModule('/src/interpreter/examples.ts')
const { toDiagnostic, formatDiagnostic } = await server.ssrLoadModule('/src/interpreter/diagnostics.ts')

function execute(source, inputs = []) {
  const iterator = new Interpreter(parseProgram(source)).execute()
  let next = iterator.next()
  let events = 0
  let index = 0
  while (!next.done && events++ < 200) {
    if (next.value.kind === 'input') next = iterator.next(parseInput(inputs[index++], next.value.type, next.value.line))
    else if (next.value.kind === 'done') return next.value
    else next = iterator.next()
  }
  throw new Error('Η δοκιμή δεν ολοκληρώθηκε.')
}

test('ο λεκτικός αναλυτής κρατά γραμμές και αγνοεί σχόλια', () => {
  const tokens = tokenize("ΓΡΑΨΕ 'α''β' ! σχόλιο\nΓΡΑΨΕ 2")
  assert.equal(tokens.find(token => token.kind === 'string').text, "α'β")
  assert.equal(tokens.filter(token => token.text === 'ΓΡΑΨΕ').at(-1).line, 2)
  assert.equal(tokens.some(token => token.text === 'σχόλιο'), false)
})

test('το παράδειγμα σταματά για είσοδο, εκτελεί επιλογή και ΓΙΑ', () => {
  const iterator = new Interpreter(parseProgram(starterProgram)).execute()
  assert.equal(iterator.next().value.output[0], 'Δώσε βαθμό (0 έως 20):')
  const pending = iterator.next().value
  assert.equal(pending.kind, 'input')
  assert.equal(pending.name, 'ΒΑΘΜΟΣ')
  const done = execute(starterProgram, ['12'])
  assert.deepEqual(done.output, ['Δώσε βαθμό (0 έως 20):', 'Επιτυχία', 'Επανάληψη 1', 'Επανάληψη 2', 'Επανάληψη 3'])
  assert.equal(done.variables.find(item => item.name === 'Ι').value.value, 4)
})

test('η ΟΣΟ μπορεί να εκτελεστεί μηδέν φορές ενώ η ΜΕΧΡΙΣ_ΟΤΟΥ μία', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Βροχοι
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α
ΑΡΧΗ
  Α <- 0
  ΟΣΟ Α > 0 ΕΠΑΝΑΛΑΒΕ
    ΓΡΑΨΕ 'Λάθος'
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ
    Α <- Α + 1
  ΜΕΧΡΙΣ_ΟΤΟΥ Α = 1
  ΓΡΑΨΕ Α
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.deepEqual(execute(source).output, ['1'])
})

test('η ΓΙΑ λειτουργεί και με αρνητικό βήμα', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Αντιστροφη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ι
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 5 ΜΕΧΡΙ 1 ΜΕ ΒΗΜΑ -2
    ΓΡΑΨΕ Ι
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.deepEqual(execute(source).output, ['5', '3', '1'])
})

test('εμφωλευμένοι βρόχοι και ΑΛΛΙΩΣ_ΑΝ διατηρούν τη σωστή ροή', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Συνδυασμοι
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ι, Κ
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2
    ΓΙΑ Κ ΑΠΟ 1 ΜΕΧΡΙ 2
      ΑΝ Ι = Κ ΤΟΤΕ
        ΓΡΑΨΕ 'Ισοι'
      ΑΛΛΙΩΣ_ΑΝ Ι < Κ ΤΟΤΕ
        ΓΡΑΨΕ 'Μικροτερος'
      ΑΛΛΙΩΣ
        ΓΡΑΨΕ 'Μεγαλυτερος'
      ΤΕΛΟΣ_ΑΝ
    ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.deepEqual(execute(source).output, ['Ισοι', 'Μικροτερος', 'Μεγαλυτερος', 'Ισοι'])
})

test('οι σταθερές χρησιμοποιούνται σε εκφράσεις αλλά δεν τροποποιούνται', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Σταθερα
ΣΤΑΘΕΡΕΣ
  ΟΡΙΟ = 3
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- ΟΡΙΟ + 2
  ΓΡΑΨΕ Χ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.deepEqual(execute(source).output, ['5'])
  assert.throws(() => execute(source.replace('Χ <- ΟΡΙΟ + 2', 'ΟΡΙΟ <- 5')), /Γραμμή 7: Η σταθερά/u)
})

test('οι τριγωνομετρικές συναρτήσεις δέχονται μοίρες', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Γωνια
ΑΡΧΗ
  ΓΡΑΨΕ ΗΜ(30)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.ok(Math.abs(Number(execute(source).output[0]) - 0.5) < 1e-12)
})

test('το ΟΧΙ εφαρμόζεται στο αποτέλεσμα της σύγκρισης', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Αρνηση
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- 2
  ΑΝ ΟΧΙ Χ = 1 ΤΟΤΕ
    ΓΡΑΨΕ 'Σωστό'
  ΤΕΛΟΣ_ΑΝ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  assert.deepEqual(execute(source).output, ['Σωστό'])
})

test('αναφέρονται η γραμμή και το σφάλμα για ελλιπές ΑΝ', () => {
  assert.throws(() => parseProgram(`ΠΡΟΓΡΑΜΜΑ Α
ΑΡΧΗ
  ΑΝ Α = 1 ΤΟΤΕ
    ΓΡΑΨΕ Α
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`), /Γραμμή 5:.*ΤΕΛΟΣ_ΑΝ/u)
})

test('απορρίπτονται διαίρεση με μηδέν και ασύμβατη εκχώρηση', () => {
  assert.throws(() => execute(`ΠΡΟΓΡΑΜΜΑ Α
ΑΡΧΗ
  ΓΡΑΨΕ 5 / 0
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`), /Γραμμή 3: Προσπάθεια διαίρεσης με το μηδέν/u)
  assert.throws(() => execute(`ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- 1.5
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`), /Γραμμή 5: Ασυμβίβαστοι τύποι/u)
})

test('η ΓΙΑ απορρίπτει αλλαγή μετρητή και μηδενικό βήμα', () => {
  assert.throws(() => parseProgram(`ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ι
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 3
    Ι <- Ι + 1
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`), /Γραμμή 5:.*δεν επιτρέπεται/u)
  assert.throws(() => execute(`ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ι
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 3 ΜΕ ΒΗΜΑ 0
    ΓΡΑΨΕ Ι
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`), /Γραμμή 5: Το βήμα της ΓΙΑ δεν μπορεί να είναι μηδέν/u)
})

test('η κονσόλα απορρίπτει πραγματική τιμή για ακέραια μεταβλητή', () => {
  assert.throws(() => parseInput('3.5', 'integer', 8), /Γραμμή 8: Αναμενόταν ακέραιος/u)
})

test('τα ανοιχτά μπλοκ και οι λανθασμένες επικεφαλίδες δίνουν συγκεκριμένο συντακτικό σφάλμα', () => {
  const wrap = body => `ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΑΡΧΗ\n${body}\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  const cases = [
    ['ΑΝ Α = 1 ΤΟΤΕ\nΓΡΑΨΕ Α', 'Ανοιχτή δομή ΑΝ: Λείπει το ΤΕΛΟΣ_ΑΝ'],
    ['ΟΣΟ Α < 3 ΕΠΑΝΑΛΑΒΕ\nΓΡΑΨΕ Α', 'Ανοιχτή δομή ΟΣΟ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'],
    ['ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 3\nΓΡΑΨΕ Ι', 'Ανοιχτή δομή ΓΙΑ: Λείπει το ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'],
    ['ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ 1', 'Ανοιχτή δομή ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ: Λείπει το ΜΕΧΡΙΣ_ΟΤΟΥ'],
    ['ΕΠΙΛΕΞΕ Α\nΠΕΡΙΠΤΩΣΗ 1\nΓΡΑΨΕ 1', 'Ανοιχτή δομή ΕΠΙΛΕΞΕ: Λείπει το ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'],
    ['ΑΝ Α = 1\nΓΡΑΨΕ Α', 'Λανθασμένη σύνταξη στην ΑΝ: Λείπει η λέξη ΤΟΤΕ'],
    ['ΓΙΑ Ι ΑΠΟ 1 ΕΩΣ 3', 'Λανθασμένη σύνταξη στη ΓΙΑ: Απαιτούνται οι λέξεις ΑΠΟ και ΜΕΧΡΙ'],
  ]
  for (const [body, expected] of cases) assert.throws(() => parseProgram(wrap(body)), error => error.message.includes(expected))
  assert.throws(() => parseProgram('ΑΡΧΗ\nΓΡΑΨΕ 1'), /Λείπει η επικεφαλίδα ΠΡΟΓΡΑΜΜΑ/u)
  assert.throws(() => parseProgram('ΠΡΟΓΡΑΜΜΑ Α\nΑΡΧΗ\nΓΡΑΨΕ 1'), /Λείπει το ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ/u)
})

test('η κατηγορία και η γραμμή διατηρούνται σε σφάλματα τύπων και εκτέλεσης', () => {
  const wrap = (declarations, body) => `ΠΡΟΓΡΑΜΜΑ Α\n${declarations}ΑΡΧΗ\n${body}\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
  const cases = [
    [wrap('', 'ΓΡΑΨΕ Χ'), 'type', 'δεν έχει δηλωθεί'],
    [wrap('ΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\n', 'ΓΡΑΨΕ Χ'), 'type', 'χωρίς να έχει λάβει αρχική τιμή'],
    [wrap('ΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\n', "Χ <- 'κείμενο'"), 'type', 'αλφαριθμητικού σε αριθμητική'],
    [wrap('ΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\n', 'Χ <- 1.5'), 'type', 'πραγματικού αριθμού σε ακέραια'],
    [wrap('', 'ΓΡΑΨΕ ΑΛΗΘΗΣ ΚΑΙ 1'), 'type', 'μη λογική έκφραση'],
    [wrap('', 'ΓΡΑΨΕ 1 mod 0'), 'runtime', 'διαίρεσης με το μηδέν'],
    [wrap('', 'ΓΡΑΨΕ Τ_Ρ(-1)'), 'runtime', 'αρνητικό όρισμα'],
  ]
  for (const [source, category, description] of cases) {
    let caught
    try { execute(source) } catch (error) { caught = error }
    const diagnostic = toDiagnostic(caught)
    assert.equal(diagnostic.category, category)
    assert.ok(diagnostic.line >= 3)
    assert.match(diagnostic.description, new RegExp(description, 'u'))
    assert.match(formatDiagnostic(diagnostic), /^🔴 \[Σφάλμα .+\] Γραμμή \d+: /u)
  }
})

test('ο ατέρμονας βρόχος σταματά στο όριο των 100.000 επαναλήψεων', () => {
  const iterator = new Interpreter(parseProgram(`ΠΡΟΓΡΑΜΜΑ Α\nΑΡΧΗ\nΟΣΟ ΑΛΗΘΗΣ ΕΠΑΝΑΛΑΒΕ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`)).execute()
  let caught
  try { for (let index = 0; index < 200_010; index++) iterator.next() } catch (error) { caught = error }
  assert.equal(toDiagnostic(caught).category, 'runtime')
  assert.match(toDiagnostic(caught).description, /100.000 επαναλήψεων/u)
})
