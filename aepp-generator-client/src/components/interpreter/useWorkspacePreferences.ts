import { useEffect, useRef, useState } from 'react'
import { defaults, restorePreferences, storageKey } from './workspaceState'
export default function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState(() => { try { return restorePreferences(window.localStorage.getItem(storageKey)) } catch { return { ...defaults } } })
  const latest = useRef(preferences)
  latest.current = preferences
  function save() { try { localStorage.setItem(storageKey, JSON.stringify(latest.current)) } catch { /* Storage may be disabled; the workspace still works. */ } }
  useEffect(() => { const timer = window.setTimeout(save, 200); return () => window.clearTimeout(timer) }, [preferences])
  useEffect(() => { window.addEventListener('pagehide', save); return () => { window.removeEventListener('pagehide', save); save() } }, [])
  return [preferences, setPreferences] as const
}
