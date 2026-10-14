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
const { runTestCases } = await server.ssrLoadModule('/src/assessment/execution.ts')

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

test('διαδικασία αλλάζει μεταβλητή κατ’ αναφορά, ενώ έκφραση περνά κατ’ τιμήν', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Δοκιμη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- 4
  ΚΑΛΕΣΕ Αυξηση(Χ)
  ΚΑΛΕΣΕ Αυξηση(Χ + 2)
  ΓΡΑΨΕ Χ, ' ', Διπλασιο(Χ) + Α_Τ(-1)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Αυξηση(Τ)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Τ
ΑΡΧΗ
  Τ <- Τ + 1
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ
ΣΥΝΑΡΤΗΣΗ Διπλασιο(Ν): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ν
ΑΡΧΗ
  Διπλασιο <- Ν * 2
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`
  assert.deepEqual(execute(source).output, ['5 11'])
  assert.equal(execute(source).variables.find(item => item.name === 'Χ').value.value, 5)
})

test('αναδρομική συνάρτηση διατηρεί ανεξάρτητο frame σε κάθε κλήση', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Δοκιμη
ΑΡΧΗ
  ΓΡΑΨΕ Παραγοντικο(4)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΣΥΝΑΡΤΗΣΗ Παραγοντικο(Ν): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ν
ΑΡΧΗ
  ΑΝ Ν = 0 ΤΟΤΕ
    Παραγοντικο <- 1
  ΑΛΛΙΩΣ
    Παραγοντικο <- Ν * Παραγοντικο(Ν - 1)
  ΤΕΛΟΣ_ΑΝ
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`
  assert.deepEqual(execute(source).output, ['24'])
})

test('εντοπίζονται πλήθος, τύπος, αδήλωτη μεταβλητή και ελλιπής επιστροφή', () => {
  const header = `ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  Χ <- 1
`
  const routine = `
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Πραξη(Α)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α
ΑΡΧΗ
  Α <- Α + 1
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ`
  assert.throws(() => execute(header + 'ΚΑΛΕΣΕ Πραξη(Χ, 2)' + routine), /Πλήθος ορισμάτων \(2\).*παραμέτρων \(1\)/u)
  assert.throws(() => execute(header + 'ΚΑΛΕΣΕ Πραξη(1.5)' + routine), /Ασυμβατότητα τύπων/u)
  assert.throws(() => execute(header + 'ΚΑΛΕΣΕ Πραξη(Χ)' + routine.replace('Α <- Α + 1', 'Α <- Χ')), /«Χ» δεν έχει δηλωθεί/u)
  const noReturn = `${header}ΓΡΑΨΕ Ελλιπης(Χ)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΣΥΝΑΡΤΗΣΗ Ελλιπης(Α): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α
ΑΡΧΗ
  ΓΡΑΨΕ Α
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`
  assert.throws(() => execute(noReturn), /Δεν εκχωρήθηκε τιμή στο όνομα της συνάρτησης/u)
})

test('τα test cases εκτελούν ΔΙΑΒΑΣΕ και ΚΑΛΕΣΕ μέσα σε υποπρόγραμμα', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Δοκιμη
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Χ
ΑΡΧΗ
  ΚΑΛΕΣΕ Εισοδος(Χ)
  ΓΡΑΨΕ Χ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Εισοδος(Α)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α
ΑΡΧΗ
  ΔΙΑΒΑΣΕ Α
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ`
  assert.equal(runTestCases(source, [{ id: '1', inputs: ['7'], expectedOutput: ['7'] }])[0].passed, true)
})

test('διαδικασία δεν τροποποιεί έμμεσα τον μετρητή της ΓΙΑ', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ι
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2
    ΚΑΛΕΣΕ Αλλαγη(Ι)
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Αλλαγη(Ν)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Ν
ΑΡΧΗ
  Ν <- Ν + 1
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ`
  assert.throws(() => execute(source), /Απαγορεύεται η αλλαγή της μεταβλητής ελέγχου/u)
})

