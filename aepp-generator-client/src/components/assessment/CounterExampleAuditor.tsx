import CounterExampleNotice from './CounterExampleNotice'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, LoaderCircle, SearchCheck, Sparkles } from 'lucide-react'
import { findProgramCounterExample, previewProgram } from '../../assessment/workerClient'
import type { CounterExample } from '../../assessment/counterExampleEngine'
import type { ProgramTestCase } from '../../assessment/model'
import { reviewCode, type CodeReviewResponse } from '../../api/codeReview'
import type { ExecutionMetrics } from '../../interpreter/runtime'
import { getApiError } from '../../api/client'
import type { FuzzSpecification } from '../../assessment/fuzzSpecification'

export default function CounterExampleAuditor({ studentCode, referenceCode, testCases, executionMetrics, reviewEnabled, onOpenDebugger, specification }: {
  studentCode: string
  referenceCode: string
  testCases: ProgramTestCase[]
  executionMetrics?: ExecutionMetrics
  reviewEnabled: boolean
  onOpenDebugger: (source: string, inputs: string[]) => void
  specification?:FuzzSpecification
}) {
  const [counterExample, setCounterExample] = useState<CounterExample | null>(null)
  const [testedCases, setTestedCases] = useState<number | null>(null)
  const [skippedCases,setSkippedCases]=useState(0)
  const [fuzzing, setFuzzing] = useState(false)
  const [fuzzError, setFuzzError] = useState('')
  const [review, setReview] = useState<CodeReviewResponse | null>(null)
  const [reviewMetrics, setReviewMetrics] = useState<ExecutionMetrics | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const revision=useRef(0)
  const fuzzAbort=useRef<AbortController|null>(null),reviewAbort=useRef<AbortController|null>(null)
  useEffect(()=>{revision.current++;setCounterExample(null);setTestedCases(null);setReview(null);setFuzzError('');setReviewError('');setFuzzing(false);setReviewing(false);return()=>{revision.current++;fuzzAbort.current?.abort();reviewAbort.current?.abort()}},[studentCode,referenceCode,testCases,specification])

  async function fuzz() {
    const current=revision.current
    fuzzAbort.current?.abort();fuzzAbort.current=new AbortController()
    setFuzzing(true); setFuzzError(''); setCounterExample(null); setTestedCases(null)
    try {
      const report = await findProgramCounterExample(studentCode, referenceCode, testCases,specification,fuzzAbort.current.signal)
      if(current!==revision.current)return
      setTestedCases(report.testedCases);setSkippedCases(report.skippedCases??0)
      setCounterExample(report.counterExample)
    } catch (cause) {
      if(current===revision.current)setFuzzError(cause instanceof Error ? cause.message : 'Η αναζήτηση αντιπαραδείγματος απέτυχε.')
    } finally { if(current===revision.current)setFuzzing(false) }
  }

  async function requestReview() {
    const current=revision.current
    if (!testCases.length) return
    reviewAbort.current?.abort();reviewAbort.current=new AbortController()
    setReviewing(true); setReviewError(''); setReview(null)
    try {
      const metrics = counterExample?.metrics ?? executionMetrics ?? (await previewProgram(studentCode, testCases[0].inputs,reviewAbort.current.signal)).metrics
      const feedback=await reviewCode(studentCode, metrics,reviewAbort.current.signal)
      if(current!==revision.current)return
      setReviewMetrics(metrics);setReview(feedback)
    }
    catch (cause) { if(current===revision.current)setReviewError(getApiError(cause)) }
    finally { if(current===revision.current)setReviewing(false) }
  }

  return <section className="counterexample-auditor mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Έλεγχος αντιπαραδειγμάτων και κώδικα">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-bold text-amber-950"><SearchCheck size={17} />Έλεγχος οριακών περιπτώσεων</h3><p className="mt-1 text-xs text-amber-900">Έλεγχος ακραίων αριθμών, ταξινομημένων/όμοιων πινάκων και ορίων αναζήτησης.</p></div>
      <button type="button" disabled={fuzzing || testCases.length === 0 || !referenceCode} onClick={() => void fuzz()} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50">
        {fuzzing ? <LoaderCircle size={15} className="animate-spin" /> : <SearchCheck size={15} />}Αναζήτηση αντιπαραδείγματος
      </button>
      {reviewEnabled && <button type="button" disabled={reviewing || testCases.length === 0} onClick={() => void requestReview()} className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-950 disabled:opacity-50">{reviewing ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}AI Code Review</button>}
    </div>
    {fuzzError && <p role="alert" className="mt-3 text-sm text-rose-800">{fuzzError}</p>}
    <p className="mt-3 text-xs">{specification?'Εφαρμόζονται οι δηλωμένοι περιορισμοί της άσκησης.':'Δεν έχουν δηλωθεί περιορισμοί εισόδου: πρόκειται για διερευνητικές δοκιμές, τις οποίες πρέπει να ελέγξεις με την εκφώνηση.'} Η ελαχιστοποίηση είναι περιορισμένη αναζήτηση μικρότερης εισόδου, όχι απόδειξη καθολικά ελάχιστου αντιπαραδείγματος.</p>
    {testedCases !== null && !counterExample && <p role="status" className="mt-3 text-sm text-emerald-800">Δεν βρέθηκε αντιπαράδειγμα μετά από {testedCases} συγκρίσεις. Παραλείφθηκαν {skippedCases} μη έγκυρες περιπτώσεις. Αυτό δεν αποδεικνύει ορθότητα.</p>}
    {counterExample && <CounterExampleNotice example={counterExample} source={studentCode} onOpenDebugger={onOpenDebugger} />}
      {reviewError && <p role="alert" className="text-sm text-rose-800">{reviewError}</p>}
      {review && <div className="grid gap-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
        <h4 className="flex items-center gap-2 font-bold"><AlertTriangle size={15} />Αναφορά AI Code Review</h4>
        {reviewMetrics && <p className="text-xs">Μετρικά: {reviewMetrics.comparisonsCount} συγκρίσεις · {reviewMetrics.assignmentsCount} εκχωρήσεις · {reviewMetrics.loopIterations} επαναλήψεις</p>}
        <p className="text-xs">Τα μετρικά αφορούν μία συγκεκριμένη εκτέλεση και δεν αποδεικνύουν ασυμπτωτική πολυπλοκότητα. Το AI feedback χρειάζεται έλεγχο.</p>
        <p><strong>Αποδοτικότητα:</strong> {review.efficiency}</p><p><strong>Αλγοριθμικά σφάλματα / επικίνδυνα σημεία:</strong> {review.algorithmicRisks}</p><p><strong>Στυλ &amp; κανόνες ΑΕΠΠ:</strong> {review.styleAndAeppRules}</p>
      </div>}
  </section>
}
