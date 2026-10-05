import { AlertCircle, BookOpen, CheckCircle2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Markdown } from '../exam/Markdown'
import type { AssessmentExam, AssessmentInsight, AssessmentReport } from '../../assessment/model'

function CodeComparison({ student, reference }: { student: string; reference: string }) {
  const left = student.split('\n'), right = reference.split('\n')
  const length = Math.max(left.length, right.length)
  return <div className="mt-4">
    <p className="mb-2 text-xs leading-5 text-slate-500">Σύγκριση κειμένου: οι διαφορετικές γραμμές δεν σημαίνουν απαραίτητα λανθασμένο αλγόριθμο. Η συμπεριφορά ελέγχεται από τις δοκιμές.</p>
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      {[{ title: 'Η απάντησή σου', lines: left, other: right }, { title: 'Ενδεικτική λύση', lines: right, other: left }].map(column =>
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200" key={column.title}>
          <h4 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">{column.title}</h4>
          <div className="max-h-72 overflow-auto bg-slate-900 p-2 font-mono text-[11px] text-slate-100">{Array.from({ length }, (_, index) =>
            <div key={index} className={`flex min-w-max gap-3 px-1 leading-5 ${column.lines[index] !== column.other[index] ? 'bg-amber-900/40' : ''}`}>
              <span className="w-6 shrink-0 select-none text-right text-slate-500">{index + 1}</span><span className="whitespace-pre">{column.lines[index] || ' '}</span>
            </div>)}</div>
        </div>)}</div>
  </div>
}

