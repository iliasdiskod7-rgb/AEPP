import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useNotes } from './NotesContext'
import { filterNotes,noteSnippet,type CodeNote } from './model'
import SaveNoteModal from './SaveNoteModal'
import { getApiError } from '../api/client'
import { notesApi } from '../api/notes'
import './notes.css'
export function NoteCard({note,onView,onOpen,onDelete}:{note:CodeNote;onView:(note:CodeNote)=>void;onOpen:(note:CodeNote)=>void;onDelete:(note:CodeNote)=>void}){
  return <article className="note-card"><h3>{note.title}</h3><time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleString('el-GR')}</time><pre>{noteSnippet(note.code)}</pre><div className="note-actions"><button onClick={()=>onView(note)}>Προβολή</button><button className="note-primary" onClick={()=>onOpen(note)}>⚡ Άνοιγμα στον Διερμηνευτή</button><button aria-label={'Διαγραφή '+note.title} onClick={()=>onDelete(note)}>Διαγραφή</button></div></article>
}
function NoteReader({note,onClose,onOpen,onEdit}:{note:CodeNote;onClose:()=>void;onOpen:(note:CodeNote)=>void;onEdit:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close()},[])
  return <dialog ref={dialog} className="note-dialog note-reader" onCancel={onClose} aria-labelledby="read-note-title"><header><h2 id="read-note-title">{note.title}</h2><button aria-label="Κλείσιμο" onClick={onClose}>✕</button></header><p className="note-comment">{note.comment||'Χωρίς προσωπικό σχόλιο.'}</p><pre>{note.code}</pre><footer><button onClick={onEdit}>Τίτλος & Σχόλιο</button><button className="note-primary" onClick={()=>{onClose();onOpen(note)}}>⚡ Άνοιγμα στον Διερμηνευτή</button></footer></dialog>
}
export default function NotesLibrary({compact=false,onOpen,onShowAll}:{compact?:boolean;onOpen:(note:CodeNote)=>void;onShowAll?:()=>void}){
  const {user}=useAuth(),{notes,loading,error,refresh,remove}=useNotes()
  const [search,setSearch]=useState(''),[selected,setSelected]=useState<CodeNote|null>(null),[editing,setEditing]=useState(false),[actionError,setActionError]=useState(''),[deleting,setDeleting]=useState(false)
  const identity=useRef(user?.id);identity.current=user?.id
  const readAbort=useRef<AbortController|null>(null)
  const [opening,setOpening]=useState(false)
  useEffect(()=>{setSelected(null);setEditing(false);setActionError('');setSearch('');if(user)void refresh();return()=>readAbort.current?.abort()},[user?.id,refresh])
  const visible=compact?notes.slice(0,4):filterNotes(notes,search)
  async function loadNote(note:CodeNote,openEditor=false){readAbort.current?.abort();const controller=new AbortController();readAbort.current=controller;const owner=identity.current;setOpening(true);setActionError('');try{const fresh=await notesApi.get(note.id,controller.signal);if(!controller.signal.aborted&&identity.current===owner){if(openEditor)onOpen(fresh);else setSelected(fresh)}}catch(e){if(!controller.signal.aborted&&identity.current===owner)setActionError(getApiError(e))}finally{if(!controller.signal.aborted&&identity.current===owner)setOpening(false)}}
  async function deleteNote(note:CodeNote){if(deleting||!window.confirm('Να διαγραφεί η σημείωση «'+note.title+'»;'))return;const owner=identity.current;setDeleting(true);setActionError('');try{await remove(note.id)}catch(e){if(identity.current===owner)setActionError(getApiError(e))}finally{if(identity.current===owner)setDeleting(false)}}
  return <section className="notes-library" aria-label="Οι Σημειώσεις μου"><header><div><h2>Οι Σημειώσεις μου</h2><p>Οι ασκήσεις και οι προσωπικές σου παρατηρήσεις, αποθηκευμένες στον λογαριασμό σου.</p></div>{compact&&onShowAll&&<button onClick={onShowAll}>Προβολή όλων</button>}</header>
    {!user?<p>Συνδέσου για να αποθηκεύεις και να βρίσκεις τις σημειώσεις σου.</p>:<>
      {!compact&&<label>Αναζήτηση τίτλου ή σχολίου<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="π.χ. μέγιστο, πίνακες…"/></label>}
      {loading&&<p role="status">Φόρτωση σημειώσεων…</p>}{error&&<p role="alert">{error} <button onClick={()=>void refresh()}>Δοκιμή ξανά</button></p>}{actionError&&<p role="alert">{actionError}</p>}
      {opening&&<p role="status">Άνοιγμα σημείωσης…</p>}
      {!loading&&!error&&!visible.length&&<p>{search?'Δεν βρέθηκαν σημειώσεις.':'Δεν έχεις ακόμη σημειώσεις. Αποθήκευσε την πρώτη σου άσκηση από τον διερμηνευτή.'}</p>}
      <div className="notes-grid" aria-busy={deleting||opening}>{visible.map(note=><NoteCard key={note.id} note={note} onView={note=>void loadNote(note)} onOpen={note=>void loadNote(note,true)} onDelete={note=>void deleteNote(note)}/>)}</div>
      {selected&&!editing&&<NoteReader note={selected} onClose={()=>setSelected(null)} onOpen={note=>void loadNote(note,true)} onEdit={()=>setEditing(true)}/>}
      {selected&&editing&&<SaveNoteModal code={selected.code} note={selected} onClose={()=>setEditing(false)} onSaved={note=>{setEditing(false);setSelected(note)}}/>}
    </>}
  </section>
}
