import { useEffect, useRef, useState } from 'react'
import type { LiveExecutionState } from '../../interpreter/liveExecution'
export default function DynamicTraceTable({state}: {state:LiveExecutionState}) {
  const [hidden,setHidden]=useState<string[]>([])
  const [follow,setFollow]=useState(true)
  const [page,setPage]=useState(0)
  const scroll=useRef<HTMLDivElement>(null)
  const pages=Math.max(1,Math.ceil(state.rows.length/100))
  const activePage=follow ? pages-1 : Math.min(page,pages-1)
  const variables=state.variables.filter(name=>!hidden.includes(name))
  useEffect(()=>{if(follow)scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})},[state.totalSteps,follow])
  return <section className="live-trace">
    <fieldset><legend>Μεταβλητές παρακολούθησης</legend>{state.variables.map(name=><label key={name}><input type="checkbox" checked={!hidden.includes(name)} onChange={()=>setHidden(previous=>previous.includes(name)?previous.filter(item=>item!==name):[...previous,name])}/>{name}</label>)}</fieldset>
    <p>Τιμές μετά την εκτέλεση της εντολής ή αμέσως μετά τον έλεγχο συνθήκης.</p>
    <label><input type="checkbox" checked={follow} onChange={event=>{setPage(activePage);setFollow(event.target.checked)}}/> Ακολούθηση τελευταίου βήματος</label>
    <div ref={scroll} className="live-trace-scroll"><table><thead><tr><th>Βήμα</th><th>Γραμμή</th><th>Εντολή</th><th>Υποπρόγραμμα</th>{variables.map(name=><th key={name}>{name}</th>)}<th>Συνθήκη</th><th>Έξοδος (ΓΡΑΨΕ)</th></tr></thead>
    <tbody>{state.rows.slice(activePage*100,activePage*100+100).map(row=><tr key={row.step} className={row.step===state.totalSteps?'is-current':''}><td>{row.step}</td><td>{row.line}</td><td>{row.instruction}</td><td>{row.scope}</td>{variables.map(name=><td key={name}>{row.values[name]??'—'}</td>)}<td>{row.condition===undefined?'—':row.condition?'Αληθής':'Ψευδής'}</td><td>{row.output||'—'}</td></tr>)}</tbody></table>
    {!state.rows.length && <p>Πάτησε «Βήμα» ή «Εκτέλεση» για αυτόματη καταγραφή.</p>}</div>
    <nav aria-label="Σελίδες πίνακα τιμών"><button type="button" disabled={activePage===0} onClick={()=>{setFollow(false);setPage(activePage-1)}}>Προηγούμενη</button><span>{activePage+1} / {pages}</span><button type="button" disabled={activePage===pages-1} onClick={()=>{setFollow(false);setPage(activePage+1)}}>Επόμενη</button></nav>
    {state.totalSteps>10000 && <p role="status">Εμφανίζονται τα τελευταία 10.000 από {state.totalSteps} βήματα.</p>}
  </section>
}
