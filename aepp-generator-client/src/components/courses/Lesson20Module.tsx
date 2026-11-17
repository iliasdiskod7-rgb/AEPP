import { lesson20Data } from '../../data/courses/lesson20'
import { LessonModule } from './LessonModule'
import { lazy, Suspense, useState } from 'react'
const SearchLab = lazy(() => import('../../tools/arrays/SearchLab'))

export default function Lesson20Module() {
  const [tab, setTab] = useState<'lesson' | 'lab'>('lesson')
  return (
    <>
      <nav className="note-actions mb-4" aria-label="Μάθημα 20">
        <button
          type="button"
          aria-pressed={tab === 'lesson'}
          onClick={() => setTab('lesson')}
          className="rounded-lg border px-4 py-2"
        >
          Μάθημα & Ασκήσεις
        </button>
        <button
          type="button"
          aria-pressed={tab === 'lab'}
          onClick={() => setTab('lab')}
          className="rounded-lg border px-4 py-2"
        >
          Εργαστήριο Αναζήτησης
        </button>
      </nav>
      <div hidden={tab !== 'lesson'}>
        <LessonModule lesson={lesson20Data} lessonNumber={20} />
      </div>
      {tab === 'lab' && (
        <Suspense fallback={<p role="status">Φόρτωση εργαστηρίου…</p>}>
          <SearchLab />
        </Suspense>
      )}
    </>
  )
}
