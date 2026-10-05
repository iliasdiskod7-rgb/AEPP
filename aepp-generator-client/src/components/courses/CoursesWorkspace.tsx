import { Suspense, useRef, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, LibraryBig, List, Search, X } from 'lucide-react'
import { courseCatalog, type CatalogChapter, type CatalogLesson } from '../../data/courses/catalog'
import { cn } from '../../lib/utils'

interface CoursesWorkspaceProps {
  selectedLessonId: string
  onSelectLesson: (id: string) => void
}

const totalLessons = courseCatalog.reduce((count, chapter) => count + chapter.lessons.length, 0)

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('el-GR').trim()
}

export default function CoursesWorkspace({ selectedLessonId, onSelectLesson }: CoursesWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [openChapters, setOpenChapters] = useState<Set<string>>(() => new Set(courseCatalog.map(chapter => chapter.id)))
  const [mobileCatalogOpen, setMobileCatalogOpen] = useState(false)
  const reader = useRef<HTMLDivElement>(null)

  const selected = courseCatalog.flatMap(chapter => chapter.lessons).find(lesson => lesson.id === selectedLessonId)
    ?? courseCatalog[0].lessons[0]
  const query = normalizeSearch(search)
  const visibleChapters = courseCatalog.map(chapter => ({
    ...chapter,
    lessons: query ? chapter.lessons.filter(lesson => normalizeSearch(`${chapter.title} ${chapter.subtitle} μάθημα ${lesson.number} ${lesson.title} ${lesson.summary} ${lesson.searchTerms ?? ''}`).includes(query)) : chapter.lessons,
  })).filter(chapter => chapter.lessons.length > 0)
  const resultCount = visibleChapters.reduce((count, chapter) => count + chapter.lessons.length, 0)
  const LessonComponent = selected.Component

  function selectLesson(lesson: CatalogLesson) {
    onSelectLesson(lesson.id)
    setMobileCatalogOpen(false)
    if (window.matchMedia('(max-width: 1279px)').matches) {
      requestAnimationFrame(() => reader.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }))
    }
  }

  function toggleChapter(chapterId: string) {
    setOpenChapters(current => {
      const next = new Set(current)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  return <section aria-label="Βιβλιοθήκη μαθημάτων" className="mx-auto max-w-7xl">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-2 text-xs font-semibold tracking-wide text-blue-700">ΕΚΠΑΙΔΕΥΤΙΚΟ ΥΛΙΚΟ</p><h1 className="text-2xl font-bold tracking-tight text-slate-900">Μαθήματα & Τεστ</h1><p className="mt-2 text-sm text-slate-500">Βρες το μάθημα που χρειάζεσαι, οργανωμένο ανά κεφάλαιο.</p></div><span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"><LibraryBig size={15} aria-hidden="true" />{totalLessons} διαθέσιμα μαθήματα</span></div>

    <button type="button" aria-expanded={mobileCatalogOpen} aria-controls="courses-catalog" onClick={() => setMobileCatalogOpen(open => !open)} className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 shadow-sm xl:hidden"><span className="flex min-w-0 items-center gap-2"><List size={18} className="shrink-0 text-blue-700" aria-hidden="true" /><span className="truncate">Μάθημα {selected.number}: {selected.title}</span></span>{mobileCatalogOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}</button>

    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside id="courses-catalog" aria-label="Κατάλογος μαθημάτων" className={cn('rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6 xl:block xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto', mobileCatalogOpen ? 'block' : 'hidden')}>
        <div className="border-b border-slate-100 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><BookOpen size={17} className="text-blue-700" aria-hidden="true" />Κατάλογος μαθημάτων</h2><span className="text-xs text-slate-400">{totalLessons}</span></div><label htmlFor="course-search" className="sr-only">Αναζήτηση μαθήματος</label><div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"><Search size={16} className="shrink-0 text-slate-400" aria-hidden="true" /><input id="course-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Αναζήτηση μαθήματος…" className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Καθαρισμός αναζήτησης" className="text-slate-400 hover:text-slate-700"><X size={16} aria-hidden="true" /></button>}</div>{query && <p role="status" className="mt-2 text-xs text-slate-500">{resultCount} {resultCount === 1 ? 'μάθημα βρέθηκε' : 'μαθήματα βρέθηκαν'}</p>}</div>
        <nav aria-label="Μαθήματα ανά κεφάλαιο" className="max-h-[60vh] overflow-y-auto p-2 xl:max-h-none xl:overflow-visible">
          {visibleChapters.length === 0 && <p className="px-3 py-6 text-center text-sm leading-6 text-slate-500">Δεν βρέθηκε μάθημα. Δοκίμασε άλλον όρο.</p>}
          {visibleChapters.map(chapter => <ChapterList key={chapter.id} chapter={chapter} selectedLessonId={selected.id} expanded={Boolean(query) || openChapters.has(chapter.id)} searchActive={Boolean(query)} onToggle={() => toggleChapter(chapter.id)} onSelect={selectLesson} />)}
        </nav>
      </aside>

      <div ref={reader} className="min-w-0 scroll-mt-4">
        <Suspense fallback={<div role="status" className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Φόρτωση μαθήματος…</div>}>
          <LessonComponent key={selected.id} />
        </Suspense>
      </div>
    </div>
  </section>
}

function ChapterList({ chapter, selectedLessonId, expanded, searchActive, onToggle, onSelect }: { chapter: CatalogChapter; selectedLessonId: string; expanded: boolean; searchActive: boolean; onToggle: () => void; onSelect: (lesson: CatalogLesson) => void }) {
  return <div className="mb-1"><button type="button" aria-expanded={expanded} aria-controls={`${chapter.id}-lessons`} disabled={searchActive} onClick={onToggle} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"><span className="min-w-0"><span className="block text-[10px] font-semibold tracking-wide text-slate-400">{chapter.title.toLocaleUpperCase('el-GR')}</span><span className="mt-0.5 block text-xs font-semibold leading-5 text-slate-700">{chapter.subtitle}</span></span><span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">{chapter.lessons.length}{!searchActive && (expanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />)}</span></button><ul id={`${chapter.id}-lessons`} hidden={!expanded} className="mt-1 space-y-1 border-l border-slate-200 pl-2 ml-4">{chapter.lessons.map(lesson => <li key={lesson.id}><button type="button" aria-current={selectedLessonId === lesson.id ? 'page' : undefined} onClick={() => onSelect(lesson)} className={cn('flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-xs leading-5', selectedLessonId === lesson.id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}><span className="shrink-0 text-[10px] text-slate-400">{String(lesson.number).padStart(2, '0')}</span><span>{lesson.title}</span></button></li>)}</ul></div>
}