export default function AssessmentReportView({ exam, report, insight, insightLoading, insightError, aiAvailable, onRetry, onRetryInsight, onTeacherScore }: {
  exam: AssessmentExam; report: AssessmentReport; insight: AssessmentInsight | null; insightLoading: boolean; insightError: string; aiAvailable: boolean;
  onRetry: () => void; onRetryInsight: () => void; onTeacherScore: (questionId: string, score: number) => void
}) {
  const [teacherInputs, setTeacherInputs] = useState<Record<string, string>>({})
  return <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="assessment-result-title">
    <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-xs font-bold tracking-widest text-blue-700">ΑΝΑΦΟΡΑ ΑΥΤΟΑΞΙΟΛΟΓΗΣΗΣ</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-5"><div><h1 id="assessment-result-title" className="text-2xl font-bold text-slate-900">Αποτελέσματα διαγωνίσματος</h1><p className="mt-2 text-sm text-slate-500">{report.title}</p></div><button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"><RotateCcw size={16} />Νέα προσπάθεια</button></div>
      <div className="mt-6 flex flex-wrap items-end gap-3"><strong className="text-4xl text-blue-800">{report.earned}<span className="text-lg text-slate-400">/100</span></strong><span className="pb-1 text-sm text-slate-600">{report.grade20}/20{report.pending ? ' · προσωρινή βαθμολογία' : ''}</span></div>
      {report.pending > 0 && <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><AlertCircle className="mt-0.5 shrink-0" size={18} />Εκκρεμούν {report.pending} μονάδες για έλεγχο καθηγητή. Η τελική βαθμολογία μπορεί να αυξηθεί· η τρέχουσα ένδειξη δεν είναι οριστική.</p>}
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{report.sections.map(section => <article key={section.theme} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-800">{section.theme}</h2><p className="mt-3 text-2xl font-bold text-blue-800">{section.earned}<span className="text-base font-normal text-slate-400">/{section.max}</span></p>{section.pending > 0 && <p className="mt-2 text-xs text-amber-700">{section.pending} μονάδες σε εκκρεμότητα</p>}<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{ width: `${section.earned / section.max * 100}%` }} /></div></article>)}</div>

    <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="study-next"><h2 id="study-next" className="flex items-center gap-2 text-lg font-bold"><BookOpen size={20} className="text-blue-700" />Τι να διαβάσεις στη συνέχεια</h2><ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">{report.recommendations.map(item => <li key={item} className="flex gap-2"><CheckCircle2 size={16} className="mt-1 shrink-0 text-blue-600" />{item}</li>)}</ul></section>

    {aiAvailable && <section className="rounded-2xl border border-violet-200 bg-violet-50 p-6" aria-labelledby="gemini-insight-title"><h2 id="gemini-insight-title" className="text-lg font-bold text-violet-950">Εκπαιδευτική ανάλυση Gemini</h2>{!insight && !insightLoading && !insightError && <button type="button" onClick={onRetryInsight} className="mt-3 rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold">Δημιουργία ανάλυσης</button>}{insightLoading && <p className="mt-3 text-sm text-violet-800">Δημιουργείται στοχευμένη ανατροφοδότηση…</p>}{insightError && <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-sm text-violet-900">{insightError}</p><button type="button" onClick={onRetryInsight} className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-semibold">Επανάληψη ανάλυσης</button></div>}{insight && <><p className="mt-3 text-sm leading-6 text-violet-950">{insight.summary}</p><ul className="mt-3 list-inside list-disc space-y-1 text-sm leading-6 text-violet-900">{insight.recommendations.map(item => <li key={item}>{item}</li>)}</ul>{insight.partialCreditSuggestions.length > 0 && <div className="mt-4 border-t border-violet-200 pt-3"><h3 className="text-sm font-bold">Προτάσεις μερικής βαθμολογίας προς τον καθηγητή</h3><p className="mt-1 text-xs text-violet-800">Οι προτάσεις δεν προστίθενται αυτόματα στον βαθμό.</p><ul className="mt-2 space-y-2 text-sm">{insight.partialCreditSuggestions.map(item => <li key={item.code}><strong>{item.code}: έως {item.points} μόρια</strong> — {item.reason}</li>)}</ul></div>}</>}</section>}

    <section className="space-y-4" aria-labelledby="assessment-review-title"><h2 id="assessment-review-title" className="text-xl font-bold">Αναλυτική διόρθωση</h2>{report.sections.flatMap(section => section.questions.map(result => {
      const question = exam.sections.flatMap(item => item.questions).find(item => item.id === result.questionId)!
      return <details key={result.questionId} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" open={result.earned < result.max || !!result.pending}>
        <summary className="cursor-pointer font-semibold text-slate-900">{result.code} · {question.title}<span className="ml-3 text-sm font-normal text-blue-700">{result.earned}/{result.max}{result.pending ? ` · ${result.pending} σε εκκρεμότητα` : ''}</span></summary>
        <p className="mt-3 text-sm leading-6 text-slate-600">{result.feedback}</p>
        {result.pending > 0 && <form className="mt-4 flex flex-wrap items-end gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3" onSubmit={event => { event.preventDefault(); onTeacherScore(result.questionId, Number(teacherInputs[result.questionId])) }}><label className="text-xs font-semibold text-amber-950">Βαθμός καθηγητή (0–{result.max})<input type="number" required min="0" max={result.max} step="0.5" value={teacherInputs[result.questionId] ?? ''} onChange={event => setTeacherInputs(current => ({ ...current, [result.questionId]: event.target.value }))} className="mt-1 block w-28 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm" /></label><button type="submit" className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white">Καταχώριση βαθμού</button></form>}
        {result.programCases?.length ? <div className="mt-3 flex flex-wrap gap-2">{result.programCases.map(test => <span key={test.id} className={`rounded-full px-3 py-1 text-xs font-medium ${test.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{test.id}: {test.passed ? 'Επιτυχία' : 'Αποτυχία'}</span>)}</div> : null}
        {result.studentCode !== undefined && result.referenceCode ? <CodeComparison student={result.studentCode} reference={result.referenceCode} /> : <div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="mb-2 text-sm font-bold">Η απάντησή σου</h3><pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5">{result.studentAnswer}</pre></div><div><h3 className="mb-2 text-sm font-bold">Σωστή απάντηση</h3><div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm"><Markdown>{result.expectedAnswer}</Markdown></div></div></div>}
        {result.studentCode !== undefined && <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm"><h3 className="mb-2 font-bold">Επεξήγηση λύσης</h3><Markdown>{result.expectedAnswer}</Markdown></div>}
      </details>
    }))}</section>
    <p className="text-xs leading-5 text-slate-500">Η αυτοαξιολόγηση βασίζεται σε προκαθορισμένες απαντήσεις, δοκιμές εκτέλεσης και απλά δομικά κριτήρια. Οι δοκιμές στο πρόγραμμα περιήγησης δεν αποτελούν ασφαλή εξέταση με μυστική τράπεζα θεμάτων.</p>
  </section>
}
