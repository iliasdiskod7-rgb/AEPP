import './debugger.css'
import './monacoEditor.css'
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { editor } from 'monaco-editor'
import { useSettings } from '../../settings/SettingsContext'
import type { CommandSnippet } from '../../interpreter/examples'

export interface EditorHandle {
  getValue: () => string
  insert: (command: CommandSnippet) => void
  focus: () => void
  syncHighlight: () => void
  replace: (value: string) => void
}
interface Props {
  breakpoints?: readonly number[]
  onToggleBreakpoint?: (line: number) => void
  initialValue: string
  onSourceChange: (value: string) => void
  activeLine: number | null
  errorLine: number | null
  showLint?: boolean
  changeSummary?: string
  followEvent?: unknown
  onCursorChange?: (cursor: { line: number; column: number }) => void
}
type Monaco = typeof import('monaco-editor/editor/editor.api')

const CodeEditorPane = memo(
  forwardRef<EditorHandle, Props>(function CodeEditorPane(props, handle) {
    const { settings, editorTheme } = useSettings()
    const host = useRef<HTMLDivElement>(null)
    const instance = useRef<editor.IStandaloneCodeEditor | null>(null)
    const api = useRef<Monaco | null>(null)
    const source = useRef(props.initialValue)
    const current = useRef({ props, settings, editorTheme })
    current.current = { props, settings, editorTheme }
    const [ready, setReady] = useState(false)
    const [loadError, setLoadError] = useState(false)

    useEffect(() => {
      let cancelled = false
      let dispose = () => {}
      void import('../../interpreter/monacoSetup')
        .then(({ monaco }) => {
          if (cancelled || !host.current) return
          api.current = monaco
          const model = monaco.editor.createModel(source.current, 'glossa')
          const codeEditor = monaco.editor.create(host.current, {
            model,
            automaticLayout: true,
            autoIndent: 'full',
            formatOnType: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            tabCompletion: 'on',
            snippetSuggestions: 'top',
            suggestSelection: 'first',
            wordBasedSuggestions: 'off',
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            ariaLabel: 'Επεξεργαστής κώδικα ΓΛΩΣΣΑΣ',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: current.current.settings.fontSize,
            lineHeight: Math.round(current.current.settings.fontSize * 1.65),
            glyphMargin: Boolean(current.current.props.onToggleBreakpoint),
            stickyScroll: { enabled: false },
            unicodeHighlight: { ambiguousCharacters: false, nonBasicASCII: false },
            renderValidationDecorations: 'on',
            padding: { top: 12, bottom: 12 },
          })
          instance.current = codeEditor
          const content = codeEditor.onDidChangeModelContent(() => {
            source.current = codeEditor.getValue()
            current.current.props.onSourceChange(source.current)
          })
          const cursor = codeEditor.onDidChangeCursorPosition(event => {
            current.current.props.onCursorChange?.({ line: event.position.lineNumber, column: event.position.column })
          })
          const mouse = codeEditor.onMouseDown(event => {
            if (event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN && event.target.position) {
              current.current.props.onToggleBreakpoint?.(event.target.position.lineNumber)
            }
          })
          const toggleBreakpoint = codeEditor.addAction({
            id: 'glossa-toggle-breakpoint',
            label: 'Εναλλαγή σημείου διακοπής',
            keybindings: [monaco.KeyCode.F9],
            run: editor => {
              const position = editor.getPosition()
              if (position) current.current.props.onToggleBreakpoint?.(position.lineNumber)
            },
          })
          dispose = () => {
            toggleBreakpoint.dispose()
            content.dispose()
            cursor.dispose()
            mouse.dispose()
            codeEditor.dispose()
            model.dispose()
            instance.current = null
            api.current = null
          }
          setReady(true)
        })
        .catch(error => {
          if (!cancelled) {
            console.error('Αποτυχία φόρτωσης του επεξεργαστή ΓΛΩΣΣΑΣ', error)
            setLoadError(true)
          }
        })
      return () => {
        cancelled = true
        dispose()
      }
    }, [])

    useEffect(() => {
      const monaco = api.current,
        codeEditor = instance.current
      if (!ready || !monaco || !codeEditor) return
      const isDarkMode = settings.theme === 'dark'
      monaco.editor.setTheme(isDarkMode ? 'glossa-dark' : 'glossa-light')
      if (isDarkMode && editorTheme !== 'dark-default') monaco.editor.setTheme('glossa-' + editorTheme)
      codeEditor.updateOptions({
        fontSize: settings.fontSize,
        lineHeight: Math.round(settings.fontSize * 1.65),
        wordWrap: settings.wordWrap ? 'on' : 'off',
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        glyphMargin: Boolean(props.onToggleBreakpoint),
        autoClosingBrackets: settings.autoClose ? 'languageDefined' : 'never',
        autoClosingQuotes: settings.autoClose ? 'languageDefined' : 'never',
        autoSurround: settings.autoClose ? 'languageDefined' : 'never',
      })
      codeEditor.getModel()?.updateOptions({ tabSize: 4, indentSize: 4, insertSpaces: true })
    }, [
      ready,
      settings.theme,
      editorTheme,
      settings.fontSize,
      settings.wordWrap,
      settings.lineNumbers,
      settings.tabSize,
      settings.autoClose,
      props.onToggleBreakpoint,
    ])

    useEffect(() => {
      const codeEditor = instance.current,
        monaco = api.current
      if (!ready || !codeEditor || !monaco) return
      const decorations = codeEditor.createDecorationsCollection()
      const entries: editor.IModelDeltaDecoration[] =
        props.breakpoints?.map(line => ({
          range: new monaco.Range(line, 1, line, 1),
          options: { glyphMarginClassName: 'glossa-breakpoint', glyphMarginHoverMessage: { value: 'Σημείο διακοπής' } },
        })) ?? []
      const line = props.errorLine ?? props.activeLine
      if (line !== null && line >= 1 && line <= (codeEditor.getModel()?.getLineCount() ?? 0)) {
        entries.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: props.errorLine
              ? 'glossa-error-line'
              : props.changeSummary
                ? 'glossa-updated-line'
                : 'glossa-active-line',
          },
        })
        codeEditor.revealLineInCenterIfOutsideViewport(line)
      }
      decorations.set(entries)
      return () => decorations.clear()
    }, [ready, props.breakpoints, props.activeLine, props.errorLine, props.changeSummary, props.followEvent])

    useImperativeHandle(
      handle,
      () => ({
        getValue: () => instance.current?.getValue() ?? source.current,
        focus: () => instance.current?.focus(),
        syncHighlight: () => instance.current?.render(true),
        replace: value => {
          source.current = value
          if (instance.current) {
            instance.current.setValue(value)
            instance.current.setPosition({ lineNumber: 1, column: 1 })
          } else current.current.props.onSourceChange(value)
        },
        insert: command => {
          const codeEditor = instance.current
          const model = codeEditor?.getModel(),
            selection = codeEditor?.getSelection()
          if (!codeEditor || !model || !selection) return
          let text = command.insert + ' '
          if (command.kind === 'block') {
            const before = model.getValue().slice(0, model.getOffsetAt(selection.getStartPosition()))
            const after = model.getValue().slice(model.getOffsetAt(selection.getEndPosition()))
            const line = before.slice(before.lastIndexOf('\n') + 1)
            const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
            text =
              (line.trim() ? '\n' + indent : '') +
              command.insert
                .split('\n')
                .map((part, index) => (index ? indent + part : part))
                .join('\n') +
              (after && !after.startsWith('\n') ? '\n' + indent : '')
          }
          codeEditor.pushUndoStop()
          codeEditor.executeEdits('glossa-command', [{ range: selection, text, forceMoveMarkers: true }])
          codeEditor.pushUndoStop()
          codeEditor.focus()
        },
      }),
      [],
    )

    return (
      <div className="ide-editor-pane" data-editor-theme={editorTheme} data-color-mode={settings.theme}>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void instance.current?.getAction('editor.action.formatDocument')?.run()}
          className="rounded border px-3 py-1 text-sm"
          title="Shift + Alt + F"
        >
          🧹 Στοίχιση
        </button>
        <div className="ide-editor-shell glossa-monaco-shell">
          <div ref={host} className="glossa-monaco-host" />
          {!ready && !loadError && (
            <p className="glossa-editor-loading" role="status">
              Φόρτωση επεξεργαστή…
            </p>
          )}
          {loadError && (
            <p className="glossa-editor-loading" role="alert">
              Δεν φορτώθηκε ο επεξεργαστής. Ανανέωσε τη σελίδα.
            </p>
          )}
        </div>
        {props.changeSummary && (
          <p role="status" className="ide-change-summary">
            Ενημέρωση: {props.changeSummary}
          </p>
        )}
        {props.showLint !== false && (
          <p role="status" className={'ide-lint' + (props.errorLine ? ' ide-lint-error' : '')}>
            {props.errorLine
              ? 'Βρέθηκε σφάλμα. Δες την κονσόλα.'
              : 'Ο έλεγχος σφαλμάτων ξεκινά όταν πατήσεις «Εκτέλεση» ή «Βήμα-Βήμα».'}
          </p>
        )}
      </div>
    )
  }),
)
export default CodeEditorPane
