import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Lightbulb } from 'lucide-react'
import CoursesWorkspace from './CoursesWorkspace'
import { courseCatalog } from '../../data/courses/catalog'
import './learn.css'

const PatternsWorkspace = lazy(() => import('../patterns/PatternsWorkspace'))
export type LearnTab = 'lessons' | 'methodologies'
interface Props {
 active: boolean
 tab: LearnTab
 onTabChange: (tab: LearnTab) => void
 selectedLessonId: string
 onSelectLesson: (id: string) => void
 selectedMethodologyId: string
 onSelectMethodology: (id: string) => void
 methodologyRequest: number
 onOpenMethodology: (id: string) => void
 onOpenProgram: (source: string) => void
 hasCustomProgram: boolean
}
const tabs = [{ id: 'lessons', label: 'Μαθήματα', Icon: BookOpen }, { id: 'methodologies', label: 'Μεθοδολογίες & Tips', Icon: Lightbulb }] as const

export default function LearnWorkspace(props: Props) {
 const buttons = useRef<(HTMLButtonElement | null)[]>([])
 const [methodologiesVisited, setMethodologiesVisited] = useState(props.tab === 'methodologies')
 useEffect(() => { if (props.tab === 'methodologies') setMethodologiesVisited(true) }, [props.tab])
 const lesson = courseCatalog.flatMap(chapter => chapter.lessons).find(item => item.id === props.selectedLessonId)
 return <section className="learn-workspace" aria-labelledby="learn-title">
  <header className="learn-heading"><h1 id="learn-title">Μαθήματα & Εξάσκηση</h1><p>Μελέτησε την ύλη και εφάρμοσέ την με τεχνικές και παραδείγματα ΓΛΩΣΣΑΣ.</p></header>
  <div className="learn-tabs" role="tablist" aria-label="Ενότητες μάθησης">{tabs.map(({ id, label, Icon }, index) => <button
   key={id} ref={node => { buttons.current[index] = node }} type="button" role="tab" id={`learn-tab-${id}`} aria-controls={`learn-panel-${id}`} aria-selected={props.tab === id} tabIndex={props.tab === id ? 0 : -1}
   onClick={() => props.onTabChange(id)} onKeyDown={event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault(); props.onTabChange(tabs[next].id); buttons.current[next]?.focus()
   }}><Icon size={18} aria-hidden="true" />{label}</button>)}</div>
  <div id="learn-panel-lessons" role="tabpanel" aria-labelledby="learn-tab-lessons" hidden={props.tab !== 'lessons'}>
   <CoursesWorkspace selectedLessonId={props.selectedLessonId} onSelectLesson={props.onSelectLesson} onOpenMethodology={props.onOpenMethodology} />
  </div>
  <div id="learn-panel-methodologies" role="tabpanel" aria-labelledby="learn-tab-methodologies" hidden={props.tab !== 'methodologies'}>
   {props.methodologyRequest > 0 && lesson && <button type="button" className="learn-back" onClick={() => props.onTabChange('lessons')}><ArrowLeft size={16} aria-hidden="true" />Πίσω στο μάθημα: {lesson.title}</button>}
   {methodologiesVisited || props.methodologyRequest > 0 || props.tab === 'methodologies' ? <Suspense fallback={<p role="status">Φόρτωση μεθοδολογιών…</p>}><PatternsWorkspace
    embedded active={props.active && props.tab === 'methodologies'} selectionRequest={props.methodologyRequest} selectedId={props.selectedMethodologyId} onSelect={props.onSelectMethodology} onOpenProgram={props.onOpenProgram} hasCustomProgram={props.hasCustomProgram}
   /></Suspense> : null}
  </div>
 </section>
}
