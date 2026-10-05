import { useRef, useState, type ReactNode } from 'react'
import { Home, BookOpen, FileText, ClipboardCheck, Code, PenTool, LogOut, User, Menu, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export type DashboardTab = 'home' | 'courses' | 'generator' | 'assessment' | 'interpreter' | 'whiteboard'

interface DashboardLayoutProps {
  activeTab: DashboardTab
  onTabChange: (tab: DashboardTab) => void
  children: ReactNode
  onLogout?: () => void
}

const navigation = [
  { id: 'home', label: 'Αρχική', icon: Home },
  { id: 'courses', label: 'Μαθήματα & Τεστ', icon: BookOpen },
  { id: 'generator', label: 'Γεννήτρια Διαγωνισμάτων', icon: FileText },
  { id: 'assessment', label: 'Διαδραστικά Διαγωνίσματα', icon: ClipboardCheck },
  { id: 'interpreter', label: 'Διερμηνευτής ΓΛΩΣΣΑΣ', icon: Code },
  { id: 'whiteboard', label: 'Πίνακας & Διαγράμματα', icon: PenTool },
] as const

export default function DashboardLayout({ activeTab, onTabChange, children, onLogout }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutNotice, setLogoutNotice] = useState('')
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)

  function navigate(tab: DashboardTab) {
    onTabChange(tab)
    setMenuOpen(false)
    main.current?.focus({ preventScroll: true })
  }

  return <div className="min-h-screen bg-slate-50 text-slate-800">
    <a href="#dashboard-content" className="skip-link">Μετάβαση στο περιεχόμενο</a>
    <header className="app-header border-b border-slate-200 bg-white">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button ref={menuButton} type="button" aria-label={menuOpen ? 'Κλείσιμο μενού' : 'Άνοιγμα μενού'} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen(open => !open)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden">
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <span className="hidden rounded-xl bg-blue-700 p-2.5 text-white min-[380px]:block"><BookOpen size={23} aria-hidden="true" /></span>
          <div><p className="text-sm font-bold tracking-tight sm:text-lg">ΑΕΠΠ <span className="font-normal text-blue-700">EduPlatform</span></p><p className="mt-0.5 hidden text-xs text-slate-500 sm:block">Ο χώρος του καθηγητή Πληροφορικής</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="hidden text-right sm:block"><p className="text-sm font-semibold">Γρηγόρης Δίσκος</p><p className="mt-0.5 text-xs text-slate-500">Καθηγητής Πληροφορικής</p></div>
          <span className="grid h-9 w-9 place-items-center rounded-full border border-blue-100 bg-blue-50 text-blue-700" role="img" aria-label="Γρηγόρης Δίσκος, Καθηγητής Πληροφορικής"><User size={19} aria-hidden="true" /></span>
          <button type="button" onClick={() => onLogout ? onLogout() : setLogoutNotice('Η αποσύνδεση θα είναι διαθέσιμη όταν ενεργοποιηθούν οι λογαριασμοί χρηστών.')} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50" aria-label="Αποσύνδεση"><LogOut size={17} aria-hidden="true" /><span className="hidden lg:inline">Αποσύνδεση</span></button>
        </div>
      </div>
      <p role="status" className={cn('text-center text-xs text-slate-600', logoutNotice && 'border-t border-slate-100 px-4 py-3')}>{logoutNotice}</p>
    </header>

    <div className="dashboard-body md:grid md:min-h-[calc(100vh-81px)] md:grid-cols-[250px_minmax(0,1fr)]">
      <aside id="dashboard-navigation" className={cn('dashboard-navigation border-b border-slate-200 bg-white md:block md:border-r md:border-b-0', menuOpen ? 'block' : 'hidden')} onKeyDown={event => {
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
