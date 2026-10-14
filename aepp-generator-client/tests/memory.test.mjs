import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
after(() => server.close())
const { Interpreter, parseInput } = await server.ssrLoadModule('/src/interpreter/runtime.ts')
const { parseProgram } = await server.ssrLoadModule('/src/interpreter/parser.ts')
const { default: MemoryVisualizer } = await server.ssrLoadModule('/src/components/interpreter/MemoryVisualizer.tsx')

function trace(source, inputs = [], memory = true) {
  const iterator = new Interpreter(parseProgram(source), { memory }).execute()
  const events = []
  let next = iterator.next(), used = 0
  for (let limit = 0; !next.done && limit < 2000; limit++) {
    events.push(next.value)
    next = next.value.kind === 'input' ? iterator.next(parseInput(String(inputs[used++]), next.value.type, next.value.line)) : iterator.next()
  }
  assert.ok(next.done, 'Πρέπει να ολοκληρωθεί το πρόγραμμα')
  return events
}
const effects = events => events.flatMap(e => e.memoryEvents ?? [])
const wrap = (decl, body) => 'ΠΡΟΓΡΑΜΜΑ Μνήμη\nΜΕΤΑΒΛΗΤΕΣ\n' + decl + '\nΑΡΧΗ\n' + body + '\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
const swap = wrap("ΑΚΕΡΑΙΕΣ: Α[3], Ι, Κ, Τ", "Α[1] <- 8\nΑ[2] <- 3\nΑ[3] <- 5\nΙ <- 1\nΚ <- 2\nΑΝ Α[Ι] > Α[Κ] ΤΟΤΕ\nΤ <- Α[Ι]\nΑ[Ι] <- Α[Κ]\nΑ[Κ] <- Τ\nΤΕΛΟΣ_ΑΝ\nΓΡΑΨΕ Α[1], ' ', Α[2]")

