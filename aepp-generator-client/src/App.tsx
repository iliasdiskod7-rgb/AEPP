import { useRef, useState } from 'react'
import { ArrowRight, Clock3, FileText, Home } from 'lucide-react'
import DashboardLayout, { type DashboardTab } from './components/layout/DashboardLayout'
import CoursesWorkspace from './components/courses/CoursesWorkspace'
import InterpreterWorkspace from './components/interpreter/InterpreterWorkspace'
import WhiteboardWorkspace from './components/whiteboard/WhiteboardWorkspace'
import AssessmentWorkspace from './components/assessment/AssessmentWorkspace'
import { starterProgram } from './interpreter/examples'
import ExamForm, { defaultRequest } from './components/ExamForm'
import ExamPreview from './components/ExamPreview'
import ExamGenerationSplash from './components/ExamGenerationSplash'
import { isDemoMode, useGenerateExam } from './api/exams'
import { createStructuredSampleExam } from './api/structuredSampleExam'
import { getApiError } from './api/client'
import type { ExamJsonResponseDto, GenerateExamRequest } from './types/exam'

export default function App() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')
  const [assessmentStart, setAssessmentStart] = useState<'practice' | 'generated'>('practice')
  const glossaSource = useRef(starterProgram)
  const [selectedLessonId, setSelectedLessonId] = useState('lesson-1')
  const [exam, setExam] = useState<ExamJsonResponseDto | null>(() => isDemoMode ? createStructuredSampleExam(defaultRequest) : null)
  const [notice, setNotice] = useState('')
  const [activeRequest, setActiveRequest] = useState(defaultRequest)
  const generation = useGenerateExam()

  async function generate(request: GenerateExamRequest) {
    setNotice('')
    setActiveRequest(request)
    const result = await generation.mutateAsync(request)
    setExam(result)
    setNotice(isDemoMode ? 'Η προεπισκόπηση του δείγματος ενημερώθηκε.' : 'Το διαγώνισμα δημιουργήθηκε επιτυχώς.')
  }

  return <DashboardLayout activeTab={activeTab} onTabChange={tab => { if (tab === 'assessment') setAssessmentStart('practice'); setActiveTab(tab) }}>
    {activeTab === 'courses' && <CoursesWorkspace selectedLessonId={selectedLessonId} onSelectLesson={setSelectedLessonId} />}
    {activeTab === 'interpreter' && <InterpreterWorkspace sourceStore={glossaSource} />}
    {activeTab === 'whiteboard' && <WhiteboardWorkspace getSource={() => glossaSource.current} />}
    {activeTab === 'assessment' && <AssessmentWorkspace key={assessmentStart} generatedExam={exam} initialMode={assessmentStart} />}
    {activeTab === 'home' && <PlaceholderPage onOpenGenerator={() => setActiveTab('generator')} />}
    <div hidden={activeTab !== 'generator'}>
      <div className="preview-controls mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 text-xs font-medium text-blue-700">ΕΡΓΑΛΕΙΑ ΔΙΔΑΣΚΑΛΙΑΣ</p><h1 className="text-2xl font-bold tracking-tight">Γεννήτρια Διαγωνισμάτων</h1><p className="mt-2 text-sm text-slate-500">Επίλεξε την ύλη και δημιούργησε το επόμενο διαγώνισμά σου.</p></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">{isDemoMode ? 'Ενδεικτικό διαγώνισμα' : 'Παραγωγή διαγωνίσματος'}</span></div>
      {exam && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="flex-1 text-sm leading-6 text-blue-900">Λύσε το διαγώνισμα διαδραστικά. Για θέματα χωρίς δομημένο κλειδί απαντήσεων η βαθμολόγηση απαιτεί έλεγχο καθηγητή.</p><button type="button" onClick={() => { setAssessmentStart('generated'); setActiveTab('assessment') }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Διαδραστική επίλυση</button></div>}
      <div className="workspace grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="settings rounded-2xl border border-slate-200 bg-white"><ExamForm onSubmit={generate} isLoading={generation.isPending} error={generation.error ? getApiError(generation.error) : null} isDemo={isDemoMode} /></aside>
      <section id="exam-preview" aria-label="Προεπισκόπηση" tabIndex={-1} className="min-w-0"><div className="mx-auto max-w-5xl">
        <p role="status" className="preview-controls mb-3 text-xs text-teal-800">{notice}</p>
        {generation.isPending && <ExamGenerationSplash request={activeRequest} />}
        {generation.error && !generation.isPending && <p role="alert" className="preview-controls mb-4 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800">{getApiError(generation.error)}</p>}
        <div hidden={generation.isPending}><ExamPreview exam={exam} isDemo={isDemoMode} /></div>
      </div></section>
      </div>
    </div>
  </DashboardLayout>
}

const placeholderPages = {
  home: { title: 'Καλώς ήρθες, Γρηγόρη.', description: 'Οργάνωσε το μάθημά σου και δώσε χώρο στην επόμενη ιδέα.', icon: Home, cards: [
    { title: 'Η τάξη σου με μια ματιά', text: 'Ένας συγκεντρωτικός χώρος για τα μαθήματα και τις δραστηριότητές σου.' },
    { title: 'Πρόσφατο υλικό', text: 'Γρήγορη πρόσβαση στο εκπαιδευτικό υλικό που ετοιμάζεις.' },
    { title: 'Προγραμματισμός μαθημάτων', text: 'Οργάνωση της προετοιμασίας και των επόμενων μαθημάτων.' },
  ] },
} as const

function PlaceholderPage({ onOpenGenerator }: { onOpenGenerator: () => void }) {
  const page = placeholderPages.home
  const Icon = page.icon
  return <section className="mx-auto max-w-6xl" aria-labelledby="dashboard-page-title">
    <div className="mb-8"><p className="mb-3 text-xs font-medium tracking-wide text-blue-700">ΑΕΠΠ EDUPLATFORM</p><h1 id="dashboard-page-title" className="text-2xl font-bold tracking-tight sm:text-3xl">{page.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{page.description}</p></div>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8"><div className="max-w-xl"><span className="mb-4 inline-flex rounded-xl bg-white p-3 text-blue-700"><FileText size={24} aria-hidden="true" /></span><p className="text-xs font-semibold text-blue-700">ΔΙΑΘΕΣΙΜΟ ΤΩΡΑ</p><h2 className="mt-2 text-xl font-semibold text-slate-900">Το επόμενο διαγώνισμα ξεκινά εδώ.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Διάλεξε ύλη, δυσκολία και θέματα. Η γεννήτρια ετοιμάζει εκφωνήσεις και ενδεικτικές λύσεις για την τάξη σου.</p></div><button type="button" onClick={onOpenGenerator} className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800">Άνοιγμα γεννήτριας<ArrowRight size={17} aria-hidden="true" /></button></div>
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600"><Icon size={18} aria-hidden="true" /><h2>Ο χώρος εργασίας σου εξελίσσεται</h2></div>
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{page.cards.map(card => <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-500"><Clock3 size={12} aria-hidden="true" />Σύντομα διαθέσιμο</span><h3 className="text-base font-semibold">{card.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{card.text}</p></article>)}</div>
  </section>
}
