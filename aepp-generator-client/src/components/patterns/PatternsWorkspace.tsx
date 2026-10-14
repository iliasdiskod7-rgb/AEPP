import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookOpen, Copy, Play, Search } from 'lucide-react'
import { categories, fullProgram, matchesPattern, methodologiesData as patterns, methodologyTopics, type MethodologyTopic } from '../../patterns/methodologiesData'
import './patterns.css'

interface Props {
  selectedId: string
  onSelect: (id: string) => void
  onOpenProgram: (source: string) => void
  hasCustomProgram: boolean
  embedded?: boolean
  active?: boolean
  selectionRequest?: number
}

export default function PatternsWorkspace({ selectedId, onSelect, onOpenProgram, hasCustomProgram, embedded = false, active = true, selectionRequest = 0 }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Όλα')
  const [topic, setTopic] = useState<MethodologyTopic | 'Όλα'>('Όλα')
  const [mode, setMode] = useState<'skeleton' | 'program'>('skeleton')
  const [notice, setNotice] = useState('')
  const [pendingSource, setPendingSource] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const codeRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const copyRequest = useRef(0)
  const handledSelection = useRef(0)
  const focusedSelection = useRef(0)
  const visible = patterns.filter(p => (topic === 'Όλα' || p.topics.includes(topic)) && (category === 'Όλα' || p.category === category) && matchesPattern(p, query))
  const pattern = visible.find(p => p.id === selectedId) ?? visible[0]
  const code = pattern ? mode === 'program' ? fullProgram(pattern) : pattern.code : ''
  const Heading = embedded ? 'h2' : 'h1'

  useLayoutEffect(() => {
    if (!active || !selectionRequest || handledSelection.current === selectionRequest) return
    handledSelection.current = selectionRequest
    setQuery(''); setCategory('Όλα'); setTopic('Όλα'); setMode('skeleton')
  }, [active, selectionRequest])
  useLayoutEffect(() => {
    if (!active || !selectionRequest || focusedSelection.current === selectionRequest || pattern?.id !== selectedId) return
    focusedSelection.current = selectionRequest
    detailRef.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 800px)').matches) detailRef.current?.scrollIntoView({ block: 'start' })
  }, [active, selectionRequest, pattern?.id, selectedId])

  useEffect(() => { copyRequest.current++; setNotice(''); setCopying(false) }, [pattern?.id, mode])
  useEffect(() => { if (pendingSource) dialogRef.current?.showModal() }, [pendingSource])
  useEffect(() => () => { copyRequest.current++ }, [])

  async function copyCode() {
    const request = ++copyRequest.current
    setCopying(true)
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(code)
      if (request === copyRequest.current) setNotice('Ο κώδικας αντιγράφηκε.')
    } catch {
      if (request !== copyRequest.current) return
      const selection = window.getSelection()
      if (selection && codeRef.current) {
        const range = document.createRange()
        range.selectNodeContents(codeRef.current)
        selection.removeAllRanges()
        selection.addRange(range)
      }
      setNotice('Επίλεξε Αντιγραφή από τον browser ή πάτησε Ctrl+C για τον επιλεγμένο κώδικα.')
    } finally { if (request === copyRequest.current) setCopying(false) }
  }

  function openProgram() {
    if (!pattern) return
    const source = fullProgram(pattern)
    if (hasCustomProgram) setPendingSource(source)
    else onOpenProgram(source)
  }

  return <section className="patterns-workspace" aria-labelledby="patterns-title">
    <header className="patterns-heading">
      <div><Heading id="patterns-title">Μεθοδολογίες & Tips</Heading><p>Βρες το μοτίβο που χρειάζεσαι. Μελέτησε τη δομή του και προσάρμοσέ τη στα δεδομένα και τα ζητούμενα της εκφώνησης.</p></div>
      <span className="patterns-count"><BookOpen size={17} aria-hidden="true" />{patterns.length} πρότυπα</span>
    </header>
    <div className="patterns-controls">
      <div className="patterns-search-row"><label className="patterns-search"><span className="sr-only">Αναζήτηση μεθοδολογίας</span><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="π.χ. μέσος όρος, ισοβαθμίες, ψηφία…" /></label>
      <label className="patterns-topic"><span>Θεματική</span><select aria-label="Θεματική μεθοδολογιών" value={topic} onChange={e => setTopic(e.target.value as MethodologyTopic | 'Όλα')}><option value="Όλα">Όλες οι θεματικές</option>{methodologyTopics.map(value => <option key={value} value={value}>{value} ({patterns.filter(p => p.topics.includes(value)).length})</option>)}</select></label></div>
      <div className="patterns-categories" aria-label="Φίλτρο κατηγορίας">{['Όλα', ...categories].map(c => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
    </div>
    <div className="patterns-layout">
      <aside className="patterns-sidebar" aria-label="Διαθέσιμα στερεότυπα"><p className="patterns-list-count" role="status">{visible.length} από {patterns.length} πρότυπα</p><ul>{visible.map(p => <li key={p.id}><button type="button" aria-pressed={pattern?.id === p.id} onClick={() => { onSelect(p.id); detailRef.current?.focus({ preventScroll: true }) }}><span>{p.category}</span><strong>{p.title}</strong><small>{p.summary}</small></button></li>)}</ul></aside>
      {pattern ? <article ref={detailRef} tabIndex={-1} className="patterns-detail" aria-labelledby="pattern-detail-title">
        <div className="pattern-intro"><p className="patterns-eyebrow">{pattern.category}</p><h2 id="pattern-detail-title">{pattern.title}</h2><p>{pattern.summary}</p></div>
        <section className="pattern-prerequisites"><h3>Πριν το χρησιμοποιήσεις</h3><ul>{pattern.prerequisites.map(p => <li key={p}>{p}</li>)}</ul></section>
        <div className="pattern-code-toolbar patterns-controls"><div className="pattern-modes" aria-label="Μορφή κώδικα"><button type="button" aria-pressed={mode === 'skeleton'} onClick={() => setMode('skeleton')}>Σκελετός</button><button type="button" aria-pressed={mode === 'program'} onClick={() => setMode('program')}>Πλήρες πρόγραμμα</button></div><button type="button" className="pattern-copy" disabled={copying} onClick={() => void copyCode()}><Copy size={15} aria-hidden="true" />{copying ? 'Αντιγραφή…' : 'Αντιγραφή κώδικα'}</button></div>
        <p className="pattern-code-label">{mode === 'skeleton' ? 'Τμήμα προγράμματος · απαιτεί τις δηλώσεις και την προετοιμασία που ακολουθούν.' : 'Πλήρες εκτελέσιμο παράδειγμα · με δηλώσεις, ανάγνωση και έλεγχο εισόδου.'}</p>
        <pre className="pattern-code" tabIndex={0} aria-label={'Κώδικας: '+pattern.title}><code ref={codeRef}>{code}</code></pre>
        <p className="pattern-notice patterns-controls" role="status">{notice}</p>
        {mode === 'skeleton' && <details className="pattern-setup"><summary>Δηλώσεις και προετοιμασία του σκελετού</summary><h4>ΜΕΤΑΒΛΗΤΕΣ</h4><pre><code>{pattern.declarations}</code></pre>{pattern.setup && <><h4>Πριν από τον σκελετό, μετά την ΑΡΧΗ</h4><pre><code>{pattern.setup}</code></pre></>}</details>}
        <div className="pattern-explanations"><section><h3>Η μεθοδολογία σε βήματα</h3><ol>{pattern.steps.map(step => <li key={step}>{step}</li>)}</ol></section><section className="pattern-pitfalls"><h3>Παγίδες που προσέχουμε</h3><ul>{pattern.pitfalls.map(p => <li key={p}>{p}</li>)}</ul></section></div>
        <section className="pattern-examples"><h3>Δοκίμασέ το με δεδομένα</h3><p>Οι τιμές εισόδου δίνονται διαδοχικά, μία ανά ΔΙΑΒΑΣΕ, στο πλήρες πρόγραμμα.</p><div className="pattern-table-scroll"><table><caption className="sr-only">Παραδείγματα εισόδου και αναμενόμενης εξόδου</caption><thead><tr><th scope="col">Περίπτωση</th><th scope="col">Τιμές εισόδου</th><th scope="col">Γραμμές εξόδου</th></tr></thead><tbody>{pattern.examples.map(e => <tr key={e.label}><th scope="row">{e.label}</th><td><code>{e.inputs.join(' → ')}</code></td><td><pre>{e.output.length ? e.output.join('\n') : 'Καμία έξοδος'}</pre></td></tr>)}</tbody></table></div></section>
        <div className="pattern-launch patterns-controls"><div><h3>Από τη μελέτη στην εκτέλεση</h3><p>Ο σκελετός φορτώνεται μαζί με τις δηλώσεις και την προετοιμασία του, ως πλήρες εκτελέσιμο πρόγραμμα.</p></div><button type="button" onClick={openProgram}><Play size={16} aria-hidden="true" />Άνοιγμα στον Διερμηνευτή</button></div>
      </article> : <div className="patterns-empty"><h2>Δεν βρέθηκε μεθοδολογία</h2><p>{topic !== 'Όλα' && !patterns.some(p => p.topics.includes(topic)) ? 'Δεν υπάρχουν ακόμη μεθοδολογίες σε αυτή τη θεματική.' : 'Δοκίμασε διαφορετική λέξη ή εμφάνισε όλες τις κατηγορίες.'}</p><button type="button" onClick={() => { setQuery(''); setCategory('Όλα'); setTopic('Όλα') }}>Καθαρισμός φίλτρων</button></div>}
    </div>
    <dialog ref={dialogRef} className="pattern-dialog" aria-labelledby="pattern-dialog-title" onClose={() => setPendingSource(null)}>
      <h2 id="pattern-dialog-title">Φόρτωση παραδείγματος</h2><p>Το πλήρες παράδειγμα θα αντικαταστήσει τον υπάρχοντα κώδικα στον Διερμηνευτή. Αν χρειάζεσαι τον κώδικά σου, κράτησε πρώτα ένα αντίγραφο.</p><div><button type="button" autoFocus onClick={() => dialogRef.current?.close()}>Ακύρωση</button><button type="button" onClick={() => { if (pendingSource) { dialogRef.current?.close(); onOpenProgram(pendingSource) } }}>Αντικατάσταση & άνοιγμα</button></div>
    </dialog>
  </section>
}
