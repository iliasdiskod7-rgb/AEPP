import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNotes } from './NotesContext'
import { suggestedNoteTitle, type CodeNote } from './model'
import { getApiError } from '../api/client'
import './notes.css'
export default function SaveNoteModal({code,note,onClose,onSaved}:{code:string;note?:CodeNote;onClose:()=>void;onSaved:(note:CodeNote)=>void}){
  const {save}=useNotes(),dialog=useRef<HTMLDialogElement>(null),abort=useRef(new AbortController())
  const [title,setTitle]=useState(note?.title??suggestedNoteTitle(code)),[comment,setComment]=useState(note?.comment??''),[asNew,setAsNew]=useState(!note),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{abort.current=new AbortController();const element=dialog.current;element?.showModal();return()=>{abort.current.abort();element?.close()}},[])
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const result=await save({title,code,comment,...(!asNew&&note?{expectedUpdatedAt:note.updatedAt}:{})},asNew?undefined:note?.id,abort.current.signal);if(!abort.current.signal.aborted)onSaved(result)}catch(e){if(!abort.current.signal.aborted)setError(e instanceof Error&&e.name==='ZodError'?'Έλεγξε τον τίτλο, τον κώδικα και το μήκος σχολίου.':getApiError(e))}finally{if(!abort.current.signal.aborted)setBusy(false)}}
  return <dialog ref={dialog} className="note-dialog" aria-labelledby="save-note-title" onCancel={e=>{e.preventDefault();if(!busy)onClose()}}><form onSubmit={e=>void submit(e)}>
    <header><h2 id="save-note-title">{note&&!asNew?'Ενημέρωση Σημείωσης':'Αποθήκευση στις Σημειώσεις'}</h2><button type="button" disabled={busy} aria-label="Κλείσιμο" onClick={onClose}>✕</button></header>
    <label>Τίτλος<input autoFocus required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Προσωπικό σχόλιο<textarea maxLength={5000} rows={4} value={comment} onChange={e=>setComment(e.target.value)}/></label>
    {note&&<label className="note-choice"><input type="checkbox" checked={asNew} onChange={e=>setAsNew(e.target.checked)}/> Αποθήκευση ως νέα σημείωση</label>}
    <p>Ο κώδικας θα αποθηκευτεί όπως γράφτηκε. Δεν απαιτείται να είναι ολοκληρωμένος.</p>
    {error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Ακύρωση</button><button type="submit" className="note-primary" disabled={busy||!code.trim()}>{busy?'Αποθήκευση…':note&&!asNew?'Ενημέρωση':'Αποθήκευση'}</button></footer>
  </form></dialog>
}