test('συγκρίσεις εκπέμπουν τις πραγματικές θέσεις και αποτέλεσμα χωρίς επαναξιολόγηση', () => {
  const events = trace(swap), comparison = effects(events).find(e => e.kind === 'ON_COMPARE')
  assert.deepEqual(comparison.operands.map(r => [r.name, r.indexes]), [['Α', [1]], ['Α', [2]]])
  assert.equal(comparison.operator, '>'); assert.equal(comparison.result, true)
  assert.deepEqual(events.at(-1).output, ['3 8'])
})
test('swap εκπέμπεται μετά την τρίτη εκχώρηση, με ενδιάμεση τιμή στην Τ', () => {
  const events = trace(swap), swaps = effects(events).filter(e => e.kind === 'ON_SWAP')
  assert.equal(swaps.length, 1)
  assert.deepEqual(swaps[0].first.indexes, [1]); assert.deepEqual(swaps[0].second.indexes, [2])
  assert.equal(swaps[0].temporary.name, 'Τ'); assert.deepEqual(swaps[0].values.map(v => v.value), [8, 3])
  const saved = events.find(e => e.memoryEvents?.some(m => m.kind === 'ON_MUTATE' && m.target.name === 'Τ'))
  assert.equal(saved.variables.find(v => v.name === 'Τ').value.value, 8)
  assert.equal(saved.variables.find(v => v.name === 'Α').elements['1'].value, 8)
  assert.equal(events.at(-1).variables.find(v => v.name === 'Α').elements['1'].value, 3)
})
test('ανεξάρτητα snapshots: επόμενες μεταβολές δεν αλλάζουν προηγούμενα βήματα', () => {
  const events = trace(wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[1] <- 1\nΑ[1] <- 9'))
  assert.deepEqual(events[0].variables[0].dimensions, [2])
  assert.equal(events[0].variables[0].elements['1'].value, 1)
  assert.equal(events[0].variables[0].elements['2'], undefined)
  events.at(-1).variables[0].elements['1'].value = 7
  assert.equal(events[0].variables[0].elements['1'].value, 1)
})
test('ΔΙΑΒΑΣΕ 2Δ επισημαίνει αναμονή και έπειτα πραγματική εγγραφή', () => {
  const events = trace(wrap('ΑΚΕΡΑΙΕΣ: Α[2,3]', 'ΔΙΑΒΑΣΕ Α[2,3]\nΓΡΑΨΕ Α[2,3]'), [6])
  assert.equal(events[0].kind, 'input')
  assert.deepEqual(events[0].memoryEvents[0].target.indexes, [2, 3])
  assert.equal(events[0].memoryEvents[0].input, true)
  const mutation = effects(events).find(e => e.kind === 'ON_MUTATE')
  assert.deepEqual(mutation.target.indexes, [2, 3]); assert.equal(mutation.value.value, 6)
  assert.equal(events.at(-1).variables[0].elements['2,3'].value, 6)
})
test('η δυαδική αναζήτηση διατηρεί δυναμικές τιμές αρχής/τέλους/μέσου', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[5], Ι, ΑΡΧ, ΤΕΛΟΣ, ΜΕΣΟ, Ζ\nΛΟΓΙΚΕΣ: ΒΡΕΘΗΚΕ', 'ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 5\nΑ[Ι] <- Ι * 2\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΑΡΧ <- 1\nΤΕΛΟΣ <- 5\nΖ <- 8\nΒΡΕΘΗΚΕ <- ΨΕΥΔΗΣ\nΟΣΟ ΑΡΧ <= ΤΕΛΟΣ ΚΑΙ ΟΧΙ ΒΡΕΘΗΚΕ ΕΠΑΝΑΛΑΒΕ\nΜΕΣΟ <- (ΑΡΧ + ΤΕΛΟΣ) DIV 2\nΑΝ Α[ΜΕΣΟ] = Ζ ΤΟΤΕ\nΒΡΕΘΗΚΕ <- ΑΛΗΘΗΣ\nΑΛΛΙΩΣ_ΑΝ Α[ΜΕΣΟ] < Ζ ΤΟΤΕ\nΑΡΧ <- ΜΕΣΟ + 1\nΑΛΛΙΩΣ\nΤΕΛΟΣ <- ΜΕΣΟ - 1\nΤΕΛΟΣ_ΑΝ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ ΜΕΣΟ')
  const events = trace(source)
  assert.deepEqual(effects(events).filter(e => e.kind === 'ON_MUTATE' && e.target.name === 'ΜΕΣΟ').map(e => e.value.value), [3, 4])
  assert.deepEqual(events.at(-1).output, ['4'])
})
test('μη έγκυρα όρια δεν παράγουν events ανύπαρκτων στοιχείων', () => {
  assert.throws(() => trace(wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[0] <- 1')), /εκτός ορίων/u)
  assert.throws(() => trace(wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[3] <- 1')), /εκτός ορίων/u)
})
test('διακοπή της τριάδας ή αλλαγή δεικτών δεν παρουσιάζεται ως swap', () => {
  const separated = swap.replace('Α[Κ] <- Τ', 'ΓΡΑΨΕ Τ\nΑ[Κ] <- Τ')
  const moved = swap.replace('Α[Κ] <- Τ', 'Κ <- 3\nΑ[Κ] <- Τ')
  for (const source of [separated, moved]) assert.equal(effects(trace(source)).filter(e => e.kind === 'ON_SWAP').length, 0)
})
test('ίδιες τιμές ανταλλάσσονται χωρίς σύγχυση ταυτότητας', () => {
  assert.equal(effects(trace(swap.replace('Α[2] <- 3', 'Α[2] <- 8').replace('> Α[Κ]', '= Α[Κ]'))).filter(e => e.kind === 'ON_SWAP').length, 1)
})
test('subprogram frames έχουν ξεχωριστή ταυτότητα και μεταβολές αναφοράς', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[1] <- 1\nΑ[2] <- 2\nΚΑΛΕΣΕ Αύξηση(Α)\nΚΑΛΕΣΕ Αύξηση(Α)\nΓΡΑΨΕ Α[1]') + '\nΔΙΑΔΙΚΑΣΙΑ Αύξηση(Π)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Π[2]\nΑΡΧΗ\nΠ[1] <- Π[1] + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const events = trace(source), mutations = effects(events).filter(e => e.kind === 'ON_MUTATE' && e.target.name === 'Π')
  assert.deepEqual(mutations.map(e => e.target.scopeId), [1, 2])
  assert.equal(events.at(-1).scopeId, 0); assert.deepEqual(events.at(-1).output, ['3'])
})
test('opt-in instrumentation δεν αλλάζει τις τιμές, τις γραμμές ή την έξοδο', () => {
  const withMemory = trace(swap), withoutMemory = trace(swap, [], false)
  assert.deepEqual(withMemory.map(e => [e.kind, e.line, e.output]), withoutMemory.map(e => [e.kind, e.line, e.output]))
  assert.equal(withoutMemory.some(e => e.memoryEvents), false)
})

test('το panel εμφανίζει πραγματικά στοιχεία 1Δ/2Δ και αδήλωτες τιμές χωρίς δείκτη 0', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Π[2,2], Α[2], ΑΡΧ, ΤΕΛΟΣ, ΜΕΣΟ\nΛΟΓΙΚΕΣ: ΣΗΜΑΙΑ', 'Π[1,2] <- 9\nΑ[1] <- 4\nΑΡΧ <- 1\nΤΕΛΟΣ <- 2\nΜΕΣΟ <- 1\nΣΗΜΑΙΑ <- ΑΛΗΘΗΣ')
  const events = trace(source)
  const markup = renderToStaticMarkup(createElement(MemoryVisualizer, { event: events.at(-1), speed: 0.5, onSpeedChange() {} }))
  assert.match(markup, /Οπτικοποιητής Μνήμης/u)
  assert.match(markup, /Π\[1, 2\]: 9/u)
  assert.match(markup, /Π\[2, 2\]: Χωρίς αρχική τιμή/u)
  assert.match(markup, /Α\[1\]: 4/u)
  assert.match(markup, /ΑΛΗΘΗΣ/u)
  assert.match(markup, /--memory-duration:1800ms/u)
  assert.doesNotMatch(markup, /\[0\]/u)
  assert.match(markup, /ΑΡΧ/u)
})
test('ο οπτικοποιητής σελιδοποιεί μεγάλα matrices χωρίς να δημιουργεί όλα τα κελιά', () => {
  const event = trace(wrap('ΑΚΕΡΑΙΕΣ: Π[100,100]', 'Π[1,1] <- 2')).at(-1)
  const markup = renderToStaticMarkup(createElement(MemoryVisualizer, { event, speed: 1, onSpeedChange() {} }))
  assert.equal((markup.match(/class="memory-cell/g) ?? []).length, 48)
  assert.match(markup, /Γραμμές/u); assert.match(markup, /Στήλες/u)
})

test('φυσαλίδα εκπέμπει πολλαπλά swaps και καταλήγει στον σωστά ταξινομημένο πίνακα', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[3], Ι, Κ, Τ', 'Α[1] <- 3\nΑ[2] <- 2\nΑ[3] <- 1\nΓΙΑ Ι ΑΠΟ 2 ΜΕΧΡΙ 3\nΓΙΑ Κ ΑΠΟ 3 ΜΕΧΡΙ Ι ΜΕ ΒΗΜΑ -1\nΑΝ Α[Κ-1] > Α[Κ] ΤΟΤΕ\nΤ <- Α[Κ-1]\nΑ[Κ-1] <- Α[Κ]\nΑ[Κ] <- Τ\nΤΕΛΟΣ_ΑΝ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')
  const events = trace(source)
  assert.equal(effects(events).filter(e => e.kind === 'ON_SWAP').length, 3)
  assert.deepEqual(Object.values(events.at(-1).variables.find(v => v.name === 'Α').elements).map(v => v.value), [1, 2, 3])
})


test('επιστροφή παραμέτρου εκπέμπει ON_MUTATE στο αρχικό κελί και στο caller scope', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[3], Ι', 'Α[2] <- 4\nΑ[3] <- 30\nΙ <- 2\nΚΑΛΕΣΕ Αυξηση(Ι, Α[Ι])') + '\nΔΙΑΔΙΚΑΣΙΑ Αυξηση(Κ, Α)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Κ, Α\nΑΡΧΗ\nΚ <- 3\nΑ <- Α + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const events = trace(source)
  const returned = events.find(e => e.scopeId === 0 && e.memoryEvents?.some(m => m.kind === 'ON_MUTATE' && m.target.name === 'Α' && m.value.value === 5))
  assert.ok(returned)
  const mutation = returned.memoryEvents.find(m => m.kind === 'ON_MUTATE' && m.target.name === 'Α')
  assert.deepEqual(mutation.target, { scopeId: 0, name: 'Α', indexes: [2] })
  assert.equal(mutation.previous.value, 4)
  assert.equal(mutation.value.value, 5)
  assert.equal(returned.variables.find(v => v.name === 'Α').elements['2'].value, 5)
  assert.equal(returned.variables.find(v => v.name === 'Α').elements['3'].value, 30)
  assert.equal(returned.variables.find(v => v.name === 'Ι').value.value, 3)
  const local = effects(events).find(m => m.kind === 'ON_MUTATE' && m.target.name === 'Α' && m.target.scopeId === 1)
  assert.deepEqual(local.target.indexes, [])
})
test('επιστροφή παραμέτρου 2Δ επισημαίνει τη συγκεκριμένη γραμμή και στήλη', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Β[2,3]', 'Β[1,2] <- 6\nΚΑΛΕΣΕ Διπλασιασμος(Β[1,2])') + '\nΔΙΑΔΙΚΑΣΙΑ Διπλασιασμος(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ * 2\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const events = trace(source)
  const mutation = effects(events).find(m => m.kind === 'ON_MUTATE' && m.target.name === 'Β' && m.value.value === 12)
  assert.deepEqual(mutation.target, { scopeId: 0, name: 'Β', indexes: [1, 2] })
  assert.equal(mutation.previous.value, 6)
  assert.equal(events.at(-1).variables[0].elements['1,2'].value, 12)
})
test('εμφωλευμένη επιστροφή ενημερώνει πρώτα την τοπική μνήμη και μετά τον αρχικό πίνακα', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[2] <- 7\nΚΑΛΕΣΕ Εξωτερικη(Α)') + '\nΔΙΑΔΙΚΑΣΙΑ Εξωτερικη(Π)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Π[2]\nΑΡΧΗ\nΚΑΛΕΣΕ Εσωτερικη(Π[2])\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ\nΔΙΑΔΙΚΑΣΙΑ Εσωτερικη(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const mutations = effects(trace(source)).filter(m => m.kind === 'ON_MUTATE' && m.value.value === 8)
  assert.deepEqual(mutations.map(m => [m.target.scopeId, m.target.name, m.target.indexes]), [[2, 'Τ', []], [1, 'Π', [2]], [0, 'Α', [2]]])
})
test('επιστροφή τιμών λειτουργεί το ίδιο με ενεργή ή ανενεργή οπτικοποίηση', () => {
  const source = wrap('ΑΚΕΡΑΙΕΣ: Α[2]', 'Α[1] <- 4\nΚΑΛΕΣΕ Αυξηση(Α[1])\nΓΡΑΨΕ Α[1]') + '\nΔΙΑΔΙΚΑΣΙΑ Αυξηση(Τ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Τ\nΑΡΧΗ\nΤ <- Τ + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
  const enabled = trace(source), disabled = trace(source, [], false)
  assert.deepEqual(enabled.map(e => [e.kind, e.line, e.output]), disabled.map(e => [e.kind, e.line, e.output]))
  assert.deepEqual(disabled.at(-1).output, ['5'])
  assert.equal(disabled.some(e => e.memoryEvents), false)
})

test('ΕΠΙΛΕΞΕ εκπέμπει συγκρίσεις για τον πίνακα και mutations στον επιλεγμένο κλάδο',()=>{
 const source=wrap('ΑΚΕΡΑΙΕΣ: Α[1]',"Α[1] <- 5\nΕΠΙΛΕΞΕ Α[1]\nΠΕΡΙΠΤΩΣΗ 1..10\nΑ[1] <- 7\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΑ[1] <- 0\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΓΡΑΨΕ Α[1]")
 const events=trace(source),memory=effects(events)
 assert.ok(memory.some(event=>event.kind==='ON_COMPARE'&&event.operands.some(ref=>ref.name==='Α'&&ref.indexes[0]===1)))
 assert.ok(memory.some(event=>event.kind==='ON_MUTATE'&&event.value.value===7))
 assert.equal(memory.some(event=>event.kind==='ON_MUTATE'&&event.value.value===0),false)
 assert.deepEqual(events.at(-1).output,['7'])
})
