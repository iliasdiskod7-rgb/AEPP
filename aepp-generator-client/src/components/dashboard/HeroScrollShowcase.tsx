import {
  ArrowRight,
  BookOpen,
  Braces,
  Flame,
  Play,
  Rocket,
  Sparkles,
  Workflow,
} from 'lucide-react'
import './home-showcase.css'

const codeLines = [
  ['ΠΡΟΓΡΑΜΜΑ', 'Μέγιστο'],
  ['ΜΕΤΑΒΛΗΤΕΣ', ''],
  ['ΑΚΕΡΑΙΕΣ:', 'i, max, A[5]'],
  ['ΑΡΧΗ', ''],
  ['ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 5', ''],
  ['  ΔΙΑΒΑΣΕ A[i]', ''],
  ['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', ''],
  ['max <- A[1]', ''],
  ['ΓΙΑ i ΑΠΟ 2 ΜΕΧΡΙ 5', ''],
  ['  ΑΝ A[i] > max ΤΟΤΕ', ''],
  ['    max <- A[i]', ''],
  ['  ΤΕΛΟΣ_ΑΝ', ''],
  ['ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ', ''],
  ['ΓΡΑΨΕ max', ''],
  ['ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', ''],
]

function IdeMockup() {
  return (
    <div
      role="img"
      aria-label="Προεπισκόπηση του διερμηνευτή ΓΛΩΣΣΑΣ με συντάκτη κώδικα και διάγραμμα ροής"
      className="home-ide-preview overflow-hidden rounded-2xl bg-white"
    >
      <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
          <Braces size={13} className="text-blue-600" aria-hidden="true" />
          Διερμηνευτής ΓΛΩΣΣΑΣ
        </div>
        <span className="hidden rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 sm:inline-flex">
          Έτοιμο
        </span>
      </div>

      <div className="grid min-h-[260px] md:min-h-[340px] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="min-w-0 border-b border-slate-200 bg-[#101827] p-3.5 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-300">μέγιστο.gl</span>
            <span className="rounded bg-blue-500/15 px-2 py-1 text-[9px] font-medium text-blue-200">ΠΡΟΓΡΑΜΜΑ</span>
          </div>
          <div className="space-y-1.5 overflow-hidden font-mono text-[10px] leading-4 sm:text-xs sm:leading-[1.35rem]">
            {codeLines.map(([keyword, remainder], index) => (
              <div key={`${keyword}-${index}`} className="flex min-w-max gap-3">
                <span className="w-4 shrink-0 select-none text-right text-slate-600">{index + 1}</span>
                <span className={index === 6 ? 'text-amber-200' : index === 4 || index === 7 ? 'text-emerald-300' : 'text-blue-200'}>
                  {keyword}
                </span>
                {remainder && <span className="text-slate-200">{remainder}</span>}
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-3 text-[10px] text-emerald-300 sm:text-xs">
            <Play size={12} fill="currentColor" aria-hidden="true" />
            Ενδεικτική είσοδος: 12, 18, 7, 4, 9 · Μέγιστο: 18
          </div>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-center gap-2 bg-slate-50/80 p-4 sm:p-6">
          <div className="mb-1 flex w-full items-center justify-between text-[10px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Workflow size={13} className="text-violet-600" aria-hidden="true" />Διάγραμμα Ροής</span>
            <span>Ζωντανή προεπισκόπηση</span>
          </div>
          <span className="rounded-full border border-blue-200 bg-white px-7 py-1.5 text-[10px] font-semibold text-slate-700 shadow-sm">ΑΡΧΗ</span>
          <span className="h-3 w-px bg-blue-300" aria-hidden="true" />
          <span className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-center text-[10px] font-semibold text-violet-800 shadow-sm">max &lt;- A[1]</span>
          <span className="h-3 w-px bg-blue-300" aria-hidden="true" />
          <span className="flex size-16 rotate-45 items-center justify-center border border-amber-300 bg-amber-50 shadow-sm sm:size-[4.5rem]">
            <span className="-rotate-45 text-[9px] font-semibold text-amber-900">i &lt;= 5;</span>
          </span>
          <span className="h-3 w-px bg-blue-300" aria-hidden="true" />
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-center text-[10px] font-semibold text-emerald-800 shadow-sm">max &lt;- A[i]</span>
          <span className="rounded-full border border-blue-200 bg-white px-7 py-1.5 text-[10px] font-semibold text-slate-700 shadow-sm">ΤΕΛΟΣ</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-2.5 text-[10px] text-slate-500 sm:px-5">
        <span>Ενδεικτική προεπισκόπηση</span>
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />ΓΛΩΣΣΑ</span>
      </div>
    </div>
  )
}

function AnalyticsMockup() {
  return (
    <div
      role="img"
      aria-label="Προεπισκόπηση πίνακα προόδου με streak, XP, σημειώσεις και πίνακα τιμών"
      className="home-analytics-preview overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[11px] text-slate-500">Ενδεικτική προεπισκόπηση</p>
          <h3 className="mt-0.5 text-xs font-bold text-slate-900">Η πρόοδός σου</h3>
        </div>
        <Sparkles size={17} className="text-violet-500" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        <div className="rounded-xl bg-orange-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold text-orange-800">ΣΕΡΙ ΗΜΕΡΩΝ</span>
            <Flame size={15} className="text-orange-500" aria-hidden="true" />
          </div>
          <p className="mt-1 text-xl font-extrabold leading-none text-orange-950">12 <span className="text-xs font-semibold">ημέρες</span></p>
        </div>
        <div className="rounded-xl bg-violet-50 p-3">
          <p className="text-[9px] font-semibold text-violet-800">ΣΥΝΟΛΙΚΑ XP</p>
          <p className="mt-1 text-xl font-extrabold leading-none text-violet-950">2.480 <span className="text-xs font-semibold">XP</span></p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-violet-200"><div className="h-full w-2/3 rounded-full bg-violet-500" /></div>
        </div>
      </div>

      <div className="grid grid-cols-[0.82fr_1.18fr] gap-2.5 px-3.5 pb-3.5">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-600"><BookOpen size={12} className="text-blue-600" aria-hidden="true" />Σημειώσεις</p>
          <div className="space-y-1.5">
            <p className="truncate rounded-md bg-blue-50 px-2 py-1.5 text-[9px] font-medium text-blue-900">Ταξινόμηση φυσαλίδας</p>
            <p className="truncate rounded-md bg-slate-50 px-2 py-1.5 text-[9px] font-medium text-slate-600">Πίνακες τιμών</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <p className="border-b border-slate-100 px-2.5 py-2 text-[9px] font-bold text-slate-600">ΠΙΝΑΚΑΣ ΤΙΜΩΝ</p>
          <table className="w-full text-left text-[9px]">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="px-2 py-1 font-semibold">i</th><th className="px-2 py-1 font-semibold">A[i]</th><th className="px-2 py-1 font-semibold">max</th></tr></thead>
            <tbody className="text-slate-700">
              <tr><td className="px-2 py-1">1</td><td className="px-2 py-1">12</td><td className="px-2 py-1">12</td></tr>
              <tr className="bg-blue-50 font-semibold text-blue-800"><td className="px-2 py-1">2</td><td className="px-2 py-1">18</td><td className="px-2 py-1">18</td></tr>
              <tr><td className="px-2 py-1">3</td><td className="px-2 py-1">7</td><td className="px-2 py-1">18</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function HeroScrollShowcase({ onStartNow, onOpenGuide }: {
  onStartNow: () => void
  onOpenGuide: () => void
}) {
  return (
    <section className="home-showcase">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="home-showcase-title">
          Το Πλήρες Ψηφιακό Εργαστήριο για την Πληροφορική Γ&apos; Λυκείου
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          Γράψε κώδικα, δες τη ροή εκτέλεσης σε real-time και κατάκτησε τις Πανελλαδικές.
        </p>
        <div className="home-showcase-actions mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStartNow}
            className="home-primary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Rocket size={17} aria-hidden="true" />
            Ξεκίνα Τώρα
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onOpenGuide}
            className="home-secondary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <BookOpen size={17} aria-hidden="true" />
            Οδηγός Χρήσης
          </button>
        </div>
      </div>

      <div className="home-preview-grid mx-auto w-full max-w-6xl">
          <div className="min-w-0">
            <IdeMockup />
          </div>
          <div className="home-progress min-w-0">
            <AnalyticsMockup />
          </div>
      </div>
      <p className="mx-auto mt-3 flex max-w-max items-center gap-2 text-center text-xs font-medium text-slate-500">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Play size={10} fill="currentColor" aria-hidden="true" /></span>
        Από τον κώδικα στην οπτικοποίηση — σε ένα ενιαίο περιβάλλον
      </p>
    </section>
  )
}
