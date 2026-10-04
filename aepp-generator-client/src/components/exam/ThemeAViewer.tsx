import type { ExamSection } from '../../types/exam'
import { sectionLetters } from '../../lib/labels'
import { Markdown } from './Markdown'
import { ThemeBTraceTable } from './ThemeBTraceTable'

/** Κοινή εμφάνιση θεμάτων· το Θέμα Β υποστηρίζει και πίνακα τιμών. */
export function ThemeAViewer({ section, showSolutions = false }: { section: ExamSection; showSolutions?: boolean }) {
  return <section className="exam-section" aria-labelledby={`section-${section.id}`}>
    <header className="mb-6 flex items-center justify-between gap-4 border-b border-stone-200 pb-3">
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 font-sans text-sm font-bold text-teal-800">{sectionLetters[section.sectionType]}</span><h2 id={`section-${section.id}`} className="text-lg font-semibold text-stone-800">{section.title}</h2></div>
      <span className="shrink-0 font-sans text-xs text-stone-500">{section.totalMarks} μονάδες</span>
    </header>
    <div className="space-y-7">{[...section.questions].sort((a, b) => a.orderIndex - b.orderIndex).map(question => <article key={question.id} className="question">
      <div className="mb-2 flex justify-between gap-3 font-sans"><h3 className="text-sm font-bold text-teal-800">{question.subTitle}</h3><span className="text-xs text-stone-400">{question.marks} μονάδες</span></div>
      <Markdown>{question.contentMarkdown}</Markdown>
      {section.sectionType === 'ThemeB' && <ThemeBTraceTable json={question.executionTraceJson} showSolutions={showSolutions} />}
      {showSolutions && <div className="mt-3 rounded-lg border-l-2 border-teal-600 bg-teal-50/70 p-4"><p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-widest text-teal-700">Ενδεικτική λύση</p><Markdown>{question.solutionMarkdown}</Markdown></div>}
    </article>)}</div>
  </section>
}
