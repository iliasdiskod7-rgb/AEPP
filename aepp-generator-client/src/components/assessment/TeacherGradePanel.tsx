import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { attemptError } from '../../api/attempts'
import type { AttemptDetail, GradeRequest } from '../../assessment/attempts'
export default function TeacherGradePanel({ attempt, onGrade, onRefresh }: { attempt: AttemptDetail; onGrade: (request: GradeRequest) => Promise<void>; onRefresh: () => Promise<void> }) {
  const { user } = useAuth()
  const [score, setScore] = useState(String(attempt.finalScore)), [comments, setComments] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (user?.role !== 'TEACHER' || attempt.status === 'IN_PROGRESS') return null
  return <form className="assessment-teacher-panel rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3" onSubmit={async event => { event.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await onGrade({ revisedScore: Number(score), teacherComments: comments, expectedVersion: attempt.version }); setComments('') } catch (cause) { setError(attemptError(cause)) } finally { setBusy(false) } }}>
    <h2 className="font-bold">Βαθμός Καθηγητή · {attempt.studentName}</h2>
    <label className="block text-sm">Τελικός βαθμός (0–100)<input required type="number" min="0" max="100" step="0.01" value={score} onChange={event => setScore(event.target.value)} className="ml-3 rounded border bg-white p-2" /></label>
    <label className="block text-sm">Σχόλια αξιολόγησης<textarea required maxLength={5000} value={comments} onChange={event => setComments(event.target.value)} className="mt-2 block w-full rounded border bg-white p-2" /></label>
    <button disabled={busy} className="rounded bg-amber-800 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Αποθήκευση…' : 'Καταχώριση επίσημου βαθμού'}</button>
    {error && <div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onRefresh(); setError('') } catch (cause) { setError(attemptError(cause)) } finally { setBusy(false) } }} className="underline">Ανανέωση αξιολόγησης</button></div>}
  </form>
}
