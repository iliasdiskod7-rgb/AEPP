import type { editor, languages } from 'monaco-editor'

export const GLOSSA_LANGUAGE_ID = 'glossa'

// Οι ολόκληρες λέξεις ελέγχονται πριν από την ταξινόμηση σε κατηγορίες.
export const glossaLanguage: languages.IMonarchLanguage = {
  ignoreCase: true,
  unicode: true,
  tokenPostfix: '.glossa',
  defaultToken: 'identifier',
  control: [
    'ΟΣΟ',
    'ΓΙΑ',
    'ΜΕΧΡΙΣ_ΟΤΟΥ',
    'ΕΠΑΝΑΛΑΒΕ',
    'ΑΠΟ',
    'ΜΕΧΡΙ',
    'ΜΕ',
    'ΒΗΜΑ',
    'ΜΕ_ΒΗΜΑ',
    'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ',
    'ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ',
    'ΑΝ',
    'ΤΟΤΕ',
    'ΑΛΛΙΩΣ',
    'ΑΛΛΙΩΣ_ΑΝ',
    'ΤΕΛΟΣ_ΑΝ',
    'ΕΠΙΛΕΞΕ',
    'ΠΕΡΙΠΤΩΣΗ',
    'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ',
  ],
  declarations: [
    'ΠΡΟΓΡΑΜΜΑ',
    'ΜΕΤΑΒΛΗΤΕΣ',
    'ΣΤΑΘΕΡΕΣ',
    'ΑΡΧΗ',
    'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ',
    'ΣΥΝΑΡΤΗΣΗ',
    'ΔΙΑΔΙΚΑΣΙΑ',
    'ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ',
    'ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ',
    'ΚΑΛΕΣΕ',
    'ΑΚΕΡΑΙΕΣ',
    'ΠΡΑΓΜΑΤΙΚΕΣ',
    'ΧΑΡΑΚΤΗΡΕΣ',
    'ΛΟΓΙΚΕΣ',
    'ΑΚΕΡΑΙΑ',
    'ΠΡΑΓΜΑΤΙΚΗ',
    'ΧΑΡΑΚΤΗΡΑΣ',
    'ΛΟΓΙΚΗ',
  ],
  io: ['ΔΙΑΒΑΣΕ', 'ΓΡΑΨΕ'],
  wordOperators: ['DIV', 'MOD', 'ΚΑΙ', 'Η', 'Ή', 'ΟΧΙ'],
  constants: ['ΑΛΗΘΗΣ', 'ΨΕΥΔΗΣ'],
  tokenizer: {
    root: [
      [/[ \t\r]+/, 'white'],
      [/!.*/, 'comment'],
      // Τα θαυμαστικά και οι λέξεις μέσα σε εισαγωγικά παραμένουν string.
      [/'(?:[^'\r\n]|'')*'/, 'string'],
      [/"(?:[^"\r\n]|"")*"/, 'string'],
      [/'[^'\r\n]*$/, 'string.invalid'],
      [/"[^"\r\n]*$/, 'string.invalid'],
      [/\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [
        /[A-Za-z_\u0370-\u03ff\u1f00-\u1fff][A-Za-z_0-9\u0370-\u03ff\u1f00-\u1fff\u0300-\u036f]*/,
        {
          cases: {
            '@control': 'keyword.control',
            '@declarations': 'type.keyword',
            '@io': 'keyword.io',
            '@wordOperators': 'operator',
            '@constants': 'constant',
            '@default': 'identifier',
          },
        },
      ],
      [/<-|<=|>=|<>|[+\-*\/^=<>]/, 'operator'],
      [/[()[\]]/, '@brackets'],
      [/[,:;]/, 'delimiter'],
    ],
  },
}

