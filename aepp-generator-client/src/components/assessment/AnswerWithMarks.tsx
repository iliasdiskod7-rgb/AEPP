import type { QuestionResult } from '../../assessment/model'

const Mark = ({ ok }: { ok: boolean }) => (
  <span className={ok ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'} aria-label={ok ? 'Σωστό' : 'Λάθος'}>
    {ok ? '✓' : '✗'}
  </span>
)

const tableCells = (line: string) =>
  line
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim())

/** Η απάντηση του μαθητή με ένδειξη σωστού/λάθους ανά πρόταση, ζεύγος, κενό ή κελί. Χωρίς μόρια. */
export default function AnswerWithMarks({ result }: { result: QuestionResult }) {
  const marks = result.itemResults
  const lines = result.studentAnswer.split('\n')
  const plain = (
    <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-5">
      {result.studentAnswer}
    </pre>
  )
  if (!marks?.length) return plain

  // Πίνακας τιμών: η απάντηση είναι πίνακας Markdown με μία ένδειξη ανά κελί.
  const tableLines = lines.filter(line => line.trim().startsWith('|'))
  if (tableLines.length >= 3 && tableLines.length === lines.length) {
    const header = tableCells(tableLines[0])
    const rows = tableLines.slice(2).map(tableCells)
    if (rows.every(row => row.length === header.length) && rows.length * header.length === marks.length)
      return (
        <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {header.map(column => (
                  <th key={column} className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, columnIndex) => {
                    const ok = marks[rowIndex * header.length + columnIndex]
                    return (
                      <td
                        key={columnIndex}
                        className={`border-b border-slate-100 px-2 py-1.5 ${ok ? 'bg-emerald-50' : 'bg-rose-50'}`}
                      >
                        <Mark ok={ok} /> {cell}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }

  // Μία γραμμή ανά στοιχείο (προτάσεις Σ/Λ, αντιστοιχίσεις, κενά) ή μία μόνη απάντηση.
  if (lines.length === marks.length)
    return (
      <ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs leading-5">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-2">
            <Mark ok={marks[index]} />
            <span className="whitespace-pre-wrap">{line}</span>
          </li>
        ))}
      </ul>
    )
  return plain
}

/** Σύνοψη τύπου «3 από 5 σωστά» για την επικεφαλίδα του ερωτήματος. */
export function marksSummary(result: QuestionResult): string {
  const marks = result.itemResults
  if (!marks?.length) return ''
  const correct = marks.filter(Boolean).length
  if (marks.length === 1) return correct ? '✓ Σωστό' : '✗ Λάθος'
  return `${correct === marks.length ? '✓ ' : correct === 0 ? '✗ ' : ''}${correct} από ${marks.length} σωστά`
}
