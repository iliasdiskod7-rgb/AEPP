import { useEffect, useRef, useState } from 'react'
import CodeEditorPane from '../interpreter/CodeEditorPane'

export default function InteractiveProgram({
  source,
  onChange,
  label,
}: {
  source: string
  onChange: (source: string) => void
  label?: string
}) {
  const worker = useRef<Worker | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [running, setRunning] = useState(false)
  const [prompt, setPrompt] = useState<{ name: string; line: number } | null>(null)
  const [value, setValue] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const [sending, setSending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const submittingInput = useRef(false)
  const [promptSequence, setPromptSequence] = useState(0)
  function stop() {
    clearTimeout(timer.current)
    worker.current?.terminate()
    worker.current = null
    setRunning(false)
    setPrompt(null)
    submittingInput.current = false
    setSending(false)
  }
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      worker.current?.terminate()
    },
    [],
  )
  useEffect(() => {
    if (prompt && !sending) input.current?.focus()
  }, [promptSequence, prompt, sending])
  function watchdog() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      stop()
      setError('Η εκτέλεση ξεπέρασε το χρονικό όριο.')
    }, 8000)
  }
  function run() {
    stop()
    setOutput([])
    setError('')
    setValue('')
    setCompleted(false)
    const active = new Worker(new URL('../../assessment/interactive.worker.ts', import.meta.url), { type: 'module' })
    worker.current = active
    setRunning(true)
    active.onmessage = ({ data }) => {
      if (worker.current !== active) return
      if (data.output) setOutput(data.output)
      if (data.kind === 'input') {
        clearTimeout(timer.current)
        submittingInput.current = false
        setSending(false)
        setPrompt({ name: data.name, line: data.line })
        setPromptSequence(sequence => sequence + 1)
        setValue('')
      }
      if (data.kind === 'invalid') {
        clearTimeout(timer.current)
        submittingInput.current = false
        setSending(false)
        setError(data.error)
      }
      if (data.kind === 'error') {
        setError(data.error)
        stop()
      }
      if (data.kind === 'done') {
        stop()
        setCompleted(true)
      }
    }
    active.onerror = () => {
      setError('Δεν ήταν δυνατή η εκτέλεση του κώδικα.')
      stop()
    }
    watchdog()
    active.postMessage({ action: 'start', source })
  }
  return (
    <div className="space-y-3" role="group" aria-label={label}>
      <CodeEditorPane
        initialValue={source}
        onSourceChange={next => {
          if (running) stop()
          setCompleted(false)
          onChange(next)
        }}
        activeLine={!sending ? (prompt?.line ?? null) : null}
        errorLine={null}
        showLint={false}
      />
      <button type="button" onClick={running ? stop : run} className="rounded-lg border px-4 py-2">
        {running ? '■ Διακοπή' : '▶ Εκτέλεση Κώδικα'}
      </button>
      <div className="rounded-lg bg-slate-900 p-3 text-white">
        <p className="font-bold">Κονσόλα εκτέλεσης</p>
        <pre role="log" aria-live="polite" className="whitespace-pre-wrap">
          {output.join('\n')}
        </pre>
        {running && (
          <p role="status">
            {prompt && !sending ? `Αναμονή εισόδου: ${prompt.name}, γραμμή ${prompt.line}.` : 'Εκτέλεση…'}
          </p>
        )}
        {prompt && (
          <form
            onSubmit={event => {
              event.preventDefault()
              if (submittingInput.current || !worker.current) return
              submittingInput.current = true
              setSending(true)
              setError('')
              watchdog()
              worker.current.postMessage({ action: 'input', value })
            }}
          >
            <label>
              Δώστε τιμή για τη μεταβλητή {prompt.name}:
              <input
                ref={input}
                disabled={sending}
                value={value}
                onChange={event => setValue(event.target.value)}
                className="m-2 rounded border bg-white p-2 text-slate-900"
              />
            </label>
            <button type="submit" disabled={sending} className="rounded border px-3 py-2">
              Εισαγωγή
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="text-rose-300">
            {error}
          </p>
        )}
        {completed && <p role="status">Η εκτέλεση ολοκληρώθηκε.</p>}
      </div>
    </div>
  )
}
