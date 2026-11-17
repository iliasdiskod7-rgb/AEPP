import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { formatGlossa, glossaConfiguration } = await server.ssrLoadModule('/src/interpreter/glossaLanguage.ts')
const { registerGlossaLanguage } = await server.ssrLoadModule('/src/interpreter/glossaLanguage.ts')

test('το Enter στοιχίζει αυτόματα επιλογές, επαναλήψεις και εμφωλευμένες δομές', () => {
 let provider
 registerGlossaLanguage({
  languages: {
   getLanguages: () => [], register() {}, setLanguageConfiguration() {}, setMonarchTokensProvider() {},
   registerDocumentFormattingEditProvider() {},
   registerCompletionItemProvider() {},
   registerOnTypeFormattingEditProvider: (_language, value) => { provider = value },
  },
  editor: { defineTheme() {} },
 })
 for (const [source, expected] of [
  ['ΑΝ x > 0 ΤΟΤΕ\n', 'ΑΝ x > 0 ΤΟΤΕ\n    '],
  ['ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5\n', 'ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5\n    '],
  ['οσο x > 0 επαναλαβε\n', 'οσο x > 0 επαναλαβε\n    '],
  ['ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n', 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n    '],
  ['ΑΝ x > 0 ΤΟΤΕ\n    ΑΛΛΙΩΣ\n    ', 'ΑΝ x > 0 ΤΟΤΕ\nΑΛΛΙΩΣ\n    '],
  ['ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5\n    ΑΝ x > 0 ΤΟΤΕ\n        ΤΕΛΟΣ_ΑΝ\n        ', 'ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5\n    ΑΝ x > 0 ΤΟΤΕ\n    ΤΕΛΟΣ_ΑΝ\n    '],
  ['ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n    ΜΕΧΡΙΣ_ΟΤΟΥ x > 0\n    ', 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\nΜΕΧΡΙΣ_ΟΤΟΥ x > 0\n'],
  ['ΕΠΙΛΕΞΕ x\n    ΠΕΡΙΠΤΩΣΗ 1\n        ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\n        ', 'ΕΠΙΛΕΞΕ x\n    ΠΕΡΙΠΤΩΣΗ 1\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\n'],
  ["ΓΡΑΨΕ 'ΑΝ x ΤΟΤΕ' ! σχόλιο\n", "ΓΡΑΨΕ 'ΑΝ x ΤΟΤΕ' ! σχόλιο\n"],
 ]) {
  const lines = source.split('\n')
  const edits = provider.provideOnTypeFormattingEdits({ getLineContent: line => lines[line - 1] }, { lineNumber: lines.length, column: lines.at(-1).length + 1 })
  for (const { range, text } of edits) lines[range.startLineNumber - 1] = text + lines[range.startLineNumber - 1].slice(range.endColumn - 1)
  assert.equal(lines.join('\n'), expected)
 }
 for (const [source, character, expected] of [
  ['ΑΝ x > 0 ΤΟΤΕ\n    ΤΕΛΟΣ_ΑΝ', 'Ν', 'ΑΝ x > 0 ΤΟΤΕ\nΤΕΛΟΣ_ΑΝ'],
  ['ΟΣΟ x > 0 ΕΠΑΝΑΛΑΒΕ\n    ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', 'Σ', 'ΟΣΟ x > 0 ΕΠΑΝΑΛΑΒΕ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'],
  ['ΑΝ x > 0 ΤΟΤΕ\n    αλλιως', 'ς', 'ΑΝ x > 0 ΤΟΤΕ\nαλλιως'],
  ['ΑΝ x > 0 ΤΟΤΕ\n    ΤΕΛΟΣ_ΑΝΑΖΗΤΗΣΗΣ', 'Σ', 'ΑΝ x > 0 ΤΟΤΕ\n    ΤΕΛΟΣ_ΑΝΑΖΗΤΗΣΗΣ'],
 ]) {
  const lines = source.split('\n')
  const edits = provider.provideOnTypeFormattingEdits({ getLineContent: line => lines[line - 1] }, { lineNumber: lines.length, column: lines.at(-1).length + 1 }, character)
  for (const { range, text } of edits) lines[range.startLineNumber - 1] = text + lines[range.startLineNumber - 1].slice(range.endColumn - 1)
  assert.equal(lines.join('\n'), expected)
 }
})
test('εσοχές, σχολική ΓΙΑ και μείωση εσοχής', () => {
 assert.ok(glossaConfiguration.indentationRules.increaseIndentPattern.test('ΑΝ x > 0 ΤΟΤΕ'))
 assert.ok(glossaConfiguration.indentationRules.increaseIndentPattern.test('ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5'))
 assert.ok(glossaConfiguration.indentationRules.decreaseIndentPattern.test('    ΤΕΛΟΣ_ΑΝ'))
 const source = 'ΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: x\nΑΡΧΗ\nΑΝ x > 0 ΤΟΤΕ\nΓΡΑΨΕ x\nΑΛΛΙΩΣ\nΓΡΑΨΕ 0\nΤΕΛΟΣ_ΑΝ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 const formatted = formatGlossa(source)
 assert.equal(formatted, 'ΜΕΤΑΒΛΗΤΕΣ\n    ΑΚΕΡΑΙΕΣ: x\nΑΡΧΗ\n    ΑΝ x > 0 ΤΟΤΕ\n        ΓΡΑΨΕ x\n    ΑΛΛΙΩΣ\n        ΓΡΑΨΕ 0\n    ΤΕΛΟΣ_ΑΝ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')
 assert.equal(formatGlossa(formatted), formatted)
})
test('Worker: έξοδος πριν την είσοδο, διόρθωση τιμής και συνέχεια', async () => {
 const messages = []
 globalThis.self = { postMessage: message => messages.push(structuredClone(message)) }
 await server.ssrLoadModule('/src/assessment/interactive.worker.ts')
 self.onmessage({ data: { action: 'start', source: 'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: x, y\nΑΡΧΗ\nΓΡΑΨΕ 1\nΔΙΑΒΑΣΕ x, y\nΓΡΑΨΕ x + y\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ' } })
 assert.equal(messages.at(-1).kind, 'input')
 assert.equal(messages.at(-1).name, 'X')
 assert.deepEqual(messages.at(-1).output, ['1'])
 self.onmessage({ data: { action: 'input', value: 'abc' } })
 assert.equal(messages.at(-1).kind, 'invalid')
 self.onmessage({ data: { action: 'input', value: '3' } })
 assert.equal(messages.at(-1).kind, 'input')
 self.onmessage({ data: { action: 'input', value: '4' } })
 assert.equal(messages.at(-1).kind, 'done')
 assert.deepEqual(messages.at(-1).output, ['1', '7'])
 messages.length = 0
 self.onmessage({ data: { action: 'start', source: 'ΠΡΟΓΡΑΜΜΑ Επαναληψη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: x, i\nΑΡΧΗ\nΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 2\nΔΙΑΒΑΣΕ x\nΓΡΑΨΕ x\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ' } })
 assert.equal(messages.at(-1).kind, 'input')
 assert.equal(messages.at(-1).line, 6)
 self.onmessage({ data: { action: 'input', value: '8' } })
 assert.equal(messages.at(-1).kind, 'input')
 assert.deepEqual(messages.at(-1).output, ['8'])
 self.onmessage({ data: { action: 'input', value: '9' } })
 assert.equal(messages.at(-1).kind, 'done')
 assert.deepEqual(messages.at(-1).output, ['8', '9'])
 delete globalThis.self
})

