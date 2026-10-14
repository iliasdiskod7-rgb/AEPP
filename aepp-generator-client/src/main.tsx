import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import './settings/theme-surfaces.css'
import { applyTheme } from './settings/applyTheme'
import { defaultSettings, restoreSettings, SETTINGS_KEY } from './settings/settings'

// Apply persisted colors before the first React render, including native dialogs.
try { applyTheme(restoreSettings(localStorage.getItem(SETTINGS_KEY))) }
catch { applyTheme(defaultSettings) }

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('app')!).render(
  <StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></StrictMode>,
)
