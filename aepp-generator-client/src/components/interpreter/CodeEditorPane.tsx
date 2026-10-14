import './debugger.css'
import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { normalize } from '../../interpreter/types'
import { highlightWords } from '../../interpreter/parser'
import { followLineScroll } from './editorScroll'
import { useSettings } from '../../settings/SettingsContext'
import { pairedEdit } from '../../settings/editorKeys'
import type { CSSProperties } from 'react'
import type { CommandSnippet } from '../../interpreter/examples'

export interface EditorHandle { getValue: () => string; insert: (command: CommandSnippet) => void; focus: () => void; syncHighlight: () => void; replace: (value: string) => void }
interface Props { breakpoints?: readonly number[]; onToggleBreakpoint?: (line: number) => void; initialValue: string; onSourceChange: (value: string) => void; activeLine: number | null; errorLine: number | null; showLint?: boolean; changeSummary?: string; followEvent?: unknown; onCursorChange?: (cursor: { line: number; column: number }) => void }
const fragments = /('[^']*(?:''[^']*)*'?|![^\n]*|[\p{L}_][\p{L}\p{N}_]*|\d+(?:\.\d+)?)/gu

function highlight(line: string) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(fragments)) {
    const index = match.index
    if (index > last) parts.push(line.slice(last, index))
    const word = match[0]
    const token = word.startsWith('!') ? 'comment' : word.startsWith("'") ? 'string' : /^\d/u.test(word) ? 'number' : highlightWords.has(normalize(word)) ? 'keyword' : 'identifier'
    parts.push(<span className={'glossa-token-' + token + (token === 'keyword' ? ' font-semibold' : '')} key={`${index}-${word}`}>{word}</span>)
    last = index + word.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

const CodeEditorPane = memo(forwardRef<EditorHandle, Props>(function CodeEditorPane({ initialValue, onSourceChange, activeLine, errorLine, showLint = true, changeSummary = '', followEvent, onCursorChange, breakpoints = [], onToggleBreakpoint }, handle) {
  const { settings, editorTheme } = useSettings()
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

  function reportCursor() {
    const input = inputRef.current
    if (!input) return
    const before = input.value.slice(0, input.selectionStart)
    onCursorChange?.({ line: before.split('\n').length, column: before.length - before.lastIndexOf('\n') })
  }
  function commit(value: string) {
    reportCursor()
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

  useLayoutEffect(() => {
    const input=inputRef.current, pre=backdrop.current
    if (!input || !pre) return
    function alignAndFollow() {
      if (!input || !pre || input.clientHeight<=0) return
      pre.style.width=input.clientWidth+'px'
      const rows=Array.from(pre.children) as HTMLElement[]
      rows.forEach((row,i)=>{const label=gutter.current?.children[i] as HTMLElement|undefined;if(label)label.style.height=row.offsetHeight+'px'})
      const line=errorLine ?? activeLine
      if(line!==null) {
        const row=rows[line-1],style=window.getComputedStyle(input)
        if(settings.wordWrap && row) {
          const top=row.offsetTop,bottom=top+row.offsetHeight,pad=24
          if(top<input.scrollTop+pad)input.scrollTop=Math.max(0,top-pad)
          else if(bottom>input.scrollTop+input.clientHeight-pad)input.scrollTop=Math.min(input.scrollHeight-input.clientHeight,bottom-input.clientHeight+pad)
        } else input.scrollTop=followLineScroll(line,parseFloat(style.lineHeight),parseFloat(style.paddingTop)||0,input.clientHeight,input.scrollTop,input.scrollHeight)
      }
      pre.scrollTop=input.scrollTop;pre.scrollLeft=input.scrollLeft
      if(gutter.current)gutter.current.scrollTop=input.scrollTop
    }
    alignAndFollow()
    const observer=new ResizeObserver(alignAndFollow);observer.observe(input)
    return()=>observer.disconnect()
  }, [activeLine,errorLine,followEvent,highlightedSource,settings.fontSize,settings.wordWrap,settings.lineNumbers])

  useImperativeHandle(handle, () => ({
    getValue: () => source.current,
    replace: (value: string) => { const input = inputRef.current; if (!input) return; input.value = value; input.setSelectionRange(0, 0); commit(value); },
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
  return <div className={"ide-editor-pane" + (settings.wordWrap ? " ide-editor-wrap" : "")} data-editor-theme={editorTheme} data-color-mode={settings.theme} style={{"--editor-font-size":settings.fontSize+"px","--editor-line-height":settings.fontSize*1.65+"px","--editor-tab-size":settings.tabSize} as CSSProperties}>
    <div className={`ide-editor-shell${typing ? ' ide-typing' : ''}`}>
      <div className={'ide-gutter' + (onToggleBreakpoint ? ' ide-debug-gutter' : '')} hidden={!settings.lineNumbers && !onToggleBreakpoint} ref={gutter} aria-hidden={onToggleBreakpoint ? undefined : true}>{lines.map((_, index) => <div key={index} className={errorLine === index + 1 ? 'error-line' : activeLine === index + 1 ? changeSummary ? 'ide-active-line ide-updated-line' : 'ide-active-line' : ''}>{onToggleBreakpoint ? <button type="button" className={'ide-breakpoint-toggle' + (breakpoints.includes(index + 1) ? ' ide-has-breakpoint' : '')} aria-pressed={breakpoints.includes(index + 1)} aria-label={(breakpoints.includes(index + 1) ? 'Αφαίρεση' : 'Προσθήκη') + ' σημείου διακοπής στη γραμμή ' + (index + 1)} title={'Σημείο διακοπής · γραμμή ' + (index + 1)} onMouseDown={event => event.preventDefault()} onClick={() => onToggleBreakpoint(index + 1)}><span className="ide-breakpoint-dot" aria-hidden="true" />{settings.lineNumbers ? index + 1 : '·'}</button> : index + 1}</div>)}</div>
      <div className="ide-code-area">
        <pre ref={backdrop} aria-hidden="true" className="ide-highlight">{lines.map((_, index) => <div key={index} className={errorLine === index + 1 ? 'error-line' : activeLine === index + 1 ? changeSummary ? 'ide-active-line ide-updated-line' : 'ide-active-line' : ''}>{colored[index].length ? colored[index] : '\u200b'}</div>)}</pre>
        <textarea wrap={settings.wordWrap ? "soft" : "off"} ref={inputRef} onSelect={reportCursor} defaultValue={initialValue} onChange={event => commit(event.currentTarget.value)} onScroll={event => { if (backdrop.current) { backdrop.current.scrollTop = event.currentTarget.scrollTop; backdrop.current.scrollLeft = event.currentTarget.scrollLeft } if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop }} onKeyDown={event => {
          if(event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey)return
          const input=event.currentTarget
          if(event.key==='Tab') {event.preventDefault();input.setRangeText(' '.repeat(settings.tabSize),input.selectionStart,input.selectionEnd,'end');commit(input.value);return}
          if(!settings.autoClose)return
          const operation=pairedEdit(input.value,input.selectionStart,input.selectionEnd,event.key)
          if(operation){event.preventDefault();input.setRangeText(operation.text,operation.start,operation.end,'end');input.setSelectionRange(operation.caret,operation.caret);commit(input.value)}
        }} spellCheck={false} aria-label="Επεξεργαστής κώδικα ΓΛΩΣΣΑΣ" className="ide-textarea" />
      </div>
    </div>
    {changeSummary && <p role="status" className="ide-change-summary">Ενημέρωση: {changeSummary}</p>}
    {showLint && <p role="status" className={`ide-lint ${errorLine ? 'ide-lint-error' : ''}`}>{errorLine ? 'Βρέθηκε σφάλμα. Δες την κονσόλα.' : 'Ο έλεγχος σφαλμάτων ξεκινά όταν πατήσεις «Εκτέλεση» ή «Βήμα-Βήμα».'}</p>}
  </div>
}))

export default CodeEditorPane
