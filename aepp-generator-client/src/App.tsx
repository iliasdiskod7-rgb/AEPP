import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import DashboardLayout, { type DashboardTab } from './components/layout/DashboardLayout'
import LearnWorkspace, { type LearnTab } from './components/courses/LearnWorkspace'
import InterpreterWorkspace from './components/interpreter/InterpreterWorkspace'
import WhiteboardWorkspace from './components/whiteboard/WhiteboardWorkspace'
import AssessmentWorkspace from './components/assessment/AssessmentWorkspace'
import { AuthProvider, useAuth } from './auth/AuthContext'
import SavedExams from './auth/SavedExams'
import { ProtectedRoute } from './auth/AuthForms'
import { SettingsProvider } from './settings/SettingsContext'
import { restoreSource } from './settings/settings'
import { NotesProvider } from './notes/NotesContext'
import NotesLibrary from './notes/NotesLibrary'
import type { CodeNote } from './notes/model'
import { starterProgram } from './interpreter/examples'
import ExamForm, { defaultRequest } from './components/ExamForm'
import ExamPreview from './components/ExamPreview'
import ExamGenerationSplash from './components/ExamGenerationSplash'
import FallbackToast from './components/common/FallbackToast'
import { isDemoMode, useGenerateExam } from './api/exams'
import { createStructuredSampleExam } from './api/structuredSampleExam'
import { apiClient } from './api/client'
import { getApiError } from './api/client'
import type { ExamJsonResponseDto, GenerateExamRequest } from './types/exam'

import { GamificationProvider, useGamification } from './gamification/GamificationProvider'
import DailyChallenge, { ChallengeBanner, StreakWidget } from './components/gamification/DailyChallenge'
import Leaderboard from './components/gamification/Leaderboard'
import DashboardFeatureGuide from './components/dashboard/DashboardFeatureGuide'
import { hasSeenDashboardTour, markDashboardTourSeen } from './components/dashboard/dashboardTourStorage'
const HeroScrollShowcase = lazy(() => import('./components/dashboard/HeroScrollShowcase'))

