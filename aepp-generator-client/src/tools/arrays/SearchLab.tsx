import { useMemo, useState, type FormEvent } from 'react'
import { Check, Shuffle } from 'lucide-react'
import type { SearchVisualizerId } from '../../data/courses/lesson1'
import { cn } from '../../lib/utils'
import ArrayVisualizer from './ArrayVisualizer'
import {
  ascending,
  defaultSearchKey,
  defaultSearchValues,
  parseArrayValues,
  parseKey,
  randomSearchCase,
} from './algorithms'
import { searchAlgorithms } from './searchSteps'

const ids = Object.keys(searchAlgorithms) as SearchVisualizerId[]

// Εργαστήριο: ο ίδιος ταξινομημένος πίνακας και το ίδιο key σε όλες τις μεθόδους.
export default function SearchLab() {
  const [algorithm, setAlgorithm] = useState<SearchVisualizerId>('binary-search')
  const [values, setValues] = useState(defaultSearchValues)
  const [key, setKey] = useState(defaultSearchKey)
  const [input, setInput] = useState(defaultSearchValues.join(', '))
  const [keyInput, setKeyInput] = useState(String(defaultSearchKey))
  const [error, setError] = useState<string | null>(null)
  const sorted = useMemo(() => ascending(values), [values])

  const summary = useMemo(
    () =>
      ids.map(id => {
        const steps = searchAlgorithms[id].generate(sorted, key)
        return { id, final: steps[steps.length - 1] }
      }),
    [sorted, key],
  )

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseArrayValues(input)
    if ('error' in parsed) return setError(parsed.error)
    const parsedKey = parseKey(keyInput)
    if ('error' in parsedKey) return setError(parsedKey.error)
    setError(null)
    setValues(parsed.values)
    setKey(parsedKey.key)
  }

  const randomize = () => {
    const next = randomSearchCase()
    const shown = ascending(next.values)
    setValues(shown)
    setKey(next.key)
    setInput(shown.join(', '))
    setKeyInput(String(next.key))
    setError(null)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-lg font-semibold text-slate-900">Εργαστήριο Αναζήτησης</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Δώσε έναν πίνακα και την τιμή key. Για να είναι δίκαιη η σύγκριση, όλες οι μέθοδοι τρέχουν στον ίδιο πίνακα
          ταξινομημένο σε αύξουσα σειρά. Δοκίμασε key που υπάρχει, key που δεν υπάρχει και key στην αρχή ή στο τέλος.
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
          <label className="w-28 text-xs font-semibold text-slate-700">
            key
            <input
              value={keyInput}
              onChange={event => setKeyInput(event.target.value)}
              inputMode="numeric"
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
            <Shuffle size={16} aria-hidden="true" /> Τυχαίο
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
              Αναζήτηση του {key} στον πίνακα [{sorted.join(', ')}]
            </caption>
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="py-2 pr-3 font-semibold">Μέθοδος</th>
                <th className="py-2 pr-3 font-semibold">Ιδέα</th>
                <th className="py-2 pr-3 text-right font-semibold">Εξετάσεις στοιχείων</th>
                <th className="py-2 text-right font-semibold">Αποτέλεσμα</th>
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
                      {searchAlgorithms[id].shortTitle}
                    </button>
                  </td>
                  <td className="py-2 pr-3 text-xs leading-5 text-slate-600">{searchAlgorithms[id].idea}</td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-900">{final.comparisons}</td>
                  <td className="py-2 text-right text-xs text-slate-700">{final.output.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Στη χειρότερη περίπτωση η σειριακή εξετάζει και τα Ν στοιχεία, ενώ η δυαδική το πολύ ⌊log₂(Ν) + 1⌋. Για Ν =
            {` ${sorted.length}`}: {sorted.length} έναντι {Math.floor(Math.log2(sorted.length) + 1)}. Για Ν = 1000: 1000
            έναντι 10.
          </p>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Επιλογή μεθόδου">
        {ids.map(id => (
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
            {searchAlgorithms[id].shortTitle}
          </button>
        ))}
      </nav>

      <ArrayVisualizer key={algorithm} algorithm={algorithm} values={sorted} searchKey={key} />
    </div>
  )
}
