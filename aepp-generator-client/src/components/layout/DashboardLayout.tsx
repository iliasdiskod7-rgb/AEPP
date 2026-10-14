import { useRef, useState, type ReactNode } from 'react'
import { Home, BookOpen, FileText, ClipboardCheck, Code, PenTool, User, Menu, X, Settings, CircleHelp } from 'lucide-react'
import { cn } from '../../lib/utils'
import WorkspaceTabs, { isWorkspaceTab } from './WorkspaceTabs'
import './workspace-shell.css'
import './dashboard-polish.css'
import UserMenu from '../../auth/UserMenu'
import SettingsModal from '../../settings/SettingsModal'

export type DashboardTab = 'home' | 'courses' | 'generator' | 'assessment' | 'interpreter' | 'whiteboard' | 'daily' | 'leaderboard' | 'notes'

interface DashboardLayoutProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  children: ReactNode
  onLogout?: () => void
  zen?: boolean
  gamificationWidget?: ReactNode
  onStartDashboardTour?: () => void
}

const navigation = [
  { id: 'home', label: 'Αρχική', icon: Home },
  { id: 'daily', label: 'Daily Challenge', icon: ClipboardCheck },
  { id: 'leaderboard', label: 'Κατάταξη & Επιτεύγματα', icon: User },
  { id: 'courses', label: 'Μαθήματα & Εξάσκηση', icon: BookOpen },
  { id: 'notes', label: 'Οι Σημειώσεις μου', icon: BookOpen },
  { id: 'generator', label: 'Γεννήτρια Διαγωνισμάτων', icon: FileText },
  { id: 'assessment', label: 'Διαδραστικά Διαγωνίσματα', icon: ClipboardCheck },
  { id: 'interpreter', label: 'Διερμηνευτής ΓΛΩΣΣΑΣ', icon: Code },
  { id: 'whiteboard', label: 'Πίνακας & Διαγράμματα', icon: PenTool },
] as const

export default function DashboardLayout({ activeTab, onTabChange, children, gamificationWidget, onStartDashboardTour, zen = false }: DashboardLayoutProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const workspace = isWorkspaceTab(activeTab)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)

  function navigate(tab: DashboardTab) {
    onTabChange(tab)
    setMenuOpen(false)
    main.current?.focus({ preventScroll: true })
  }

  return <div className={cn("dashboard-shell min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100", workspace && "workspace-shell", zen && "zen-shell")}>
    <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    <a href="#dashboard-content" className="skip-link">Μετάβαση στο περιεχόμενο</a>
    <header className="app-header border-b border-slate-200 bg-white">
      <div className="app-header-inner flex min-h-20 flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button ref={menuButton} type="button" aria-label={menuOpen ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού'} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(open => !open)} className={cn("rounded-lg p-2 text-slate-600 hover:bg-slate-100", !workspace && "md:hidden")}>
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <span className="hidden rounded-xl bg-blue-700 p-2.5 text-white min-[380px]:block"><BookOpen size={23} aria-hidden="true" /></span>
          <div><p className="text-sm font-bold tracking-tight sm:text-lg">ΑΕΠΠ <span className="font-normal text-blue-700">EduPlatform</span></p><p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Ο χώρος του καθηγητή Πληροφορικής</p></div>
        </div>
        <div className="app-header-actions flex shrink-0 items-center gap-3 sm:gap-4">
          {gamificationWidget}
          {activeTab === 'home' && onStartDashboardTour && <button id="dashboard-guide-button" type="button" onClick={onStartDashboardTour} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100 sm:text-sm"><CircleHelp size={17} aria-hidden="true" />Οδηγός Χρήσης</button>}
          <button type="button" aria-label="Ρυθμίσεις IDE" title="Ρυθμίσεις IDE" onClick={() => setSettingsOpen(true)} className="rounded-lg border border-slate-200 p-2.5 text-slate-600"><Settings size={20} aria-hidden="true" /></button>
          <UserMenu />
        </div>
      </div>
    </header>

    {workspace && <WorkspaceTabs activeTab={activeTab} onSelect={navigate} />}
    <div className="dashboard-body md:grid md:min-h-[calc(100vh-81px)] md:grid-cols-[250px_minmax(0,1fr)]">
      <aside id="dashboard-navigation" className={cn('dashboard-navigation border-b border-slate-200 bg-white md:block md:border-r md:border-b-0', menuOpen ? 'block' : 'hidden', workspace && !menuOpen && '!hidden')} onKeyDown={event => {
        if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); menuButton.current?.focus() }
      }}>
        <div className="p-4 md:sticky md:top-0 md:py-7">
          <p className="mb-4 px-3 text-[10px] font-semibold tracking-widest text-slate-400">ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ</p>
          <nav aria-label="Κύρια πλοήγηση"><ul className="space-y-1.5">{navigation.map(({ id, label, icon: Icon }) => <li key={id}>
            <button type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => navigate(id)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition-colors', activeTab === id ? 'bg-blue-50 font-semibold text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}><Icon size={19} className="shrink-0" aria-hidden="true" /><span>{label}</span></button>
          </li>)}</ul></nav>
          <div className="mt-9 hidden rounded-xl border border-slate-100 bg-slate-50 p-4 md:block"><p className="text-xs font-semibold text-slate-600">Πληροφορική Προσανατολισμού</p><p className="mt-2 text-xs leading-5 text-slate-400">Γ΄ Λυκείου<br />Ένα μέρος για κάθε βήμα της διδασκαλίας.</p></div>
        </div>
      </aside>
      <main ref={main} id="dashboard-content" tabIndex={-1} className="dashboard-content min-w-0 p-4 outline-none sm:p-6 xl:p-8">{children}</main>
    </div>
  </div>
}
