import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, BookOpenCheck, Clock3, LoaderCircle, Play, Send } from 'lucide-react'
import { Markdown } from '../exam/Markdown'
import CodeEditorPane from '../interpreter/CodeEditorPane'
import { prepareAssessment, localAttempt } from '../../assessment/assessmentFlow'
import { loadPracticeExam } from '../../api/assessmentLoader'
import { getMockExam } from '../../assessment/mockExamBank'
import { generatedToAssessment } from '../../assessment/generatedAdapter'
import { practiceExam } from '../../assessment/practiceExam'
import { checkProgram, previewProgram } from '../../assessment/workerClient'
import type { AnswerSheet, AnswerValue, AssessmentInsight, AssessmentQuestion, AssessmentReport, AssessmentExam } from '../../assessment/model'
import type { ExecutionResult } from '../../assessment/execution'
import type { ExamJsonResponseDto } from '../../types/exam'
import { useAuth } from '../../auth/AuthContext'
import { apiClient } from '../../api/client'
import { isDemoMode } from '../../api/exams'
import { generateAssessmentInsight } from '../../api/assessment'
import { buildAttemptSubmission, type AttemptDetail, type GradeRequest } from '../../assessment/attempts'
import { startExamAttempt, submitExamAttempt, getExamAttempt, gradeExamAttempt, attemptError } from '../../api/attempts'
import { draftKey, readAssessmentDraft } from '../../assessment/drafts'
import AssessmentHistory from './AssessmentHistory'
import AssessmentReportView from './AssessmentReportView'
import '../interpreter/interpreter.css'
import './assessment.css'

type Mode = 'practice' | 'generated'
const emptyRows = (question: Extract<AssessmentQuestion, { kind: 'trace' }>) =>
  question.rowLabels.map(() => question.columns.map(() => ''))