export const glossaConfiguration: languages.LanguageConfiguration = {
  indentationRules: {
    increaseIndentPattern:
      /^\s*(ΑΝ.*ΤΟΤΕ|ΑΛΛΙΩΣ|ΑΛΛΙΩΣ_ΑΝ.*ΤΟΤΕ|ΟΣΟ.*ΕΠΑΝΑΛΑΒΕ|ΓΙΑ\s+.*|ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ|ΕΠΑΝΑΛΑΒΕ|ΕΠΙΛΕΞΕ.*|ΠΕΡΙΠΤΩΣΗ.*|ΑΡΧΗ|ΜΕΤΑΒΛΗΤΕΣ|ΣΤΑΘΕΡΕΣ)\s*(?:!.*)?$/i,
    decreaseIndentPattern:
      /^\s*(ΤΕΛΟΣ_ΑΝ|ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ|ΜΕΧΡΙΣ_ΟΤΟΥ.*|ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ|ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ|ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ|ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ|ΑΛΛΙΩΣ|ΑΛΛΙΩΣ_ΑΝ.*|ΠΕΡΙΠΤΩΣΗ.*|ΑΡΧΗ|ΜΕΤΑΒΛΗΤΕΣ|ΣΤΑΘΕΡΕΣ)\s*(?:!.*)?$/i,
  },
  comments: { lineComment: '!' },
  brackets: [
    ['(', ')'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
  ],
  surroundingPairs: [
    { open: '(', close: ')' },
    { open: '[', close: ']' },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
  wordPattern: /[A-Za-z_0-9\u0370-\u03ff\u1f00-\u1fff\u0300-\u036f]+/,
}

export function createGlossaTheme(
  dark: boolean,
  background = dark ? '#0f172a' : '#ffffff',
): editor.IStandaloneThemeData {
  const ink = dark ? 'f8fafc' : '0f172a'
  return {
    base: dark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: ink },
      { token: 'identifier', foreground: ink },
      { token: 'keyword.control', foreground: dark ? 'c084fc' : '9333ea', fontStyle: 'bold' },
      { token: 'type.keyword', foreground: dark ? '38bdf8' : '0284c7', fontStyle: 'bold' },
      { token: 'keyword.io', foreground: dark ? '38bdf8' : '0284c7', fontStyle: 'bold' },
      { token: 'operator', foreground: dark ? 'fb923c' : 'ea580c' },
      { token: 'string', foreground: dark ? '4ade80' : '16a34a' },
      { token: 'number', foreground: dark ? 'f472b6' : 'db2777' },
      { token: 'constant', foreground: dark ? 'f472b6' : 'db2777' },
      { token: 'comment', foreground: dark ? '94a3b8' : '64748b', fontStyle: 'italic' },
      { token: 'delimiter', foreground: ink },
    ],
    colors: {
      'editor.background': background,
      'editor.foreground': '#' + ink,
      'editorLineNumber.foreground': dark ? '#94a3b8' : '#64748b',
      'editorLineNumber.activeForeground': dark ? '#f8fafc' : '#0f172a',
      'editorCursor.foreground': dark ? '#38bdf8' : '#0284c7',
      'editor.selectionBackground': dark ? '#2563eb60' : '#93c5fd70',
      'editor.lineHighlightBackground': dark ? '#ffffff08' : '#0f172a06',
      'editorGutter.background': background,
    },
  }
}

type Monaco = typeof import('monaco-editor/editor/editor.api')
const registered = new WeakSet<Monaco>()

export function registerGlossaLanguage(monaco: Monaco): void {
  if (registered.has(monaco)) return
  if (!monaco.languages.getLanguages().some(language => language.id === GLOSSA_LANGUAGE_ID)) {
    monaco.languages.register({ id: GLOSSA_LANGUAGE_ID, aliases: ['ΓΛΩΣΣΑ', 'Glossa'], extensions: ['.gls'] })
  }
  monaco.languages.setLanguageConfiguration(GLOSSA_LANGUAGE_ID, glossaConfiguration)
  monaco.languages.setMonarchTokensProvider(GLOSSA_LANGUAGE_ID, glossaLanguage)
  monaco.languages.registerCompletionItemProvider(GLOSSA_LANGUAGE_ID, createGlossaCompletionProvider(monaco))
  monaco.languages.registerDocumentFormattingEditProvider(GLOSSA_LANGUAGE_ID, {
    provideDocumentFormattingEdits: model => [
      { range: model.getFullModelRange(), text: formatGlossa(model.getValue()) },
    ],
  })
  monaco.languages.registerOnTypeFormattingEditProvider(GLOSSA_LANGUAGE_ID, {
    autoFormatTriggerCharacters: ['\n', 'Ν', 'ν', 'Σ', 'σ', 'ς', 'Ω', 'ω', 'Η', 'η', 'Υ', 'υ'],
    provideOnTypeFormattingEdits: (model, position, character = '\n') => {
      const isNewline = character === '\n'
      if (
        !isNewline &&
        !glossaConfiguration.indentationRules!.decreaseIndentPattern.test(model.getLineContent(position.lineNumber))
      )
        return []
      // Στοιχίζουμε μόνο τη γραμμή που ολοκληρώθηκε και τη νέα γραμμή.
      // Η προσωρινή εντολή διατηρεί την εσοχή και όταν η νέα γραμμή είναι κενή.
      const lines = Array.from({ length: position.lineNumber }, (_, index) => model.getLineContent(index + 1))
      if (isNewline && !lines.at(-1)!.trim()) lines[lines.length - 1] = 'ΓΡΑΨΕ'
      const formatted = formatGlossa(lines.join('\n')).split('\n')
      return (isNewline ? [position.lineNumber - 1, position.lineNumber] : [position.lineNumber])
        .filter(line => line > 0)
        .flatMap(line => {
          const original = /^[ \t]*/.exec(model.getLineContent(line))![0]
          const indent = /^[ \t]*/.exec(formatted[line - 1])![0]
          return original === indent
            ? []
            : [
                {
                  range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: original.length + 1 },
                  text: indent,
                },
              ]
        })
    },
  })
  monaco.editor.defineTheme('glossa-light', createGlossaTheme(false))
  monaco.editor.defineTheme('glossa-dark', createGlossaTheme(true))
  for (const [name, background] of Object.entries({ monokai: '#272822', vscode: '#1e1e1e', contrast: '#000000' })) {
    monaco.editor.defineTheme('glossa-' + name, createGlossaTheme(true, background))
  }
  registered.add(monaco)
}

