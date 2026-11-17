import { useEffect, useRef, useState } from 'react'
import { BookOpen, Copy, Download, Play } from 'lucide-react'
import { notesApi } from '../api/notes'
import { useAuth } from '../auth/AuthContext'
import { LoginRegisterForm } from '../auth/AuthForms'
import { useNotes } from './NotesContext'
import type { SharedNote } from './model'
import './notes.css'
export default function SharedNotePage({
  token,
  onOpen,
  onHome,
}: {
  token: string
  onOpen: (source: string) => void
  onHome: () => void
}) {
  const { user, isLoading } = useAuth(),
    { save } = useNotes(),
    [note, setNote] = useState<SharedNote | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [actionError, setActionError] = useState(''),
    [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [login, setLogin] = useState(false),
    [retry, setRetry] = useState(0)
  const alive = useRef(true),
    identity = useRef(user?.id)
  identity.current = user?.id
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setNote(null)
    notesApi
      .shared(token, controller.signal)
      .then(value => {
        if (!controller.signal.aborted) setNote(value)
      })
      .catch(cause => {
        if (!controller.signal.aborted)
          setError(
            cause?.response?.status === 404
              ? 'Η σημείωση δεν είναι διαθέσιμη. Ο σύνδεσμος μπορεί να έχει ανακληθεί ή η σημείωση να έχει διαγραφεί.'
              : 'Δεν ήταν δυνατή η φόρτωση της σημείωσης. Δοκίμασε ξανά. Η δημόσια προβολή δεν απαιτεί σύνδεση.',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, retry])
  useEffect(() => {
    setMessage('')
    setActionError('')
    setLogin(false)
  }, [user?.id])
  async function act(action: 'export' | 'fork') {
    if (!note || busy) return
    if (action === 'fork' && !user) {
      setLogin(true)
      return
    }
    const owner = identity.current
    setBusy(action)
    setActionError('')
    setMessage('')
    try {
      if (action === 'export') {
        const { exportNoteToWord } = await import('./exportNote')
        await exportNoteToWord(note)
      } else {
        await save({ title: note.title, code: note.code, comment: note.comment })
        if (alive.current && identity.current === owner)
          setMessage('Το αντίγραφο αποθηκεύτηκε ιδιωτικά στις Σημειώσεις σου.')
      }
    } catch {
      if (alive.current && identity.current === owner)
        setActionError(
          action === 'export'
            ? 'Το αρχείο Word δεν δημιουργήθηκε. Δοκίμασε ξανά.'
            : 'Το αντίγραφο δεν αποθηκεύτηκε. Έλεγξε τη σύνδεσή σου και δοκίμασε ξανά.',
        )
    } finally {
      if (alive.current) setBusy('')
    }
  }
  return (
    <main className="shared-note-page">
      <header className="shared-note-brand">
        <button type="button" onClick={onHome}>
          <BookOpen size={22} />
          AeppHub
        </button>
        <span>Κοινόχρηστη σημείωση · Μόνο για ανάγνωση</span>
      </header>
      {loading ? (
        <p role="status" className="shared-note-state">
          Φόρτωση σημείωσης…
        </p>
      ) : error ? (
        <section className="shared-note-state">
          <h1>Η σημείωση δεν άνοιξε</h1>
          <p role="alert">{error}</p>
          <button onClick={() => setRetry(n => n + 1)}>Δοκιμή ξανά</button>
        </section>
      ) : (
        note && (
          <article>
            <header>
              <h1>{note.title}</h1>
              <p className="shared-note-author">Δημιουργός: {note.authorName}</p>
              <div className="shared-note-dates">
                <span>
                  Δημιουργία: <time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString('el-GR')}</time>
                </span>
                <span>
                  Ενημέρωση: <time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleString('el-GR')}</time>
                </span>
              </div>
            </header>
            <nav aria-label="Ενέργειες κοινόχρηστης σημείωσης" className="note-actions">
              <button className="note-primary" onClick={() => onOpen(note.code)}>
                <Play size={17} />
                Άνοιγμα στον Διερμηνευτή
              </button>
              <button disabled={!!busy} onClick={() => void act('export')}>
                <Download size={17} />
                {busy === 'export' ? 'Δημιουργία Word…' : 'Εξαγωγή σε Word (.docx)'}
              </button>
              <button disabled={!!busy || isLoading} onClick={() => void act('fork')}>
                <Copy size={17} />
                {busy === 'fork' ? 'Αποθήκευση…' : 'Αντιγραφή στις Σημειώσεις μου'}
              </button>
            </nav>
            {actionError && <p role="alert">{actionError}</p>}
            {message && (
              <p role="status" className="shared-note-success">
                {message}
              </p>
            )}
            {login && !user && (
              <section className="shared-note-login">
                <p>Συνδέσου για να αποθηκεύσεις δικό σου ιδιωτικό αντίγραφο.</p>
                <LoginRegisterForm onSuccess={() => setLogin(false)} />
              </section>
            )}
            {note.comment && (
              <section>
                <h2>Σχόλια και σημειώσεις</h2>
                <p className="shared-note-comment">{note.comment}</p>
              </section>
            )}
            <section>
              <h2>Κώδικας ΓΛΩΣΣΑΣ</h2>
              <pre tabIndex={0} aria-label="Κώδικας κοινόχρηστης σημείωσης">
                {note.code}
              </pre>
            </section>
          </article>
        )
      )}
      <footer>Δημιουργήθηκε μέσω του AeppHub</footer>
    </main>
  )
}
