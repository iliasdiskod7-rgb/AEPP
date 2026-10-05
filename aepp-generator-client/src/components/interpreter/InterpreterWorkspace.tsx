import { useCallback, useRef, useState } from 'react'
import { Play, RotateCcw, StepForward } from 'lucide-react'
import CodeEditorPane, { type EditorHandle } from './CodeEditorPane'
import CommandGuide from './CommandGuide'
import RuntimePanel from './RuntimePanel'
import { starterProgram, type CommandSnippet } from '../../interpreter/examples'
import { parseProgram } from '../../interpreter/parser'
import { Interpreter, parseInput } from '../../interpreter/runtime'
import type { ExecutionEvent, Value } from '../../interpreter/types'
import { toDiagnostic, type Diagnostic } from '../../interpreter/diagnostics'
import './interpreter.css'

const STEPS_PER_FRAME = 500
export default function InterpreterWorkspace({ sourceStore }: { sourceStore?: { current: string } }) {
  const [event, setEvent] = useState<ExecutionEvent | null>(null)
  const [executionDiagnostic, setExecutionDiagnostic] = useState<Diagnostic | null>(null)
  const [status, setStatus] = useState('Έτοιμο για εκτέλεση.')
  const editorRef = useRef<EditorHandle>(null)
  const sourceRef = useRef(sourceStore?.current ?? starterProgram)
  const executionTouched = useRef(false)
  const runner = useRef<Generator<ExecutionEvent, void, Value | undefined> | null>(null)
  const compiledSource = useRef('')
  const runContinuously = useRef(false)

  const onSourceChange = useCallback((value: string) => {
    sourceRef.current = value
    if (sourceStore) sourceStore.current = value
    if (!executionTouched.current) return
    runner.current = null
    compiledSource.current = ''
    executionTouched.current = false
    setEvent(null)
    setExecutionDiagnostic(null)
    setStatus('Έτοιμο για εκτέλεση.')
  }, [sourceStore])

  function reset() {
    runner.current = null
    compiledSource.current = ''
    setEvent(null)
    setExecutionDiagnostic(null)
    setStatus('Έτοιμο για εκτέλεση.')
    executionTouched.current = false
  }

  function prepare() {
    if (runner.current && compiledSource.current === sourceRef.current) return runner.current
    editorRef.current?.syncHighlight()
    setExecutionDiagnostic(null)
    const program = parseProgram(sourceRef.current)
    runner.current = new Interpreter(program).execute()
    compiledSource.current = sourceRef.current
    return runner.current
  }

  function advance(continuous: boolean, supplied?: Value, resume = false) {
    executionTouched.current = true
    if (!resume && event?.kind === 'input' && supplied === undefined && runner.current) {
      setExecutionDiagnostic({ line: event.line, category: 'runtime', description: `Δώσε πρώτα τιμή για τη μεταβλητή «${event.name}».` })
      return
    }
    runContinuously.current = continuous
    try {
      const iterator = prepare()
      let next = iterator.next(supplied)
      let processed = 0
      while (!next.done) {
        const current = next.value
        setEvent(current)
        if (current.kind === 'input') { setStatus(`Αναμονή εισόδου για τη μεταβλητή ${current.name}.`); return }
        if (current.kind === 'done') { setStatus('Η εκτέλεση ολοκληρώθηκε.'); runner.current = null; return }
        if (!continuous) { setStatus(`Εκτελέστηκε η γραμμή ${current.line}.`); return }
        if (++processed >= STEPS_PER_FRAME) {
          window.setTimeout(() => { if (runner.current === iterator && runContinuously.current) advance(true, undefined, true) }, 0)
          return
        }
        next = iterator.next()
      }
      setStatus('Η εκτέλεση ολοκληρώθηκε.')
      runner.current = null
    } catch (cause) {
      setExecutionDiagnostic(toDiagnostic(cause))
      setStatus('Η εκτέλεση σταμάτησε.')
      runner.current = null
    }
  }

  function submitInput(text: string): boolean {
    if (event?.kind !== 'input') return false
    try { const value = parseInput(text, event.type, event.line); setExecutionDiagnostic(null); advance(runContinuously.current, value); return true }
    catch (cause) { setExecutionDiagnostic(toDiagnostic(cause, 'type')); return false }
  }

  const insert = useCallback((command: CommandSnippet) => editorRef.current?.insert(command), [])
  const diagnostic = executionDiagnostic

  return <section className="mx-auto max-w-[1500px]" aria-labelledby="ide-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-semibold tracking-wide text-blue-700">ΕΡΓΑΣΤΗΡΙΟ ΓΛΩΣΣΑΣ</p><h1 id="ide-title" className="text-2xl font-bold tracking-tight text-slate-900">Διερμηνευτής ΓΛΩΣΣΑΣ</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Γράψε ένα πρόγραμμα, εκτέλεσέ το ή παρακολούθησε κάθε βήμα και τις τιμές των μεταβλητών.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">Πρώτη λειτουργική έκδοση</span></div>
    <div className="ide-grid">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="editor-title"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div><h2 id="editor-title" className="font-semibold text-slate-900">Κώδικας</h2><p className="text-xs text-slate-500">Η επισήμανση της γραμμής δείχνει το τελευταίο βήμα.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => advance(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"><Play size={15} />Εκτέλεση</button><button type="button" onClick={() => advance(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><StepForward size={15} />Βήμα-Βήμα</button><button type="button" onClick={() => reset()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw size={15} />Επαναφορά</button></div></div><CodeEditorPane ref={editorRef} initialValue={sourceRef.current} onSourceChange={onSourceChange} activeLine={event && event.kind !== 'done' ? event.line : null} errorLine={diagnostic?.line ?? null} /><p className="border-t border-slate-100 px-4 py-3 text-xs leading-5 text-slate-500">Υποστηρίζονται απλές μεταβλητές και σταθερές, εκφράσεις, είσοδος/έξοδος, ΑΝ, ΟΣΟ, ΜΕΧΡΙΣ_ΟΤΟΥ και ΓΙΑ. Πίνακες, ΕΠΙΛΕΞΕ και υποπρογράμματα θα προστεθούν σε επόμενο στάδιο.</p></section>
      <div className="grid min-w-0 content-start gap-4"><CommandGuide onInsert={insert} /><RuntimePanel event={event} diagnostic={diagnostic} status={status} onInput={submitInput} /></div>
    </div>
  </section>
}
