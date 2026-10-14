import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { dashboardFeatures } from './dashboardFeatures'
import './dashboard-tour.css'

interface Spotlight {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
  popoverTop: number
  popoverLeft: number
}

export default function DashboardOnboardingTour({ active, step, onStepChange, onClose }: {
  active: boolean
  step: number
  onStepChange: (step: number) => void
  onClose: () => void
}) {
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const popover = useRef<HTMLElement>(null)
  const feature = dashboardFeatures[step]

  useLayoutEffect(() => {
    if (!active || !feature) return
    const target = document.querySelector<HTMLElement>(`[data-dashboard-feature="${feature.id}"]`)
    if (!target) return
    target.scrollIntoView?.({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    })

    const update = () => {
      const rect = target.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const left = Math.max(0, rect.left)
      const top = Math.max(0, rect.top)
      const right = Math.min(viewportWidth, rect.right)
      const bottom = Math.min(viewportHeight, rect.bottom)
      const popoverWidth = Math.min(380, viewportWidth - 32)
      const popoverHeight = popover.current?.getBoundingClientRect().height ?? 330
      const center = rect.left + rect.width / 2
      const spaceBelow = viewportHeight - rect.bottom - 16
      const spaceAbove = rect.top - 16
      const preferredTop = spaceBelow >= popoverHeight
        ? rect.bottom + 16
        : spaceAbove >= popoverHeight
          ? rect.top - popoverHeight - 16
          : spaceBelow >= spaceAbove
            ? rect.bottom + 8
            : rect.top - popoverHeight - 8
      setSpotlight({
        top, right: viewportWidth - right, bottom: viewportHeight - bottom, left,
        width: Math.max(0, right - left), height: Math.max(0, bottom - top),
        popoverTop: Math.max(8, Math.min(viewportHeight - popoverHeight - 8, preferredTop)),
        popoverLeft: Math.min(viewportWidth - popoverWidth / 2 - 16, Math.max(popoverWidth / 2 + 16, center)),
      })
    }
    const frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    nextButton.current?.focus()
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, feature])

  if (!active || !feature) return null

  const lastStep = step === dashboardFeatures.length - 1
  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus()
    }
  }

  return <>
    <div className="dashboard-tour-shade" aria-hidden="true">
      {spotlight && <>
        <div className="dashboard-tour-shade__pane" style={{ top: 0, right: 0, bottom: `calc(100% - ${spotlight.top}px)`, left: 0 }} />
        <div className="dashboard-tour-shade__pane" style={{ top: spotlight.top + spotlight.height, right: 0, bottom: 0, left: 0 }} />
        <div className="dashboard-tour-shade__pane" style={{ top: spotlight.top, right: `calc(100% - ${spotlight.left}px)`, bottom: spotlight.bottom, left: 0 }} />
        <div className="dashboard-tour-shade__pane" style={{ top: spotlight.top, right: 0, bottom: spotlight.bottom, left: spotlight.left + spotlight.width }} />
        <div className="dashboard-tour-shade__target" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} />
      </>}
      {!spotlight && <div className="dashboard-tour-shade__pane dashboard-tour-shade__pane--all" />}
    </div>
    <section
      className="dashboard-tour-popover theme-overlay bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-tour-title"
      aria-describedby="dashboard-tour-description"
      onKeyDown={handleKeyDown}
      ref={popover}
      style={spotlight ? { top: spotlight.popoverTop, left: spotlight.popoverLeft } : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-[10px] font-bold tracking-widest text-blue-700">ΞΕΝΑΓΗΣΗ · ΒΗΜΑ {step + 1} ΑΠΟ {dashboardFeatures.length}</p>
        <button type="button" onClick={onClose} aria-label="Κλείσιμο ξενάγησης" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
      </div>
      <h2 id="dashboard-tour-title" className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{feature.title}</h2>
      <p id="dashboard-tour-description" className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">{feature.description}</p>
      <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm leading-5 text-blue-950 dark:bg-slate-800 dark:text-white"><strong>Γιατί να το χρησιμοποιήσεις:</strong> {feature.benefit}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Παράλειψη</button>
        <div className="flex items-center gap-2">
          <button type="button" disabled={step === 0} onClick={() => onStepChange(step - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"><ArrowLeft size={15} />Πίσω</button>
          <button ref={nextButton} type="button" onClick={() => lastStep ? onClose() : onStepChange(step + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800">{lastStep ? 'Ολοκλήρωση' : 'Επόμενο'}{!lastStep && <ArrowRight size={15} />}</button>
        </div>
      </div>
    </section>
  </>
}
