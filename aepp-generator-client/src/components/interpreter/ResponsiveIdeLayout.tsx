import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import useWorkspacePreferences from './useWorkspacePreferences'
import ResizeHandle from './ResizeHandle'
import { clampSize, defaults, shortcutAction } from './workspaceState'
import './responsive-ide.css'
interface Props { editor: ReactNode; commands: ReactNode; console: ReactNode; memory: ReactNode; controls: ReactNode; status: string; cursor: { line: number; column: number }; errors: number; attention: unknown; needsInput: boolean; executionRequest?: number; outputCount?: number; active?: boolean; onZenChange?: (zen: boolean) => void; onFocusEditor: () => void }
function usePanelDialog(ref: React.RefObject<HTMLDialogElement | null>, visible: boolean, modal: boolean) {
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !visible) { dialog?.close(); return }
    if (dialog.open) dialog.close()
    if (modal) dialog.showModal(); else dialog.show()
    return () => dialog.close()
  }, [ref, visible, modal])
}
export default function ResponsiveIdeLayout({ editor, commands, console: terminal, memory, controls, status, cursor, errors, attention, needsInput, executionRequest = 0, outputCount = 0, active = true, onZenChange, onFocusEditor }: Props) {
  const [p, setP] = useWorkspacePreferences()
  const previousOutputCount = useRef(0)
  const [zen, setZen] = useState(false)
  const [size, setSize] = useState({ width: 1200, height: 600 })
  const [mobilePanel, setMobilePanel] = useState<'commands' | 'dock' | null>(null)
  const [memoryVisited, setMemoryVisited] = useState(false)
  const [sideTool, setSideTool] = useState<'commands' | 'memory'>(p.tab === 'memory' ? 'memory' : 'commands')
  const [memoryOpen, setMemoryOpen] = useState(p.tab === 'memory' && ['open', 'maximized'].includes(p.dock))
  const root = useRef<HTMLElement>(null), main = useRef<HTMLDivElement>(null), commandsDialog = useRef<HTMLDialogElement>(null), dockDialog = useRef<HTMLDialogElement>(null)
  const compact = size.width < 960
  const memoryVisible = active && !zen && sideTool === 'memory' && memoryOpen
  const commandsVisible = memoryVisible || (active && !zen && sideTool === 'commands' && p.commands !== 'hidden' && (!compact || mobilePanel === 'commands'))
  const dockVisible = active && !zen && ['open', 'maximized'].includes(p.dock) && (memoryVisible || !compact || mobilePanel === 'dock')
  const width = clampSize(p.width, 220, Math.min(480, size.width - 420))
  const height = clampSize(p.height, 120, Math.min(600, size.height - 180))
  usePanelDialog(commandsDialog, commandsVisible, compact && !memoryVisible)
  usePanelDialog(dockDialog, dockVisible, compact && !memoryVisible)
  useEffect(() => {
    const element = main.current; if (!element) return
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width && entry.contentRect.height) setSize({ width: entry.contentRect.width, height: entry.contentRect.height }) })
    observer.observe(element); return () => observer.disconnect()
  }, [])
  useEffect(() => { if (compact) setMobilePanel(p.dock === 'open' || p.dock === 'maximized' ? 'dock' : p.commands === 'open' ? 'commands' : null); else setMobilePanel(null) }, [compact])
  useEffect(() => { setP(previous => previous.tab === 'memory' ? { ...previous, tab: 'console', dock: 'minimized' } : previous) }, [setP])
  useEffect(() => { if (memoryVisible) setMemoryVisited(true) }, [memoryVisible])
  useEffect(() => {
    if (!executionRequest) return
    setSideTool('memory'); setMemoryOpen(true); setMemoryVisited(true); setZen(false); setMobilePanel(null)
    setP(previous => ({ ...previous, dock: 'minimized', tab: 'console' }))
  }, [executionRequest, setP])
  useEffect(() => {
    const hasNewOutput = outputCount > previousOutputCount.current
    previousOutputCount.current = outputCount
    if (!active || !hasNewOutput) return
    setP(previous => ({ ...previous, dock: 'open', tab: 'console' }))
    setMobilePanel('dock')
  }, [outputCount, active, setP])
  useEffect(() => { if (active && attention) { setP(previous => ({ ...previous, dock: 'open', tab: 'console' })); setMobilePanel('dock') } }, [attention, active, setP])
  useEffect(() => { if (dockVisible && p.tab === 'console' && needsInput) dockDialog.current?.querySelector('input')?.focus() }, [dockVisible, p.tab, needsInput, attention])
  useEffect(() => { if (!active) setZen(false) }, [active])
  useEffect(() => { onZenChange?.(zen); return () => onZenChange?.(false) }, [zen, onZenChange])
  useEffect(() => {
    if (!zen) return
    const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; onFocusEditor()
    return () => { document.body.style.overflow = old }
  }, [zen, onFocusEditor])
  function toggleCommands() { setSideTool('commands'); setP(previous => ({ ...previous, commands: previous.commands === 'open' && (!compact || mobilePanel === 'commands') ? 'hidden' : 'open' })); setMobilePanel(mobilePanel === 'commands' ? null : 'commands') }
  function openDock(tab: 'console' | 'memory') { if (tab === 'memory') { setSideTool('memory'); setMemoryOpen(previous => sideTool === 'memory' ? !previous : true); setMobilePanel(null); return } setP(previous => ({ ...previous, tab, dock: previous.tab === tab && ['open','maximized'].includes(previous.dock) && (!compact || mobilePanel === 'dock') ? 'minimized' : 'open' })); setMobilePanel(mobilePanel === 'dock' && p.tab === tab ? null : 'dock') }
  function closeDock(mode: 'closed' | 'minimized') { dockDialog.current?.close(); setP(previous => ({ ...previous, dock: mode })); setMobilePanel(null); onFocusEditor() }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (active && zen && event.code === 'Escape') { event.preventDefault(); setZen(false); onFocusEditor(); return }
      const action = shortcutAction(event, active)
      if (!action) return
      event.preventDefault()
      if (action === 'commands') toggleCommands(); else if (action === 'console') openDock('console'); else setZen(previous => !previous)
    }
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener)
  })
  const style = { '--commands-width': (memoryVisible ? Math.max(340, width) : p.commands === 'rail' ? 44 : width) + 'px', '--dock-height': height + 'px' } as CSSProperties
  return <section ref={root} style={style} className={'responsive-ide' + (zen ? ' ide-zen' : '') + (compact ? ' ide-compact' : '') + (memoryVisible ? ' ide-memory-pinned' : '')} aria-label="Χώρος εργασίας ΓΛΩΣΣΑΣ">
    <div className="ide-workspace-toolbar" hidden={zen}>
      <div className="ide-execution-controls">{controls}</div>
      <div className="ide-panel-controls">
        <button type="button" aria-expanded={commandsVisible} aria-controls="ide-commands" aria-keyshortcuts="Control+B Meta+B" title="Εντολές · Ctrl+B" onClick={toggleCommands}>☰ Εντολές</button>
        <button type="button" aria-expanded={dockVisible && p.tab === 'console'} aria-controls="ide-dock" aria-keyshortcuts="Control+Backquote Meta+Backquote" title="Κονσόλα · Ctrl+&#96;" onClick={() => openDock('console')}>▤ Κονσόλα</button>
        <button type="button" aria-expanded={memoryVisible} aria-controls="ide-commands" title="Μνήμη και πίνακες" onClick={() => openDock('memory')}>▦ Μνήμη</button>
        <button type="button" title="Επαναφορά διάταξης" onClick={() => { setP({ ...defaults }); setMobilePanel(null) }}>↺</button>
        <button type="button" title="Zen Mode · F9 · Έξοδος με Esc" aria-keyshortcuts="F9" onClick={() => setZen(true)}>⛶ Zen</button>
      </div>
    </div>
    <div ref={main} className={'ide-pane-grid ide-side-' + p.side + (commandsVisible && (!compact || memoryVisible) ? ' ide-has-commands' : '')}>
      <dialog ref={commandsDialog} id="ide-commands" className={'ide-commands-dialog' + (p.commands === 'rail' && !compact && !memoryVisible ? ' ide-command-rail' : '')} aria-label={memoryVisible ? "Μνήμη και πίνακες" : "Εντολές και εργαλεία"} onCancel={e => { e.preventDefault(); commandsDialog.current?.close(); setP(previous => ({ ...previous, commands: 'hidden' })); setMobilePanel(null); onFocusEditor() }} onClick={e => { if (compact && e.target === e.currentTarget) { setP(previous => ({ ...previous, commands: 'hidden' })); setMobilePanel(null) } }}>
        <div className="ide-command-rail-actions" hidden={memoryVisible || p.commands !== 'rail' || compact}><button type="button" title="Ανάπτυξη εντολών" onClick={() => setP(previous => ({ ...previous, commands: 'open' }))}>☰</button><button type="button" title="Απόκρυψη εντολών" onClick={toggleCommands}>×</button></div>
        <div className="ide-command-content" hidden={memoryVisible || (p.commands === 'rail' && !compact)}>
          <div className="ide-panel-heading"><strong>Εντολές</strong><button type="button" title="Μεταφορά sidebar στην άλλη πλευρά" onClick={() => setP(previous => ({ ...previous, side: previous.side === 'right' ? 'left' : 'right' }))}>⇄</button><button type="button" title="Σύμπτυξη σε εικονίδια" onClick={() => { setP(previous => ({ ...previous, commands: 'rail' })); setMobilePanel(null) }}>−</button><button type="button" title="Απόκρυψη εντολών" onClick={() => { commandsDialog.current?.close(); setP(previous => ({ ...previous, commands: 'hidden' })); setMobilePanel(null); onFocusEditor() }}>×</button></div>
          <div className="ide-command-body">{commands}</div>
        </div>
        <div className="ide-memory-side-content" hidden={!memoryVisible}><div className="ide-panel-heading"><strong>Μνήμη & Πίνακες</strong><button type="button" title="Απόκρυψη οπτικοποίησης" onClick={() => setMemoryOpen(false)}>×</button></div><div className="ide-memory-side-body">{memoryVisited ? memory : null}</div></div>
      </dialog>
      {commandsVisible && !compact && (memoryVisible || p.commands === 'open') && !zen && <div className="ide-side-split"><ResizeHandle axis="x" direction={p.side === 'left' ? 1 : -1} value={memoryVisible ? Math.max(340, width) : width} min={memoryVisible ? 340 : 220} max={Math.min(480, size.width - 420)} onChange={value => setP(previous => ({ ...previous, width: value }))} label="Πλάτος εντολών" controls="ide-commands" /></div>}
      <div className={'ide-editor-stack' + (dockVisible && (!compact || memoryVisible) ? p.dock === 'maximized' && !memoryVisible ? ' ide-dock-maximized' : ' ide-has-dock' : '')}>
        <div className="ide-editor-container" hidden={dockVisible && p.dock === 'maximized' && !compact && !memoryVisible}>{editor}</div>
        {dockVisible && !compact && (p.dock !== 'maximized' || memoryVisible) && <ResizeHandle axis="y" direction={-1} value={height} min={120} max={Math.min(600, size.height - 180)} onChange={value => setP(previous => ({ ...previous, height: value }))} label="Ύψος κονσόλας και μνήμης" controls="ide-dock" />}
        <dialog ref={dockDialog} id="ide-dock" className={'ide-dock-dialog' + (p.dock === 'maximized' && !memoryVisible ? ' ide-dock-full' : '')} aria-label="Κονσόλα και οπτικοποιητής" onCancel={e => { e.preventDefault(); closeDock('minimized') }} onClick={e => { if (compact && e.target === e.currentTarget) closeDock('minimized') }}>
          <div className="ide-panel-heading"><div className="ide-dock-tabs" role="tablist" aria-label="Εργαλεία εκτέλεσης">{(['console'] as const).map(tab => <button key={tab} id={'ide-tab-' + tab} type="button" role="tab" tabIndex={p.tab === tab ? 0 : -1} aria-selected={p.tab === tab} aria-controls={'ide-content-' + tab} onKeyDown={e => { if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return; e.preventDefault(); const next = e.key === 'Home' ? 'console' : e.key === 'End' ? 'memory' : tab === 'console' ? 'memory' : 'console'; setP(previous => ({ ...previous, tab: next })); document.getElementById('ide-tab-' + next)?.focus() }} onClick={() => setP(previous => ({ ...previous, tab }))}>{tab === 'console' ? 'Κονσόλα' : 'Μνήμη & Πίνακες'}</button>)}</div><button type="button" title="Ελαχιστοποίηση" onClick={() => closeDock('minimized')}>−</button><button type="button" title={p.dock === 'maximized' ? 'Επαναφορά μεγέθους' : 'Μεγιστοποίηση'} onClick={() => setP(previous => ({ ...previous, dock: previous.dock === 'maximized' ? 'open' : 'maximized' }))}>□</button><button type="button" title="Κλείσιμο panel" onClick={() => closeDock('closed')}>×</button></div>
          <div id="ide-content-console" className="ide-dock-body" role="tabpanel" aria-labelledby="ide-tab-console" hidden={p.tab !== 'console'}>{terminal}</div>
        </dialog>
      </div>
    </div>
    <footer className="ide-status-bar" hidden={zen}><button type="button" title="Άνοιγμα κονσόλας" onClick={() => { setP(previous => ({ ...previous, dock: 'open', tab: 'console' })); setMobilePanel('dock') }}><span role="status">{status}</span></button><span>Γραμμή {cursor.line}, Στήλη {cursor.column}</span><button type="button" title="Προβολή διαγνωστικών" onClick={() => { setP(previous => ({ ...previous, dock: 'open', tab: 'console' })); setMobilePanel('dock') }}>Σφάλματα: {errors}</button></footer>
    {zen && <button className="ide-zen-exit" type="button" title="Έξοδος από Zen Mode · Esc" onClick={() => { setZen(false); onFocusEditor() }}>⛶ Έξοδος · Esc</button>}
  </section>
}
