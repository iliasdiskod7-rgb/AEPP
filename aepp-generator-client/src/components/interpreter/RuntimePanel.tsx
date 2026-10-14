import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import type { ExecutionEvent } from '../../interpreter/types'
import { displayValue } from '../../interpreter/runtime'
import { formatDiagnostic, type Diagnostic } from '../../interpreter/diagnostics'

import { useSettings } from '../../settings/SettingsContext'

const typeLabel = { integer: 'Ακέραια', real: 'Πραγματική', boolean: 'Λογική', string: 'Χαρακτήρας' }
interface Props { event: ExecutionEvent | null; diagnostic: Diagnostic | null; status: string; onInput: (text: string) => boolean; embedded?: boolean; suggestedInput?: string }
export default function RuntimePanel({ event, diagnostic, status, onInput, embedded = false, suggestedInput }: Props) {
  const {speak} = useSettings()
  const [voiceNotice,setVoiceNotice] = useState('')
  const [input, setInput] = useState('')
  const [followOutput, setFollowOutput] = useState(true)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputFormRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const pending = event?.kind === 'input' ? event : null
  useEffect(() => { if (pending) setInput(suggestedInput ?? '') }, [event, pending, suggestedInput])
  useLayoutEffect(() => {
    const output = outputRef.current
    if (!output || !followOutput) return
    function follow() {
      if (!output || !output.parentElement?.clientHeight) return
      output.scrollTop = output.scrollHeight
      const target = diagnostic ? errorRef.current : pending ? inputFormRef.current : null
      const container = output.closest<HTMLElement>('.ide-dock-body')
      if (target && container) {
        const box = target.getBoundingClientRect(), bounds = container.getBoundingClientRect()
        if (box.bottom > bounds.top + container.clientHeight) container.scrollTop += box.bottom - bounds.top - container.clientHeight + 8
        else if (box.top < bounds.top) container.scrollTop += box.top - bounds.top - 8
      }
    }
    follow()
    const observer = new ResizeObserver(follow)
    observer.observe(output)
    return () => observer.disconnect()
  }, [event?.output.length, pending, diagnostic, followOutput])
  function submit(submission: FormEvent) { submission.preventDefault(); if (!pending) return; if (onInput(input)) setInput('') }
  return <div className={embedded ? "ide-runtime-embedded" : "grid gap-4"}>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="console-title">
      <div hidden={embedded} className="border-b border-slate-100 px-5 py-3"><h2 id="console-title" className="font-semibold">Κονσόλα εισόδου / εξόδου</h2><p role="status" className="mt-1 text-xs text-slate-500">{status}</p></div>
      <label className="runtime-follow-control"><input type="checkbox" checked={followOutput} onChange={e => setFollowOutput(e.target.checked)} />Ακολούθηση νέας εξόδου</label>
      <div ref={outputRef} className="max-h-44 min-h-28 overflow-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-emerald-200" aria-live="polite">{event?.output.map((line, index) => <div key={index} className={index === event.output.length - 1 ? "runtime-latest-output" : undefined}>{line || ' '}</div>)}{!event?.output.length && <span className="text-slate-400">Η έξοδος θα εμφανιστεί εδώ.</span>}</div>
      {pending && <form ref={inputFormRef} onSubmit={submit} className="flex flex-wrap items-end gap-2 border-t border-slate-100 p-3"><label className="min-w-40 flex-1 text-xs font-medium text-slate-700">Τιμή για {pending.name} ({typeLabel[pending.type]})<input autoFocus={!embedded} value={input} onChange={event => setInput(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500" aria-label={`Τιμή για ${pending.name}`} /></label><button type="submit" className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">Υποβολή</button></form>}
      {diagnostic && <p ref={errorRef} role="alert" className="m-3 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-800">{formatDiagnostic(diagnostic)}<button type="button" className="ml-2 underline" onClick={() => setVoiceNotice(speak(formatDiagnostic(diagnostic)) ? '' : 'Η φωνητική ανάγνωση δεν υποστηρίζεται σε αυτόν τον browser.')}>Ανάγνωση σφάλματος</button></p>}
      {voiceNotice && <p role="status" className="px-3 text-xs">{voiceNotice}</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="variables-title"><div className="border-b border-slate-100 px-5 py-3"><h2 id="variables-title" className="font-semibold">Τρέχουσες τιμές μεταβλητών</h2></div><div className="max-h-52 overflow-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-2">Όνομα</th><th className="px-4 py-2">Τύπος</th><th className="px-4 py-2">Τιμή</th></tr></thead><tbody>{event?.variables.map(variable => <tr key={variable.name} className="border-t border-slate-100"><td className="px-4 py-2 font-mono font-semibold">{variable.name}{variable.constant && <span className="ml-1 text-slate-400">★</span>}</td><td className="px-4 py-2 text-slate-500">{typeLabel[variable.type]}</td><td className="px-4 py-2 font-mono">{variable.value ? displayValue(variable.value) : '—'}</td></tr>)}{!event?.variables.length && <tr><td colSpan={3} className="px-4 py-4 text-slate-500">Δεν υπάρχουν τιμές ακόμη.</td></tr>}</tbody></table></div></section>
  </div>
}
