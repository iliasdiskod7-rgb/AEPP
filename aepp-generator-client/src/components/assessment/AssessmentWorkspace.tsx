import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Clock3, LoaderCircle, Send } from 'lucide-react'
import { Markdown } from '../exam/Markdown'
import InteractiveProgram from './InteractiveProgram'
import { prepareAssessment, localAttempt } from '../../assessment/assessmentFlow'
import { loadPracticeExam } from '../../api/assessmentLoader'
import { getMockExam, getMockExamBank } from '../../assessment/mockExamBank'
import { practiceExam } from '../../assessment/practiceExam'
import { checkProgram } from '../../assessment/workerClient'
import type {
  AnswerSheet,
  AnswerValue,
  AssessmentQuestion,
  AssessmentReport,
  AssessmentExam,
} from '../../assessment/model'

import { useAuth } from '../../auth/AuthContext'
import { buildAttemptSubmission, type AttemptDetail } from '../../assessment/attempts'
import { startExamAttempt, submitExamAttempt, getExamAttempt, attemptError } from '../../api/attempts'
import { draftKey, readAssessmentDraft } from '../../assessment/drafts'
import ExamLobbyCard from './ExamLobbyCard'
import { formatExamTime, remainingExamSeconds } from '../../assessment/examLobby'
import { getPracticeExamList } from '../../api/attempts'
import AssessmentHistory from './AssessmentHistory'
import AssessmentReportView from './AssessmentReportView'
import '../interpreter/interpreter.css'
import './assessment.css'

const emptyRows = (question: Extract<AssessmentQuestion, { kind: 'trace' }>) =>
  question.rowLabels.map(() => question.columns.map(() => ''))

