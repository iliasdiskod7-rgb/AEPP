import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDownToLine, BookOpen, Clock3, Printer } from 'lucide-react'
import type { ExamJsonResponseDto } from '../types/exam'
import { Button } from './common/Button'
import { CodeEditor } from './exam/CodeEditor'
import { Markdown } from './exam/Markdown'
import { cn } from '../lib/utils'

export interface ExamPreviewProps {
  exam: ExamJsonResponseDto | null
  isLoading?: boolean
  isDemo?: boolean
}

const tabs = ['Εκφώνηση Διαγωνίσματος', 'Ενδεικτικές Λύσεις'] as const

export default function ExamPreview({ exam, isLoading = false, isDemo = false }: ExamPreviewProps) {
  const id = useId()
  const [activeTab, setActiveTab] = useState(0)
  const [notice, setNotice] = useState('')
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const total = exam?.sections.reduce((sum, section) => sum + section.totalMarks, 0) ?? 0
  const count = exam?.sections.reduce((sum, section) => sum + section.questions.length, 0) ?? 0

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') next = 1 - index
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = 1
    else return
    event.preventDefault()
    setActiveTab(next)
    tabRefs.current[next]?.focus()
  }

  function download() {
    if (!exam) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(exam, null, 2)], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'διαγώνισμα-πληροφορικής.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Έγινε λήψη του διαγωνίσματος μαζί με τις λύσεις.')
  }

  return <section aria-label="Προεπισκόπηση διαγωνίσματος" aria-busy={isLoading}>
    <div className="preview-controls mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Πληροφορική · Γ΄ Λυκείου</p><h2 className="mt-2 text-2xl font-semibold">Το διαγώνισμά σου, οργανωμένο.</h2><p className="mt-2 text-sm text-stone-500">Εκφωνήσεις και αναλυτικές λύσεις σε ΓΛΩΣΣΑ.</p></div><div className="flex gap-2"><Button variant="secondary" disabled={!exam} onClick={() => window.print()}><Printer size={15} />Εκτύπωση</Button><Button variant="secondary" disabled={!exam} onClick={download} title="Λήψη αρχείου JSON που περιλαμβάνει και τις λύσεις"><ArrowDownToLine size={15} />Λήψη</Button></div></div>
    {exam && <div className="preview-controls mb-5 grid grid-cols-3 gap-3">{[[exam.sections.length, 'Θέματα'], [count, 'Ερωτήματα'], [total, 'Μονάδες']].map(([value, label]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-2xl font-semibold text-teal-900">{value}</p><p className="mt-1 text-xs text-stone-500">{label}</p></div>)}</div>}
    {isLoading && <p role="status" className="preview-controls mb-4 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">Δημιουργείται νέο διαγώνισμα. Η προηγούμενη προεπισκόπηση παραμένει διαθέσιμη.</p>}
    {!exam ? <div className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-20 text-center"><BookOpen className="mx-auto mb-4 text-teal-700" size={30} /><h3 className="font-semibold">Δεν υπάρχει ακόμη διαγώνισμα</h3><p className="mt-2 text-sm text-stone-500">Επίλεξε τις παραμέτρους και πάτησε «Δημιουργία Διαγωνίσματος».</p></div> : <div className="preview-shell overflow-hidden rounded-xl border border-stone-200 bg-[#eeede8]">
      <div className="preview-controls border-b border-stone-200 bg-white p-3"><div role="tablist" aria-label="Περιεχόμενο διαγωνίσματος" className="flex flex-wrap gap-2">{tabs.map((label, index) => <button key={label} ref={element => { tabRefs.current[index] = element }} role="tab" id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={activeTab === index} tabIndex={activeTab === index ? 0 : -1} onClick={() => setActiveTab(index)} onKeyDown={event => handleTabKey(event, index)} className={cn('rounded-lg px-4 py-3 text-sm font-semibold', activeTab === index ? 'bg-teal-800 text-white' : 'text-stone-500 hover:bg-stone-100')}>{label}</button>)}</div></div>
      {isDemo && <p className="preview-controls bg-amber-50 px-5 py-3 text-xs text-amber-900">Ενδεικτικό διαγώνισμα εξάσκησης · Σταθερό δείγμα</p>}
      {tabs.map((label, index) => <div key={label} id={`${id}-panel-${index}`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`} hidden={activeTab !== index} tabIndex={0}>
        {activeTab === index && <div className="paper-surround p-3 sm:p-6"><article className="exam-paper mx-auto max-w-[820px] bg-white px-5 py-8 shadow-sm sm:px-10 sm:py-12">
          <header className="mb-8 border-b-2 border-teal-800 pb-6"><p className="mb-3 font-sans text-[10px] uppercase tracking-widest text-teal-700">{label}</p><h1 className="font-serif text-3xl leading-tight text-teal-950">{exam.title}</h1><div className="mt-4 flex flex-wrap items-center gap-5 font-sans text-xs text-stone-500"><span className="flex items-center gap-1.5"><Clock3 size={14} />{exam.durationMinutes} λεπτά</span><span>{total} μονάδες</span><span>{exam.sections.length} θέματα</span></div></header>
          {index === 0 && <><div className="mb-6 flex flex-wrap gap-5 font-sans text-xs text-stone-500"><span className="min-w-40 flex-1 border-b border-stone-200 pb-3">Ονοματεπώνυμο</span><span className="border-b border-stone-200 pb-3">Τμήμα: __________</span></div><p className="mb-8 text-sm italic leading-7 text-stone-500">Να απαντήσετε σε όλα τα θέματα. Όπου ζητείται κώδικας, να χρησιμοποιήσετε ΓΛΩΣΣΑ. Οι δείκτες των πινάκων ξεκινούν από το 1.</p></>}
          <div className="space-y-10">{exam.sections.map((section, sectionIndex) => <section key={`${section.theme}-${sectionIndex}`} className="exam-section"><header className="mb-5 flex items-center justify-between gap-3 border-b border-stone-200 pb-3"><h2 className="text-xl font-bold text-teal-900">{section.theme}</h2><span className="shrink-0 font-sans text-xs text-stone-500">{section.totalMarks} μονάδες</span></header><div className="space-y-7">{section.questions.map((question, questionIndex) => <section key={`${question.code}-${questionIndex}`} className="question"><div className="mb-3 flex justify-between font-sans"><h3 className="text-sm font-bold text-teal-800">{question.code}</h3><span className="text-xs text-stone-500">{question.marks} μονάδες</span></div>{index === 0 ? <><Markdown>{question.questionText}</Markdown>{question.glowCodeSnippet !== null && question.glowCodeSnippet.trim() !== '' && <CodeEditor value={question.glowCodeSnippet} readOnly label="ΓΛΩΣΣΑ" />}</> : <Markdown>{question.solutionText}</Markdown>}</section>)}</div></section>)}</div>
          <footer className="mt-10 border-t border-stone-200 pt-4 text-center font-sans text-xs text-stone-400">{index === 0 ? 'Τέλος διαγωνίσματος' : 'Τέλος ενδεικτικών λύσεων'}</footer>
        </article></div>}
      </div>)}
    </div>}
    <p role="status" className="preview-controls mt-3 text-xs text-teal-800">{notice}</p>
  </section>
}
