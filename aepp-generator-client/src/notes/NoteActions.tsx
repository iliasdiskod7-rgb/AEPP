import { useEffect, useRef, useState } from 'react'
import { Download, Link, ShieldOff } from 'lucide-react'
import { useAuth, authError } from '../auth/AuthContext'
import { notesApi } from '../api/notes'
import type { CodeNote } from './model'
export default function NoteActions({ note }: { note: CodeNote }) {
  const { user } = useAuth(),
    [busy, setBusy] = useState(''),
    [url, setUrl] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [isPublic, setPublic] = useState(!!note.isPublic)
  const alive = useRef(true),
    owner = useRef(user?.id)
  owner.current = user?.id
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    setPublic(!!note.isPublic)
    setUrl('')
    setMessage('')
  }, [note.id, note.isPublic])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 8000)
    return () => clearTimeout(timer)
  }, [message])
  async function run(action: 'export' | 'share' | 'unshare') {
    if (busy) return
    setBusy(action)
    setError('')
    setMessage('')
    const identity = owner.current
    try {
      if (action === 'export') {
        const { exportNoteToWord } = await import('./exportNote')
        await exportNoteToWord(note, note.authorName || user?.fullName)
        return
      }
      if (action === 'unshare') {
        await notesApi.unshare(note.id)
        if (alive.current && identity === owner.current) {
          setPublic(false)
          setUrl('')
          setMessage('Η κοινή χρήση διακόπηκε. Ο προηγούμενος σύνδεσμος δεν είναι πλέον διαθέσιμος.')
        }
        return
      }
      const result = await notesApi.share(note.id)
      if (!alive.current || identity !== owner.current) return
      setUrl(result.url)
      setPublic(true)
      try {
        await navigator.clipboard.writeText(result.url)
        if (alive.current) setMessage('Ο σύνδεσμος αντιγράφηκε! Μπορείτε να τον στείλετε σε συμμαθητές ή καθηγητές.')
      } catch {
        if (alive.current) setMessage('Ο σύνδεσμος δημιουργήθηκε. Αντέγραψέ τον από το πεδίο παρακάτω.')
      }
    } catch (cause) {
      if (alive.current && identity === owner.current)
        setError(action === 'export' ? 'Το αρχείο Word δεν δημιουργήθηκε. Δοκίμασε ξανά.' : authError(cause))
    } finally {
      if (alive.current && identity === owner.current) setBusy('')
    }
  }
  return (
    <div className="note-sharing">
      <div className="note-actions">
        <button disabled={!!busy} onClick={() => void run('export')}>
          <Download size={16} />
          {busy === 'export' ? 'Δημιουργία Word…' : 'Εξαγωγή σε Word (.docx)'}
        </button>
        <button disabled={!!busy} onClick={() => void run('share')}>
          <Link size={16} />
          {busy === 'share' ? 'Δημιουργία συνδέσμου…' : 'Κοινή Χρήση'}
        </button>
        {isPublic && (
          <button disabled={!!busy} onClick={() => void run('unshare')}>
            <ShieldOff size={16} />
            Διακοπή κοινής χρήσης
          </button>
        )}
      </div>
      <p className="note-share-hint">
        Η κοινή χρήση επιτρέπει σε όποιον έχει τον σύνδεσμο να δει τον κώδικα, το σχόλιο και το όνομα δημιουργού. Οι
        αλλαγές στη σημείωση εμφανίζονται και στον σύνδεσμο.
      </p>
      {url && (
        <label>
          Σύνδεσμος κοινής χρήσης
          <input readOnly value={url} onFocus={e => e.currentTarget.select()} />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {message && (
        <div role="status" className="note-toast">
          {message}
        </div>
      )}
    </div>
  )
}
