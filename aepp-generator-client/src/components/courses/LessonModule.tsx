import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, BookOpenCheck, Check, ChevronDown, ChevronUp, Clock3, Eye, EyeOff, Lightbulb, RotateCcw, Target, X } from 'lucide-react'
import type { Lesson, LessonTip } from '../../data/courses/lesson1'
import { cn } from '../../lib/utils'

type LessonTab = 'theory' | 'tips' | 'quiz'

const tabs: { id: LessonTab; label: string; icon: typeof BookOpenCheck }[] = [
  { id: 'theory', label: 'Θεωρία & Ερωτήσεις', icon: BookOpenCheck },
  { id: 'tips', label: 'Tips & SOS', icon: Lightbulb },
  { id: 'quiz', label: 'Ασκήσεις & Κουίζ', icon: Target },
]

const tipStyles: Record<LessonTip['kind'], { card: string; badge: string; icon: typeof AlertTriangle }> = {
  'Προσοχή': { card: 'border-red-200 bg-red-50/60', badge: 'bg-red-100 text-red-800', icon: AlertTriangle },
  'Παγίδα': { card: 'border-amber-200 bg-amber-50/60', badge: 'bg-amber-100 text-amber-800', icon: AlertTriangle },
  'Μνημονικό': { card: 'border-blue-200 bg-blue-50/60', badge: 'bg-blue-100 text-blue-800', icon: Lightbulb },
}
function AnswerText({ answer }: { answer: string }) {
  return <div className="space-y-2 text-sm leading-7 text-slate-600">{answer.split('\n').map((line, index) => line.startsWith('• ')
    ? <p key={index} className="flex gap-2"><span aria-hidden="true" className="text-blue-600">•</span><span>{line.slice(2)}</span></p>
    : <p key={index}>{line}</p>)}</div>
}

