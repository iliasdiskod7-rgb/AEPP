import { useState } from 'react'
import { AlertCircle, BookOpen, CheckCircle2, RotateCcw } from 'lucide-react'
import type { AttemptDetail } from '../../assessment/attempts'
import { Markdown } from '../exam/Markdown'
import type { AssessmentExam, AssessmentReport } from '../../assessment/model'
import { GRADING_VISIBLE } from '../../assessment/gradingDisplay'

function CodeComparison({ student, reference }: { student: string; reference: string }) {
  const left = student.split('\n'),
    right = reference.split('\n')
  const length = Math.max(left.length, right.length)
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs leading-5 text-slate-500">
        Σύγκριση κειμένου: οι διαφορετικές γραμμές δεν σημαίνουν απαραίτητα λανθασμένο αλγόριθμο.
        {GRADING_VISIBLE
          ? ' Η συμπεριφορά ελέγχεται από τις δοκιμές.'
          : ' Ένα πρόβλημα μπορεί να λυθεί σωστά με περισσότερους από έναν τρόπους.'}
      </p>
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        {[
          { title: 'Η απάντησή σου', lines: left, other: right },
          { title: 'Ενδεικτική λύση', lines: right, other: left },
        ].map(column => (
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200" key={column.title}>
            <h4 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">{column.title}</h4>
            <div className="max-h-72 overflow-auto bg-slate-900 p-2 font-mono text-[11px] text-slate-100">
              {Array.from({ length }, (_, index) => (
                <div
                  key={index}
                  className={`flex min-w-max gap-3 px-1 leading-5 ${column.lines[index] !== column.other[index] ? 'bg-amber-900/40' : ''}`}
                >
                  <span className="w-6 shrink-0 select-none text-right text-slate-500">{index + 1}</span>
                  <span className="whitespace-pre">{column.lines[index] || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AssessmentReportView({
  exam,
  report,
  onRetry,
  attempt,
  localOnly = false,
}: {
  localOnly?: boolean
  exam: AssessmentExam
  report: AssessmentReport
  onRetry: () => void
  onOpenDebugger: (source: string, inputs: string[]) => void
  attempt: AttemptDetail
}) {
  // Χωρίς βαθμούς, οι λύσεις εμφανίζονται αμέσως δίπλα στις απαντήσεις του μαθητή.
  const [solutionsVisible, setSolutionsVisible] = useState(true)
  return (
    <section className="mx-auto max-w-6xl space-y-6" aria-labelledby="assessment-result-title">
      <header className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-bold tracking-widest text-blue-700">
          {GRADING_VISIBLE ? 'ΑΝΑΦΟΡΑ ΑΥΤΟΑΞΙΟΛΟΓΗΣΗΣ' : 'ΟΙ ΑΠΑΝΤΗΣΕΙΣ ΣΟΥ ΚΑΙ ΟΙ ΛΥΣΕΙΣ'}
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 id="assessment-result-title" className="text-2xl font-bold text-slate-900">
              {GRADING_VISIBLE ? 'Αποτελέσματα διαγωνίσματος' : 'Σύγκριση με τις ενδεικτικές λύσεις'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{report.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-expanded={solutionsVisible}
              onClick={() => setSolutionsVisible(value => !value)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              <BookOpen size={16} />
              {solutionsVisible ? 'Απόκρυψη ενδεικτικών λύσεων' : 'Προβολή ενδεικτικής λύσης'}
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              <RotateCcw size={16} />
              Νέα προσπάθεια
            </button>
          </div>
        </div>
        {!GRADING_VISIBLE && (
          <p className="mt-5 text-sm leading-6 text-slate-600">
            Σύγκρινε τις απαντήσεις σου με τις ενδεικτικές λύσεις.
          </p>
        )}
        {GRADING_VISIBLE && (
          <div className="mt-6 flex flex-wrap items-end gap-3">
            <strong className="text-4xl text-blue-800">
              {report.earned}
              <span className="text-lg text-slate-400">/100</span>
            </strong>
            <span className="pb-1 text-sm text-slate-600">
              {report.grade20}/20{report.pending ? ' · προσωρινή βαθμολογία' : ''}
            </span>
          </div>
        )}
        {GRADING_VISIBLE && report.pending > 0 && attempt.status !== 'GRADED_BY_TEACHER' && (
          <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            Υπάρχουν {report.pending} μονάδες χωρίς αυτόματη αξιολόγηση. Σύγκρινε τις απαντήσεις σου με τις ενδεικτικές
            λύσεις.
          </p>
        )}
      </header>

      {!localOnly && (
        <section className="rounded-xl border bg-white p-5 space-y-3">
          <h2 className="font-bold">Αποθηκευμένη υποβολή</h2>
          {GRADING_VISIBLE ? (
            <p>Αυτόματος βαθμός: {attempt.autoGradeScore}/100 · Αυτοαξιολόγηση</p>
          ) : (
            <p className="text-sm text-slate-600">Η προσπάθεια αποθηκεύτηκε στο ιστορικό σου.</p>
          )}
          {GRADING_VISIBLE &&
            attempt.gradeRevisions.map(revision => (
              <article key={revision.id} className="border-t pt-3">
                <p>
                  {revision.teacherName} · {new Date(revision.revisedAt).toLocaleString('el-GR')} ·{' '}
                  {revision.revisedScore}/100
                </p>
                <p className="whitespace-pre-wrap">{revision.teacherComments}</p>
              </article>
            ))}
        </section>
      )}
      {GRADING_VISIBLE && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {report.sections.map(section => (
            <article key={section.theme} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-slate-800">{section.theme}</h2>
              <p className="mt-3 text-2xl font-bold text-blue-800">
                {section.earned}
                <span className="text-base font-normal text-slate-400">/{section.max}</span>
              </p>
              {section.pending > 0 && (
                <p className="mt-2 text-xs text-amber-700">{section.pending} μονάδες χωρίς αυτόματη αξιολόγηση</p>
              )}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-blue-600" style={{ width: `${(section.earned / section.max) * 100}%` }} />
              </div>
            </article>
          ))}
        </div>
      )}

      {GRADING_VISIBLE && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="study-next">
          <h2 id="study-next" className="flex items-center gap-2 text-lg font-bold">
            <BookOpen size={20} className="text-blue-700" />
            Τι να διαβάσεις στη συνέχεια
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {report.recommendations.map(item => (
              <li key={item} className="flex gap-2">
                <CheckCircle2 size={16} className="mt-1 shrink-0 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="assessment-review-title">
        <h2 id="assessment-review-title" className="text-xl font-bold">
          {GRADING_VISIBLE ? 'Αναλυτική διόρθωση' : 'Ερωτήματα'}
        </h2>
        {report.sections.flatMap(section =>
          section.questions.map(result => {
            const question = exam.sections.flatMap(item => item.questions).find(item => item.id === result.questionId)!
            const referenceCode = result.referenceCode?.trim() || (question.kind === 'program' ? question.referenceCode : '') || /```(?:glossa)?\s*\n([\s\S]*?)```/u.exec(result.expectedAnswer)?.[1]?.trim() || ''
            const studentCode = result.studentCode ?? result.studentAnswer
            return (
              <details
                key={result.questionId}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                open={!GRADING_VISIBLE || result.earned < result.max || !!result.pending}
              >
                <summary className="cursor-pointer font-semibold text-slate-900">
                  {result.code} · {question.title}
                  {GRADING_VISIBLE ? (
                    <span className="ml-3 text-sm font-normal text-blue-700">
                      {result.earned}/{result.max}
                      {result.pending ? ` · ${result.pending} χωρίς αυτόματη αξιολόγηση` : ''}
                    </span>
                  ) : (
                    <span className="ml-3 text-sm font-normal text-slate-600"></span>
                  )}
                </summary>
                {GRADING_VISIBLE && <p className="mt-3 text-sm leading-6 text-slate-600">{result.feedback}</p>}

                {GRADING_VISIBLE && result.programCases?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.programCases.map(test => (
                      <span
                        key={test.id}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${test.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                      >
                        {test.id}: {test.passed ? 'Επιτυχία' : 'Αποτυχία'}
                      </span>
                    ))}
                  </div>
                ) : null}
                {question.kind === 'program' ? (
                  <>
                    {solutionsVisible && referenceCode ? (
                      <CodeComparison student={studentCode} reference={referenceCode} />
                    ) : (
                      <div className="mt-4"><h3 className="mb-2 text-sm font-bold">Η απάντησή σου</h3>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs">{studentCode || 'Δεν δόθηκε απάντηση.'}</pre>
                      </div>
                    )}
                    {solutionsVisible && (
                      <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
                        <h3 className="mb-2 font-bold">Επεξήγηση ενδεικτικής λύσης</h3>
                        <Markdown>{result.expectedAnswer}</Markdown>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-bold">Η απάντησή σου</h3>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5">{result.studentAnswer || 'Δεν δόθηκε απάντηση.'}</pre>
                    </div>
                    {solutionsVisible && (
                      <div>
                        <h3 className="mb-2 text-sm font-bold">Ενδεικτική απάντηση</h3>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm">
                          <Markdown>{result.expectedAnswer}</Markdown>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </details>
            )
          }),
        )}
      </section>
      <p className="text-xs leading-5 text-slate-500">
        {GRADING_VISIBLE
          ? 'Τα πρότυπα βαθμολογούνται με δοκιμές και δομικά κριτήρια. Η τοπική αυτοαξιολόγηση επιβεβαιώνεται στον διακομιστή κατά την αποθήκευση. Για ερωτήματα χωρίς αυτόματη αξιολόγηση, σύγκρινε την απάντησή σου με την ενδεικτική λύση.'
          : 'Οι ενδεικτικές λύσεις είναι πρωτότυπο υλικό εξάσκησης. Μια διαφορετική αλλά σωστή απάντηση είναι εξίσου αποδεκτή.'}
      </p>
    </section>
  )
}
