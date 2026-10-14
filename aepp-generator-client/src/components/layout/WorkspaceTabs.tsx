import type { DashboardTab } from './DashboardLayout'
export const workspaceTabs = [{ id: 'interpreter', label: '💻 Editor' }, { id: 'whiteboard', label: '📐 Διάγραμμα Ροής' }, { id: 'assessment', label: '📝 Διαγωνίσματα' }, { id: 'daily', label: '🔥 Daily Challenge' }] as const
export function isWorkspaceTab(tab: DashboardTab) { return workspaceTabs.some(item => item.id === tab) }
export default function WorkspaceTabs({ activeTab, onSelect }: { activeTab: DashboardTab; onSelect: (tab: DashboardTab) => void }) {
  return <nav className="workspace-top-tabs" role="tablist" aria-label="Εργαλεία μαθητή">{workspaceTabs.map((tab, index) => <button key={tab.id} id={'workspace-tab-' + tab.id} role="tab" type="button" tabIndex={tab.id === activeTab ? 0 : -1} aria-selected={tab.id === activeTab} aria-controls={'workspace-' + tab.id} title={tab.label} onClick={() => onSelect(tab.id)} onKeyDown={e => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return
    e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? workspaceTabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + workspaceTabs.length) % workspaceTabs.length
    onSelect(workspaceTabs[next].id); document.getElementById('workspace-tab-' + workspaceTabs[next].id)?.focus()
  }}>{tab.label}</button>)}</nav>
}