export function LessonModule({ lesson, lessonNumber }: { lesson: Lesson; lessonNumber: number | string }) {
  const [activeTab, setActiveTab] = useState<LessonTab>('theory')
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(() => new Set())
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const id = useId()
  const tabList = useRef<HTMLDivElement>(null)
  const allOpen = openQuestions.size === lesson.theoryQuestions.length
  const answeredCount = Object.keys(answers).length
  const score = lesson.quizQuestions.filter(question => answers[question.id] === question.correctOptionIndex).length

  function toggleQuestion(questionId: string) {
    setOpenQuestions(current => {
      const next = new Set(current)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      return next
    })
  }

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(tabList.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    const current = buttons.indexOf(event.currentTarget)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : event.key === 'ArrowRight' ? (current + 1) % buttons.length : (current - 1 + buttons.length) % buttons.length
    buttons[next]?.click()
    buttons[next]?.focus()
  }

  return <section className="mx-auto max-w-6xl" aria-labelledby={`${id}-title`}>
    <header className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100"><span className="rounded-full bg-white/15 px-3 py-1">{lesson.chapter}</span><span>Μάθημα {lessonNumber}</span><span aria-hidden="true">•</span><span className="inline-flex items-center gap-1"><Clock3 size={13} aria-hidden="true" />{lesson.estimatedMinutes} λεπτά</span></div>
        <div className="mt-5 flex items-start gap-4"><span className="hidden rounded-2xl bg-white/15 p-3 sm:inline-flex"><BookOpenCheck size={28} aria-hidden="true" /></span><div><h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">{lesson.summary}</p></div></div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4" aria-label="Στόχοι μαθήματος">{lesson.objectives.map(objective => <div key={objective} className="flex gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>{objective}</div>)}</div>
    </header>

    <div ref={tabList} role="tablist" aria-label="Περιεχόμενο μαθήματος" className="mt-7 grid gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-3">
      {tabs.map(({ id: tabId, label, icon: Icon }) => <button key={tabId} id={`${id}-${tabId}-tab`} type="button" role="tab" aria-selected={activeTab === tabId} aria-controls={`${id}-${tabId}-panel`} tabIndex={activeTab === tabId ? 0 : -1} onKeyDown={handleTabKeys} onClick={() => setActiveTab(tabId)} className={cn('flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors', activeTab === tabId ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}><Icon size={18} aria-hidden="true" />{label}{tabId === 'theory' && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">{lesson.theoryQuestions.length}</span>}</button>)}
    </div>

    <div id={`${id}-theory-panel`} role="tabpanel" aria-labelledby={`${id}-theory-tab`} hidden={activeTab !== 'theory'} className="mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Ερωτήσεις θεωρίας</h2><p className="mt-1 text-sm text-slate-500">Άνοιξε κάθε κάρτα αφού πρώτα προσπαθήσεις να απαντήσεις μόνος σου.</p></div><button type="button" onClick={() => setOpenQuestions(allOpen ? new Set() : new Set(lesson.theoryQuestions.map(question => question.id)))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">{allOpen ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}{allOpen ? 'Απόκρυψη όλων των απαντήσεων' : 'Εμφάνιση όλων των απαντήσεων'}</button></div>
      <div className="grid items-start gap-4 lg:grid-cols-2">{lesson.theoryQuestions.map((item, index) => {
        const isOpen = openQuestions.has(item.id)
        const answerId = `${id}-${item.id}-answer`
        return <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">{item.category}</span>{item.isSos && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-700">{item.sosLabel ?? 'SOS'}</span>}</div><span className="text-xs font-semibold text-slate-400">{String(index + 1).padStart(2, '0')}</span></div><h3 className="mt-4 text-base font-semibold leading-6 text-slate-900">{item.question}</h3><button type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => toggleQuestion(item.id)} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900">{isOpen ? 'Απόκρυψη απάντησης' : 'Εμφάνιση απάντησης'}{isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}</button></div>
          <div id={answerId} hidden={!isOpen} className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6"><p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500">ΑΠΑΝΤΗΣΗ</p><AnswerText answer={item.answer} /><div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">{item.keyPoints.map(point => <span key={point} className="rounded-md bg-white px-2.5 py-1 text-[11px] text-slate-600 ring-1 ring-slate-200">{point}</span>)}</div></div>
        </article>
      })}</div>
    </div>

    <div id={`${id}-tips-panel`} role="tabpanel" aria-labelledby={`${id}-tips-tab`} hidden={activeTab !== 'tips'} className="mt-6">
      <div className="mb-5"><h2 className="text-lg font-semibold">Σημεία SOS για επανάληψη</h2><p className="mt-1 text-sm text-slate-500">Οι έννοιες που συχνά μπερδεύονται και όσα αξίζει να θυμάσαι.</p></div>
      <div className="grid items-start gap-4 lg:grid-cols-2">{lesson.tips.map(tip => { const style = tipStyles[tip.kind]; const Icon = style.icon; return <article key={tip.id} className={cn('rounded-2xl border p-5 sm:p-6', style.card)}><div className="flex items-center gap-2"><Icon size={19} aria-hidden="true" /><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', style.badge)}>{tip.kind}</span></div><h3 className="mt-4 text-base font-semibold text-slate-900">{tip.title}</h3><p className="mt-2 text-sm leading-7 text-slate-700">{tip.body}</p><p className="mt-4 border-t border-current/10 pt-3 text-xs text-slate-600">Σχετικές ερωτήσεις: {tip.relatedQuestionIds.map(questionId => Number(questionId.slice(1))).join(', ')}</p></article> })}</div>
    </div>

    <div id={`${id}-quiz-panel`} role="tabpanel" aria-labelledby={`${id}-quiz-tab`} hidden={activeTab !== 'quiz'} className="mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Δοκίμασε όσα έμαθες</h2><p className="mt-1 text-sm text-slate-500">Διάλεξε μία απάντηση ανά ερώτηση. Η εξήγηση εμφανίζεται αμέσως.</p></div><button type="button" onClick={() => setAnswers({})} disabled={answeredCount === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={15} aria-hidden="true" />Νέα προσπάθεια</button></div>
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold text-slate-800">Βαθμολογία: {score}/{lesson.quizQuestions.length}</span><span className="text-slate-500">Απαντήθηκαν {answeredCount}/{lesson.quizQuestions.length}</span></div><div role="progressbar" aria-label="Πρόοδος κουίζ" aria-valuemin={0} aria-valuemax={lesson.quizQuestions.length} aria-valuenow={answeredCount} className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${(answeredCount / lesson.quizQuestions.length) * 100}%` }} /></div></div>
      <div className="space-y-4">{lesson.quizQuestions.map((question, index) => {
        const selected = answers[question.id]
        const answered = selected !== undefined
        const correct = selected === question.correctOptionIndex
        return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{question.kind}</span><span className="text-xs text-slate-400">{index + 1}/{lesson.quizQuestions.length}</span></div><h3 className="mt-4 text-base font-semibold leading-6 text-slate-900">{question.question}</h3><div className="mt-4 grid gap-2">{question.options.map((option, optionIndex) => {
          const showCorrect = answered && optionIndex === question.correctOptionIndex
          const showIncorrect = answered && optionIndex === selected && !correct
          return <button key={option} type="button" disabled={answered} onClick={() => setAnswers(current => ({ ...current, [question.id]: optionIndex }))} className={cn('flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors', showCorrect ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : showIncorrect ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50', answered && 'cursor-default')}><span>{option}</span>{showCorrect && <Check size={18} className="shrink-0" aria-hidden="true" />}{showIncorrect && <X size={18} className="shrink-0" aria-hidden="true" />}</button>
        })}</div>{answered && <div role="status" className={cn('mt-4 rounded-xl border p-4 text-sm leading-6', correct ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900')}><p className="font-semibold">{correct ? 'Σωστά!' : 'Χρειάζεται επανάληψη.'}</p><p className="mt-1">{question.explanation}</p></div>}</article>
      })}</div>
      {answeredCount === lesson.quizQuestions.length && <p role="status" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">Ολοκλήρωσες το κουίζ με {score} σωστές απαντήσεις στις {lesson.quizQuestions.length}. Μπορείς να δοκιμάσεις ξανά.</p>}
    </div>
  </section>
}
