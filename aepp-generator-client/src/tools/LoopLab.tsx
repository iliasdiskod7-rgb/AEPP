import { useEffect, useRef, useState } from 'react'
import { parseProgram } from '../interpreter/parser'
import { listLoops, transformLoop, type LoopTarget } from './loopTransformer'
import { runsMatch, type LoopRun } from './loopExecution'
import './loopLab.css'

export const loopExample=`ΠΡΟΓΡΑΜΜΑ Σύγκριση
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: i, άθροισμα
ΑΡΧΗ
  άθροισμα <- 0
  ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 10 ΜΕ ΒΗΜΑ 2
    άθροισμα <- άθροισμα + i
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
  ΓΡΑΨΕ i, άθροισμα
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
export default function LoopLab(){
  const [source,setSource]=useState(loopExample),[converted,setConverted]=useState(''),[selected,setSelected]=useState(''),[target,setTarget]=useState<LoopTarget>('while'),[guard,setGuard]=useState(true)
  const [inputs,setInputs]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[results,setResults]=useState<Array<[LoopRun,LoopRun]>>([])
  const workers=useRef(new Set<Worker>()),version=useRef(0)
  useEffect(()=>()=>{version.current++;workers.current.forEach(w=>w.terminate())},[])
  let loops:ReturnType<typeof listLoops>=[]
  try{loops=listLoops(parseProgram(source))}catch{/* Το κείμενο μπορεί να είναι ημιτελές κατά την πληκτρολόγηση. */}
  const chosen=loops.find(l=>l.nodeId===selected)??loops[0]
  function clear(){version.current++;workers.current.forEach(w=>w.terminate());workers.current.clear();setBusy(false);setResults([]);setError('')}
  function convert(){clear();try{if(!chosen?.nodeId)throw new Error('Γράψε πλήρες πρόγραμμα και επίλεξε βρόχο.');const result=transformLoop(source,chosen.nodeId,target,guard);setConverted(result.code);setWarnings(result.warnings)}catch(e){setConverted('');setWarnings([]);setError(e instanceof Error?e.message:'Αποτυχία μετατροπής.')}}
  function run(code:string,values:string[]):Promise<LoopRun>{return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./loopExecution.worker.ts',import.meta.url),{type:'module'});workers.current.add(worker)
    const finish=()=>{clearTimeout(timer);worker.terminate();workers.current.delete(worker)}
    const timer=setTimeout(()=>{finish();reject(new Error('Η εκτέλεση υπερέβη τα 8 δευτερόλεπτα.'))},8000)
    worker.onmessage=(event:MessageEvent<LoopRun>)=>{finish();resolve(event.data)}
    worker.onerror=()=>{finish();reject(new Error('Αποτυχία εκκίνησης Worker.'))}
    worker.postMessage({source:code,inputs:values})
  })}
  async function compare(){clear();const current=version.current;setBusy(true)
    try{
      const cases=inputs.trim()?inputs.split('\n').filter(l=>l.trim()).map(l=>l.split('|').map(v=>v.trim())):[[]]
      if(cases.length>20)throw new Error('Επιτρέπονται έως 20 σενάρια εισόδου.')
      const pairs:Array<[LoopRun,LoopRun]>=[]
      for(const values of cases){const pair=await Promise.all([run(source,values),run(converted,values)]);if(current!==version.current)return;pairs.push(pair)}
      setResults(pairs)
    }catch(e){if(current===version.current)setError(e instanceof Error?e.message:'Αποτυχία σύγκρισης.')}
    finally{if(current===version.current)setBusy(false)}
  }
  return <section className="loop-lab" aria-labelledby="loop-lab-title">
    <h1 id="loop-lab-title">Εργαστήριο Μετατροπής & Σύγκρισης Βρόχων</h1>
    <p>Μελέτησε πλήρη προγράμματα ΓΛΩΣΣΑΣ. Η μετατροπή αναδημιουργεί τον κώδικα από το AST· τα σχόλια και η αρχική μορφοποίηση δεν διατηρούνται.</p>
    <div className="loop-controls"><label>Βρόχος <select value={chosen?.nodeId??''} onChange={e=>{clear();setSelected(e.target.value);setConverted('')}}>{loops.map(l=><option key={l.nodeId} value={l.nodeId}>{l.kind==='for'?'ΓΙΑ':l.kind==='while'?'ΟΣΟ':'ΜΕΧΡΙΣ_ΟΤΟΥ'} · γραμμή {l.line}</option>)}</select></label>
      <label>Μετατροπή σε <select value={target} onChange={e=>{clear();setTarget(e.target.value==='repeat'?'repeat':'while');setConverted('')}}><option value="while">ΟΣΟ</option><option value="repeat">ΜΕΧΡΙΣ_ΟΤΟΥ</option></select></label>
      <label><input type="checkbox" checked={guard} onChange={e=>{clear();setGuard(e.target.checked);setConverted('')}}/> Έλεγχος ΑΝ πριν τη ΜΕΧΡΙΣ_ΟΤΟΥ</label><button onClick={convert}>Μετατροπή</button>
    </div>
    <div className="loop-editors"><label>Αρχικός Κώδικας<textarea spellCheck={false} value={source} onChange={e=>{clear();setSource(e.target.value);setConverted('');setWarnings([])}}/></label><label>Μετατραπείς Κώδικας<textarea spellCheck={false} value={converted} onChange={e=>{clear();setConverted(e.target.value)}}/></label></div>
    {warnings.map(w=><p key={w} className="loop-warning">⚠️ {w}</p>)}
    <label>Σενάρια εισόδου (ένα ανά γραμμή, τιμές χωρισμένες με |)<textarea rows={3} value={inputs} onChange={e=>{clear();setInputs(e.target.value)}} placeholder="1 | 10 | 2"/></label>
    <p>Κενό πεδίο: πρόγραμμα χωρίς ΔΙΑΒΑΣΕ. Για χαρακτήρες δώσε την τιμή χωρίς εισαγωγικά.</p>
    <button disabled={!converted||busy} onClick={()=>void compare()}>{busy?'Εκτέλεση…':'Σύγκριση Εκτέλεσης'}</button>{busy&&<button onClick={clear}>Ακύρωση</button>}
    {error&&<p role="alert">{error}</p>}
    {results.length>0&&<div aria-live="polite"><h2>{results.every(([a,b])=>runsMatch(a,b))?'🟢 Ίδια αποτελέσματα στις δοκιμασμένες εισόδους':'⚠️ Προσοχή — διαφορά ή αποτυχία εκτέλεσης'}</h2><p>Οι δοκιμές δεν αποδεικνύουν ισοδυναμία για όλες τις δυνατές εισόδους. Συγκρίνονται έξοδος και τελική μνήμη του κύριου προγράμματος, χωρίς τις νέες βοηθητικές μεταβλητές.</p>{results.map((pair,i)=><article key={i}><h3>Σενάριο {i+1}</h3><div className="loop-editors">{pair.map((r,j)=><div key={j}><h4>{j?'Μετατραπείς':'Αρχικός'}</h4>{r.error&&<p role="alert">{r.error}</p>}<p>Βήματα: {r.steps} · Επαναλήψεις σωμάτων: {Object.values(r.iterations).reduce((a,b)=>a+b,0)}</p><pre>{Object.entries(r.iterations).map(([k,v])=>`${k}: ${v}`).join('\n')}</pre><h4>Τελικές μεταβλητές</h4><pre>{r.variables.map(v=>v.name+': '+JSON.stringify(v.dimensions?v.elements:v.value?.value??null)).join('\n')}</pre><h4>Έξοδος</h4><pre>{r.output.join('\n')||'Καμία έξοδος'}</pre></div>)}</div></article>)}</div>}
  </section>
}