export default function AssessmentWorkspace({
  onOpenDebugger,
}: {
  onOpenDebugger: (source: string, inputs: string[]) => void
}) {
  const { user } = useAuth()
  const [catalog, setCatalog] = useState<AssessmentExam[]>([])
  const [catalogError, setCatalogError] = useState('')
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [phase, setPhase] = useState<'intro' | 'taking' | 'report'>('intro')
  const [answers, setAnswers] = useState<AnswerSheet>(() => readAssessmentDraft(practiceExam, user?.id))
  const [report, setReport] = useState<AssessmentReport | null>(null)

  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null)
  const [savedExam, setSavedExam] = useState<AssessmentExam | null>(null)
  const [selectedExam, setSelectedExam] = useState<AssessmentExam | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [localOnly, setLocalOnly] = useState(false)
  const [loadNotice, setLoadNotice] = useState('')
  const loadSequence = useRef(0),
    loadController = useRef<AbortController | null>(null),
    mounted = useRef(true)
  const pendingSubmission = useRef<ReturnType<typeof buildAttemptSubmission> | null>(null)
  useEffect(() => {
    mounted.current = true
    void loadRandomPracticeExam()
    return () => {
      mounted.current = false
      loadSequence.current++
      loadController.current?.abort()
    }
  }, [])
  const pendingId = useRef<string | null>(null)
  const submitting = useRef(false)
  const currentUser = useRef(user?.id)
  currentUser.current = user?.id
  useEffect(() => {
    currentUser.current = user?.id
    return () => {
      currentUser.current = undefined
    }
  }, [user?.id])
  const exam = useMemo(() => savedExam ?? selectedExam ?? practiceExam, [savedExam, selectedExam])

  useEffect(() => {
    if (phase === 'taking') document.getElementById('assessment-title')?.focus()
  }, [phase])
  useEffect(() => {
    if (phase !== 'taking') return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [phase, attempt?.attemptId])

  useEffect(() => {
    if (phase !== 'taking') return
    try {
      localStorage.setItem(draftKey(exam.id, user?.id), JSON.stringify(answers))
    } catch {
      /* Η επίλυση συνεχίζεται στη μνήμη. */
    }
  }, [answers, exam.id, phase, user?.id])

  function resetPractice() {
    loadController.current?.abort()
    loadSequence.current++
    setAttempt(null)
    setSavedExam(null)
    setSelectedExam(null)
    pendingId.current = null
    pendingSubmission.current = null
    setPhase('intro')
    setReport(null)
    setError('')
    setLoadNotice('')
    setLocalOnly(false)
    setAnswers(readAssessmentDraft(practiceExam, user?.id))
    void loadRandomPracticeExam()
  }
  async function loadRandomPracticeExam() {
    if (submitting.current) return
    loadController.current?.abort()
    const controller = new AbortController()
    loadController.current = controller
    const sequence = ++loadSequence.current,
      owner = user?.id
    setBusy('random')
    setLoading(true)
    setError('')
    try {
      const result = await loadPracticeExam(!!user, controller.signal, selectedExam?.id)
      if (sequence !== loadSequence.current || currentUser.current !== owner || !mounted.current) return
      setAttempt(null)
      setSavedExam(null)
      setSelectedExam(result.exam)
      pendingId.current = null
      pendingSubmission.current = null
      setLocalOnly(result.local)
      setLoadNotice(result.notice)
      setAnswers(readAssessmentDraft(result.exam, owner))
      setReport(null)
      setPhase('intro')
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(attemptError(cause))
    } finally {
      if (sequence === loadSequence.current && mounted.current) {
        setBusy(null)
        setLoading(false)
      }
    }
  }
  function selectLobbyExam(item: AssessmentExam) {
    if (busy || phase !== 'intro') return
    setSelectedExam(item)
    setSavedExam(null)
    setAttempt(null)
    pendingId.current = null
    pendingSubmission.current = null
    setAnswers(readAssessmentDraft(item, user?.id))
    setError('')
  }
  async function loadCatalog() {
    if (catalogLoading) return
    if (localOnly) {
      setCatalog(await getMockExamBank())
      return
    }
    const owner = user?.id
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const items = await getPracticeExamList()
      if (mounted.current && currentUser.current === owner) setCatalog(items)
    } catch {
      if (mounted.current) setCatalogError('Δεν φορτώθηκε η λίστα διαγωνισμάτων.')
    } finally {
      if (mounted.current) setCatalogLoading(false)
    }
  }
  function update(id: string, value: AnswerValue) {
    setAnswers(current => ({ ...current, [id]: value }))
  }
  function nested(id: string, key: string, value: string) {
    setAnswers(current => ({
      ...current,
      [id]: {
        ...(current[id] && typeof current[id] === 'object' && !Array.isArray(current[id]) ? current[id] : {}),
        [key]: value,
      },
    }))
  }
  function mapAnswer(id: string): Record<string, string> {
    const value = answers[id]
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  }
  function textAnswer(id: string): string {
    const value = answers[id]
    return typeof value === 'string' ? value : ''
  }
  function rowsAnswer(question: Extract<AssessmentQuestion, { kind: 'trace' }>): string[][] {
    const value = answers[question.id]
    return Array.isArray(value) ? value : emptyRows(question)
  }
  async function start() {
    if (submitting.current || loading) return
    submitting.current = true
    setBusy('start')
    setError('')
    const owner = user?.id
    try {
      if (user)
        try {
          pendingId.current ??= crypto.randomUUID()
          const saved = await startExamAttempt(pendingId.current, exam.id, undefined)
          if (currentUser.current !== owner || !mounted.current) return
          setAttempt(saved)
          setSavedExam(saved.exam)
          setLocalOnly(false)
          setLoadNotice('')
          setReport(saved.report)
          setPhase(saved.report ? 'report' : 'taking')
          return
        } catch {
          /* Local practice is available when the API is unavailable. */
        }
      if (!localOnly && selectedExam)
        throw Error('Δεν ήταν δυνατή η έναρξη του επιλεγμένου διαγωνίσματος. Δοκίμασε ξανά.')
      const localExam = await getMockExam(exam.id)
      if (currentUser.current !== owner || !mounted.current) return
      const saved = localAttempt(localExam, crypto.randomUUID(), user?.fullName)
      pendingId.current = saved.attemptId
      setSelectedExam(localExam)
      setSavedExam(localExam)
      setAttempt(saved)
      setLocalOnly(true)
      setAnswers(readAssessmentDraft(localExam, owner))
      setPhase('taking')
      setLoadNotice(
        'Η προσπάθεια δεν έχει αποθηκευτεί στον λογαριασμό σου.',
      )
    } catch (cause) {
      if (mounted.current) setError(attemptError(cause))
    } finally {
      if (mounted.current) {
        submitting.current = false
        setBusy(null)
      }
    }
  }
  async function submit() {
    if (!attempt || submitting.current) return
    submitting.current = true
    setError('')
    setBusy('submit')
    const owner = user?.id
    try {
      if (localOnly) {
        const result = await prepareAssessment(exam, answers, checkProgram, true)
        if (currentUser.current !== owner || !mounted.current) return
        setAttempt({
          ...attempt,
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          version: 1,
          autoGradeScore: result.earned,
          finalScore: result.earned,
          report: result,
        })
        setReport(result)
        setPhase('report')
      } else {
        if (!user) throw Error('Συνδέσου ξανά για να υποβάλεις τις απαντήσεις σου.')
        if (!pendingSubmission.current) {
          const result = await prepareAssessment(exam, answers, checkProgram, false)
          pendingSubmission.current = buildAttemptSubmission(attempt.attemptId, exam, answers, result)
        }
        if (currentUser.current !== owner || !mounted.current) return
        const saved = await submitExamAttempt(pendingSubmission.current)
        if (currentUser.current !== owner || !mounted.current) return
        if (!saved.report) throw Error('Η υποβολή δεν επέστρεψε αναφορά. Δοκίμασε ξανά.')
        setAttempt(saved)
        setSavedExam(saved.exam)
        setReport(saved.report)
        setPhase('report')
        try {
          localStorage.removeItem(draftKey(exam.id, owner))
        } catch {}
      }
      window.scrollTo({ top: 0, behavior: 'auto' })
    } catch (cause) {
      if (mounted.current) setError(attemptError(cause))
    } finally {
      if (mounted.current) {
        submitting.current = false
        setBusy(null)
      }
    }
  }
  async function syncLocalAttempt() {
    if (!user || !attempt || !report || submitting.current) return
    submitting.current = true
    setBusy('sync')
    setError('')
    const owner = user.id
    try {
      await startExamAttempt(attempt.attemptId, exam.id)
      const saved = await submitExamAttempt(buildAttemptSubmission(attempt.attemptId, exam, answers, report))
      if (currentUser.current !== owner || !mounted.current) return
      if (!saved.report) throw Error('Δεν επέστρεψε αναφορά η υπηρεσία υποβολής.')
      setAttempt(saved)
      setSavedExam(saved.exam)
      setReport(saved.report)
      setLocalOnly(false)
      setLoadNotice('')
      try {
        localStorage.removeItem(draftKey(exam.id, owner))
      } catch {}
    } catch (cause) {
      if (mounted.current) setError(attemptError(cause))
    } finally {
      if (mounted.current) {
        submitting.current = false
        setBusy(null)
      }
    }
  }
  async function openAttempt(id: string) {
    const owner = user?.id,
      saved = await getExamAttempt(id)
    if (currentUser.current !== owner) return
    pendingSubmission.current = null
    setLocalOnly(false)
    setLoadNotice('')
    setAttempt(saved)
    setSavedExam(saved.exam)
    setReport(saved.report)
    setAnswers(
      saved.questionSubmissions.length
        ? Object.fromEntries(saved.questionSubmissions.map(q => [q.questionId, JSON.parse(q.studentAnswerJson)]))
        : readAssessmentDraft(saved.exam, owner),
    )
    setPhase(saved.report ? 'report' : 'taking')
    setHistoryOpen(false)
  }
  function renderQuestion(question: AssessmentQuestion) {
    if (question.kind === 'trueFalse')
      return (
        <div className="space-y-4">
          {question.statements.map((statement, index) => (
            <fieldset key={statement.id} className="rounded-xl border border-slate-200 p-4">
              <legend className="px-1 text-sm font-medium">
                {index + 1}. {statement.text}
              </legend>
              <div className="mt-2 flex gap-5">
                {(['Σωστό', 'Λάθος'] as const).map(value => (
                  <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={statement.id}
                      checked={mapAnswer(question.id)[statement.id] === value}
                      onChange={() => nested(question.id, statement.id, value)}
                    />
                    {value}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )
    if (question.kind === 'matching')
      return (
        <div className="space-y-3">
          {question.pairs.map(pair => (
            <label
              key={pair.id}
              className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm sm:grid-cols-2 sm:items-center"
            >
              <span className="font-semibold">{pair.left}</span>
              <select
                aria-label={`Αντιστοίχιση ${pair.left}`}
                value={mapAnswer(question.id)[pair.id] ?? ''}
                onChange={event => nested(question.id, pair.id, event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">Επίλεξε χαρακτηριστικό</option>
                {question.choices.map(choice => (
                  <option key={choice.id} value={choice.id}>
                    {choice.text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )
    if (question.kind === 'choice')
      return (
        <fieldset className="space-y-2">
          <legend className="sr-only">Επιλογές {question.code}</legend>
          {question.options.map(option => (
            <label
              key={option.id}
              className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50"
            >
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option.id}
                onChange={() => update(question.id, option.id)}
              />
              {option.text}
            </label>
          ))}
        </fieldset>
      )
    if (question.kind === 'fill')
      return (
        <label className="block text-sm font-semibold">
          Η απάντησή σου
          <input
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-normal"
            value={textAnswer(question.id)}
            onChange={event => update(question.id, event.target.value)}
          />
        </label>
      )
    if (question.kind === 'codeBlanks')
      return (
        <div className="overflow-x-auto rounded-xl bg-slate-900 p-4">
          <pre className="min-w-max font-mono text-xs leading-9 text-slate-100">
            {question.template.split(/(\{\{\d+\}\})/gu).map((part, index) => {
              const id = /^\{\{(\d+)\}\}$/u.exec(part)?.[1]
              return id ? (
                <input
                  key={index}
                  aria-label={`Κενό ${id}`}
                  value={mapAnswer(question.id)[id] ?? ''}
                  onChange={event => nested(question.id, id, event.target.value)}
                  className="mx-1 inline-block w-24 rounded border border-blue-400 bg-white px-2 py-1 text-center font-mono text-xs text-slate-900 outline-blue-500"
                  placeholder={`(${id})`}
                />
              ) : (
                <span key={index}>{part}</span>
              )
            })}
          </pre>
        </div>
      )
    if (question.kind === 'trace')
      return (
        <div className="overflow-x-auto">
          <table className="assessment-trace w-full min-w-[650px] border-collapse text-sm">
            <thead>
              <tr>
                <th>Σημείο καταγραφής</th>
                {question.columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {question.rowLabels.map((label, row) => (
                <tr key={label}>
                  <th>{label}</th>
                  {question.columns.map((column, col) => (
                    <td key={`${row}-${col}`}>
                      <input
                        aria-label={`${label}, ${column}`}
                        value={rowsAnswer(question)[row][col]}
                        onChange={event => {
                          const next = rowsAnswer(question).map(cells => [...cells])
                          next[row][col] = event.target.value
                          update(question.id, next)
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    if (question.kind === 'program')
      return (
        <InteractiveProgram
          key={exam.id + ':' + question.id}
          label={`Εκτέλεση κώδικα ${question.code}`}
          source={textAnswer(question.id)}
          onChange={value => update(question.id, value)}
        />
      )
    return (
      <label className="block text-sm font-semibold">
        Η απάντησή σου
        <textarea
          rows={8}
          value={textAnswer(question.id)}
          onChange={event => update(question.id, event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal leading-6"
          placeholder="Γράψε την απάντησή σου εδώ"
        />
      </label>
    )
  }

  const historyButton = user && (
    <button
      type="button"
      disabled={!!busy}
      onClick={() => setHistoryOpen(true)}
      className="mb-4 rounded-lg border px-4 py-2"
    >
      Ιστορικό υποβολών
    </button>
  )
  if (historyOpen)
    return (
      <>
        <button className="mb-4 rounded border p-2" onClick={() => setHistoryOpen(false)}>
          Επιστροφή στο διαγώνισμα
        </button>
        <AssessmentHistory onOpen={openAttempt} />
      </>
    )
  if (loading && !selectedExam)
    return (
      <section className="assessment-loading" role="status" aria-busy="true" aria-label="Φόρτωση διαγωνίσματος">
        <h1>Φόρτωση διαγωνίσματος…</h1>
        <div className="assessment-skeleton" aria-hidden="true" />
        {[1, 2, 3, 4].map(id => (
          <div key={id} className="assessment-skeleton assessment-skeleton-section" aria-hidden="true" />
        ))}
      </section>
    )
  if (phase === 'report' && report && attempt)
    return (
      <>
        {historyButton}
        {localOnly && (
          <div className="assessment-local-notice" role="status">
            <p>Η προσπάθεια δεν έχει αποθηκευτεί στον λογαριασμό σου.</p>
            {user && (
              <button type="button" disabled={!!busy} onClick={() => void syncLocalAttempt()}>
                {busy === 'sync' ? 'Αποθήκευση…' : 'Αποθήκευση στον λογαριασμό'}
              </button>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="assessment-error">
            {error}
          </p>
        )}
        <AssessmentReportView
          localOnly={localOnly}
          exam={exam}
          report={report}
          attempt={attempt}
          onOpenDebugger={onOpenDebugger}
          onRetry={() => {
            try {
              localStorage.removeItem(draftKey(exam.id, user?.id))
            } catch {}
            resetPractice()
            setAnswers({})
          }}
        />
      </>
    )
  return (
    <section className="mx-auto max-w-6xl" aria-labelledby="assessment-title">
      {historyButton}
      {phase === 'taking' && attempt && (
        <div className="exam-countdown" role="timer" aria-label="Χρόνος που απομένει">
          <Clock3 size={20} />
          <span>Χρόνος που απομένει</span>
          <strong>{formatExamTime(remainingExamSeconds(attempt.startedAt, exam.durationMinutes, now))}</strong>
          {remainingExamSeconds(attempt.startedAt, exam.durationMinutes, now) === 0 && (
            <span role="status">Ο χρόνος ολοκληρώθηκε. Υπόβαλε τις απαντήσεις σου.</span>
          )}
        </div>
      )}
      {loadNotice && (
        <div className="assessment-local-notice" role="status">
          <p>{loadNotice}</p>
          {phase === 'intro' && (
            <button type="button" disabled={!!busy} onClick={() => void loadRandomPracticeExam()}>
              Δοκιμή φόρτωσης ξανά
            </button>
          )}
        </div>
      )}
      <header className="mb-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <h1 id="assessment-title" tabIndex={-1} className="mt-2 text-2xl font-bold">
          {phase === 'intro' ? 'Διαγωνίσματα' : exam.title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Απάντησε στην οθόνη, εκτέλεσε τον κώδικά σου και σύγκρινε τις απαντήσεις σου με τις λύσεις μετά την υποβολή.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={15} />
            {exam.durationMinutes} λεπτά
          </span>
          <span>{exam.sections.length} θέματα · 100 μονάδες</span>
          <span>Πρωτότυπο διαγώνισμα εξάσκησης</span>
        </div>
      </header>
      {!user && (
        <p className="mb-4 rounded border p-4">
          Μπορείς να εξασκηθείς τοπικά χωρίς σύνδεση. Για αποθήκευση στον λογαριασμό σου, συνδέσου από το μενού.
        </p>
      )}
      {phase === 'intro' && (
        <p className="sr-only" role="status">
          {busy === 'random' ? 'Επιλογή διαγωνίσματος…' : `Επιλεγμένο διαγώνισμα: ${exam.title}`}
        </p>
      )}
      {phase === 'intro' ? (
        <>
          <ExamLobbyCard
            exam={exam}
            busy={busy}
            canShuffle={true}
            onShuffle={() => void loadRandomPracticeExam()}
            onStart={() => void start()}
          />
          <details
            className="exam-lobby-picker"
            onToggle={event => {
              if (event.currentTarget.open && !catalog.length && !catalogLoading) void loadCatalog()
            }}
          >
            <summary>Ή επίλεξε συγκεκριμένο διαγώνισμα από τη λίστα</summary>
            {catalogLoading ? (
              <p role="status">Φόρτωση λίστας…</p>
            ) : (
              <div className="exam-lobby-list">
                {catalog.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!!busy}
                    aria-pressed={exam.id === item.id}
                    onClick={() => selectLobbyExam(item)}
                  >
                    <span>{item.title}</span>
                    <small>
                      {item.durationMinutes} λεπτά · {item.sections.length} θέματα
                    </small>
                  </button>
                ))}
              </div>
            )}
            {catalogError && (
              <p role="status">
                {catalogError}{' '}
                <button type="button" onClick={() => void loadCatalog()}>
                  Δοκιμή ξανά
                </button>
              </p>
            )}
          </details>
        </>
      ) : (
        <div className="space-y-7">
          {exam.sections.map(section => (
            <section key={section.theme} aria-label={section.theme} className="space-y-4">
              <div className="flex items-center justify-between border-b-2 border-blue-200 pb-2">
                <h2 className="text-xl font-bold text-slate-900">{section.theme}</h2>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
                  {section.marks} μόρια
                </span>
              </div>
              {section.questions.map(question => (
                <article
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold">
                      {question.code} · {question.title}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">{question.marks} μόρια</span>
                  </div>
                  <div className="mb-5 text-sm leading-6 text-slate-700">
                    <Markdown>{question.prompt}</Markdown>
                  </div>
                  <fieldset disabled={busy === 'submit' || !!pendingSubmission.current}>
                    {renderQuestion(question)}
                  </fieldset>
                </article>
              ))}
            </section>
          ))}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <p className="text-sm text-blue-900">
              Με την υποβολή θα δεις τις απαντήσεις σου δίπλα στις ενδεικτικές λύσεις.
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void submit()}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy === 'submit' ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}Υποβολή
              Διαγωνίσματος
            </button>
          </div>
        </div>
      )}
      {pendingSubmission.current && phase === 'taking' && (
        <p className="assessment-local-notice">
          Η υποβολή είναι έτοιμη. Αν απέτυχε η σύνδεση, πάτησε ξανά «Υποβολή Διαγωνίσματος» για να σταλεί το ίδιο φύλλο
          απαντήσεων.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <AlertCircle size={17} className="shrink-0" />
          {error}
        </p>
      )}
    </section>
  )
}
