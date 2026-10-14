import type { CounterExample } from '../../assessment/counterExampleEngine'
export default function CounterExampleNotice({example,source,onOpenDebugger}:{example:CounterExample;source:string;onOpenDebugger:(source:string,inputs:string[])=>void}){
  return <div className="mt-3 space-y-3">
    <p role="alert">⚠️ Βρέθηκε αντιπαράδειγμα! Η είσοδος {example.inputDescription} παράγει εσφαλμένο αποτέλεσμα.</p>
    <div className="grid gap-3 text-xs sm:grid-cols-2"><div><strong>Αναμενόμενο</strong><pre>{example.expectedOutput.join('\n')||'Καμία έξοδος'}</pre></div><div><strong>Αποτέλεσμα μαθητή</strong><pre>{example.studentError??(example.actualOutput.join('\n')||'Καμία έξοδος')}</pre></div></div>
    <button type="button" onClick={()=>onOpenDebugger(source,[...example.inputs])}>Άνοιγμα στον Debugger</button>
  </div>
}
