import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { SnippetParser } from '../node_modules/monaco-editor/esm/vs/editor/contrib/snippet/browser/snippetParser.js'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { createGlossaCompletionProvider, glossaLanguage, getGlossaCompletionContext } = await server.ssrLoadModule('/src/interpreter/glossaLanguage.ts')
const provider = createGlossaCompletionProvider({ languages: {
  CompletionItemKind: { Function: 1, Snippet: 27, Keyword: 17 },
  CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
} })

function complete(line, column = line.length + 1, preceding = '') {
  const lines = (preceding + line).split('\n')
  const before = line.slice(0, column - 1)
  const word = /[\p{L}\p{M}\d_]*$/u.exec(before)[0]
  const startColumn = column - word.length
  const rest = /^[\p{L}\p{M}\d_]*/u.exec(line.slice(column - 1))[0]
  return provider.provideCompletionItems({
    getLineContent: number => lines[number - 1],
    getWordUntilPosition: () => ({ word, startColumn, endColumn: column }),
    getWordAtPosition: () => ({ word: word + rest, startColumn, endColumn: column + rest.length }),
  }, { lineNumber: lines.length, column }).suggestions
}

test('ελληνικά, Greeklish, κεφαλαία και τόνοι επιστρέφουν τις ίδιες εντολές', () => {
  for (const prefix of ['τε', 'τελος', 'TELOS', 'τέλος']) {
    const labels = complete(prefix).map(item => item.label)
    for (const ending of ['ΑΝ', 'ΕΠΑΝΑΛΗΨΗΣ', 'ΕΠΙΛΟΓΩΝ', 'ΠΡΟΓΡΑΜΜΑΤΟΣ', 'ΣΥΝΑΡΤΗΣΗΣ', 'ΔΙΑΔΙΚΑΣΙΑΣ'])
      assert.ok(labels.includes('ΤΕΛΟΣ_' + ending), prefix + ': ' + ending)
  }
  for (const prefix of ['ακερ', 'ΑΚΕΡ', 'aker', 'AKER'])
    assert.equal(complete(prefix, undefined, 'ΜΕΤΑΒΛΗΤΕΣ\n')[0].insertText, 'ΑΚΕΡΑΙΕΣ')
  for (const prefix of ['για', 'ΓΙΑ', 'gia', 'GIA'])
    assert.equal(complete(prefix)[0].label, 'ΓΙΑ')
})

test('όλες οι κατηγορίες λέξεων και ενσωματωμένων συναρτήσεων είναι διαθέσιμες', () => {
  const suggestions = [...complete(''), ...complete('', undefined, 'ΜΕΤΑΒΛΗΤΕΣ\n'), ...complete('ΣΥΝΑΡΤΗΣΗ Δοκιμη(): ')]
  for (const group of ['control', 'declarations', 'io', 'wordOperators', 'constants'])
    for (const label of glossaLanguage[group]) assert.ok(suggestions.some(item => item.label === label), label)
  for (const label of ['ΗΜ', 'ΣΥΝ', 'ΕΦ', 'Τ_Ρ', 'Α_Τ', 'Α_Μ', 'ΛΟΓ', 'Ε']) {
    const item = suggestions.find(item => item.label === label)
    assert.equal(item.insertText, label + '(${1:x})')
    assert.equal(item.insertTextRules, 4)
  }
  for (const [alias, label] of [['τετ_ριζα', 'Τ_Ρ'], ['tet_riza', 'Τ_Ρ'], ['αρχ_τιμη', 'Α_Τ'], ['arx_timi', 'Α_Τ']])
    assert.ok(complete(alias).some(item => item.label === label))
})