/** Ελληνικά, τόνοι και συνήθεις γραφές Greeklish οδηγούν στην ίδια πρόταση. */
function completionKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function greeklish(value: string, phonetic = false): string {
  const letters: Record<string, string> = {
    Α: 'A',
    Β: 'V',
    Γ: 'G',
    Δ: 'D',
    Ε: 'E',
    Ζ: 'Z',
    Η: phonetic ? 'I' : 'H',
    Θ: 'TH',
    Ι: 'I',
    Κ: 'K',
    Λ: 'L',
    Μ: 'M',
    Ν: 'N',
    Ξ: 'KS',
    Ο: 'O',
    Π: 'P',
    Ρ: 'R',
    Σ: 'S',
    Τ: 'T',
    Υ: phonetic ? 'I' : 'Y',
    Φ: 'F',
    Χ: 'X',
    Ψ: 'PS',
    Ω: 'O',
  }
  return [...completionKey(value)].map(letter => letters[letter] ?? letter).join('')
}

const glossaSnippets: Record<string, string> = {
  ΑΝ: 'ΑΝ ${1:συνθήκη} ΤΟΤΕ\n    $0\nΤΕΛΟΣ_ΑΝ',
  ΑΛΛΙΩΣ_ΑΝ: 'ΑΛΛΙΩΣ_ΑΝ ${1:συνθήκη} ΤΟΤΕ\n    $0',
  ΑΛΛΙΩΣ: 'ΑΛΛΙΩΣ\n    $0',
  ΟΣΟ: 'ΟΣΟ ${1:συνθήκη} ΕΠΑΝΑΛΑΒΕ\n    $0\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ',
  ΓΙΑ: 'ΓΙΑ ${1:i} ΑΠΟ ${2:1} ΜΕΧΡΙ ${3:10}\n    $0\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ',
  ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ: 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n    $0\nΜΕΧΡΙΣ_ΟΤΟΥ ${1:συνθήκη}',
  ΕΠΙΛΕΞΕ: 'ΕΠΙΛΕΞΕ ${1:έκφραση}\n    ΠΕΡΙΠΤΩΣΗ ${2:τιμή}\n        $0\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ',
  ΠΕΡΙΠΤΩΣΗ: 'ΠΕΡΙΠΤΩΣΗ ${1:τιμή}\n    $0',
  'ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ': 'ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\n    $0',
  ΠΡΟΓΡΑΜΜΑ: 'ΠΡΟΓΡΑΜΜΑ ${1:Όνομα}\nΜΕΤΑΒΛΗΤΕΣ\n    ΑΚΕΡΑΙΕΣ: $2\nΑΡΧΗ\n    $0\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ',
  ΔΙΑΔΙΚΑΣΙΑ: 'ΔΙΑΔΙΚΑΣΙΑ ${1:Όνομα}(${2:παράμετροι})\nΜΕΤΑΒΛΗΤΕΣ\n    ${3:δηλώσεις}\nΑΡΧΗ\n    $0\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ',
  ΣΥΝΑΡΤΗΣΗ:
    'ΣΥΝΑΡΤΗΣΗ ${1:Όνομα}(${2:παράμετροι}): ${3:ΠΡΑΓΜΑΤΙΚΗ}\nΜΕΤΑΒΛΗΤΕΣ\n    ${4:δηλώσεις}\nΑΡΧΗ\n    $1 <- $0\nΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ',
  ΔΙΑΒΑΣΕ: 'ΔΙΑΒΑΣΕ ${1:μεταβλητή}',
  ΓΡΑΨΕ: 'ΓΡΑΨΕ ${1:έκφραση}',
  ΚΑΛΕΣΕ: 'ΚΑΛΕΣΕ ${1:Διαδικασία}(${2:παράμετροι})',
}

