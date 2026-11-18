export type DockMode = 'closed' | 'minimized' | 'open' | 'maximized'
/** Καρτέλες του πλαϊνού πάνελ: εντολές και ζωντανή οπτικοποίηση της εκτέλεσης. */
export type SideTab = 'commands' | 'memory' | 'trace' | 'debug'
export type LiveTab = Exclude<SideTab, 'commands'>
export const sideTabs: SideTab[] = ['commands', 'memory', 'trace', 'debug']
export interface WorkspacePreferences {
  version: 3
  commands: 'hidden' | 'rail' | 'open'
  side: 'left' | 'right'
  width: number
  dock: DockMode
  tab: 'console' | 'memory'
  height: number
  sideTab: SideTab
}
// Ο editor ξεκινά καθαρός: χωρίς πλαϊνό πάνελ και με μαζεμένη κονσόλα. Μνήμη και κονσόλα
// ανοίγουν όταν τρέξει το πρόγραμμα. Νέο κλειδί (v3), ώστε όλοι να ξεκινήσουν έτσι μία φορά.
export const storageKey = 'aepp.ide.workspace.v3'
export const defaults: WorkspacePreferences = {
  version: 3,
  commands: 'hidden',
  side: 'right',
  width: 400,
  dock: 'minimized',
  tab: 'console',
  height: 240,
  sideTab: 'commands',
}
export function clampSize(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}
export function resizeSize(start: number, delta: number, direction: 1 | -1, minimum: number, maximum: number) {
  return clampSize(start + delta * direction, minimum, maximum)
}
export function restorePreferences(raw: string | null): WorkspacePreferences {
  try {
    const p = JSON.parse(raw ?? 'null')
    if (!p || p.version !== 3) return { ...defaults }
    // Ό,τι άνοιξε η εκτέλεση (μνήμη, ανοιχτή κονσόλα) δεν ξαναεμφανίζεται στο επόμενο άνοιγμα.
    // Κρατιούνται μόνο οι επιλογές του μαθητή: εντολές, πλευρά και μεγέθη.
    const showedExecution = sideTabs.includes(p.sideTab) && p.sideTab !== 'commands'
    const commands = ['hidden', 'rail', 'open'].includes(p.commands) ? p.commands : defaults.commands
    return {
      version: 3,
      commands: showedExecution ? 'hidden' : commands,
      side: p.side === 'left' ? 'left' : 'right',
      width: Number.isFinite(p.width) ? clampSize(p.width, 220, 480) : defaults.width,
      dock: p.dock === 'closed' ? 'closed' : 'minimized',
      tab: 'console',
      height: Number.isFinite(p.height) ? clampSize(p.height, 120, 600) : defaults.height,
      sideTab: 'commands',
    }
  } catch {
    return { ...defaults }
  }
}
export function shortcutAction(
  e: {
    code: string
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    shiftKey: boolean
    isComposing?: boolean
    defaultPrevented?: boolean
  },
  active: boolean,
) {
  if (!active || e.isComposing || e.defaultPrevented || e.altKey || e.shiftKey) return null
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyB') return 'commands'
  if ((e.ctrlKey || e.metaKey) && e.code === 'Backquote') return 'console'
  if (!e.ctrlKey && !e.metaKey && e.code === 'F9') return 'zen'
  return null
}
