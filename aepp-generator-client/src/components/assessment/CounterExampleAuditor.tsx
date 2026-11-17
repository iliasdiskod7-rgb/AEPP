import CounterExampleNotice from './CounterExampleNotice'
import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, SearchCheck } from 'lucide-react'
import { findProgramCounterExample } from '../../assessment/workerClient'
import type { CounterExample } from '../../assessment/counterExampleEngine'
import type { ProgramTestCase } from '../../assessment/model'
import type { FuzzSpecification } from '../../assessment/fuzzSpecification'

export default function CounterExampleAuditor({
  studentCode,
  referenceCode,
  testCases,
  onOpenDebugger,
  specification,
}: {
  studentCode: string
  referenceCode: string
  testCases: ProgramTestCase[]
  onOpenDebugger: (source: string, inputs: string[]) => void
  specification?: FuzzSpecification
}) {
  const [counterExample, setCounterExample] = useState<CounterExample | null>(null)
  const [testedCases, setTestedCases] = useState<number | null>(null)
  const [skippedCases, setSkippedCases] = useState(0)
  const [fuzzing, setFuzzing] = useState(false)
  const [fuzzError, setFuzzError] = useState('')
  const revision = useRef(0)
  const fuzzAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    revision.current++
    setCounterExample(null)
    setTestedCases(null)
    setFuzzError('')
    setFuzzing(false)
    return () => {
      revision.current++
      fuzzAbort.current?.abort()
    }
  }, [studentCode, referenceCode, testCases, specification])

  async function fuzz() {
    const current = revision.current
    fuzzAbort.current?.abort()
    fuzzAbort.current = new AbortController()
    setFuzzing(true)
    setFuzzError('')
    setCounterExample(null)
    setTestedCases(null)
    try {
      const report = await findProgramCounterExample(
        studentCode,
        referenceCode,
        testCases,
        specification,
        fuzzAbort.current.signal,
      )
      if (current !== revision.current) return
      setTestedCases(report.testedCases)
      setSkippedCases(report.skippedCases ?? 0)
      setCounterExample(report.counterExample)
    } catch (cause) {
      if (current === revision.current)
        setFuzzError(cause instanceof Error ? cause.message : 'Η αναζήτηση αντιπαραδείγματος απέτυχε.')
    } finally {
      if (current === revision.current) setFuzzing(false)
    }
  }

  return (
    <section
      className="counterexample-auditor mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"
      aria-label="Έλεγχος αντιπαραδειγμάτων και κώδικα"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <SearchCheck size={17} />
            Έλεγχος οριακών περιπτώσεων
          </h3>
          <p className="mt-1 text-xs text-amber-900">
            Έλεγχος ακραίων αριθμών, ταξινομημένων/όμοιων πινάκων και ορίων αναζήτησης.
          </p>
        </div>
        <button
          type="button"
          disabled={fuzzing || testCases.length === 0 || !referenceCode}
          onClick={() => void fuzz()}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
        >
          {fuzzing ? <LoaderCircle size={15} className="animate-spin" /> : <SearchCheck size={15} />}Αναζήτηση
          αντιπαραδείγματος
        </button>
      </div>
      {fuzzError && (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {fuzzError}
        </p>
      )}
      <p className="mt-3 text-xs">
        {specification
          ? 'Εφαρμόζονται οι δηλωμένοι περιορισμοί της άσκησης.'
          : 'Δεν έχουν δηλωθεί περιορισμοί εισόδου: πρόκειται για διερευνητικές δοκιμές, τις οποίες πρέπει να ελέγξεις με την εκφώνηση.'}{' '}
        Η ελαχιστοποίηση είναι περιορισμένη αναζήτηση μικρότερης εισόδου, όχι απόδειξη καθολικά ελάχιστου
        αντιπαραδείγματος.
      </p>
      {testedCases !== null && !counterExample && (
        <p role="status" className="mt-3 text-sm text-emerald-800">
          Δεν βρέθηκε αντιπαράδειγμα μετά από {testedCases} συγκρίσεις. Παραλείφθηκαν {skippedCases} μη έγκυρες
          περιπτώσεις. Αυτό δεν αποδεικνύει ορθότητα.
        </p>
      )}
      {counterExample && (
        <CounterExampleNotice example={counterExample} source={studentCode} onOpenDebugger={onOpenDebugger} />
      )}
    </section>
  )
}