const completionAliases: Record<string, string[]> = {
  Τ_Ρ: ['τετ_ριζα', 'τετραγωνικη_ριζα'],
  Α_Τ: ['αρχ_τιμη', 'απολυτη_τιμη'],
  Α_Μ: ['ακεραιο_μερος'],
  ΓΙΑ: ['gia'],
  ΣΥΝ: ['syn', 'sin'],
}

/** Η τελευταία ενότητα πριν από τον κέρσορα ανήκει στο τρέχον πρόγραμμα/υποπρόγραμμα. */
export function getGlossaCompletionContext(model: editor.ITextModel, position: { lineNumber: number; column: number }) {
  let section: 'outside' | 'variables' | 'constants' | 'body' = 'outside'
  for (let line = 1; line <= position.lineNumber; line++) {
    const text = model.getLineContent(line)
    const beforeCursor = line === position.lineNumber ? text.slice(0, position.column - 1) : text
    const code = completionKey(beforeCursor.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|!.*/g, '')).trim()
    if (code === 'ΜΕΤΑΒΛΗΤΕΣ') section = 'variables'
    else if (code === 'ΣΤΑΘΕΡΕΣ') section = 'constants'
    else if (code === 'ΑΡΧΗ') section = 'body'
    else if (
      /^(?:ΠΡΟΓΡΑΜΜΑ|ΣΥΝΑΡΤΗΣΗ|ΔΙΑΔΙΚΑΣΙΑ)(?:\s|$)/.test(code) ||
      /^(?:ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ|ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ|ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ)$/.test(code)
    )
      section = 'outside'
  }
  return { isInsideVariablesSection: section === 'variables', isInsideMainBody: section === 'body' }
}

