import { DebuggerEngine, type DebugAction } from '../../interpreter/debugger'
import { BreakpointManager } from '../../interpreter/breakpoints'
import DebuggerPanel from './DebuggerPanel'
import { liveExecution } from '../../interpreter/liveExecution'
import LiveExecutionTools from '../whiteboard/LiveExecutionTools'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, StepForward, Undo2, Square } from 'lucide-react'
import CodeEditorPane, { type EditorHandle } from './CodeEditorPane'
import CommandGuide from './CommandGuide'
import RuntimePanel from './RuntimePanel'
import MemoryVisualizer, { type ExecutionSpeed } from './MemoryVisualizer'
import { starterProgram, type CommandSnippet } from '../../interpreter/examples'
import { parseProgram } from '../../interpreter/parser'
import { parseInput } from '../../interpreter/runtime'
import type { ExecutionEvent, Value } from '../../interpreter/types'
import { toDiagnostic, type Diagnostic } from '../../interpreter/diagnostics'
import { describeChanges } from './memoryChanges'
import ResponsiveIdeLayout from './ResponsiveIdeLayout'
import './interpreter.css'
import { useSettings } from '../../settings/SettingsContext'
import { restoreSource, sourceStorageKey } from '../../settings/settings'
import { useAuth } from '../../auth/AuthContext'
import SaveNoteModal from '../../notes/SaveNoteModal'
import type { CodeNote } from '../../notes/model'
import { DebugInputBuffer } from '../../interpreter/inputBuffer'

