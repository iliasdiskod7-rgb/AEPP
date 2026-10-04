import { Code2 } from 'lucide-react'

interface Props {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  label?: string
}

/** Απλός επεξεργαστής κειμένου για ΓΛΩΣΣΑ, χωρίς εκτέλεση κώδικα. */
export function CodeEditor({ value, onChange, readOnly = false, label = 'ΓΛΩΣΣΑ' }: Props) {
  return <div className="my-4 overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
    <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500"><Code2 size={14} />{label}</div>
    {readOnly ? <pre className="overflow-x-auto p-4 text-[13px] leading-7 text-stone-700"><code>{value}</code></pre>
      : <textarea aria-label={label} spellCheck={false} value={value} onChange={e => onChange?.(e.target.value)} rows={Math.max(5, value.split('\n').length)} className="block w-full resize-y bg-transparent p-4 font-mono text-sm leading-7" />}
  </div>
}
