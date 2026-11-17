import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, Pause, Play, RotateCcw, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import type { VisualizerId } from '../../data/courses/lesson1'
import { cn } from '../../lib/utils'
import {
  arrayAlgorithms,
  ascending,
  defaultSearchKey,
  defaultSearchValues,
  defaultSortValues,
  parseArrayValues,
  parseKey,
  randomArrayValues,
  randomSearchCase,
} from './algorithms'
import type { CellRole } from './types'

const roleStyle: Record<CellRole, string> = {
  compare: 'border-amber-400 bg-amber-50 text-slate-900 -translate-y-1',
  swap: 'border-red-500 bg-red-50 text-slate-900 -translate-y-2',
  min: 'border-violet-500 bg-violet-50 text-slate-900',
  free: 'border-dashed border-slate-400 bg-white text-slate-400',
  shift: 'border-blue-500 bg-blue-50 text-slate-900 -translate-y-1',
  insert: 'border-emerald-500 bg-emerald-50 text-slate-900 -translate-y-1 ring-2 ring-emerald-400',
  found: 'border-emerald-600 bg-emerald-50 text-slate-900 -translate-y-2 ring-2 ring-emerald-500',
  discarded: 'border-slate-200 bg-slate-100 text-slate-400 opacity-60',
}

const roleLabel: Record<CellRole, string> = {
  compare: 'σύγκριση',
  swap: 'αντιμετάθεση',
  min: 'ελάχιστο (k)',
  free: 'ελεύθερη',
  shift: 'μετακίνηση',
  insert: 'εισαγωγή',
  found: 'βρέθηκε',
  discarded: 'εκτός αναζήτησης',
}

const speeds = [
  { label: 'Αργά', ms: 1400 },
  { label: 'Κανονικά', ms: 800 },
  { label: 'Γρήγορα', ms: 350 },
]

interface ArrayVisualizerProps {
  algorithm: VisualizerId
  /** Τιμές από έξω (εργαστήριο). Αν λείπουν, το component έχει δική του φόρμα εισόδου. */
  values?: number[]
  /** Τιμή key από έξω (εργαστήριο αναζήτησης). */
  searchKey?: number
}