export default function AssessmentWorkspace({ generatedExam, initialMode = 'practice', onOpenDebugger }: { generatedExam: ExamJsonResponseDto | null; initialMode?: Mode; onOpenDebugger: (source: string, inputs: string[]) => void }) {
  const { user } = useAuth()
  const [saveNotice, setSaveNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [phase, setPhase] = useState<'intro' | 'taking' | 'report'>('intro')
  const [answers, setAnswers] = useState<AnswerSheet>(() => readAssessmentDraft(initialMode === 'generated' && generatedExam ? generatedToAssessment(generatedExam) : practiceExam, user?.id))
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<Record<string, ExecutionResult>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [insight, setInsight] = useState<AssessmentInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightError, setInsightError] = useState('')
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [savedExam, setSavedExam] = useState<AssessmentExam | null>(null)
  const [selectedExam, setSelectedExam] = useState<AssessmentExam | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading,setLoading]=useState(initialMode==='practice')
  const [localOnly,setLocalOnly]=useState(false)
  const [loadNotice,setLoadNotice]=useState('')
  const loadSequence=useRef(0),loadController=useRef<AbortController|null>(null),mounted=useRef(true)
  const pendingSubmission=useRef<ReturnType<typeof buildAttemptSubmission>|null>(null)
  useEffect(()=>{mounted.current=true;if(initialMode==='practice')void loadRandomPracticeExam();return()=>{mounted.current=false;loadSequence.current++;loadController.current?.abort()}},[])
  const pendingId = useRef<string | null>(null)
  const submitting = useRef(false)
  const currentUser = useRef(user?.id)
  currentUser.current = user?.id
  useEffect(() => { currentUser.current = user?.id; return () => { currentUser.current = undefined; insightSequence.current++ } }, [user?.id])
  const insightSequence = useRef(0)
  const exam = useMemo(() => savedExam ?? selectedExam ?? (mode === 'generated' && generatedExam ? generatedToAssessment(generatedExam) : practiceExam), [mode, generatedExam, savedExam, selectedExam])

  useEffect(() => {
    if (phase !== 'taking') return
    try { localStorage.setItem(draftKey(exam.id, user?.id), JSON.stringify(answers)) } catch { /* Η επίλυση συνεχίζεται στη μνήμη. */ }
  }, [answers, exam.id, phase, user?.id])

  function changeMode(next:Mode){
    loadController.current?.abort();loadSequence.current++;insightSequence.current++
    setAttempt(null);setSavedExam(null);setSelectedExam(null);pendingId.current=null;pendingSubmission.current=null
    setMode(next);setPhase('intro');setReport(null);setInsight(null);setInsightError('');setError('');setPreview({});setInputs({});setLoadNotice('');setLocalOnly(false)
    setAnswers(readAssessmentDraft(next==='generated'&&generatedExam?generatedToAssessment(generatedExam):practiceExam,user?.id))
    if(next==='practice')void loadRandomPracticeExam();else setLoading(false)
  }
  async function loadRandomPracticeExam(){
    if(submitting.current)return
    loadController.current?.abort();const controller=new AbortController();loadController.current=controller
    const sequence=++loadSequence.current,owner=user?.id
    setBusy('random');setLoading(true);setError('')
    try{
      const result=await loadPracticeExam(!!user,controller.signal)
      if(sequence!==loadSequence.current||currentUser.current!==owner||!mounted.current)return
      setAttempt(null);setSavedExam(null);setSelectedExam(result.exam);pendingId.current=null;pendingSubmission.current=null
      setLocalOnly(result.local);setLoadNotice(result.notice);setAnswers(readAssessmentDraft(result.exam,owner));setReport(null);setPhase('intro');setPreview({});setInputs({})
    }catch(cause){if(!controller.signal.aborted&&mounted.current)setError(attemptError(cause))}
    finally{if(sequence===loadSequence.current&&mounted.current){setBusy(null);setLoading(false)}}
  }
  async function loadInsight(result: AssessmentReport) {
    const requestId = ++insightSequence.current
    setInsightLoading(true); setInsightError('')
    try { const response = await generateAssessmentInsight(result); if (requestId === insightSequence.current) setInsight(response) }
    catch { if (requestId === insightSequence.current) setInsightError('Η ανάλυση Gemini δεν είναι διαθέσιμη αυτή τη στιγμή. Η βασική αναφορά παραμένει διαθέσιμη.') }
    finally { if (requestId === insightSequence.current) setInsightLoading(false) }
  }
  function update(id: string, value: AnswerValue) { setAnswers(current => ({ ...current, [id]: value })) }
  function nested(id: string, key: string, value: string) {
    setAnswers(current => ({ ...current, [id]: { ...(current[id] && typeof current[id] === 'object' && !Array.isArray(current[id]) ? current[id] : {}), [key]: value } }))
  }
  function mapAnswer(id: string): Record<string, string> {
    const value = answers[id]
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }
  function textAnswer(id: string): string { const value = answers[id]; return typeof value === 'string' ? value : '' }
  function rowsAnswer(question: Extract<AssessmentQuestion, { kind: 'trace' }>): string[][] {
    const value = answers[question.id]
    return Array.isArray(value) ? value : emptyRows(question)
  }
  async function runPreview(question: Extract<AssessmentQuestion, { kind: 'program' }>) {
    setError(''); setBusy(question.id)
    try {
      const values = (inputs[question.id] ?? '').split(/\r?\n/u).map(value => value.trim()).filter(Boolean)
      const result = await previewProgram(textAnswer(question.id), values)
      setPreview(current => ({ ...current, [question.id]: result }))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Η δοκιμή δεν ολοκληρώθηκε.') }
    finally { setBusy(null) }
  }
  async function start(){
    if(submitting.current||loading)return
    submitting.current=true;setBusy('start');setError('');const owner=user?.id
    try{
      if(user)try{
        pendingId.current??=crypto.randomUUID()
        const saved=await startExamAttempt(pendingId.current,exam.id,mode==='generated'&&generatedExam?generatedExam:undefined)
        if(currentUser.current!==owner||!mounted.current)return
        setAttempt(saved);setSavedExam(saved.exam);setLocalOnly(false);setLoadNotice('');setReport(saved.report);setPhase(saved.report?'report':'taking');return
      }catch(cause){if(mode==='generated')throw cause}
      const localExam=await getMockExam()
      if(currentUser.current!==owner||!mounted.current)return
      const saved=localAttempt(localExam,crypto.randomUUID(),user?.fullName);pendingId.current=saved.attemptId
      setSelectedExam(localExam);setSavedExam(localExam);setAttempt(saved);setLocalOnly(true);setAnswers(readAssessmentDraft(localExam,owner));setPhase('taking')
      setLoadNotice('Τοπική εξάσκηση: η επίλυση και η βαθμολόγηση λειτουργούν χωρίς API. Η προσπάθεια δεν έχει ακόμη αποθηκευτεί στον λογαριασμό σου.')
    }catch(cause){if(mounted.current)setError(attemptError(cause))}finally{if(mounted.current){submitting.current=false;setBusy(null)}}
  }
  async function submit(){
    if(!attempt||submitting.current)return
    submitting.current=true;setError('');setBusy('submit');const owner=user?.id
    try{
      if(localOnly){
        const result=await prepareAssessment(exam,answers,checkProgram,true)
        if(currentUser.current!==owner||!mounted.current)return
        setAttempt({...attempt,status:'SUBMITTED',submittedAt:new Date().toISOString(),version:1,autoGradeScore:result.earned,finalScore:result.earned,report:result});setReport(result);setPhase('report')
      }else{
        if(!user)throw Error('Συνδέσου ξανά για να υποβάλεις τις απαντήσεις σου.')
        if(!pendingSubmission.current){const result=await prepareAssessment(exam,answers,checkProgram,false);pendingSubmission.current=buildAttemptSubmission(attempt.attemptId,exam,answers,result)}
        if(currentUser.current!==owner||!mounted.current)return
        const saved=await submitExamAttempt(pendingSubmission.current)
        if(currentUser.current!==owner||!mounted.current)return
        if(!saved.report)throw Error('Η υποβολή δεν επέστρεψε αναφορά βαθμολογίας. Δοκίμασε ξανά.')
        setAttempt(saved);setSavedExam(saved.exam);setReport(saved.report);setPhase('report')
        try{localStorage.removeItem(draftKey(exam.id,owner))}catch{}
        if(!isDemoMode)void loadInsight(saved.report)
      }
      window.scrollTo({top:0,behavior:'auto'})
    }catch(cause){if(mounted.current)setError(attemptError(cause))}finally{if(mounted.current){submitting.current=false;setBusy(null)}}
  }
  async function syncLocalAttempt(){
    if(!user||!attempt||!report||submitting.current)return
    submitting.current=true;setBusy('sync');setError('');const owner=user.id
    try{
      await startExamAttempt(attempt.attemptId,exam.id)
      const saved=await submitExamAttempt(buildAttemptSubmission(attempt.attemptId,exam,answers,report))
      if(currentUser.current!==owner||!mounted.current)return
      if(!saved.report)throw Error('Δεν επέστρεψε αναφορά η υπηρεσία υποβολής.')
      setAttempt(saved);setSavedExam(saved.exam);setReport(saved.report);setLocalOnly(false);setLoadNotice('')
      try{localStorage.removeItem(draftKey(exam.id,owner))}catch{}
    }catch(cause){if(mounted.current)setError(attemptError(cause))}finally{if(mounted.current){submitting.current=false;setBusy(null)}}
  }
  async function openAttempt(id: string) {
    const owner = user?.id, saved = await getExamAttempt(id)
    if (currentUser.current !== owner) return
    pendingSubmission.current=null;setLocalOnly(false);setLoadNotice('')
    setAttempt(saved);setSavedExam(saved.exam);setReport(saved.report);setAnswers(saved.questionSubmissions.length?Object.fromEntries(saved.questionSubmissions.map(q=>[q.questionId,JSON.parse(q.studentAnswerJson)])):readAssessmentDraft(saved.exam,owner))
    setPhase(saved.report ? 'report' : 'taking'); setHistoryOpen(false); setInsight(null); insightSequence.current++
  }
  async function teacherGrade(request: GradeRequest) {
    if (!attempt || user?.role !== 'TEACHER') throw new Error('Απαιτείται λογαριασμός καθηγητή.')
    const owner = user.id, saved = await gradeExamAttempt(attempt.attemptId, request)
    if (currentUser.current === owner) setAttempt(saved)
  }

  function renderQuestion(question: AssessmentQuestion) {
    if (question.kind === 'trueFalse') return <div className="space-y-4">{question.statements.map((statement, index) => <fieldset key={statement.id} className="rounded-xl border border-slate-200 p-4"><legend className="px-1 text-sm font-medium">{index + 1}. {statement.text}</legend><div className="mt-2 flex gap-5">{(['Σωστό', 'Λάθος'] as const).map(value => <label key={value} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name={statement.id} checked={mapAnswer(question.id)[statement.id] === value} onChange={() => nested(question.id, statement.id, value)} />{value}</label>)}</div></fieldset>)}</div>
    if (question.kind === 'matching') return <div className="space-y-3">{question.pairs.map(pair => <label key={pair.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-2 sm:items-center"><span className="font-semibold">{pair.left}</span><select aria-label={`Αντιστοίχιση ${pair.left}`} value={mapAnswer(question.id)[pair.id] ?? ''} onChange={event => nested(question.id, pair.id, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Επίλεξε χαρακτηριστικό</option>{question.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.text}</option>)}</select></label>)}</div>
    if (question.kind === 'choice') return <fieldset className="space-y-2"><legend className="sr-only">Επιλογές {question.code}</legend>{question.options.map(option => <label key={option.id} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => update(question.id, option.id)} />{option.text}</label>)}</fieldset>
    if (question.kind === 'fill') return <label className="block text-sm font-semibold">Η απάντησή σου<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-normal" value={textAnswer(question.id)} onChange={event => update(question.id, event.target.value)} /></label>
    if (question.kind === 'codeBlanks') return <div className="overflow-x-auto rounded-xl bg-slate-900 p-4"><pre className="min-w-max font-mono text-xs leading-9 text-slate-100">{question.template.split(/(\{\{\d+\}\})/gu).map((part, index) => { const id = /^\{\{(\d+)\}\}$/u.exec(part)?.[1]; return id ? <input key={index} aria-label={`Κενό ${id}`} value={mapAnswer(question.id)[id] ?? ''} onChange={event => nested(question.id, id, event.target.value)} className="mx-1 inline-block w-24 rounded border border-blue-400 bg-white px-2 py-1 text-center font-mono text-xs text-slate-900 outline-blue-500" placeholder={`(${id})`} /> : <span key={index}>{part}</span> })}</pre></div>
    if (question.kind === 'trace') return <div className="overflow-x-auto"><table className="assessment-trace w-full min-w-[650px] border-collapse text-sm"><thead><tr><th>Σημείο καταγραφής</th>{question.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{question.rowLabels.map((label, row) => <tr key={label}><th>{label}</th>{question.columns.map((column, col) => <td key={`${row}-${col}`}><input aria-label={`${label}, ${column}`} value={rowsAnswer(question)[row][col]} onChange={event => { const next = rowsAnswer(question).map(cells => [...cells]); next[row][col] = event.target.value; update(question.id, next) }} /></td>)}</tr>)}</tbody></table></div>
    if (question.kind === 'program') return <div className="space-y-3"><div className="overflow-hidden rounded-xl border border-slate-200"><CodeEditorPane key={question.id} initialValue={textAnswer(question.id)} onSourceChange={value => update(question.id, value)} activeLine={null} errorLine={null} /></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><label className="text-xs font-semibold text-slate-600">Τιμές δοκιμαστικής εισόδου, μία ανά γραμμή<textarea value={inputs[question.id] ?? ''} onChange={event => setInputs(current => ({ ...current, [question.id]: event.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-sm" placeholder="Δώσε μία τιμή ανά γραμμή" /></label><button type="button" disabled={!!busy} onClick={() => void runPreview(question)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"><Play size={16} />Δοκιμή / Εκτέλεση</button></div>{question.gradingMode === 'review' && !question.previewCases?.length && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Μπορείς να δοκιμάσεις τον κώδικά σου. Η τελική βαθμολογία αυτού του θέματος χρειάζεται έλεγχο καθηγητή, επειδή δεν υπάρχουν δομημένες δοκιμές.</p>}{preview[question.id] && <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-white"><p className="mb-2 font-sans font-bold">Έξοδος δοκιμής</p>{preview[question.id].error ? <p className="text-rose-300">{preview[question.id].error}</p> : <pre>{preview[question.id].output.join('\n') || 'Καμία έξοδος'}</pre>}</div>}</div>
    return <label className="block text-sm font-semibold">Η απάντησή σου<textarea rows={8} value={textAnswer(question.id)} onChange={event => update(question.id, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal leading-6" placeholder="Γράψε την απάντησή σου εδώ" /></label>
  }

  const historyButton = user && <button type="button" disabled={!!busy} onClick={() => setHistoryOpen(true)} className="mb-4 rounded-lg border px-4 py-2">Ιστορικό υποβολών</button>
  if (historyOpen) return <><button className="mb-4 rounded border p-2" onClick={() => setHistoryOpen(false)}>Επιστροφή στο διαγώνισμα</button><AssessmentHistory onOpen={openAttempt} /></>
  if(loading)return <section className="assessment-loading" role="status" aria-busy="true" aria-label="Φόρτωση διαγωνίσματος"><h1>Φόρτωση διαγωνίσματος…</h1><div className="assessment-skeleton" aria-hidden="true" />{[1,2,3,4].map(id=><div key={id} className="assessment-skeleton assessment-skeleton-section" aria-hidden="true" />)}</section>
  if (phase === 'report' && report && attempt) return <>{historyButton}{localOnly&&<div className="assessment-local-notice" role="status"><p>Τοπική αυτοαξιολόγηση · Η προσπάθεια δεν έχει αποθηκευτεί στον διακομιστή.</p>{user&&<button type="button" disabled={!!busy} onClick={()=>void syncLocalAttempt()}>{busy==='sync'?'Αποθήκευση…':'Αποθήκευση στον λογαριασμό'}</button>}</div>}{error&&<p role="alert" className="assessment-error">{error}</p>}<AssessmentReportView exam={exam} report={report} attempt={attempt} onGrade={teacherGrade} onRefresh={async () => { const saved = await getExamAttempt(attempt.attemptId); setAttempt(saved) }} onOpenDebugger={onOpenDebugger} insight={insight} insightLoading={insightLoading} insightError={insightError} aiAvailable={!localOnly&&!isDemoMode} onRetryInsight={() => void loadInsight(report)} onRetry={() => { try{localStorage.removeItem(draftKey(exam.id,user?.id))}catch{} changeMode(mode); setAnswers({}); setPreview({}); setInsightLoading(false) }} /></>
  return <section className="mx-auto max-w-6xl" aria-labelledby="assessment-title">
    {historyButton}
    {loadNotice&&<div className="assessment-local-notice" role="status"><p>{loadNotice}</p>{phase==='intro'&&<button type="button" disabled={!!busy} onClick={()=>void loadRandomPracticeExam()}>Δοκιμή φόρτωσης ξανά</button>}</div>}
    <header className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold tracking-widest text-blue-700">ΔΙΑΔΡΑΣΤΙΚΑ ΔΙΑΓΩΝΙΣΜΑΤΑ</p><h1 id="assessment-title" className="mt-2 text-2xl font-bold">{exam.title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">Απάντησε στην οθόνη, εκτέλεσε τον κώδικά σου και δες αναλυτική διόρθωση μετά την υποβολή.</p><div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 size={15} />{exam.durationMinutes} λεπτά</span><span>{exam.sections.length} θέματα · 100 μονάδες</span><span>{exam.source === 'practice' ? 'Πρωτότυπο διαγώνισμα εξάσκησης' : 'Διαγώνισμα από τη γεννήτρια'}</span></div></header>
    <div className="mb-6 flex flex-wrap gap-2"><button type="button" disabled={!!busy} aria-pressed={mode === 'practice'} onClick={() => changeMode('practice')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'practice' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white'}`}>Διαγώνισμα εξάσκησης</button>{mode === 'practice' && <button type="button" disabled={!!busy || phase !== 'intro'} onClick={() => void loadRandomPracticeExam()} className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{busy === 'random' ? 'Φόρτωση…' : 'Τυχαίο πρότυπο διαγώνισμα'}</button>}{generatedExam && <button type="button" disabled={!!busy} aria-pressed={mode === 'generated'} onClick={() => changeMode('generated')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${mode === 'generated' ? 'bg-blue-700 text-white' : 'border border-slate-200 bg-white'}`}>Τελευταίο διαγώνισμα γεννήτριας</button>}</div>
    {user && generatedExam && mode === 'generated' && <div className="mb-4"><button type="button" disabled={saving} className="rounded-lg border border-blue-200 px-4 py-2 text-sm" onClick={async () => {setSaving(true);try {await apiClient.post('/user-exams',generatedExam);setSaveNotice('Το διαγώνισμα αποθηκεύτηκε στον λογαριασμό σου.')} catch {setSaveNotice('Το διαγώνισμα δεν αποθηκεύτηκε. Δοκίμασε ξανά.')} finally {setSaving(false)}}}>{saving ? 'Αποθήκευση…' : 'Αποθήκευση στον λογαριασμό'}</button><p role="status" className="mt-2 text-xs">{saveNotice}</p></div>}
    {!user && <p className="mb-4 rounded border p-4">Μπορείς να εξασκηθείς τοπικά χωρίς σύνδεση. Για αποθήκευση στον λογαριασμό σου, συνδέσου από το μενού.</p>}
    {phase === 'intro' ? <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><div className="flex items-start gap-3"><BookOpenCheck size={26} className="shrink-0 text-blue-700" /><div><h2 className="text-lg font-bold">Πριν ξεκινήσεις</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Στα πρότυπα εξάσκησης βαθμολογούνται αυτόματα τα Θέματα Α–Δ. Ο Worker εκτελεί τις δοκιμές κώδικα και το API επιβεβαιώνει τον βαθμό με τη δική του τράπεζα. Στην τοπική εξάσκηση ο βαθμός είναι αυτοαξιολόγηση μέχρι να αποθηκευτεί. Οι λύσεις εμφανίζονται μετά την υποβολή.</p></div></div>{exam.source === 'generated' && <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Το τρέχον συμβόλαιο παραγωγής δεν παρέχει δομημένο κλειδί απαντήσεων και δοκιμών. Μπορείς να λύσεις το διαγώνισμα, αλλά η βαθμολογία του θα μείνει σε εκκρεμότητα για καθηγητή.</p>}<button type="button" disabled={!!busy || loading} onClick={() => void start()} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800">{Object.keys(answers).length ? 'Συνέχιση διαγωνίσματος' : 'Έναρξη διαγωνίσματος'}<ArrowRight size={17} /></button></div> : <div className="space-y-7">{exam.sections.map(section => <section key={section.theme} aria-label={section.theme} className="space-y-4"><div className="flex items-center justify-between border-b-2 border-blue-200 pb-2"><h2 className="text-xl font-bold text-slate-900">{section.theme}</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{section.marks} μόρια</span></div>{section.questions.map(question => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold">{question.code} · {question.title}</h3><span className="text-xs font-semibold text-slate-500">{question.marks} μόρια</span></div><div className="mb-5 text-sm leading-6 text-slate-700"><Markdown>{question.prompt}</Markdown></div><fieldset disabled={busy==='submit'||!!pendingSubmission.current}>{renderQuestion(question)}</fieldset></article>)}</section>)}<div className="rounded-2xl border border-blue-100 bg-blue-50 p-5"><p className="text-sm text-blue-900">Με την υποβολή θα εμφανιστούν οι ενδεικτικές λύσεις και η αναλυτική βαθμολόγηση.</p><button type="button" disabled={!!busy} onClick={() => void submit()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy === 'submit' ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}Υποβολή Διαγωνίσματος</button></div></div>}
    {pendingSubmission.current&&phase==='taking'&&<p className="assessment-local-notice">Η υποβολή είναι έτοιμη. Αν απέτυχε η σύνδεση, πάτησε ξανά «Υποβολή Διαγωνίσματος» για να σταλεί το ίδιο φύλλο απαντήσεων.</p>}
    {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><AlertCircle size={17} className="shrink-0" />{error}</p>}
  </section>
}
