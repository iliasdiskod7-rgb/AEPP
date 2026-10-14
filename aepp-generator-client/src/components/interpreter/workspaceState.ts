export type DockMode = 'closed' | 'minimized' | 'open' | 'maximized'
export interface WorkspacePreferences { version: 1; commands: 'hidden' | 'rail' | 'open'; side: 'left' | 'right'; width: number; dock: DockMode; tab: 'console' | 'memory'; height: number }
export const storageKey = 'aepp.ide.workspace.v1'
export const defaults: WorkspacePreferences = { version: 1, commands: 'hidden', side: 'right', width: 300, dock: 'minimized', tab: 'console', height: 260 }
export function clampSize(value: number, minimum: number, maximum: number) { return Math.min(Math.max(value, minimum), Math.max(minimum, maximum)) }
export function resizeSize(start: number, delta: number, direction: 1 | -1, minimum: number, maximum: number) { return clampSize(start + delta * direction, minimum, maximum) }
export function restorePreferences(raw: string | null): WorkspacePreferences {
  try {
    const p = JSON.parse(raw ?? 'null')
    if (!p || p.version !== 1) return { ...defaults }
    return { version: 1, commands: ['hidden','rail','open'].includes(p.commands) ? p.commands : defaults.commands, side: p.side === 'left' ? 'left' : 'right', width: Number.isFinite(p.width) ? clampSize(p.width, 220, 480) : defaults.width, dock: ['closed','minimized','open','maximized'].includes(p.dock) ? p.dock : defaults.dock, tab: p.tab === 'memory' ? 'memory' : 'console', height: Number.isFinite(p.height) ? clampSize(p.height, 120, 600) : defaults.height }
  } catch { return { ...defaults } }
}
export function shortcutAction(e: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; isComposing?: boolean; defaultPrevented?: boolean }, active: boolean) {
  if (!active || e.isComposing || e.defaultPrevented || e.altKey || e.shiftKey) return null
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyB') return 'commands'
  if ((e.ctrlKey || e.metaKey) && e.code === 'Backquote') return 'console'
  if (!e.ctrlKey && !e.metaKey && e.code === 'F9') return 'zen'
  return null
}
