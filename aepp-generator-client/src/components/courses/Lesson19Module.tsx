import { lesson19Data } from '../../data/courses/lesson19'
import { LessonModule } from './LessonModule'
import { lazy, Suspense, useState } from 'react'
const SortingLab = lazy(() => import('../../tools/arrays/SortingLab'))

export default function Lesson19Module() {
  const [tab, setTab] = useState<'lesson' | 'lab'>('lesson')
  return (
    <>
      <nav className="note-actions mb-4" aria-label="Μάθημα 19">
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
          Εργαστήριο Ταξινόμησης
        </button>
      </nav>
      <div hidden={tab !== 'lesson'}>
        <LessonModule lesson={lesson19Data} lessonNumber={19} />
      </div>
      {tab === 'lab' && (
        <Suspense fallback={<p role="status">Φόρτωση εργαστηρίου…</p>}>
          <SortingLab />
        </Suspense>
      )}
    </>
  )
}