export default function InterpreterWorkspace({ sourceStore, active = true, onZenChange, onOpenFlowchart, debugLaunch,codeNote,onNoteSaved,noteLaunch }: { sourceStore?: { current: string }; active?: boolean; onZenChange?: (value: boolean) => void; onOpenFlowchart?: () => void; debugLaunch?: { id: number; source: string; inputs: string[] };codeNote?:CodeNote;onNoteSaved?:(note:CodeNote)=>void;noteLaunch?:number }) {
  const {user}=useAuth()
  const [noteSave,setNoteSave]=useState<{code:string;note?:CodeNote}|null>(null)
  const [noteNotice,setNoteNotice]=useState('')
  const handledNoteLaunch=useRef<number|undefined>(undefined)
  useEffect(()=>{if(noteLaunch===undefined||handledNoteLaunch.current===noteLaunch||!codeNote)return;handledNoteLaunch.current=noteLaunch;reset();editorRef.current?.replace(codeNote.code);setStatus('Άνοιξε η σημείωση «'+codeNote.title+'».')},[noteLaunch,codeNote])
  useEffect(()=>{if(!noteNotice)return;const id=window.setTimeout(()=>setNoteNotice(''),5000);return()=>window.clearTimeout(id)},[noteNotice])
  const {settings, playSound, unlockAudio} = useSettings()
  const settingsRef = useRef(settings); settingsRef.current = settings
  const [saveNotice, setSaveNotice] = useState('')
  const [executionRequest, setExecutionRequest] = useState(0)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [speed, setSpeed] = useState<ExecutionSpeed>(1)
  const speedRef = useRef<ExecutionSpeed>(1)
  const timer = useRef<number | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const debugInputBuffer = useRef(new DebugInputBuffer())
  const handledDebugLaunch = useRef(0)
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const [event, setEvent] = useState<ExecutionEvent | null>(null)
  const [executionDiagnostic, setExecutionDiagnostic] = useState<Diagnostic | null>(null)
  const [status, setStatus] = useState('Έτοιμο για εκτέλεση.')
  const editorRef = useRef<EditorHandle>(null)
  const sourceRef = useRef(sourceStore?.current ?? restoreSource(starterProgram,user?.id))
  const executionTouched = useRef(false)
  const runner = useRef<DebuggerEngine | null>(null)
  const [breakpointManager] = useState(() => new BreakpointManager())
  const [breakpoints, setBreakpoints] = useState<number[]>([])
  const [faulted, setFaulted] = useState(false)
  const executionMode = useRef<DebugAction>('step')
  const toggleBreakpoint = useCallback((line: number) => setBreakpoints(breakpointManager.toggle(line)), [breakpointManager])
  const compiledSource = useRef('')
  const runContinuously = useRef(false)

  useEffect(() => {
    if (!debugLaunch || handledDebugLaunch.current === debugLaunch.id) return
    handledDebugLaunch.current = debugLaunch.id
    reset()
    sourceStore && (sourceStore.current = debugLaunch.source)
    editorRef.current?.replace(debugLaunch.source)
    debugInputBuffer.current.load(debugLaunch.inputs)
    setStatus('Το αντιπαράδειγμα φορτώθηκε. Εκτέλεσε βήμα-βήμα για να ελέγξεις τις εισόδους.')
  }, [debugLaunch, reset, sourceStore])

  useEffect(() => {
    function save() {if (!settingsRef.current.autoSaveSeconds) return;try {localStorage.setItem(sourceStorageKey(user?.id),sourceRef.current);setSaveNotice('')}catch{setSaveNotice('Η αυτόματη αποθήκευση δεν είναι διαθέσιμη σε αυτόν τον browser.')}}
    const id=settings.autoSaveSeconds ? window.setInterval(save,settings.autoSaveSeconds*1000) : null
    window.addEventListener('pagehide',save)
    return()=>{if(id!==null)window.clearInterval(id);window.removeEventListener('pagehide',save)}
  },[settings.autoSaveSeconds,user?.id])

  const onSourceChange = useCallback((value: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    runContinuously.current = false
    setIsRunning(false)
    sourceRef.current = value
    if (sourceStore) sourceStore.current = value
    debugInputBuffer.current.load([])
    breakpointManager.clear(); setBreakpoints([]); setFaulted(false)
    if (!executionTouched.current) return
    runner.current = null
    compiledSource.current = ''
    executionTouched.current = false
    setEvent(null)
    liveExecution.reset()
    setExecutionDiagnostic(null)
    setStatus('Έτοιμο για εκτέλεση.')
  }, [sourceStore, breakpointManager])

  useEffect(() => {
    if (!active) { if (timer.current !== null) window.clearTimeout(timer.current); runContinuously.current = false; setIsRunning(false) }
    else if (sourceStore && sourceStore.current !== sourceRef.current) editorRef.current?.replace(sourceStore.current)
  }, [active, sourceStore])
  const focusEditor = useCallback(() => editorRef.current?.focus(), [])

  function pause() {
    if (timer.current !== null) window.clearTimeout(timer.current)
    runContinuously.current = false
    setIsRunning(false)
    setStatus('Η εκτέλεση τέθηκε σε παύση.')
  }

  function reset() {
    pause()
    debugInputBuffer.current.load([])
    runner.current?.stop()
    runner.current = null
    compiledSource.current = ''
    setFaulted(false)
    setEvent(null)
    liveExecution.reset()
    setExecutionDiagnostic(null)
    setStatus('Έτοιμο για εκτέλεση.')
    executionTouched.current = false
  }

  function prepare() {
    if (runner.current && compiledSource.current === sourceRef.current) return runner.current
    editorRef.current?.syncHighlight()
    setExecutionDiagnostic(null)
    const program = parseProgram(sourceRef.current)
    liveExecution.start(sourceRef.current, program)
    runner.current = new DebuggerEngine(program, { capacity: 100, breakpoints: breakpointManager, maxLoopIterations: settingsRef.current.loopLimit })
    compiledSource.current = sourceRef.current
    return runner.current
  }

  function advance(continuous: boolean, supplied?: Value, resume = false, action: DebugAction = continuous ? 'continue' : 'step') {
    executionTouched.current = true
    executionMode.current = action
    if (!resume && event?.kind === 'input' && supplied === undefined && runner.current) {
      setExecutionDiagnostic({ line: event.line, category: 'runtime', description: `Δώσε πρώτα τιμή για τη μεταβλητή «${event.name}».` })
      return
    }
    if (timer.current !== null) window.clearTimeout(timer.current)
    runContinuously.current = continuous
    setIsRunning(continuous)
    try {
      const iterator = prepare()
      const result = iterator.advance(action, supplied)
      const current = result.event
      setEvent(current)
      liveExecution.accept(current)
      if (result.reason === 'breakpoint') { setIsRunning(false); runContinuously.current = false; setStatus('Σημείο διακοπής στη γραμμή ' + (current.kind !== 'done' ? current.line : '') + '.'); return }
      if (current.kind === 'input') { setIsRunning(false); setStatus('Αναμονή εισόδου για τη μεταβλητή ' + current.name + '.'); return }
      if (current.kind === 'done') { setIsRunning(false); runContinuously.current = false; setStatus('Η εκτέλεση ολοκληρώθηκε.'); playSound('success'); return }
      setStatus('Εκτελέστηκε η γραμμή ' + current.line + '.')
      if (continuous) timer.current = window.setTimeout(() => {
        if (runner.current === iterator && runContinuously.current) advance(true, undefined, true)
      }, settingsRef.current.executionDelay / speedRef.current)
    } catch (cause) {
      playSound('error'); setExecutionDiagnostic(toDiagnostic(cause))
      setStatus('Η εκτέλεση σταμάτησε.')
      setIsRunning(false)
      runContinuously.current = false
      setFaulted(true)
    }
  }

  function submitInput(text: string): boolean {
    if (event?.kind !== 'input') return false
    try { const value = parseInput(text, event.type, event.line); setExecutionDiagnostic(null); advance(runContinuously.current, value, false, executionMode.current); return true }
    catch (cause) { playSound('error'); setExecutionDiagnostic(toDiagnostic(cause, 'type')); return false }
  }

  function stepBack() {
    pause()
    try {
      const previous = runner.current?.stepBack()
      if (!previous) return
      debugInputBuffer.current.seek(runner.current?.inputsUsed??0)
      setEvent(previous); liveExecution.restore(previous)
      setFaulted(false); setExecutionDiagnostic(null)
      setStatus('Επαναφορά στο προηγούμενο βήμα.')
      setExecutionRequest(value => value + 1)
    } catch (cause) { setExecutionDiagnostic(toDiagnostic(cause)) }
  }
  function stop() {
    pause(); runner.current?.stop(); runner.current=null; compiledSource.current=''
    setFaulted(false); setExecutionDiagnostic(null)
    if (event?.kind === 'input') {
      const stopped: ExecutionEvent={kind:'step',line:event.line,variables:event.variables,output:event.output,
        debugStepIndex:event.debugStepIndex,scopeId:event.scopeId,scopeName:event.scopeName,callStack:event.callStack,memoryEvents:[]}
      setEvent(stopped); liveExecution.restore(stopped)
    }
    setStatus('Η εκτέλεση διακόπηκε.')
  }

  const insert = useCallback((command: CommandSnippet) => editorRef.current?.insert(command), [])
  const diagnostic = executionDiagnostic

  return <>{noteSave&&<SaveNoteModal code={noteSave.code} note={noteSave.note} onClose={()=>setNoteSave(null)} onSaved={note=>{setNoteSave(null);onNoteSaved?.(note);setNoteNotice('Η σημείωση αποθηκεύτηκε στη βιβλιοθήκη σου!')}}/>}{noteNotice&&<div className="note-toast" role="status">{noteNotice}</div>}<ResponsiveIdeLayout outputCount={event?.output.length ?? 0} executionRequest={executionRequest} active={active} onZenChange={onZenChange} onFocusEditor={focusEditor} status={saveNotice || status} cursor={cursor} errors={diagnostic ? 1 : 0} needsInput={event?.kind === 'input'} attention={diagnostic ?? (event?.kind === 'input' ? event : null)}
    editor={<CodeEditorPane breakpoints={breakpoints} onToggleBreakpoint={toggleBreakpoint} ref={editorRef} followEvent={event} changeSummary={describeChanges(event)} initialValue={sourceRef.current} onSourceChange={onSourceChange} onCursorChange={setCursor} showLint={false} activeLine={event && event.kind !== 'done' ? event.line : null} errorLine={diagnostic?.line ?? null} />}
    commands={<CommandGuide onInsert={insert} />}
    console={<RuntimePanel embedded event={event} diagnostic={diagnostic} status={status} onInput={text => { const accepted = submitInput(text); if (accepted) debugInputBuffer.current.consume(); return accepted }} suggestedInput={event?.kind === 'input' ? debugInputBuffer.current.peek() : undefined} />}
    memory={<LiveExecutionTools debuggerPanel={<DebuggerPanel event={event} breakpoints={breakpoints} onToggleBreakpoint={toggleBreakpoint} historySize={runner.current?.history.length ?? 0} />} onOpenFlowchart={onOpenFlowchart ? () => { pause(); onOpenFlowchart() } : undefined} memory={<MemoryVisualizer event={event} speed={speed} onSpeedChange={value => { speedRef.current = value; setSpeed(value) }} />} />}
    controls={<><button type="button" title={user?"Αποθήκευση του κώδικα στον λογαριασμό σου":"Συνδέσου για αποθήκευση σημειώσεων"} disabled={!user} onClick={()=>{pause();setNoteSave({code:editorRef.current?.getValue()??sourceRef.current,note:codeNote})}} className="inline-flex items-center gap-1 border px-3 py-2 disabled:opacity-40">{codeNote?"💾 Ενημέρωση Σημείωσης":"💾 Αποθήκευση στις Σημειώσεις"}</button><button type="button" title="Συνέχεια εκτέλεσης μέχρι το επόμενο σημείο διακοπής" disabled={isRunning || faulted || event?.kind === 'done'} onClick={() => { unlockAudio(); setExecutionRequest(previous => previous + 1); advance(true) }} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-40"><Play size={15} />Συνέχεια</button><button type="button" title="Παύση εκτέλεσης" disabled={!isRunning} onClick={pause} className="inline-flex items-center gap-1 border px-3 py-2 disabled:opacity-40"><Pause size={15} />Παύση</button><button type="button" title="Εκτέλεση επόμενου βήματος μέσα στις κλήσεις" disabled={isRunning || faulted || event?.kind === 'done'} onClick={() => { unlockAudio(); setExecutionRequest(previous => previous + 1); advance(false) }} className="inline-flex items-center gap-1 border px-3 py-2"><StepForward size={15} />Βήμα</button><button type="button" title="Επαναφορά εκτέλεσης" onClick={reset} className="inline-flex items-center gap-1 border px-3 py-2"><RotateCcw size={15} /></button><button type="button" title="Step Over: εκτέλεση κλήσης χωρίς στάση στα εσωτερικά βήματα, εκτός από breakpoints ή είσοδο" disabled={isRunning || faulted || event?.kind === 'done'} onClick={() => { setExecutionRequest(value => value + 1); advance(false, undefined, false, 'over') }} className="inline-flex items-center gap-1 border px-3 py-2 disabled:opacity-40"><StepForward size={15} />Πάνω από κλήση</button><button type="button" title="Step Back: επαναφορά προηγούμενης κατάστασης και θέσης εκτέλεσης" disabled={isRunning || !runner.current?.canStepBack} onClick={stepBack} className="inline-flex items-center gap-1 border px-3 py-2 disabled:opacity-40"><Undo2 size={15} />Πίσω</button><button type="button" title="Οριστική διακοπή τρέχουσας εκτέλεσης" disabled={!runner.current} onClick={stop} className="inline-flex items-center gap-1 border px-3 py-2 disabled:opacity-40"><Square size={15} />Διακοπή</button><label className="text-xs text-slate-500" title="Ταχύτητα εκτέλεσης">Ταχύτητα <select aria-label="Ταχύτητα εκτέλεσης" value={speed} onChange={e => { const value = Number(e.target.value) as ExecutionSpeed; speedRef.current = value; setSpeed(value) }}>{[0.5,1,2].map(value => <option key={value} value={value}>{value}×</option>)}</select></label></>}
  /></>
}
