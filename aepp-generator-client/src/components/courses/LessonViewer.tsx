import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { BookOpenCheck, Check, ChevronRight, Clock3, ListChecks, Route, TriangleAlert } from 'lucide-react'
import { lesson1Data, type TheoryQuestion } from '../../data/courses/lesson1'
import { cn } from '../../lib/utils'

type LessonSection = 'theory' | 'methodology'

const categoryStyles: Record<TheoryQuestion['category'], string> = {
  'Ενέργειες αντιμετώπισης': 'bg-blue-50 text-blue-700 ring-blue-100',
  'Ορισμοί & παραδείγματα': 'bg-sky-50 text-sky-700 ring-sky-100',
  'Κατανόηση προβλήματος': 'bg-violet-50 text-violet-700 ring-violet-100',
  'Δεδομένα & πληροφορίες': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'Δομή προβλήματος': 'bg-amber-50 text-amber-700 ring-amber-100',
  'Απαιτήσεις & στάδια': 'bg-rose-50 text-rose-700 ring-rose-100',
}

export default function LessonViewer() {
  const [activeSection, setActiveSection] = useState<LessonSection>('theory')
  const tabsId = useId()
  const tabList = useRef<HTMLDivElement>(null)
  const lesson = lesson1Data

  function handleTabKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const tabs = Array.from(tabList.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])
    const current = tabs.indexOf(event.currentTarget)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : event.key === 'ArrowRight' ? (current + 1) % tabs.length : (current - 1 + tabs.length) % tabs.length
    tabs[next]?.click()
    tabs[next]?.focus()
  }

  return <section className="mx-auto max-w-6xl" aria-labelledby="lesson-title">
    <header className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-5 py-7 text-white sm:px-8 sm:py-9">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-blue-100"><span className="rounded-full bg-white/15 px-3 py-1">{lesson.chapter}</span><span>Μάθημα 1</span><span aria-hidden="true">•</span><span className="inline-flex items-center gap-1"><Clock3 size={13} aria-hidden="true" />{lesson.estimatedMinutes} λεπτά</span></div>
        <div className="mt-5 flex items-start gap-4"><span className="hidden rounded-2xl bg-white/15 p-3 sm:inline-flex"><BookOpenCheck size={28} aria-hidden="true" /></span><div><h1 id="lesson-title" className="text-2xl font-bold tracking-tight sm:text-3xl">{lesson.title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50 sm:text-base">{lesson.summary}</p></div></div>
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4" aria-label="Στόχοι μαθήματος">{lesson.objectives.map(objective => <div key={objective} className="flex gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-100 text-blue-700"><Check size={12} strokeWidth={3} aria-hidden="true" /></span>{objective}</div>)}</div>
    </header>

    <div ref={tabList} role="tablist" aria-label="Περιεχόμενο μαθήματος" className="mt-7 grid grid-cols-1 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm sm:grid-cols-2">
      <button id={`${tabsId}-theory-tab`} type="button" role="tab" aria-selected={activeSection === 'theory'} aria-controls={`${tabsId}-theory-panel`} tabIndex={activeSection === 'theory' ? 0 : -1} onKeyDown={handleTabKeys} onClick={() => setActiveSection('theory')} className={cn('flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors', activeSection === 'theory' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}><ListChecks size={18} aria-hidden="true" />Ερωτήσεις Θεωρίας<span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">{lesson.theoryQuestions.length}</span></button>
      <button id={`${tabsId}-methodology-tab`} type="button" role="tab" aria-selected={activeSection === 'methodology'} aria-controls={`${tabsId}-methodology-panel`} tabIndex={activeSection === 'methodology' ? 0 : -1} onKeyDown={handleTabKeys} onClick={() => setActiveSection('methodology')} className={cn('flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors', activeSection === 'methodology' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}><Route size={18} aria-hidden="true" />Μεθοδολογία Επίλυσης</button>
    </div>

    <div id={`${tabsId}-theory-panel`} role="tabpanel" aria-labelledby={`${tabsId}-theory-tab`} hidden={activeSection !== 'theory'} className="mt-6">
      <div className="mb-5"><h2 className="text-lg font-semibold">Ερωτήσεις θεωρίας</h2><p className="mt-1 text-sm text-slate-500">{lesson.theoryQuestions.length} ερωτήσεις με απαντήσεις και λέξεις-κλειδιά.</p></div>
      <div className="grid items-start gap-4 lg:grid-cols-2">{lesson.theoryQuestions.map((item, index) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1', categoryStyles[item.category])}>{item.category}</span><span className="text-xs font-semibold text-slate-300">{String(index + 1).padStart(2, '0')}</span></div>
        <h3 className="mt-5 text-base font-semibold leading-6 text-slate-900">{item.question}</h3>
        <div className="mt-3 space-y-2 text-sm leading-7 text-slate-600">{item.answer.split('\n').map((line, lineIndex) => line.startsWith('• ') ? <p key={lineIndex} className="pl-4 before:mr-2 before:content-['•']">{line.slice(2)}</p> : <p key={lineIndex}>{line}</p>)}</div>
        <div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-400">ΛΕΞΕΙΣ-ΚΛΕΙΔΙΑ</p><ul className="flex flex-wrap gap-2">{item.keyPoints.map(point => <li key={point} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">{point}</li>)}</ul></div>
      </article>)}</div>
    </div>

    <div id={`${tabsId}-methodology-panel`} role="tabpanel" aria-labelledby={`${tabsId}-methodology-tab`} hidden={activeSection !== 'methodology'} className="mt-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><p className="text-xs font-semibold text-blue-700">ΜΕΘΟΔΟΛΟΓΙΑ</p><h2 className="mt-2 text-xl font-semibold text-slate-900">{lesson.methodology.title}</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{lesson.methodology.introduction}</p></div>
      <ol className="mt-5 space-y-4">{lesson.methodology.steps.map((step, index) => <li key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-5 sm:p-6">
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white sm:mb-0">{index + 1}</span>
        <div><h3 className="text-base font-semibold text-slate-900">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p><ul className="mt-4 grid gap-2 md:grid-cols-2">{step.prompts.map(prompt => <li key={prompt} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600"><ChevronRight size={14} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />{prompt}</li>)}</ul></div>
      </li>)}</ol>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6"><h3 className="flex items-center gap-2 font-semibold text-emerald-900"><BookOpenCheck size={19} aria-hidden="true" />Τελικός έλεγχος</h3><ul className="mt-4 space-y-3">{lesson.methodology.finalCheck.map(item => <li key={item} className="flex gap-2.5 text-sm leading-6 text-emerald-900/75"><Check size={16} className="mt-1 shrink-0" aria-hidden="true" />{item}</li>)}</ul></section>
        <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 sm:p-6"><h3 className="flex items-center gap-2 font-semibold text-amber-900"><TriangleAlert size={19} aria-hidden="true" />Συνηθισμένες παγίδες</h3><ul className="mt-4 space-y-3">{lesson.methodology.commonMistakes.map(item => <li key={item} className="flex gap-2.5 text-sm leading-6 text-amber-900/75"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul></section>
      </div>
    </div>
  </section>
}
