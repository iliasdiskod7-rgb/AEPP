import { useMemo, useState, type FormEvent } from 'react'
import { Check, Shuffle } from 'lucide-react'
import type { SortVisualizerId } from '../../data/courses/lesson1'
import { cn } from '../../lib/utils'
import ArrayVisualizer from './ArrayVisualizer'
import { defaultSortValues, parseArrayValues, randomArrayValues } from './algorithms'
import { sortAlgorithmIds, sortAlgorithms } from './sortSteps'

// Εργαστήριο: ίδιος πίνακας σε όλους τους αλγορίθμους, ώστε ο μαθητής να τους συγκρίνει.
export default function SortingLab() {
  const [algorithm, setAlgorithm] = useState<SortVisualizerId>('bubble-sort')
  const [values, setValues] = useState(defaultSortValues)
  const [input, setInput] = useState(defaultSortValues.join(', '))
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(
    () =>
      sortAlgorithmIds.map(id => {
        const steps = sortAlgorithms[id].generate(values, 0)
        return { id, final: steps[steps.length - 1] }
      }),
    [values],
  )

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseArrayValues(input)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    setValues(parsed.values)
  }

  const randomize = () => {
    const next = randomArrayValues()
    setValues(next)
    setInput(next.join(', '))
    setError(null)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-semibold text-slate-900">Εργαστήριο Ταξινόμησης</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Δώσε έναν πίνακα και δες πώς τον ταξινομεί κάθε μέθοδος. Ο ίδιος πίνακας χρησιμοποιείται σε όλες, ώστε να
          συγκρίνεις συγκρίσεις και μετακινήσεις.
        </p>
        <form onSubmit={apply} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 basis-60 text-xs font-semibold text-slate-700">
            Τιμές πίνακα (2–12 ακέραιοι)
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-normal text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Check size={16} aria-hidden="true" /> Εφαρμογή
          </button>
          <button
            type="button"
            onClick={randomize}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Shuffle size={16} aria-hidden="true" /> Τυχαίος
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <caption className="mb-2 text-left text-xs font-semibold text-slate-500">
              Σύγκριση για τον πίνακα [{values.join(', ')}]
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3 font-semibold">Μέθοδος</th>
                <th className="py-2 pr-3 font-semibold">Ιδέα</th>
                <th className="py-2 pr-3 text-right font-semibold">Συγκρίσεις</th>
                <th className="py-2 pr-3 text-right font-semibold">Αντιμεταθέσεις / μετακινήσεις</th>
                <th className="py-2 text-right font-semibold">Εγγραφές στον πίνακα</th>
              </tr>
            </thead>
            <tbody>
              {summary.map(({ id, final }) => (
                <tr key={id} className={cn('border-b border-slate-100 align-top', id === algorithm && 'bg-blue-50')}>
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => setAlgorithm(id)}
                      aria-pressed={id === algorithm}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {sortAlgorithms[id].shortTitle}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-xs leading-5 text-slate-600">{sortAlgorithms[id].idea}</td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-900">{final.comparisons}</td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-900">{final.moves}</td>
                  <td className="py-2 text-right font-mono text-slate-900">{final.writes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            «Εγγραφές στον πίνακα» είναι οι εκχωρήσεις της μορφής table[…] &lt;- …. Μια αντιμετάθεση κάνει 2 τέτοιες
            εγγραφές (η τρίτη εκχώρηση πηγαίνει στο temp). Δοκίμασε ήδη ταξινομημένο και αντίστροφα ταξινομημένο πίνακα.
          </p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Επιλογή μεθόδου">
        {sortAlgorithmIds.map(id => (
          <button
            key={id}
            type="button"
            aria-pressed={id === algorithm}
            onClick={() => setAlgorithm(id)}
            className={cn(
              'rounded-lg border px-4 py-2 text-sm font-medium',
              id === algorithm
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {sortAlgorithms[id].shortTitle}
          </button>
        ))}
      </nav>

      <ArrayVisualizer key={algorithm} algorithm={algorithm} values={values} />
    </div>
  )
}
