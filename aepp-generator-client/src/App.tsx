import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import DashboardLayout, { type DashboardTab } from './components/layout/DashboardLayout'
import type { LearnTab } from './components/courses/LearnWorkspace'
import AssessmentErrorBoundary from './components/assessment/AssessmentErrorBoundary'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/AuthForms'
import { SettingsProvider } from './settings/SettingsContext'
import { restoreSource } from './settings/settings'
import { NotesProvider } from './notes/NotesContext'
import NotesLibrary from './notes/NotesLibrary'
import type { CodeNote } from './notes/model'
import { starterProgram } from './interpreter/examples'

import { GamificationProvider, useGamification } from './gamification/GamificationProvider'
import DailyChallenge, { ChallengeBanner, StreakWidget } from './components/gamification/DailyChallenge'
import DashboardFeatureGuide from './components/dashboard/DashboardFeatureGuide'
import { hasSeenDashboardTour, markDashboardTourSeen } from './components/dashboard/dashboardTourStorage'
// Κάθε χώρος εργασίας φορτώνεται την πρώτη φορά που ανοίγει, ώστε η Αρχική να μένει ελαφριά.
const HeroScrollShowcase = lazy(() => import('./components/dashboard/HeroScrollShowcase'))
const LearnWorkspace = lazy(() => import('./components/courses/LearnWorkspace'))
const InterpreterWorkspace = lazy(() => import('./components/interpreter/InterpreterWorkspace'))
const WhiteboardWorkspace = lazy(() => import('./components/whiteboard/WhiteboardWorkspace'))
const AssessmentWorkspace = lazy(() => import('./components/assessment/AssessmentWorkspace'))
const Leaderboard = lazy(() => import('./components/gamification/Leaderboard'))
const SharedNotePage = lazy(() => import('./notes/SharedNotePage'))
const workspaceFallback = (
  <p role="status" className="p-6 text-sm text-slate-500">
    Φόρτωση…
  </p>
)

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <NotesProvider>
          <GamificationProvider>
            <NoteRoute />
          </GamificationProvider>
        </NotesProvider>
      </AuthProvider>
    </SettingsProvider>
  )
}
function NoteRoute() {
  const [path, setPath] = useState(() => window.location.pathname),
    [source, setSource] = useState<string | undefined>()
  useEffect(() => {
    const pop = () => {
      setPath(window.location.pathname)
      setSource(undefined)
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  const match = /^\/share\/([^/]+)\/?$/.exec(path)
  function leave(code?: string) {
    history.pushState(null, '', '/')
    setSource(code)
    setPath('/')
  }
  return match ? (
    <Suspense fallback={workspaceFallback}>
      <SharedNotePage key={match[1]} token={match[1]} onOpen={leave} onHome={() => leave()} />
    </Suspense>
  ) : (
    <Workspace sharedSource={source} />
  )
}
function Workspace({ sharedSource }: { sharedSource?: string }) {
  const { user } = useAuth()
  const { action, data: daily } = useGamification()
  const [activeTab, setActiveTab] = useState<DashboardTab>(sharedSource ? 'interpreter' : 'home')
  const [dashboardTourActive, setDashboardTourActive] = useState(false)
  const [dashboardTourStep, setDashboardTourStep] = useState(0)
  const [dashboardWelcomeVisible, setDashboardWelcomeVisible] = useState(false)
  const [dashboardTourStorageError, setDashboardTourStorageError] = useState(false)
  const [noteState, setNoteState] = useState<{ ownerId: string; note: CodeNote; launch?: number } | undefined>()
  const noteSequence = useRef(0)
  const openedNote = noteState?.ownerId === user?.id ? noteState : undefined
  const [diagramRequest, setDiagramRequest] = useState(0)
  const [debugLaunch, setDebugLaunch] = useState<
    { id: number; source: string; inputs: string[]; ownerId?: string } | undefined
  >()
  const debugLaunchId = useRef(0)
  const [ideZen, setIdeZen] = useState(false)
  const [visited, setVisited] = useState<Set<DashboardTab>>(() => new Set())
  useEffect(() => {
    setVisited(previous => (previous.has(activeTab) ? previous : new Set([...previous, activeTab])))
  }, [activeTab])
  const glossaSource = useRef(sharedSource ?? restoreSource(starterProgram, user?.id))
  const sourceOwner = useRef(user?.id)
  if (sourceOwner.current !== user?.id) {
    sourceOwner.current = user?.id
    glossaSource.current = sharedSource ?? restoreSource(starterProgram, user?.id)
  }
  function openNote(note: CodeNote) {
    if (!user) return
    glossaSource.current = note.code
    setNoteState({ ownerId: user.id, note, launch: ++noteSequence.current })
    setDebugLaunch(undefined)
    setActiveTab('interpreter')
  }
  const [selectedPatternId, setSelectedPatternId] = useState('statistics')
  const [selectedLessonId, setSelectedLessonId] = useState('lesson-1')
  const [learnTab, setLearnTab] = useState<LearnTab>('lessons')
  const [methodologyRequest, setMethodologyRequest] = useState(0)
  function openMethodology(id: string) {
    setSelectedPatternId(id)
    setMethodologyRequest(value => value + 1)
    setLearnTab('methodologies')
  }
  const [assessmentSession, setAssessmentSession] = useState(0)

  useEffect(() => {
    if (!user) {
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
  }, [user?.id])

  function startDashboardTour() {
    setDashboardTourStep(0)
    setDashboardTourActive(true)
    setActiveTab('home')
  }

  function closeDashboardTour() {
    setDashboardTourActive(false)
    setDashboardWelcomeVisible(false)
    if (user) {
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
      if (seconds >= 60) {
        clearInterval(timer)
        void action('study', { lessonId: selectedLessonId })
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [activeTab, learnTab, selectedLessonId, daily?.day, action])

  useEffect(() => {
    setAssessmentSession(previous => previous + 1)
  }, [user?.id])

  return (
    <DashboardLayout
      zen={ideZen}
      gamificationWidget={<StreakWidget onOpen={() => setActiveTab('daily')} />}
      onStartDashboardTour={startDashboardTour}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <Suspense fallback={workspaceFallback}>
        <div hidden={activeTab !== 'courses'}>
          {(activeTab === 'courses' || visited.has('courses')) && (
            <LearnWorkspace
              active={activeTab === 'courses'}
              tab={learnTab}
              onTabChange={setLearnTab}
              selectedLessonId={selectedLessonId}
              onSelectLesson={setSelectedLessonId}
              selectedMethodologyId={selectedPatternId}
              onSelectMethodology={setSelectedPatternId}
              methodologyRequest={methodologyRequest}
              onOpenMethodology={openMethodology}
              hasCustomProgram={glossaSource.current !== starterProgram}
              onOpenProgram={source => {
                glossaSource.current = source
                setNoteState(undefined)
                setDebugLaunch(undefined)
                setActiveTab('interpreter')
              }}
            />
          )}
        </div>
        <div
          id="workspace-interpreter"
          role="tabpanel"
          aria-labelledby="workspace-tab-interpreter"
          hidden={activeTab !== 'interpreter'}
        >
          {(activeTab === 'interpreter' || visited.has('interpreter')) && (
            <InterpreterWorkspace
              key={user?.id ?? 'guest'}
              codeNote={openedNote?.note}
              noteLaunch={openedNote?.launch}
              onNoteSaved={note => {
                if (user)
                  setNoteState(previous => ({
                    ownerId: user.id,
                    note,
                    launch: previous?.ownerId === user.id ? previous.launch : undefined,
                  }))
              }}
              active={activeTab === 'interpreter'}
              onZenChange={setIdeZen}
              sourceStore={glossaSource}
              debugLaunch={debugLaunch?.ownerId === user?.id ? debugLaunch : undefined}
              onOpenFlowchart={() => {
                setDiagramRequest(value => value + 1)
                setActiveTab('whiteboard')
              }}
            />
          )}
        </div>
        <div
          id="workspace-whiteboard"
          role="tabpanel"
          aria-labelledby="workspace-tab-whiteboard"
          hidden={activeTab !== 'whiteboard'}
        >
          {(activeTab === 'whiteboard' || visited.has('whiteboard')) && (
            <WhiteboardWorkspace
              diagramRequest={diagramRequest}
              active={activeTab === 'whiteboard'}
              getSource={() => glossaSource.current}
            />
          )}
        </div>
        <div
          id="workspace-assessment"
          role="tabpanel"
          aria-labelledby="workspace-tab-assessment"
          hidden={activeTab !== 'assessment'}
        >
          {(activeTab === 'assessment' || visited.has('assessment')) && (
            <AssessmentErrorBoundary
              key={(user?.id ?? 'guest') + assessmentSession}
              onRetry={() => {
                setAssessmentSession(value => value + 1)
              }}
            >
              <AssessmentWorkspace
                key={(user?.id ?? 'guest') + assessmentSession}
                onOpenDebugger={(source, inputs) => {
                  glossaSource.current = source
                  setNoteState(undefined)
                  setDebugLaunch({ id: ++debugLaunchId.current, source, inputs, ownerId: user?.id })
                  setActiveTab('interpreter')
                }}
              />
            </AssessmentErrorBoundary>
          )}
        </div>
        <div id="workspace-daily" role="tabpanel" aria-labelledby="workspace-tab-daily" hidden={activeTab !== 'daily'}>
          {(activeTab === 'daily' || visited.has('daily')) && (
            <ProtectedRoute>
              <DailyChallenge />
            </ProtectedRoute>
          )}
        </div>
        {activeTab === 'leaderboard' && (
          <ProtectedRoute>
            <Leaderboard />
          </ProtectedRoute>
        )}
        {activeTab === 'notes' && <NotesLibrary key={user?.id ?? 'guest'} onOpen={openNote} />}
        {activeTab === 'home' && (
          <>
            <Suspense fallback={<div className="min-h-[30rem]" aria-hidden="true" />}>
              <HeroScrollShowcase onStartNow={() => setActiveTab('interpreter')} onOpenGuide={startDashboardTour} />
            </Suspense>
            <DashboardFeatureGuide
              welcomeVisible={dashboardWelcomeVisible && !!user}
              storageError={dashboardTourStorageError}
              tourActive={dashboardTourActive}
              tourStep={dashboardTourStep}
              onStartTour={startDashboardTour}
              onStepChange={setDashboardTourStep}
              onCloseTour={closeDashboardTour}
              onNavigate={setActiveTab}
            />
            <div className="mx-auto mt-8 max-w-6xl space-y-6">
              <ChallengeBanner onOpen={() => setActiveTab('daily')} />
              <NotesLibrary
                key={user?.id ?? 'guest'}
                compact
                onOpen={openNote}
                onShowAll={() => setActiveTab('notes')}
              />
            </div>
          </>
        )}
      </Suspense>
    </DashboardLayout>
  )
}