/** Προτάσεις με πραγματικά snippet tab stops και αντικατάσταση ολόκληρης λέξης. */
export function createGlossaCompletionProvider(monaco: Monaco): languages.CompletionItemProvider {
  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages
  const functions = ['ΗΜ', 'ΣΥΝ', 'ΕΦ', 'Τ_Ρ', 'Α_Τ', 'Α_Μ', 'ΛΟΓ', 'Ε']
  const declarationTypes = new Set(['ΑΚΕΡΑΙΕΣ', 'ΠΡΑΓΜΑΤΙΚΕΣ', 'ΧΑΡΑΚΤΗΡΕΣ', 'ΛΟΓΙΚΕΣ'])
  const returnTypes = new Set(['ΑΚΕΡΑΙΑ', 'ΠΡΑΓΜΑΤΙΚΗ', 'ΧΑΡΑΚΤΗΡΑΣ', 'ΛΟΓΙΚΗ'])
  const executableCommands = new Set(['ΔΙΑΒΑΣΕ', 'ΓΡΑΨΕ', 'ΑΝ', 'ΟΣΟ', 'ΓΙΑ', 'ΕΠΙΛΕΞΕ', 'ΚΑΛΕΣΕ'])
  const words = [
    ...new Set([
      ...glossaLanguage.control,
      ...glossaLanguage.declarations,
      ...glossaLanguage.io,
      ...glossaLanguage.wordOperators,
      ...glossaLanguage.constants,
      ...Object.keys(glossaSnippets),
      ...functions,
      'ΜΕ ΒΗΜΑ',
    ]),
  ] as string[]
  return {
    triggerCharacters: [
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZαβγδεζηθικλμνξοπρσςτυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩάέήίόύώΆΈΉΊΌΎΏϊΐϋΰΪΫ_',
    ],
    provideCompletionItems: (model, position) => {
      const before = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
      // Τα ! μέσα σε αλφαριθμητικά δεν ξεκινούν σχόλιο· τα διπλά εισαγωγικά διαφεύγουν.
      let quote = ''
      for (let index = 0; index < before.length; index++) {
        const character = before[index]
        if (quote) {
          if (character === quote) {
            if (before[index + 1] === quote) index++
            else quote = ''
          }
        } else if (character === '!') return { suggestions: [] }
        else if (character === "'" || character === '"') quote = character
      }
      if (quote) return { suggestions: [] }
      const { isInsideVariablesSection, isInsideMainBody } = getGlossaCompletionContext(model, position)
      const word = model.getWordUntilPosition(position)
      const isFunctionReturnType = /^\s*ΣΥΝΑΡΤΗΣΗ\s+.*\)\s*:\s*$/.test(
        completionKey(before.slice(0, word.startColumn - 1)),
      )
      const prefix = completionKey(word.word)
      const wholeWord = model.getWordAtPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: wholeWord?.endColumn ?? word.endColumn,
      }
      const priority = (label: string) =>
        (isInsideMainBody && executableCommands.has(label)) || (isInsideVariablesSection && declarationTypes.has(label))
          ? 0
          : 1
      const matches = words
        .filter(label => !declarationTypes.has(label) || isInsideVariablesSection)
        .filter(label => !returnTypes.has(label) || isFunctionReturnType)
        .filter(label =>
          [label, ...(completionAliases[label] ?? [])]
            .flatMap(alias => [
              completionKey(alias),
              greeklish(alias),
              greeklish(alias, true),
              greeklish(alias).replace(/X/g, 'CH'),
              greeklish(alias, true).replace(/X/g, 'CH'),
            ])
            .some(alias => alias.startsWith(prefix)),
        )
        .sort((left, right) => priority(left) - priority(right))
      return {
        incomplete: true,
        suggestions: matches.map((label, index) => {
          const isFunction = functions.includes(label)
          const snippet = glossaSnippets[label] ?? (isFunction ? label + '(${1:x})' : undefined)
          return {
            label,
            kind: isFunction
              ? CompletionItemKind.Function
              : snippet
                ? CompletionItemKind.Snippet
                : CompletionItemKind.Keyword,
            detail: isFunction
              ? 'Ενσωματωμένη συνάρτηση ΓΛΩΣΣΑΣ'
              : snippet
                ? 'Σκελετός ΓΛΩΣΣΑΣ · Tab για επόμενο πεδίο'
                : 'Λέξη-κλειδί ΓΛΩΣΣΑΣ',
            insertText: snippet ?? label,
            insertTextRules: snippet ? CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            // Το Monaco φιλτράρει ξανά: κρατάμε και το αρχικό Greeklish/τονισμένο πρόθεμα.
            filterText: word.word + label,
            sortText: String(index).padStart(3, '0'),
            preselect: index === 0,
            range,
          }
        }),
      }
    },
  }
}

/** Στοίχιση με τέσσερα κενά, χωρίς αλλαγή του περιεχομένου των γραμμών. */
export function formatGlossa(source: string): string {
  const stack: string[] = []
  return source
    .split(/(\r?\n)/)
    .map((line, index) => {
      if (index % 2) return line
      const text = line.trimStart()
      if (!text) return ''
      const code = text
        .replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|!.*/g, token => (token.startsWith('!') ? '' : token))
        .trim()
        .toUpperCase()
      if (
        /^(ΠΡΟΓΡΑΜΜΑ|ΔΙΑΔΙΚΑΣΙΑ|ΣΥΝΑΡΤΗΣΗ)\s/.test(code) ||
        /^(ΜΕΤΑΒΛΗΤΕΣ|ΣΤΑΘΕΡΕΣ|ΑΡΧΗ|ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ|ΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ|ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ)$/.test(code)
      )
        stack.length = 0
      else if (/^ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ$/.test(code)) {
        if (stack.at(-1) === 'case') stack.pop()
        if (stack.at(-1) === 'select') stack.pop()
      } else if (/^ΠΕΡΙΠΤΩΣΗ(?:\s|$)/.test(code)) {
        if (stack.at(-1) === 'case') stack.pop()
      } else if (/^(ΤΕΛΟΣ_ΑΝ|ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ)$|^ΜΕΧΡΙΣ_ΟΤΟΥ\s|^ΑΛΛΙΩΣ(?:_ΑΝ\s.*|$)/.test(code)) stack.pop()
      const formatted = ' '.repeat(stack.length * 4) + text
      if (/^ΕΠΙΛΕΞΕ(?:\s|$)/.test(code)) stack.push('select')
      else if (/^ΠΕΡΙΠΤΩΣΗ(?:\s|$)/.test(code)) stack.push('case')
      else if (glossaConfiguration.indentationRules!.increaseIndentPattern.test(code)) stack.push('block')
      return formatted
    })
    .join('')
}
