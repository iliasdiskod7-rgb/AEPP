import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { liveExecution } from '../../interpreter/liveExecution'
import DynamicTraceTable from './DynamicTraceTable'
import './live-execution.css'

export default function LiveExecutionTools({ memory, debuggerPanel, onOpenFlowchart }: { memory: ReactNode; debuggerPanel?: ReactNode; onOpenFlowchart?: () => void }) {
  const state = useSyncExternalStore(liveExecution.subscribe, liveExecution.getSnapshot, liveExecution.getSnapshot)
  const [tab, setTab] = useState<'memory' | 'trace' | 'debug'>('memory')
  return <section className="live-tools">
    <nav aria-label="Ζωντανή οπτικοποίηση">
      {(['memory', 'trace', ...(debuggerPanel ? ['debug' as const] : [])] as const).map(id => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{id === 'memory' ? 'Μνήμη' : id === 'trace' ? 'Πίνακας τιμών' : 'Αποσφαλμάτωση'}</button>)}
    </nav>
    <div hidden={tab !== 'memory'}>{memory}</div>
    <div hidden={tab !== 'trace'}><DynamicTraceTable state={state} /></div>
    <div hidden={tab !== 'debug'}>{debuggerPanel}</div>
    {onOpenFlowchart && <button className="live-board-link" type="button" title="Το διάγραμμα ανοίγει στον μεγάλο καμβά του Ψηφιακού Πίνακα. Η εκτέλεση τίθεται σε παύση." onClick={onOpenFlowchart}>Διάγραμμα στον Ψηφιακό Πίνακα ↗</button>}
  </section>
}
