import type { Settings } from './settings'

/** One root update for React, Tailwind, native controls and top-layer dialogs. */
export function applyTheme(settings: Settings, root = document.documentElement) {
  root.dataset.theme = settings.theme
  root.classList.toggle('dark', settings.theme === 'dark')
  root.dataset.density = settings.density
  root.style.colorScheme = settings.theme
  root.style.setProperty('--settings-code-font-size', `${settings.fontSize}px`)
}
