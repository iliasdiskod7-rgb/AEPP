import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { normalize } from '../../interpreter/types'
import { highlightWords } from '../../interpreter/parser'
import type { CommandSnippet } from '../../interpreter/examples'

export interface EditorHandle { getValue: () => string; insert: (command: CommandSnippet) => void; focus: () => void; syncHighlight: () => void }
interface Props { initialValue: string; onSourceChange: (value: string) => void; activeLine: number | null; errorLine: number | null }
const fragments = /('[^']*(?:''[^']*)*'?|![^\n]*|[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?)/gu

function highlight(line: string) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(fragments)) {
    const index = match.index
    if (index > last) parts.push(line.slice(last, index))
    const word = match[0]
    const tone = word.startsWith('!') ? 'text-slate-400' : word.startsWith("'") ? 'text-emerald-700'
      : /^\d/u.test(word) ? 'text-amber-700' : highlightWords.has(normalize(word)) ? 'text-blue-700 font-semibold' : 'text-slate-800'
    parts.push(<span className={tone} key={`${index}-${word}`}>{word}</span>)
    last = index + word.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

const CodeEditorPane = memo(forwardRef<EditorHandle, Props>(function CodeEditorPane({ initialValue, onSourceChange, activeLine, errorLine }, handle) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const backdrop = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const source = useRef(initialValue)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const [highlightedSource, setHighlightedSource] = useState(initialValue)
  const [typing, setTyping] = useState(false)

  function schedule(value: string) {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setHighlightedSource(value)
      dirty.current = false
      setTyping(false)
    }, 400)
  }

  function commit(value: string) {
    source.current = value
    onSourceChange(value)
    if (!dirty.current) {
      dirty.current = true
      setTyping(true)
    }
    schedule(value)
  }

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  useImperativeHandle(handle, () => ({
    getValue: () => source.current,
    focus: () => inputRef.current?.focus(),
    syncHighlight: () => {
      if (timer.current) clearTimeout(timer.current)
      setHighlightedSource(source.current)
      dirty.current = false
      setTyping(false)
    },
    insert: (command: CommandSnippet) => {
      const input = inputRef.current
      if (!input) return
      const start = input.selectionStart, end = input.selectionEnd
      let inserted = command.insert + ' '
      if (command.kind === 'block') {
        const before = source.current.slice(0, start)
        const after = source.current.slice(end)
        const lineStart = before.lastIndexOf('\n') + 1
        const indent = /^\s*/u.exec(before.slice(lineStart))?.[0] ?? ''
        const prefix = before.slice(lineStart).trim() ? '\n' + indent : ''
        const body = command.insert.split('\n').map((line, index) => index ? indent + line : line).join('\n')
        const suffix = after && !after.startsWith('\n') ? '\n' + indent : ''
        inserted = prefix + body + suffix
      }
      input.setRangeText(inserted, start, end, 'end')
      commit(input.value)
      input.focus()
    },
  }))

  const lines = useMemo(() => highlightedSource.split('\n'), [highlightedSource])
  const colored = useMemo(() => lines.map(highlight), [lines])
  return <div>
    <div className={`ide-editor-shell${typing ? ' ide-typing' : ''}`}>
      <div className="ide-gutter" ref={gutter} aria-hidden="true">{lines.map((_, index) => <div key={index} className={errorLine === index + 1 ? 'error-line' : activeLine === index + 1 ? 'ide-active-line' : ''}>{index + 1}</div>)}</div>
      <div className="ide-code-area">
        <pre ref={backdrop} aria-hidden="true" className="ide-highlight">{lines.map((_, index) => <div key={index} className={errorLine === index + 1 ? 'error-line' : activeLine === index + 1 ? 'ide-active-line' : ''}>{colored[index]}{'\n'}</div>)}</pre>
        <textarea ref={inputRef} defaultValue={initialValue} onChange={event => commit(event.currentTarget.value)} onScroll={event => { if (backdrop.current) { backdrop.current.scrollTop = event.currentTarget.scrollTop; backdrop.current.scrollLeft = event.currentTarget.scrollLeft } if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop }} onKeyDown={event => {
          if (event.key !== 'Tab') return
          event.preventDefault()
          const input = event.currentTarget
          input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end')
          commit(input.value)
        }} spellCheck={false} aria-label="Επεξεργαστής κώδικα ΓΛΩΣΣΑΣ" className="ide-textarea" />
      </div>
    </div>
    <p role="status" className={`ide-lint ${errorLine ? 'ide-lint-error' : ''}`}>{errorLine ? 'Βρέθηκε σφάλμα. Δες την κονσόλα.' : 'Ο έλεγχος σφαλμάτων ξεκινά όταν πατήσεις «Εκτέλεση» ή «Βήμα-Βήμα».'}</p>
  </div>
}))

export default CodeEditorPane