test('πίνακες 1Δ και 2Δ περνούν σε υποπρογράμματα με έλεγχο ορίων', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Πινακες
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α[2,2], Β[2], Ι
ΑΡΧΗ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2
    ΔΙΑΒΑΣΕ Β[Ι]
    Α[Ι,1] <- Β[Ι]
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΚΑΛΕΣΕ Αύξηση(Β)
  ΓΡΑΨΕ Β[1], ' ', Σύνολο(Α)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΔΙΑΔΙΚΑΣΙΑ Αύξηση(Π)
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Π[2]
ΑΡΧΗ
  Π[1] <- Π[1] + 1
ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ
ΣΥΝΑΡΤΗΣΗ Σύνολο(Π): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Π[2,2]
ΑΡΧΗ
  Σύνολο <- Π[1,1] + Π[2,1]
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`
  assert.deepEqual(execute(source, ['3', '5']).output, ['4 8'])
  assert.equal(runTestCases(source, [{ id: '1', inputs: ['3', '5'], expectedOutput: ['4 8'] }])[0].passed, true)
  assert.throws(() => execute(source.replace('Αύξηση(Β)', 'Αύξηση(Α)'), ['3', '5']), /διαστάσεις/u)
  assert.throws(() => execute(source.replace('Π[1] <- Π[1] + 1', 'Π[0] <- 1'), ['3', '5']), /εκτός ορίων/u)
})

test('η συνάρτηση αντιγράφει τον πίνακα και δεν αλλάζει τον πίνακα του καλούντος', () => {
  const source = `ΠΡΟΓΡΑΜΜΑ Α
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Π[2]
ΑΡΧΗ
  Π[1] <- 1
  ΓΡΑΨΕ Δοκιμη(Π)
  ΓΡΑΨΕ Π[1]
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΣΥΝΑΡΤΗΣΗ Δοκιμη(Α): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: Α[2]
ΑΡΧΗ
  Α[1] <- 2
  Δοκιμη <- Α[1]
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`
  assert.deepEqual(execute(source).output, ['2', '1'])
  assert.throws(() => execute(source.replace('Δοκιμη(Π)', 'Αγνωστη(Π)')), /δεν βρέθηκε ή δεν έχει δηλωθεί/u)
})


const incrementElement = '\nΔΙΑΔΙΚΑΣΙΑ Αυξηση(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
const elementProgram = (body, declarations = 'ΑΚΕΡΑΙΕΣ: Α[3], Ι') =>
  'ΠΡΟΓΡΑΜΜΑ Αναφορες\nΜΕΤΑΒΛΗΤΕΣ\n' + declarations + '\nΑΡΧΗ\n' + body + '\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'

test('διαδικασία επιστρέφει νέα τιμή στο Α[1]', () => {
  assert.deepEqual(execute(elementProgram("Α[1] <- 4\nΑ[2] <- 20\nΚΑΛΕΣΕ Αυξηση(Α[1])\nΓΡΑΨΕ Α[1], ' ', Α[2]") + incrementElement).output, ['5 20'])
})
test('διαδικασία επιστρέφει νέα τιμή στο Α[Ι] με Ι=2', () => {
  assert.deepEqual(execute(elementProgram('Ι <- 2\nΑ[2] <- 9\nΚΑΛΕΣΕ Αυξηση(Α[Ι])\nΓΡΑΨΕ Α[2]') + incrementElement).output, ['10'])
})
test('διαδικασία επιστρέφει νέα τιμή σε στοιχείο δισδιάστατου πίνακα', () => {
  const routine = '\nΔΙΑΔΙΚΑΣΙΑ Διπλασιασμος(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ * 2\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const source = elementProgram("Β[1,2] <- 6\nΒ[2,2] <- 30\nΚΑΛΕΣΕ Διπλασιασμος(Β[1,2])\nΓΡΑΨΕ Β[1,2], ' ', Β[2,2]", 'ΑΚΕΡΑΙΕΣ: Β[2,2]') + routine
  assert.deepEqual(execute(source).output, ['12 30'])
})
test('οι δείκτες δεσμεύονται πριν από την κλήση και δεν επανυπολογίζονται στην επιστροφή', () => {
  const routine = '\nΔΙΑΔΙΚΑΣΙΑ Μεταβολη(Κ, Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Κ, Τ\nΑΡΧΗ\nΚ <- 3\nΤ <- Τ + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const source = elementProgram("Ι <- 2\nΑ[2] <- 9\nΑ[3] <- 30\nΚΑΛΕΣΕ Μεταβολη(Ι, Α[Ι])\nΓΡΑΨΕ Ι, ' ', Α[2], ' ', Α[3]") + routine
  assert.deepEqual(execute(source).output, ['3 10 30'])
})
test('συνάρτηση στον δείκτη ορίσματος αξιολογείται ακριβώς μία φορά', () => {
  const routine = '\nΣΥΝΑΡΤΗΣΗ Θεση(Κ): ΑΚΕΡΑΙΑ\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Κ\nΑΡΧΗ\nΓΡΑΨΕ \'δείκτης\'\nΘεση <- Κ\nΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ'
  const source = elementProgram('Ι <- 2\nΑ[2] <- 9\nΚΑΛΕΣΕ Αυξηση(Α[Θεση(Ι)])\nΓΡΑΨΕ Α[2]') + incrementElement + routine
  assert.deepEqual(execute(source).output, ['δείκτης', '10'])
})
test('εμφωλευμένες διαδικασίες επιστρέφουν τιμές στο σωστό caller scope', () => {
  const outer = '\nΔΙΑΔΙΚΑΣΙΑ Εξωτερικη(Π)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Π[3]\nΑΡΧΗ\nΚΑΛΕΣΕ Αυξηση(Π[2])\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  assert.deepEqual(execute(elementProgram('Α[2] <- 7\nΚΑΛΕΣΕ Εξωτερικη(Α)\nΓΡΑΨΕ Α[2]') + outer + incrementElement).output, ['8'])
})
test('εκφράσεις, σταθερές και παράμετροι συνάρτησης δεν επιστρέφουν τιμές στον πίνακα', () => {
  const routine = '\nΣΥΝΑΡΤΗΣΗ Αλλαγη(Τ): ΑΚΕΡΑΙΑ\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ + 10\nΑλλαγη <- Τ\nΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ'
  const source = elementProgram("Α[1] <- 4\nΚΑΛΕΣΕ Αυξηση(Α[1] + 1)\nΚΑΛΕΣΕ Αυξηση(5)\nΓΡΑΨΕ Αλλαγη(Α[1]), ' ', Α[1]") + incrementElement + routine
  assert.deepEqual(execute(source).output, ['14 4'])
})
test('μη αρχικοποιημένο στοιχείο μπορεί να λάβει τιμή από ΔΙΑΒΑΣΕ παραμέτρου', () => {
  const routine = '\nΔΙΑΔΙΚΑΣΙΑ Εισοδος(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Τ\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  assert.deepEqual(execute(elementProgram('ΚΑΛΕΣΕ Εισοδος(Α[2])\nΓΡΑΨΕ Α[2]') + routine, ['11']).output, ['11'])
})
test('όρια, ακέραιοι δείκτες, τύποι και διαστάσεις ελέγχονται πριν από την κλήση', () => {
  const source = elementProgram('Α[1] <- 4\nΚΑΛΕΣΕ Αυξηση(Α[1])') + incrementElement
  for (const index of ['0', '4']) assert.throws(() => execute(source.replace('Αυξηση(Α[1])', 'Αυξηση(Α[' + index + '])')), /εκτός ορίων/u)
  assert.throws(() => execute(source.replace('Αυξηση(Α[1])', 'Αυξηση(Α[1.5])')), /δείκτης πίνακα πρέπει να είναι ακέραιος/u)
  assert.throws(() => execute(source.replace('ΑΚΕΡΑΙΕΣ: Τ', 'ΠΡΑΓΜΑΤΙΚΕΣ: Τ')), /Ασυμβατότητα τύπων/u)
  assert.throws(() => execute(source.replace('ΑΚΕΡΑΙΕΣ: Τ', 'ΑΚΕΡΑΙΕΣ: Τ[3]')), /διαστάσεις/u)
})

const complete = (body,declarations='ΑΚΕΡΑΙΕΣ: Χ')=>'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\n'+declarations+'\nΑΡΧΗ\n'+body+'\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
test('ΕΠΙΛΕΞΕ: μεμονωμένες τιμές, λίστες, κλειστό διάστημα 1..10 και ΑΛΛΙΩΣ',()=>{
 const body="ΔΙΑΒΑΣΕ Χ\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ -1, 0\nΓΡΑΨΕ 'λίστα'\nΠΕΡΙΠΤΩΣΗ 1..10\nΓΡΑΨΕ 'διάστημα'\nΠΕΡΙΠΤΩΣΗ 11\nΓΡΑΨΕ 'τιμή'\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 'άλλο'\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΓΡΑΨΕ 'τέλος'"
 for(const [value,label] of [[-1,'λίστα'],[0,'λίστα'],[1,'διάστημα'],[5,'διάστημα'],[10,'διάστημα'],[11,'τιμή'],[12,'άλλο']])assert.deepEqual(execute(complete(body),[String(value)]).output,[label,'τέλος'])
 assert.equal(tokenize('1..10').find(token=>token.text==='..').kind,'symbol')
})
test('ΕΠΙΛΕΞΕ χωρίς default συνεχίζει και χωρίς fall-through κρατά την πρώτη περίπτωση',()=>{
 assert.deepEqual(execute(complete("Χ <- 20\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 1\nΓΡΑΨΕ 'όχι'\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΓΡΑΨΕ 'τέλος'")).output,['τέλος'])
 assert.deepEqual(execute(complete("Χ <- 5\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 1..10\nΓΡΑΨΕ 'πρώτο'\nΠΕΡΙΠΤΩΣΗ 5\nΓΡΑΨΕ 'δεύτερο'\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ")).output,['πρώτο'])
})
test('ΕΠΙΛΕΞΕ δέχεται χαρακτήρες, λογικές τιμές, δεκαδικά και σχεσιακές περιπτώσεις',()=>{
 assert.deepEqual(execute(complete("Χ <- 'Β'\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 'Α', 'Β'\nΓΡΑΨΕ 'ναι'\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ",'ΧΑΡΑΚΤΗΡΕΣ: Χ')).output,['ναι'])
 assert.deepEqual(execute(complete("Χ <- ΑΛΗΘΗΣ\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ ΑΛΗΘΗΣ\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ",'ΛΟΓΙΚΕΣ: Χ')).output,['1'])
 assert.deepEqual(execute(complete("Χ <- 2.5\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 1.5..3.5\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ",'ΠΡΑΓΜΑΤΙΚΕΣ: Χ')).output,['1'])
 assert.deepEqual(execute(complete("Χ <- -1\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ < 0\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ")).output,['1'])
})
test('εμφωλευμένη ΕΠΙΛΕΞΕ, υποπρόγραμμα και μία αξιολόγηση της έκφρασης',()=>{
 const source=complete("ΕΠΙΛΕΞΕ Τιμη()\nΠΕΡΙΠΤΩΣΗ 1\nΓΡΑΨΕ 0\nΠΕΡΙΠΤΩΣΗ 2\nΕΠΙΛΕΞΕ 3\nΠΕΡΙΠΤΩΣΗ 3\nΓΡΑΨΕ 7\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ")+'\nΣΥΝΑΡΤΗΣΗ Τιμη(): ΑΚΕΡΑΙΑ\nΑΡΧΗ\nΤιμη <- 2\nΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ'
 const iterator=new Interpreter(parseProgram(source)).execute();const events=[]
 for(let next=iterator.next();!next.done;next=iterator.next())events.push(next.value)
 assert.equal(events.filter(event=>event.scopeName==='ΤΙΜΗ').length,1)
 assert.deepEqual(events.at(-1).output,['7'])
})
test('ΕΠΙΛΕΞΕ ελέγχει malformed περιπτώσεις, default-last, τύπους και προστασία μετρητή',()=>{
 for(const body of ['ΕΠΙΛΕΞΕ 1\nΠΕΡΙΠΤΩΣΗ 1,\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ','ΕΠΙΛΕΞΕ 1\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 1\nΠΕΡΙΠΤΩΣΗ 2\nΓΡΑΨΕ 2\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ','ΕΠΙΛΕΞΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'])assert.throws(()=>parseProgram(complete(body)))
 assert.throws(()=>parseProgram(complete("ΕΠΙΛΕΞΕ 1\nΠΕΡΙΠΤΩΣΗ 'x'\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ")),/συμβατό τύπο/)
 assert.throws(()=>execute(complete('ΕΠΙΛΕΞΕ 5\nΠΕΡΙΠΤΩΣΗ 10..1\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ')),/κάτω όριο/)
 assert.throws(()=>parseProgram(complete('ΓΙΑ Χ ΑΠΟ 1 ΜΕΧΡΙ 2\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 1\nΧ <- 5\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')),/μεταβλητής ελέγχου/)
})
test('ΛΟΓ είναι φυσικός λογάριθμος, Ε είναι e^x και απορρίπτονται μη θετικά ορίσματα',()=>{
 const source=complete('ΓΡΑΨΕ ΛΟΓ(1)\nΓΡΑΨΕ ΛΟΓ(Ε(2))\nΓΡΑΨΕ Ε(0)\nΓΡΑΨΕ Ε(-1)')
 const values=execute(source).output.map(Number)
 assert.equal(values[0],0);assert.ok(Math.abs(values[1]-2)<1e-12);assert.equal(values[2],1);assert.ok(Math.abs(values[3]-Math.exp(-1))<1e-12)
 for(const value of [-5,0])assert.throws(()=>execute(complete('ΓΡΑΨΕ ΛΟΓ('+value+')')),error=>error.category==='runtime'&&error.line===5&&/θετικός αριθμός/.test(error.message))
 assert.throws(()=>execute(complete('ΓΡΑΨΕ Ε(1000)')),/δεν μπορεί να αναπαρασταθεί/)
 assert.throws(()=>parseProgram(complete("ΓΡΑΨΕ ΛΟΓ('x')")),/αριθμητικό όρισμα/)
 assert.throws(()=>parseProgram(complete('ΓΡΑΨΕ Ε(1,2)')),/Πλήθος ορισμάτων/)
})
test('& στην αρχή/τέλος γραμμής ενώνει εντολές και διατηρεί φυσικές θέσεις',()=>{
 for(const body of ['Χ <- 1 + &\n2','Χ <- 1 +\n&2','Χ <- 1 + & ! σχόλιο\n&2','Χ <- 1 + &\n2 + &\n3']){
  const source=complete(body+'\nΓΡΑΨΕ Χ');const program=parseProgram(source)
  assert.equal(program.body[0].line,5)
  assert.deepEqual(execute(source).output,[body.includes('3')?'6':'3'])
 }
 const source=complete('Χ <- 1 +\n&ΑΓΝΩΣΤΗ')
 assert.throws(()=>parseProgram(source),error=>error.line===6&&/ΑΓΝΩΣΤΗ/.test(error.message))
 const tokens=tokenize('ΓΡΑΨΕ 1 +\n  & 2');assert.equal(tokens.find(token=>token.text==='2').line,2);assert.equal(tokens.find(token=>token.text==='2').column,5)
})
test('& σε αλφαριθμητικά/σχόλια διατηρείται και συνέχιση ανοιχτού αλφαριθμητικού λειτουργεί',()=>{
 assert.deepEqual(execute(complete("ΓΡΑΨΕ 'α&β' ! &\nΓΡΑΨΕ 'γ' ")).output,['α&β','γ'])
 assert.deepEqual(execute(complete("ΓΡΑΨΕ 'α\n&β'")).output,['αβ'])
 assert.deepEqual(execute(complete("ΓΡΑΨΕ 'α&\nβ'")).output,['αβ'])
 assert.throws(()=>tokenize('&ΓΡΑΨΕ 1'),/προηγούμενη εντολή/)
 assert.throws(()=>tokenize('ΓΡΑΨΕ 1 &'),/επόμενη γραμμή/)
 assert.throws(()=>tokenize('ΓΡΑΨΕ 1 &\n'),/επόμενη γραμμή/)
})
test('συμβολικές σταθερές επιλύουν διαστάσεις 1Δ/2Δ και υποπρογραμμάτων',()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΣΤΑΘΕΡΕΣ\nΝ = 3\nΜ = Ν + 1\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Α[Ν], Β[Ν,Μ]\nΑΡΧΗ\nΑ[3] <- 7\nΒ[3,4] <- 8\nΚΑΛΕΣΕ Αυξηση(Α)\nΓΡΑΨΕ Α[3], Β[3,4]\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\nΔΙΑΔΙΚΑΣΙΑ Αυξηση(Π)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Π[Ν]\nΑΡΧΗ\nΠ[3] <- Π[3] + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
 assert.deepEqual(parseProgram(source).declarations.map(d=>d.dimensions),[[3],[3,4]])
 assert.deepEqual(execute(source).output,['88'])
 for(const value of ['0','-1','1.5',"'x'",'ΑΛΗΘΗΣ'])assert.throws(()=>parseProgram(source.replace('Ν = 3','Ν = '+value).replace('Μ = Ν + 1','Μ = 4')),/θετικοί ακέραιοι/)
 assert.throws(()=>parseProgram(source.replace('Α[Ν]','Α[ΑΓΝΩΣΤΗ]')),/θετικοί ακέραιοι/)
 assert.throws(()=>parseProgram(source.replace('Ν = 3','Ν = Μ')),/προηγουμένως/)
})
test('στατικός έλεγχος βρίσκει αδήλωτη μεταβλητή μέσα σε νεκρό ΑΛΛΙΩΣ πριν την έξοδο',()=>{
 const source=complete("ΓΡΑΨΕ 'δεν εκτελείται'\nΑΝ ΑΛΗΘΗΣ ΤΟΤΕ\nΧ <- 1\nΑΛΛΙΩΣ\nΓΡΑΨΕ ΑΓΝΩΣΤΗ\nΤΕΛΟΣ_ΑΝ")
 assert.throws(()=>parseProgram(source),error=>error.category==='type'&&error.line===9&&/ΑΓΝΩΣΤΗ/.test(error.message))
 const ast=parseProgram(complete('Χ <- 1'));ast.body[0].name='ΑΓΝΩΣΤΗ'
 assert.throws(()=>new Interpreter(ast),/ΑΓΝΩΣΤΗ/)
})
test('στατικός έλεγχος εξετάζει όλα τα υποπρογράμματα και τις τοπικές εμβέλειες',()=>{
 const source=complete('Χ <- 1')+'\nΔΙΑΔΙΚΑΣΙΑ Αχρηστη()\nΑΡΧΗ\nΓΡΑΨΕ Χ\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
 assert.throws(()=>parseProgram(source),/«Χ» δεν έχει δηλωθεί/)
 assert.throws(()=>parseProgram(complete('ΕΠΙΛΕΞΕ 1\nΠΕΡΙΠΤΩΣΗ 2\nΓΡΑΨΕ ΑΓΝΩΣΤΗ\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ')),/ΑΓΝΩΣΤΗ/)
})
test('στατικοί τύποι ελέγχουν και τα παρακαμπτόμενα σκέλη ΚΑΙ/Η/ΟΧΙ',()=>{
 for(const condition of ['ΨΕΥΔΗΣ ΚΑΙ 1','ΑΛΗΘΗΣ Η 1','ΟΧΙ 1'])assert.throws(()=>parseProgram(complete('ΑΝ '+condition+' ΤΟΤΕ\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΑΝ')),error=>error.category==='type')
 assert.deepEqual(execute(complete('ΑΝ ΨΕΥΔΗΣ ΚΑΙ 1/0 > 2 ΤΟΤΕ\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΑΝ\nΓΡΑΨΕ 2')).output,['2'])
 assert.throws(()=>parseProgram(complete('ΑΝ ΨΕΥΔΗΣ ΚΑΙ ΑΓΝΩΣΤΗ > 2 ΤΟΤΕ\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΑΝ')),/ΑΓΝΩΣΤΗ/)
})

test('η αλφαριθμητική τιμή ΑΛΛΙΩΣ δεν συγχέεται με την προεπιλεγμένη περίπτωση',()=>{
 assert.deepEqual(execute(complete("Χ <- 'ΑΛΛΙΩΣ'\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 'ΑΛΛΙΩΣ'\nΓΡΑΨΕ 1\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 2\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ",'ΧΑΡΑΚΤΗΡΕΣ: Χ')).output,['1'])
})
