import type { ExecutionTrace } from '../../types/exam'

function parseTrace(json: string): ExecutionTrace | null {
  try {
    const value: unknown = JSON.parse(json)
    if (!value || typeof value !== 'object' || !('columns' in value) || !('rows' in value)) return null
    const { columns, rows } = value
    if (!Array.isArray(columns) || !columns.length || !columns.every(c => typeof c === 'string')) return null
    if (!Array.isArray(rows) || !rows.every(row => Array.isArray(row) && row.length === columns.length && row.every(cell => cell === null || ['string', 'number', 'boolean'].includes(typeof cell)))) return null
    return { columns, rows } as ExecutionTrace
  } catch { return null }
}

export function ThemeBTraceTable({ json, showSolutions = false }: { json: string | null; showSolutions?: boolean }) {
  if (!json) return null
  const trace = parseTrace(json)
  if (!trace) return <p className="my-3 text-sm text-amber-800" role="status">Ο πίνακας τιμών δεν μπορεί να εμφανιστεί: η μορφή των δεδομένων δεν είναι έγκυρη.</p>
  return <div className="my-4 overflow-x-auto rounded-lg border border-stone-200">
    <table className="w-full border-collapse text-left font-mono text-xs">
      <caption className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-left font-sans text-xs text-stone-500">Πίνακας τιμών · {showSolutions ? 'συμπληρωμένες τιμές' : 'να συμπληρωθούν τα κενά κελιά'}</caption>
      <thead><tr>{trace.columns.map((column, i) => <th key={i} scope="col" className="border-b border-stone-200 bg-stone-50 px-4 py-3 font-semibold text-stone-600">{column}</th>)}</tr></thead>
      <tbody>{trace.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="h-10 border-b border-stone-100 px-4 py-2 text-stone-600">{j === 0 || showSolutions ? typeof cell === 'boolean' ? (cell ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ') : String(cell ?? '—') : <span aria-label="Κενό προς συμπλήρωση">&nbsp;</span>}</td>)}</tr>)}</tbody>
    </table>
  </div>
}
