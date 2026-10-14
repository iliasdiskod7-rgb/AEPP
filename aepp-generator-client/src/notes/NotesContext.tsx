import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth, authError } from '../auth/AuthContext'
import { notesApi } from '../api/notes'
import type { CodeNote, NoteInput } from './model'
interface Library {notes:CodeNote[];loading:boolean;error:string;refresh:()=>Promise<void>;save:(input:NoteInput,id?:string,signal?:AbortSignal)=>Promise<CodeNote>;remove:(id:string)=>Promise<void>}
const Context=createContext<Library|null>(null)
export function useNotes(){const value=useContext(Context);if(!value)throw new Error('Απαιτείται NotesProvider.');return value}
export function NotesProvider({children}:{children:ReactNode}){
  const {user}=useAuth(),owner=user?.id
  const identity=useRef(owner);identity.current=owner
  const [state,setState]=useState<{owner?:string;notes:CodeNote[];loading:boolean;error:string}>({notes:[],loading:false,error:''})
  const readAbort=useRef<AbortController|null>(null),revision=useRef(0)
  const refresh=useCallback(async()=>{
    readAbort.current?.abort();const requestOwner=identity.current;if(!requestOwner)return
    const controller=new AbortController();readAbort.current=controller;const request=++revision.current
    setState(s=>({owner:requestOwner,notes:s.owner===requestOwner?s.notes:[],loading:true,error:''}))
    try{const notes=await notesApi.list(controller.signal);if(request===revision.current&&identity.current===requestOwner)setState({owner:requestOwner,notes,loading:false,error:''})}
    catch(e){if(!controller.signal.aborted&&request===revision.current&&identity.current===requestOwner)setState(s=>({...s,loading:false,error:authError(e)}))}
  },[])
  useEffect(()=>{revision.current++;readAbort.current?.abort();setState({owner,notes:[],loading:!!owner,error:''});if(owner)void refresh();return()=>{revision.current++;readAbort.current?.abort()}},[owner,refresh])
  const save=useCallback(async(input:NoteInput,id?:string,signal?:AbortSignal)=>{
    const requestOwner=identity.current;if(!requestOwner)throw new Error('Συνδέσου για να αποθηκεύσεις σημειώσεις.')
    const note=await notesApi.save(input,id,signal)
    if(identity.current!==requestOwner)throw new Error('Ο λογαριασμός άλλαξε. Η προβολή δεν ενημερώθηκε.')
    readAbort.current?.abort();revision.current++
    setState(s=>({owner:requestOwner,notes:[note,...(s.owner===requestOwner?s.notes:[]).filter(n=>n.id!==note.id)].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),loading:false,error:''}))
    void refresh()
    return note
  },[refresh])
  const remove=useCallback(async(id:string)=>{
    const requestOwner=identity.current;if(!requestOwner)throw new Error('Χρειάζεται σύνδεση.')
    await notesApi.remove(id);if(identity.current!==requestOwner)return
    readAbort.current?.abort();revision.current++;setState(s=>({...s,notes:s.notes.filter(n=>n.id!==id),loading:false}))
  },[])
  const visible=state.owner===owner?state:{notes:[],loading:!!owner,error:''}
  return <Context.Provider value={{...visible,refresh,save,remove}}>{children}</Context.Provider>
}
