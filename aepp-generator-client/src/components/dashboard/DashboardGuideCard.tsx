import { ArrowRight } from 'lucide-react'
import type { DashboardFeature } from './dashboardFeatures'

export default function DashboardGuideCard({ feature, onOpen, highlighted = false }: {
  feature: DashboardFeature
  onOpen: () => void
  highlighted?: boolean
}) {
  const Icon = feature.icon
  return <article
    data-dashboard-feature={feature.id}
    data-tour-active={highlighted || undefined}
    className="dashboard-guide-card flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
  >
    <div className="flex items-start gap-4">
      <span className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl ${feature.iconClass}`}>
        <Icon size={23} aria-hidden="true" />
      </span>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-base font-bold leading-6 text-slate-900">{feature.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{feature.description}</p>
      </div>
    </div>
    <div className="dashboard-guide-benefit mt-5 flex-1">
      <p className="text-[10px] font-bold tracking-wider text-blue-700">ΓΙΑΤΙ ΝΑ ΤΟ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ</p>
      <p className="mt-1.5 text-sm leading-5 text-slate-700">{feature.benefit}</p>
    </div>
    <button type="button" onClick={onOpen} className="dashboard-tool-button mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
      Άνοιγμα εργαλείου <ArrowRight size={16} aria-hidden="true" />
    </button>
  </article>
}