export default function ArrayVisualizer({ algorithm, values, searchKey }: ArrayVisualizerProps) {
  const algo = arrayAlgorithms[algorithm]
  const initialValues = algo.needsKey ? defaultSearchValues : defaultSortValues
  const [ownValues, setOwnValues] = useState(initialValues)
  const [ownKey, setOwnKey] = useState(defaultSearchKey)
  const [input, setInput] = useState(initialValues.join(', '))
  const [keyInput, setKeyInput] = useState(String(defaultSearchKey))
  const [error, setError] = useState<string | null>(null)
  const given = values ?? ownValues
  const key = searchKey ?? ownKey
  const data = useMemo(() => (algo.requiresSorted ? ascending(given) : given), [algo, given])
  const autoSorted = algo.requiresSorted && data.some((value, index) => value !== given[index])
  const steps = useMemo(() => algo.generate(data, key), [algo, data, key])
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(speeds[1].ms)
  const last = steps.length - 1
  const step = steps[Math.min(current, last)]

  useEffect(() => {
    setCurrent(0)
    setPlaying(false)
  }, [steps])

  useEffect(() => {
    if (!playing) return
    if (current >= last) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setCurrent(value => value + 1), speed)
    return () => clearTimeout(timer)
  }, [playing, current, last, speed])

  const apply = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseArrayValues(input)
    if ('error' in parsed) return setError(parsed.error)
    if (algo.needsKey) {
      const parsedKey = parseKey(keyInput)
      if ('error' in parsedKey) return setError(parsedKey.error)
      setOwnKey(parsedKey.key)
    }
    setError(null)
    setOwnValues(parsed.values)
  }

  const randomize = () => {
    if (algo.needsKey) {
      const next = randomSearchCase()
      const shown = algo.requiresSorted ? ascending(next.values) : next.values
      setOwnValues(shown)
      setInput(shown.join(', '))
      setOwnKey(next.key)
      setKeyInput(String(next.key))
    } else {
      const next = randomArrayValues()
      setOwnValues(next)
      setInput(next.join(', '))
    }
    setError(null)
  }

  const togglePlay = () => {
    if (current >= last) {
      setCurrent(0)
      setPlaying(true)
    } else setPlaying(value => !value)
  }

  const varEntries = Object.entries(step.vars)
  const id = `viz-${algorithm}`

  return (
    <section
      aria-label={`Οπτικοποίηση: ${algo.title}`}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h4 className="text-base font-semibold text-slate-900">{algo.title}</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">{algo.idea}</p>
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-2 text-center">
          {[
            [algo.comparisonsLabel, step.comparisons],
            [algo.movesLabel, step.moves],
            ['Βήμα', `${current + 1}/${steps.length}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <dt className="text-[10px] font-semibold text-slate-500">{label}</dt>
              <dd className="font-mono text-sm font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex min-h-9 flex-wrap items-center gap-2">
              {varEntries.length === 0 ? (
                <span className="text-xs text-slate-500">Μεταβλητές: —</span>
              ) : (
                varEntries.map(([name, value]) => (
                  <span
                    key={name}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-700"
                  >
                    {name} = <strong className="text-slate-900">{value}</strong>
                  </span>
                ))
              )}
              {step.floating !== null && (
                <span className="ml-auto rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-1 font-mono text-sm font-bold text-slate-900">
                  temp = {step.floating}
                </span>
              )}
            </div>

            <ol className="mt-4 flex flex-wrap justify-center gap-1.5 sm:gap-2" aria-label="Πίνακας table">
              {step.array.map((value, index) => {
                const role = step.roles[index]
                const sorted = !role && step.sorted.includes(index)
                const pointers = step.pointers[index] ?? []
                return (
                  <li key={index} className="flex w-11 flex-col items-center sm:w-14">
                    <span className="mb-1 font-mono text-[10px] text-slate-500">[{index + 1}]</span>
                    <span
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl border-2 font-mono text-base font-bold motion-safe:transition-all motion-safe:duration-300 sm:h-14 sm:w-14 sm:text-lg',
                        role
                          ? roleStyle[role]
                          : sorted
                            ? 'border-emerald-400 bg-emerald-50 text-slate-900'
                            : 'border-slate-300 bg-white text-slate-900',
                      )}
                    >
                      {value}
                    </span>
                    <span className="mt-1 min-h-4 text-center text-[10px] leading-4 text-slate-500">
                      {role && role !== 'discarded' ? roleLabel[role] : sorted ? '✓' : ''}
                    </span>
                    {pointers.map(label => (
                      <span key={label} className="font-mono text-[10px] font-bold leading-4 text-blue-700">
                        ↑{label}
                      </span>
                    ))}
                  </li>
                )
              })}
            </ol>
          </div>

          <p
            aria-live="polite"
            className="min-h-14 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700"
          >
            {step.description}
          </p>

          {algo.needsKey && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm text-slate-900">
              <span className="mr-2 font-sans text-[10px] font-semibold tracking-wider text-slate-500">ΕΞΟΔΟΣ</span>
              {step.output.length ? step.output.join(' · ') : '—'}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlaying(false)
                  setCurrent(0)
                }}
                disabled={current === 0}
                title="Από την αρχή"
                aria-label="Από την αρχή"
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setCurrent(value => Math.max(0, value - 1))}
                disabled={current === 0 || playing}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <SkipBack size={16} aria-hidden="true" /> Πίσω
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                {playing ? 'Παύση' : current >= last ? 'Ξανά' : 'Αναπαραγωγή'}
              </button>
              <button
                type="button"
                onClick={() => setCurrent(value => Math.min(last, value + 1))}
                disabled={current >= last || playing}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Επόμενο <SkipForward size={16} aria-hidden="true" />
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              Ταχύτητα
              <select
                value={speed}
                onChange={event => setSpeed(Number(event.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                {speeds.map(option => (
                  <option key={option.ms} value={option.ms}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
            {algo.legend.map(role => (
              <li key={role} className="flex items-center gap-1.5">
                <span aria-hidden="true" className={cn('inline-block h-3.5 w-3.5 rounded border-2', roleStyle[role])} />
                {roleLabel[role]}
              </li>
            ))}
            {!algo.needsKey && (
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-3.5 w-3.5 rounded border-2 border-emerald-400 bg-emerald-50"
                />
                ταξινομημένο
              </li>
            )}
          </ul>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-slate-500">ΚΩΔΙΚΑΣ ΓΛΩΣΣΑΣ</p>
            <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 py-2 font-mono text-xs leading-6">
              {algo.code.map((codeLine, index) => {
                const active = step.lines.includes(index)
                return (
                  <div
                    key={index}
                    className={cn(
                      'border-l-4 pr-3',
                      active
                        ? 'border-blue-600 bg-blue-50 font-bold text-slate-900'
                        : 'border-transparent text-slate-600',
                    )}
                    style={{ paddingLeft: `${0.5 + codeLine.indent * 1.1}rem` }}
                  >
                    {codeLine.text}
                  </div>
                )
              })}
            </pre>
          </div>

          {!values && (
            <form onSubmit={apply} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700" htmlFor={`${id}-values`}>
                Τιμές πίνακα (2–12 ακέραιοι)
              </label>
              <input
                id={`${id}-values`}
                value={input}
                onChange={event => setInput(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
              {algo.needsKey && (
                <>
                  <label className="block text-xs font-semibold text-slate-700" htmlFor={`${id}-key`}>
                    Τιμή που αναζητούμε (key)
                  </label>
                  <input
                    id={`${id}-key`}
                    value={keyInput}
                    onChange={event => setKeyInput(event.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                  />
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Check size={16} aria-hidden="true" /> Εφαρμογή
                </button>
                <button
                  type="button"
                  onClick={randomize}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Shuffle size={16} aria-hidden="true" /> Τυχαίο
                </button>
              </div>
              {error && (
                <p role="alert" className="text-xs text-red-700">
                  {error}
                </p>
              )}
            </form>
          )}
          {autoSorted && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-slate-700">
              Ο αλγόριθμος προϋποθέτει αύξουσα ταξινόμηση, οπότε ο πίνακας ταξινομήθηκε πριν από την αναζήτηση.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
