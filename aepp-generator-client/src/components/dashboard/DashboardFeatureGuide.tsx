import { useAuth } from '../../auth/AuthContext'
import type { DashboardTab } from '../layout/DashboardLayout'
import DashboardGuideCard from './DashboardGuideCard'
import DashboardOnboardingTour from './DashboardOnboardingTour'
import { dashboardFeatures } from './dashboardFeatures'

export default function DashboardFeatureGuide({ welcomeVisible, storageError, tourActive, tourStep, onStartTour, onStepChange, onCloseTour, onNavigate }: {
  welcomeVisible: boolean
  storageError: boolean
  tourActive: boolean
  tourStep: number
  onStartTour: () => void
  onStepChange: (step: number) => void
  onCloseTour: () => void
  onNavigate: (tab: DashboardTab) => void
}) {
  const { user } = useAuth()
  return <>
    <section className="dashboard-feature-guide mx-auto max-w-6xl" aria-labelledby="dashboard-page-title">
      {welcomeVisible && <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 sm:p-6">
        <div><p className="text-xs font-bold tracking-widest text-blue-700">ΚΑΛΩΣ ΗΡΘΕΣ ΣΤΟ AEPP STUDIO</p><h2 className="mt-2 text-lg font-bold text-slate-900">Καλώς ήρθες στο AEPP Studio! Πάτα «Ξενάγηση» για να δεις πώς να πάρεις 20 στις Πανελλαδικές!</h2></div>
        <button type="button" onClick={onStartTour} className="min-h-11 shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Ξενάγηση</button>
      </div>}
      {storageError && <p role="status" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Δεν ήταν δυνατή η ανάγνωση ή αποθήκευση της προτίμησής σου για την ξενάγηση σε αυτή τη συσκευή.</p>}
      <div className="mb-6">
        <h2 id="dashboard-page-title" className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{user ? `Καλώς ήρθες, ${user.fullName}.` : 'Καλώς ήρθες στην ΑΕΠΠ.'}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Επίλεξε ένα εργαλείο για να εξασκηθείς, να οργανώσεις τις σημειώσεις σου ή να δεις τον αλγόριθμό σου σε δράση.</p>
      </div>
      <div className="dashboard-feature-grid grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {dashboardFeatures.map(feature => <DashboardGuideCard key={feature.id} feature={feature} highlighted={tourActive && dashboardFeatures[tourStep]?.id === feature.id} onOpen={() => onNavigate(feature.destination)} />)}
      </div>
    </section>
    <DashboardOnboardingTour active={tourActive} step={tourStep} onStepChange={onStepChange} onClose={onCloseTour} />
  </>
}
