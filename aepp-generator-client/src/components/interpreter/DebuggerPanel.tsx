import { useState } from 'react'
import type { ExecutionEvent } from '../../interpreter/types'
import { normalize } from '../../interpreter/types'
import { resolveWatch } from '../../interpreter/watches'
import './debugger.css'
export default function DebuggerPanel({event,breakpoints,onToggleBreakpoint,historySize}:{
  event:ExecutionEvent|null;breakpoints:number[];onToggleBreakpoint:(line:number)=>void;historySize:number
}) {
  const [selected,setSelected]=useState<number|null>(null)
  const [watches,setWatches]=useState<string[]>([])
  const [draft,setDraft]=useState('')
  const stack=event?.callStack??[]
  const frame=stack.find(item=>item.scopeId===selected)??stack.at(-1)
  function add() {const name=draft.trim();if(!name)return;setWatches(previous=>previous.some(item=>normalize(item)===normalize(name))?previous:[...previous,name]);setDraft('')}
  return <section className="debugger-panel" aria-label="Αποσφαλμάτωση">
    <h3>Αποσφαλμάτωση</h3>
    <p role="status">{event?.breakpointHit?'Σημείο διακοπής στη γραμμή '+event.breakpointHit.line:event?.kind==='done'?'Η εκτέλεση ολοκληρώθηκε.':'Κλικ στον αριθμό γραμμής για σημείο διακοπής.'}</p>
    <h4>Σημεία διακοπής</h4>
    <div className="debugger-breakpoints">{breakpoints.map(line=><button key={line} type="button" title={'Αφαίρεση σημείου διακοπής στη γραμμή '+line} onClick={()=>onToggleBreakpoint(line)}>● {line} ×</button>)}{!breakpoints.length&&<span>Δεν έχουν οριστεί.</span>}</div>
    <h4>Στοίβα κλήσεων</h4>
    <ol className="debugger-stack">{stack.map((item,index)=><li key={item.scopeId}><button type="button" aria-pressed={frame?.scopeId===item.scopeId} onClick={()=>setSelected(item.scopeId)}>[{index}] {item.kind==='program'?'Κύριο πρόγραμμα':item.kind==='procedure'?'ΔΙΑΔΙΚΑΣΙΑ':'ΣΥΝΑΡΤΗΣΗ'} {item.name} · γραμμή {item.line}</button></li>)}</ol>
    {!stack.length&&<p>Ξεκίνα την εκτέλεση για να δεις τις κλήσεις.</p>}
    <h4>Μεταβλητές παρακολούθησης</h4>
    <form onSubmit={event=>{event.preventDefault();add()}}><input aria-label="Νέα μεταβλητή παρακολούθησης" placeholder="π.χ. sum, Α[Ι], Β[1,2]" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={100}/><button type="submit">Προσθήκη</button></form>
    {frame&&<p>Πλαίσιο: {frame.name}</p>}
    <dl>{watches.map(name=><div key={name}><dt>{name}<button type="button" aria-label={'Αφαίρεση '+name} onClick={()=>setWatches(previous=>previous.filter(item=>item!==name))}>×</button></dt><dd>{resolveWatch(name,frame?.variables??[])}</dd></div>)}</dl>
    <p>Διαθέσιμα στιγμιότυπα: {historySize}/100. Η επιστροφή διαγράφει τα μεταγενέστερα βήματα.</p>
  </section>
}
