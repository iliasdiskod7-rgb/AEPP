import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { Interpreter, parseInput } = await server.ssrLoadModule('/src/interpreter/runtime.ts')
const { parseProgram } = await server.ssrLoadModule('/src/interpreter/parser.ts')
const { patterns, fullProgram, matchesPattern, categories } = await server.ssrLoadModule('/src/patterns/catalog.ts')
const { default: PatternsWorkspace } = await server.ssrLoadModule('/src/components/patterns/PatternsWorkspace.tsx')
const { default: DashboardLayout } = await server.ssrLoadModule('/src/components/layout/DashboardLayout.tsx')
after(() => server.close())
function run(pattern, inputs) {
  const iterator = new Interpreter(parseProgram(fullProgram(pattern))).execute()
  let next = iterator.next(), used = 0, output = []
  for (let steps = 0; !next.done && steps < 50000; steps++) {
    output = next.value.output
    if (next.value.kind === 'input') {
      assert.ok(used < inputs.length, 'Αναμενόταν επιπλέον είσοδος: '+pattern.id)
      next = iterator.next(parseInput(String(inputs[used++]), next.value.type, next.value.line))
    } else next = iterator.next()
  }
  assert.ok(next.done, 'Το πρόγραμμα πρέπει να τερματίσει: '+pattern.id)
  assert.equal(used, inputs.length, 'Πρέπει να χρησιμοποιηθούν ακριβώς οι δεδομένες είσοδοι')
  return output
}
for (const pattern of patterns) {
  for (const example of pattern.examples) {
    test(pattern.title+' / '+example.label, () => assert.deepEqual(run(pattern,example.inputs),example.output))
  }
}
const get = id => patterns.find(p => p.id === id)
test('εγκυρότητα διαστάσεων πριν από οποιαδήποτε προσπέλαση', () => {
  assert.deepEqual(run(get('statistics'),[-1,101,2,3,5]),['8 2','4'])
  assert.deepEqual(run(get('extrema'),[0,1,-7]),['-7 1','-7 1'])
})
test('μέγιστο επιτρεπτό Ν: 100 στοιχεία και όλα τα όρια πινάκων', () => {
  const numbers = Array.from({length:100},(_,i)=>100-i)
  assert.deepEqual(run(get('statistics'),[100,...numbers]),['5050 100','50.5'])
  assert.deepEqual(run(get('bubble'),[100,...numbers]),[...numbers].reverse().map(String))
})
test('δυαδική αναζήτηση: όλες οι θέσεις και κλειδιά έξω από τα όρια', () => {
  const numbers = [-7,-3,0,2,5,9,20]
  for (let i=0;i<numbers.length;i++) assert.deepEqual(run(get('binary'),[numbers.length,...numbers,numbers[i]]),[String(i+1)])
  for (const key of [-100,1,100]) assert.deepEqual(run(get('binary'),[numbers.length,...numbers,key]),['0'])
})
test('ψηφία: άνω όριο και απόρριψη υπέρβασης', () => {
  assert.deepEqual(run(get('digits'),[999999999]),[...Array(9).fill('9'),'9 81'])
  assert.deepEqual(run(get('digits'),[1000000000,0]),['0','1 0'])
})
test('αναζήτηση χωρίς εξάρτηση από τόνους, πεζά ή κενά στα άκρα', () => {
  assert.ok(matchesPattern(get('conditional'),'  ΜΕΣΟΣ ΟΡΟΣ  '))
  assert.ok(matchesPattern(get('digits'),'ψηφία'))
  assert.ok(!matchesPattern(get('digits'),'ταξινόμηση'))
  assert.equal(new Set(patterns.map(p=>p.id)).size,patterns.length)
  for (const category of categories) assert.ok(patterns.some(p=>p.category===category))
})
test('όλα τα πρότυπα αποδίδονται με προϋποθέσεις, κώδικα και επεξηγήσεις', () => {
  for (const p of patterns) {
    const html = renderToStaticMarkup(createElement(PatternsWorkspace,{selectedId:p.id,onSelect:()=>{},onOpenProgram:()=>{},hasCustomProgram:true}))
    assert.ok(html.includes(p.title.replaceAll('&','&amp;')))
    assert.ok(html.includes('Πριν το χρησιμοποιήσεις'))
    assert.ok(html.includes('Παγίδες που προσέχουμε'))
    assert.ok(html.includes('Πλήρες πρόγραμμα'))
    assert.ok(html.includes('Άνοιγμα στον Διερμηνευτή'))
    assert.ok(!html.includes('70%'))
  }
})
test('η βιβλιοθήκη εντάσσεται στον ενιαίο χώρο μάθησης', () => {
  const html = renderToStaticMarkup(createElement(DashboardLayout,{activeTab:'courses',onTabChange:()=>{},children:'Μάθηση'}))
  assert.match(html,/aria-current="page"[^>]*>.*?Μαθήματα &amp; Εξάσκηση/s)
  assert.ok(!html.includes('Μεθοδολογίες &amp; Tips'))
})
