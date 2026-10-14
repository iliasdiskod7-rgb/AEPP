import {useEffect,useRef,useState} from 'react'
import {apiClient} from '../api/client'
import {authError,useAuth} from './AuthContext'
import {toClientExam} from '../api/exams'
import { GeneratedExamSchema, SavedExamEntriesSchema } from '../assessment/examSchemas'
import { parseBoundary } from '../assessment/schemas'
import type {ExamJsonResponseDto} from '../types/exam'
interface Entry{id:string;title:string;format:'examDto'|'examJson';createdAt:string}
export default function SavedExams({onOpen,refreshKey}:{onOpen:(exam:ExamJsonResponseDto)=>void;refreshKey:number}) {
 const {user}=useAuth();const identity=useRef(user?.id);identity.current=user?.id;const [entries,setEntries]=useState<Entry[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null)
 useEffect(()=>{setEntries([]);if(!user)return;const abort=new AbortController();apiClient.get<unknown>('/user-exams',{signal:abort.signal,timeout:15000}).then(r=>{if(abort.signal.aborted)return;setEntries(parseBoundary(SavedExamEntriesSchema,r.data));setError('')}).catch(e=>{if(!abort.signal.aborted)setError(authError(e))});return()=>abort.abort()},[user?.id,refreshKey])
 if(!user)return null
 return <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">Τα αποθηκευμένα διαγωνίσματά μου</h2><p role="status" className="mt-2 text-xs text-slate-500">{error||(!entries.length?'Δεν έχεις αποθηκευμένα διαγωνίσματα ακόμη.':'Διατηρούνται στον λογαριασμό σου, σε κάθε συσκευή.')}</p><ul className="mt-3 flex flex-wrap gap-2">{entries.map(entry=><li key={entry.id}><button type="button" disabled={!!busy} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-xs" onClick={async()=>{const owner=identity.current;setBusy(entry.id);try{const {data}=await apiClient.get<unknown>('/user-exams/'+encodeURIComponent(entry.id));if(identity.current!==owner)return;onOpen(entry.format==='examDto'?toClientExam(data):parseBoundary(GeneratedExamSchema,data));setError('')}catch(e){setError(authError(e))}finally{setBusy(null)}}}>{busy===entry.id?'Φόρτωση…':entry.title}<small className="ml-2 text-slate-500">{new Date(entry.createdAt).toLocaleDateString('el-GR')}</small></button></li>)}</ul></section>
}
