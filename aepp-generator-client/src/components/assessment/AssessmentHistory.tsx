import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { attemptError, getAttemptHistory } from '../../api/attempts'
import type { AttemptPage } from '../../assessment/attempts'
export default function AssessmentHistory({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const { user } = useAuth()
  const [teacher, setTeacher] = useState(false), [page, setPage] = useState(1), [data, setData] = useState<AttemptPage | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { const controller = new AbortController(); setData(null); setError(''); void getAttemptHistory(page, teacher && user?.role === 'TEACHER', controller.signal).then(result => { if (!controller.signal.aborted) setData(result) }).catch(cause => { if (!controller.signal.aborted) setError(attemptError(cause)) }); return () => controller.abort() }, [page, teacher, user?.id, user?.role])
  return <section className="mx-auto max-w-6xl space-y-4"><h1 className="text-2xl font-bold">Ιστορικό διαγωνισμάτων</h1>
    {user?.role === 'TEACHER' && <button className="rounded border p-2" onClick={() => { setTeacher(value => !value); setPage(1) }}>{teacher ? 'Οι δικές μου προσπάθειες' : 'Υποβολές μαθητών προς αξιολόγηση'}</button>}
    {error && <p role="alert">{error}</p>}{!data && !error && <p role="status">Φόρτωση ιστορικού…</p>}
    {data?.items.length === 0 && <p>Δεν υπάρχουν προσπάθειες.</p>}
    {data?.items.map(item => <article key={item.id} className="rounded-xl border bg-white p-5 space-y-2"><h2 className="font-bold">{item.examTitle}</h2><p>{item.studentName} · {new Date(item.startedAt).toLocaleString('el-GR')}</p><p>{item.status === 'IN_PROGRESS' ? 'Σε εξέλιξη' : 'Αυτόματη βαθμολογία: ' + item.autoGradeScore + '/100'}{item.status === 'GRADED_BY_TEACHER' && ' · Επίσημος βαθμός: ' + item.finalScore + '/100'}</p><p className="text-sm">{item.sections.map(section => section.theme + ': ' + section.autoPoints + '/' + section.maxPoints).join(' · ')}</p><button disabled={busy} className="rounded border px-3 py-2 disabled:opacity-50" onClick={async () => { setBusy(true); setError(''); try { await onOpen(item.id) } catch (cause) { setError(attemptError(cause)) } finally { setBusy(false) } }}>{item.status === 'IN_PROGRESS' ? 'Συνέχιση' : 'Αναλυτική αναφορά'}</button></article>)}
    {data && <nav aria-label="Σελίδες ιστορικού" className="flex gap-3 items-center"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Προηγούμενη</button><span>Σελίδα {page}</span><button disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Επόμενη</button></nav>}
  </section>
}
