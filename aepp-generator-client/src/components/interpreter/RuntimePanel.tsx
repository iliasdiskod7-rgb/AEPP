import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ExecutionEvent } from '../../interpreter/types'
import { displayValue } from '../../interpreter/runtime'
import { formatDiagnostic, type Diagnostic } from '../../interpreter/diagnostics'

const typeLabel = { integer: 'Ακέραια', real: 'Πραγματική', boolean: 'Λογική', string: 'Χαρακτήρας' }
interface Props { event: ExecutionEvent | null; diagnostic: Diagnostic | null; status: string; onInput: (text: string) => boolean }
export default function RuntimePanel({ event, diagnostic, status, onInput }: Props) {
  const [input, setInput] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)
  const pending = event?.kind === 'input' ? event : null
  useEffect(() => {
    if (diagnostic) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [diagnostic])
  function submit(submission: FormEvent) { submission.preventDefault(); if (!pending) return; if (onInput(input)) setInput('') }
  return <div className="grid gap-4">
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="console-title">
      <div className="border-b border-slate-100 px-5 py-3"><h2 id="console-title" className="font-semibold">Κονσόλα εισόδου / εξόδου</h2><p role="status" className="mt-1 text-xs text-slate-500">{status}</p></div>
      <div className="max-h-44 min-h-28 overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-emerald-200" aria-live="polite">{event?.output.map((line, index) => <div key={index}>{line || ' '}</div>)}{!event?.output.length && <span className="text-slate-400">Η έξοδος θα εμφανιστεί εδώ.</span>}</div>
      {pending && <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3"><label className="min-w-40 flex-1 text-xs font-medium text-slate-700">Τιμή για {pending.name} ({typeLabel[pending.type]})<input autoFocus value={input} onChange={event => setInput(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" aria-label={`Τιμή για ${pending.name}`} /></label><button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Υποβολή</button></form>}
      {diagnostic && <p ref={errorRef} role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{formatDiagnostic(diagnostic)}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="variables-title"><div className="border-b border-slate-100 px-5 py-3"><h2 id="variables-title" className="font-semibold">Τρέχουσες τιμές μεταβλητών</h2></div><div className="max-h-52 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">Όνομα</th><th className="px-4 py-2">Τύπος</th><th className="px-4 py-2">Τιμή</th></tr></thead><tbody>{event?.variables.map(variable => <tr key={variable.name} className="border-t border-slate-100"><td className="px-4 py-2 font-mono font-semibold">{variable.name}{variable.constant && <span className="ml-1 text-slate-400">★</span>}</td><td className="px-4 py-2 text-slate-500">{typeLabel[variable.type]}</td><td className="px-4 py-2 font-mono">{variable.value ? displayValue(variable.value) : '—'}</td></tr>)}{!event?.variables.length && <tr><td colSpan={3} className="px-4 py-4 text-slate-500">Δεν υπάρχουν τιμές ακόμη.</td></tr>}</tbody></table></div></section>
  </div>
}
