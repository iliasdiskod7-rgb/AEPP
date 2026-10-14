import { lesson13Data } from '../../data/courses/lesson13'
import { LessonModule } from './LessonModule'
import { lazy, Suspense, useState } from 'react'
const LoopLab=lazy(()=>import('../../tools/LoopLab'))

export default function Lesson13Module() {
  const [tab,setTab]=useState<'lesson'|'lab'>('lesson')
  return <><nav className="note-actions mb-4" aria-label="Μάθημα 13"><button type="button" aria-pressed={tab==='lesson'} onClick={()=>setTab('lesson')} className="rounded-lg border px-4 py-2">Μάθημα & Ασκήσεις</button><button type="button" aria-pressed={tab==='lab'} onClick={()=>setTab('lab')} className="rounded-lg border px-4 py-2">Εργαστήριο Βρόχων · Προαιρετική εμβάθυνση</button></nav><div hidden={tab!=='lesson'}><LessonModule lesson={lesson13Data} lessonNumber={13}/></div>{tab==='lab'&&<Suspense fallback={<p role="status">Φόρτωση εργαστηρίου…</p>}><LoopLab/></Suspense>}</>
}