export default function App() { return <SettingsProvider><AuthProvider><NotesProvider><GamificationProvider><Workspace /></GamificationProvider></NotesProvider></AuthProvider></SettingsProvider> }
function Workspace() {
  const { user } = useAuth()
  const identity = useRef(user?.id); identity.current = user?.id
  const [examRefresh, setExamRefresh] = useState(0)
  const { action, data: daily } = useGamification()
  const [activeTab, setActiveTab] = useState<DashboardTab>('home')
  const [dashboardTourActive, setDashboardTourActive] = useState(false)
  const [dashboardTourStep, setDashboardTourStep] = useState(0)
  const [dashboardWelcomeVisible, setDashboardWelcomeVisible] = useState(false)
  const [dashboardTourStorageError, setDashboardTourStorageError] = useState(false)
  const [noteState,setNoteState]=useState<{ownerId:string;note:CodeNote;launch?:number}|undefined>()
  const noteSequence=useRef(0)
  const openedNote=noteState?.ownerId===user?.id?noteState:undefined
  const [diagramRequest, setDiagramRequest] = useState(0)
  const [debugLaunch, setDebugLaunch] = useState<{ id: number; source: string; inputs: string[];ownerId?:string } | undefined>()
  const debugLaunchId = useRef(0)
  const [ideZen, setIdeZen] = useState(false)
  const [visited, setVisited] = useState<Set<DashboardTab>>(() => new Set())
  useEffect(() => { setVisited(previous => previous.has(activeTab) ? previous : new Set([...previous, activeTab])) }, [activeTab])
  const [assessmentStart, setAssessmentStart] = useState<'practice' | 'generated'>('practice')
  const glossaSource = useRef(restoreSource(starterProgram,user?.id))
  const sourceOwner=useRef(user?.id)
  if(sourceOwner.current!==user?.id){sourceOwner.current=user?.id;glossaSource.current=restoreSource(starterProgram,user?.id)}
  function openNote(note:CodeNote){if(!user)return;glossaSource.current=note.code;setNoteState({ownerId:user.id,note,launch:++noteSequence.current});setDebugLaunch(undefined);setActiveTab('interpreter')}
  const [selectedPatternId, setSelectedPatternId] = useState('statistics')
  const [selectedLessonId, setSelectedLessonId] = useState('lesson-1')
  const [learnTab, setLearnTab] = useState<LearnTab>('lessons')
  const [methodologyRequest, setMethodologyRequest] = useState(0)
  function openMethodology(id: string) {
    setSelectedPatternId(id)
    setMethodologyRequest(value => value + 1)
    setLearnTab('methodologies')
  }
  const [exam, setExam] = useState<ExamJsonResponseDto | null>(() => isDemoMode ? createStructuredSampleExam(defaultRequest) : null)
  const [assessmentExam, setAssessmentExam] = useState(exam)
  const [assessmentSession, setAssessmentSession] = useState(0)
  const [notice, setNotice] = useState('')
  const [activeRequest, setActiveRequest] = useState(defaultRequest)
  const generation = useGenerateExam()

  useEffect(() => {
    if (!user || user.role !== 'STUDENT') {
      setDashboardWelcomeVisible(false)
      return
    }
    try {
      setDashboardWelcomeVisible(!hasSeenDashboardTour(user.id, window.localStorage))
      setDashboardTourStorageError(false)
    } catch {
      setDashboardWelcomeVisible(true)
      setDashboardTourStorageError(true)
    }
  }, [user?.id, user?.role])

  function startDashboardTour() {
    setDashboardTourStep(0)
    setDashboardTourActive(true)
    setActiveTab('home')
  }

  function closeDashboardTour() {
    setDashboardTourActive(false)
    setDashboardWelcomeVisible(false)
    if (user?.role === 'STUDENT') {
      try {
        markDashboardTourSeen(user.id, window.localStorage)
        setDashboardTourStorageError(false)
      } catch {
        setDashboardTourStorageError(true)
      }
    }
    window.requestAnimationFrame(() => document.getElementById('dashboard-guide-button')?.focus())
  }

  useEffect(() => {
    if (activeTab !== 'courses' || learnTab !== 'lessons') return
    let seconds = 0
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') seconds++
      if (seconds >= 60) { clearInterval(timer); void action('study', { lessonId: selectedLessonId }) }
    }, 1000)
    return () => clearInterval(timer)
  }, [activeTab, learnTab, selectedLessonId, daily?.day, action])

  useEffect(() => {setExam(isDemoMode ? createStructuredSampleExam(defaultRequest) : null);setAssessmentExam(null);setAssessmentSession(previous => previous + 1);setNotice('');generation.reset()}, [user?.id])

  async function generate(request: GenerateExamRequest) {
    setNotice('')
    setActiveRequest(request)
    const owner = identity.current
    const result = await generation.mutateAsync(request)
    if (identity.current !== owner) return
    setExam(result)
    if (isDemoMode) {try {await apiClient.post('/user-exams', result)} catch {setNotice('Το δείγμα δημιουργήθηκε, αλλά δεν αποθηκεύτηκε στον λογαριασμό.');return}}
    if (identity.current !== owner) return
    setExamRefresh(previous => previous + 1)
    setNotice(result.generationSource === 'examBank' ? 'Φορτώθηκε πρότυπο διαγώνισμα από την Τράπεζα Θεμάτων.' : isDemoMode ? 'Η προεπισκόπηση του δείγματος ενημερώθηκε.' : 'Το διαγώνισμα δημιουργήθηκε επιτυχώς.')
  }

  return <DashboardLayout zen={ideZen} gamificationWidget={<StreakWidget onOpen={() => setActiveTab('daily')} />} onStartDashboardTour={startDashboardTour} activeTab={activeTab} onTabChange={setActiveTab}>
    <FallbackToast key={generation.submittedAt} message={generation.isSuccess && generation.data.generationSource === 'examBank' ? generation.data.fallbackMessage ?? null : null} />
    <div hidden={activeTab !== 'courses'}>{(activeTab === 'courses' || visited.has('courses')) && <LearnWorkspace
      active={activeTab === 'courses'} tab={learnTab} onTabChange={setLearnTab}
      selectedLessonId={selectedLessonId} onSelectLesson={setSelectedLessonId}
      selectedMethodologyId={selectedPatternId} onSelectMethodology={setSelectedPatternId}
      methodologyRequest={methodologyRequest} onOpenMethodology={openMethodology}
      hasCustomProgram={glossaSource.current !== starterProgram}
      onOpenProgram={source => { glossaSource.current = source; setNoteState(undefined); setDebugLaunch(undefined); setActiveTab('interpreter') }}
    />}</div>
    <div id="workspace-interpreter" role="tabpanel" aria-labelledby="workspace-tab-interpreter" hidden={activeTab !== 'interpreter'}>{(activeTab === 'interpreter' || visited.has('interpreter')) && <InterpreterWorkspace key={user?.id??'guest'} codeNote={openedNote?.note} noteLaunch={openedNote?.launch} onNoteSaved={note=>{if(user)setNoteState(previous=>({ownerId:user.id,note,launch:previous?.ownerId===user.id?previous.launch:undefined}))}} active={activeTab === 'interpreter'} onZenChange={setIdeZen} sourceStore={glossaSource} debugLaunch={debugLaunch?.ownerId===user?.id?debugLaunch:undefined} onOpenFlowchart={() => { setDiagramRequest(value => value + 1); setActiveTab('whiteboard') }} />}</div>
    <div id="workspace-whiteboard" role="tabpanel" aria-labelledby="workspace-tab-whiteboard" hidden={activeTab !== 'whiteboard'}>{(activeTab === 'whiteboard' || visited.has('whiteboard')) && <WhiteboardWorkspace diagramRequest={diagramRequest} active={activeTab === 'whiteboard'} getSource={() => glossaSource.current} />}</div>
    <div id="workspace-assessment" role="tabpanel" aria-labelledby="workspace-tab-assessment" hidden={activeTab !== 'assessment'}>{(activeTab === 'assessment' || visited.has('assessment')) && <AssessmentWorkspace key={(user?.id ?? 'guest') + assessmentStart + assessmentSession} generatedExam={assessmentExam} initialMode={assessmentStart} onOpenDebugger={(source, inputs) => { glossaSource.current = source; setNoteState(undefined);setDebugLaunch({ id: ++debugLaunchId.current, source, inputs,ownerId:user?.id }); setActiveTab('interpreter') }} />}</div>
    <div id="workspace-daily" role="tabpanel" aria-labelledby="workspace-tab-daily" hidden={activeTab !== 'daily'}>{(activeTab === 'daily' || visited.has('daily')) && <ProtectedRoute><DailyChallenge /></ProtectedRoute>}</div>
    {activeTab === 'leaderboard' && <ProtectedRoute><Leaderboard /></ProtectedRoute>}
    {activeTab === 'notes' && <NotesLibrary key={user?.id??'guest'} onOpen={openNote}/>}
    {activeTab === 'home' && <>
      <Suspense fallback={<div className="min-h-[30rem]" aria-hidden="true" />}>
        <HeroScrollShowcase onStartNow={() => setActiveTab('interpreter')} onOpenGuide={startDashboardTour} />
      </Suspense>
      <DashboardFeatureGuide welcomeVisible={dashboardWelcomeVisible && user?.role === 'STUDENT'} storageError={dashboardTourStorageError} tourActive={dashboardTourActive} tourStep={dashboardTourStep} onStartTour={startDashboardTour} onStepChange={setDashboardTourStep} onCloseTour={closeDashboardTour} onNavigate={setActiveTab} />
      {user?.role === 'TEACHER' && <TeacherGeneratorShortcut onOpenGenerator={() => setActiveTab('generator')} />}
      <div className="mx-auto mt-8 max-w-6xl space-y-6">
        <ChallengeBanner onOpen={() => setActiveTab('daily')} />
        <div className="grid items-start gap-6 lg:grid-cols-2"><NotesLibrary key={user?.id??'guest'} compact onOpen={openNote} onShowAll={()=>setActiveTab('notes')}/><SavedExams refreshKey={examRefresh} onOpen={exam => {setAssessmentExam(exam);setAssessmentSession(previous => previous + 1);setAssessmentStart('generated');setActiveTab('assessment')}} /></div>
      </div>
    </>}
    <div hidden={activeTab !== 'generator'}><ProtectedRoute roles={['TEACHER']}>
      <SavedExams refreshKey={examRefresh} onOpen={setExam} />
      <div className="preview-controls mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="mb-2 text-xs font-medium text-blue-700">ΕΡΓΑΛΕΙΑ ΔΙΔΑΣΚΑΛΙΑΣ</p><h1 className="text-2xl font-bold tracking-tight">Γεννήτρια Διαγωνισμάτων</h1><p className="mt-2 text-sm text-slate-500">Επίλεξε την ύλη και δημιούργησε το επόμενο διαγώνισμά σου.</p></div><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">{isDemoMode ? 'Ενδεικτικό διαγώνισμα' : 'Παραγωγή διαγωνίσματος'}</span></div>
      {exam && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="flex-1 text-sm leading-6 text-blue-900">Λύσε το διαγώνισμα διαδραστικά. Για θέματα χωρίς δομημένο κλειδί απαντήσεων η βαθμολόγηση απαιτεί έλεγχο καθηγητή.</p><button type="button" onClick={() => { setAssessmentExam(exam); setAssessmentSession(previous => previous + 1); setAssessmentStart('generated'); setActiveTab('assessment') }} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Διαδραστική επίλυση</button></div>}
      <div className="workspace grid items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="settings rounded-2xl border border-slate-200 bg-white"><ExamForm onSubmit={generate} isLoading={generation.isPending} error={generation.error ? getApiError(generation.error) : null} isDemo={isDemoMode} /></aside>
      <section id="exam-preview" aria-label="Προεπισκόπηση" tabIndex={-1} className="min-w-0"><div className="mx-auto max-w-5xl">
        <p role="status" className="preview-controls mb-3 text-xs text-teal-800">{notice}</p>
        {generation.isPending && <ExamGenerationSplash request={activeRequest} />}
        {generation.error && !generation.isPending && <p role="alert" className="preview-controls mb-4 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800">{getApiError(generation.error)}</p>}
        <div hidden={generation.isPending}><ExamPreview exam={exam} isDemo={isDemoMode} /></div>
      </div></section>
      </div>
    </ProtectedRoute></div>
  </DashboardLayout>
}

function TeacherGeneratorShortcut({ onOpenGenerator }: { onOpenGenerator: () => void }) {
  const { user } = useAuth()
  if (user?.role !== 'TEACHER') return null
  return <section className="mx-auto max-w-6xl" aria-labelledby="dashboard-page-title">
    <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6"><div><p className="text-xs font-semibold text-blue-700">ΕΡΓΑΛΕΙΑ ΚΑΘΗΓΗΤΗ</p><h2 className="mt-2 text-lg font-semibold text-slate-900">Δημιούργησε διαγώνισμα για την τάξη σου.</h2><p className="mt-1 text-sm leading-6 text-slate-600">Επίλεξε ύλη και δυσκολία για να ετοιμάσεις θέματα και ενδεικτικές λύσεις.</p></div><button type="button" onClick={onOpenGenerator} className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-medium text-white hover:bg-blue-800">Άνοιγμα γεννήτριας<ArrowRight size={17} aria-hidden="true" /></button></div>
  </section>
}