test('τα snippets ερμηνεύονται από τον Monaco και περιέχουν τα απαιτούμενα tab stops', () => {
  for (const label of ['ΑΝ', 'ΟΣΟ', 'ΓΙΑ', 'ΕΠΙΛΕΞΕ', 'ΠΡΟΓΡΑΜΜΑ', 'ΣΥΝΑΡΤΗΣΗ', 'ΔΙΑΔΙΚΑΣΙΑ', 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ']) {
    const item = complete('').find(item => item.label === label)
    const parsed = new SnippetParser().parse(item.insertText)
    assert.ok(parsed.placeholders.some(placeholder => placeholder.index === 1), label)
    assert.ok(parsed.placeholders.some(placeholder => placeholder.index === 0), label)
    assert.equal(item.insertTextRules, 4)
  }
  const item = complete('για')[0]
  const parsed = new SnippetParser().parse(item.insertText)
  assert.equal(parsed.toString(), 'ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 10\n    \nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')
  assert.equal(parsed.placeholders.find(placeholder => placeholder.index === 1).toString(), 'i')
})

test('αντικαθίσταται μόνο η τρέχουσα λέξη και αποφεύγονται σχόλια και αλφαριθμητικά', () => {
  assert.deepEqual(complete('  ακεραιες', 7, 'ΜΕΤΑΒΛΗΤΕΣ\n')[0].range,
    { startLineNumber: 2, endLineNumber: 2, startColumn: 3, endColumn: 11 })
  for (const line of ['! για', "ΓΡΑΨΕ 'για", 'ΓΡΑΨΕ "για', "ΓΡΑΨΕ 'α''για"])
    assert.deepEqual(complete(line), [])
  assert.ok(complete("ΓΡΑΨΕ '!' + ημ").some(item => item.label === 'ΗΜ'))
  for (const letter of 'aAzZαωΑΩ_') assert.ok(provider.triggerCharacters.includes(letter))
})

test('τύποι δηλώσεων μόνο στις ΜΕΤΑΒΛΗΤΕΣ, με προτεραιότητα εντολών στο σώμα', () => {
  const types = ['ΑΚΕΡΑΙΕΣ', 'ΠΡΑΓΜΑΤΙΚΕΣ', 'ΧΑΡΑΚΤΗΡΕΣ', 'ΛΟΓΙΚΕΣ']
  for (const preceding of ['ΜΕΤΑΒΛΗΤΕΣ\n', 'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nμεταβλητές ! δηλώσεις\n']) {
    assert.equal(complete('ακ', undefined, preceding)[0].label, 'ΑΚΕΡΑΙΕΣ')
    for (const type of types) assert.ok(complete('', undefined, preceding).some(item => item.label === type))
  }
  for (const preceding of ['', 'ΣΤΑΘΕΡΕΣ\n', 'ΜΕΤΑΒΛΗΤΕΣ\nΑΡΧΗ\n', 'ΜΕΤΑΒΛΗΤΕΣ\nΑΡΧΗ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\n']) {
    assert.ok(!complete('ακ', undefined, preceding).some(item => item.label === 'ΑΚΕΡΑΙΕΣ'))
    assert.ok(!complete('', undefined, preceding).some(item => types.includes(item.label)))
  }
  const body = complete('', undefined, 'ΑΡΧΗ\n')
  const commands = ['ΔΙΑΒΑΣΕ', 'ΓΡΑΨΕ', 'ΑΝ', 'ΟΣΟ', 'ΓΙΑ', 'ΕΠΙΛΕΞΕ', 'ΚΑΛΕΣΕ']
  assert.deepEqual(new Set(body.slice(0, 7).map(item => item.label)), new Set(commands))
  assert.equal(body[0].preselect, true)
})

test('το χ στο σώμα δεν προτείνει ΧΑΡΑΚΤΗΡΕΣ ούτε ΧΑΡΑΚΤΗΡΑΣ', () => {
  const preceding = 'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΧΑΡΑΚΤΗΡΕΣ: χ\nΑΡΧΗ\n'
  const allTypes = ['ΑΚΕΡΑΙΕΣ', 'ΠΡΑΓΜΑΤΙΚΕΣ', 'ΧΑΡΑΚΤΗΡΕΣ', 'ΛΟΓΙΚΕΣ', 'ΑΚΕΡΑΙΑ', 'ΠΡΑΓΜΑΤΙΚΗ', 'ΧΑΡΑΚΤΗΡΑΣ', 'ΛΟΓΙΚΗ']
  for (const prefix of ['', 'χ', 'Χ', 'x', 'ch', 'ακ', 'λογ', 'πραγ'])
    assert.ok(!complete(prefix, undefined, preceding).some(item => allTypes.includes(item.label)), prefix)
  assert.deepEqual(complete('χ', undefined, 'ΜΕΤΑΒΛΗΤΕΣ\n').map(item => item.label), ['ΧΑΡΑΚΤΗΡΕΣ'])
  for (const [prefix, label] of [['ακ', 'ΑΚΕΡΑΙΑ'], ['πραγ', 'ΠΡΑΓΜΑΤΙΚΗ'], ['χ', 'ΧΑΡΑΚΤΗΡΑΣ'], ['λογ', 'ΛΟΓΙΚΗ']])
    assert.ok(complete('ΣΥΝΑΡΤΗΣΗ Δοκιμη(): ' + prefix).some(item => item.label === label))
})

test('το πλαίσιο αγνοεί σχόλια, αλφαριθμητικά και επόμενες γραμμές και επανεκκινεί στα υποπρογράμματα', () => {
  for (const preceding of [
    'ΜΕΤΑΒΛΗΤΕΣ\n! ΑΡΧΗ\n',
    'ΜΕΤΑΒΛΗΤΕΣ\n! ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\n',
    'ΑΡΧΗ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\nΔΙΑΔΙΚΑΣΙΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\n',
  ]) assert.ok(complete('ακ', undefined, preceding).some(item => item.label === 'ΑΚΕΡΑΙΕΣ'))
  for (const preceding of [
    "ΑΡΧΗ\nΓΡΑΨΕ 'ΜΕΤΑΒΛΗΤΕΣ'\n",
    'ΑΡΧΗ\n! ΜΕΤΑΒΛΗΤΕΣ\n',
    'ΜΕΤΑΒΛΗΤΕΣ\nΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\nΑΡΧΗ\n',
    'ΜΕΤΑΒΛΗΤΕΣ\nΔΙΑΔΙΚΑΣΙΑ Δοκιμη\n',
    'ΜΕΤΑΒΛΗΤΕΣ\nΑΡΧΗ\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ\n',
  ]) assert.ok(!complete('ακ', undefined, preceding).some(item => item.label === 'ΑΚΕΡΑΙΕΣ'))
  const lines = ['ΜΕΤΑΒΛΗΤΕΣ', 'ακ', 'ΑΡΧΗ', 'ΓΡΑΨΕ 1', 'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ']
  const model = { getLineContent: number => lines[number - 1] }
  assert.deepEqual(getGlossaCompletionContext(model, { lineNumber: 2, column: 3 }),
    { isInsideVariablesSection: true, isInsideMainBody: false })
  assert.deepEqual(getGlossaCompletionContext(model, { lineNumber: 4, column: 1 }),
    { isInsideVariablesSection: false, isInsideMainBody: true })
})
