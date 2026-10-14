import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { ExecutionEvent, MemoryReference, Value, VariableSnapshot } from '../../interpreter/types'
import { normalize } from '../../interpreter/types'
import { displayValue } from '../../interpreter/runtime'
import { describeChanges } from './memoryChanges'
import { memoryKey } from '../../interpreter/memory'
import './memory-visualizer.css'

export type ExecutionSpeed = 0.5 | 1 | 2
interface Props { event: ExecutionEvent | null; speed: ExecutionSpeed; onSpeedChange: (speed: ExecutionSpeed) => void }
const typeLabels = { integer: 'Ακέραια', real: 'Πραγματική', boolean: 'Λογική', string: 'Χαρακτήρας' }
const pointerRoles = ['Αρχή', 'Τέλος', 'Μέσο'] as const
const pointerNames = [['ΑΡΧ', 'ΑΡΧΙΚΗ', 'ΑΡΧΗ_ΑΝΑΖΗΤΗΣΗΣ', 'START', 'LEFT', 'LOW'], ['ΤΕΛΟΣ', 'END', 'RIGHT', 'HIGH'], ['ΜΕΣΟ', 'ΜΕΣΟΣ', 'MID', 'MIDDLE']]
const text = (value: Value | null | undefined) => value ? displayValue(value) : '—'
const refLabel = (ref: MemoryReference) => ref.name + (ref.indexes.length ? '[' + ref.indexes.join(', ') + ']' : '')

export default function MemoryVisualizer({ event, speed, onSpeedChange }: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const [followChanges, setFollowChanges] = useState(true)
  const [activeEvent, setActiveEvent] = useState<ExecutionEvent | null>(null)
  const [pointerArray, setPointerArray] = useState<string | null>(null)
  const [bindings, setBindings] = useState<(string | null)[]>([null, null, null])
  const variables = event?.variables ?? []
  const scalars = variables.filter(v => !v.dimensions)
  const arrays = variables.filter(v => v.dimensions)
  const oneDimensional = arrays.filter(v => v.dimensions?.length === 1)
  const integerScalars = scalars.filter(v => v.type === 'integer' && !v.constant)
  const selectedArray = pointerArray === '' ? '' : oneDimensional.some(v => v.name === pointerArray) ? pointerArray ?? '' : oneDimensional[0]?.name ?? ''
  const pointers = pointerRoles.map((role, index) => {
    const name = bindings[index] ?? integerScalars.find(v => pointerNames[index].includes(normalize(v.name)))?.name ?? ''
    const variable = integerScalars.find(v => v.name === name)
    return { role, name, value: variable?.value?.value, index }
  })
  const highlights = new Map<string, string>()
  const effects = activeEvent === event ? event?.memoryEvents ?? [] : []
  for (const effect of effects) if (effect.kind === 'ON_READ') highlights.set(memoryKey(effect.target), 'read')
  for (const effect of effects) if (effect.kind === 'ON_COMPARE') for (const operand of effect.operands) highlights.set(memoryKey(operand), 'compare')
  for (const effect of effects) if (effect.kind === 'ON_MUTATE') highlights.set(memoryKey(effect.target), 'mutate')
  for (const effect of effects) if (effect.kind === 'ON_SWAP') for (const ref of [effect.first, effect.second, effect.temporary]) highlights.set(memoryKey(ref), 'swap')

  useEffect(() => {
    setActiveEvent(event)
    if (!event) return
    const duration = 900 / speed
    const timer = window.setTimeout(() => setActiveEvent(null), duration)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animations: Animation[] = [], ghosts: HTMLSpanElement[] = [], hidden: HTMLElement[] = []
    const root = rootRef.current
    function move(from: MemoryReference, to: MemoryReference, value: Value, arc: number, hideValues = false) {
      if (!root || reduced) return
      const source = nodes.current.get(memoryKey(from)), target = nodes.current.get(memoryKey(to))
      if (!source || !target || source === target) return
      const bounds = root.getBoundingClientRect(), a = source.getBoundingClientRect(), b = target.getBoundingClientRect()
      if (!source.checkVisibility() || !target.checkVisibility()) return
      const ghost = document.createElement('span')
      ghost.className = 'memory-moving-value'
      ghost.textContent = text(value)
      ghost.setAttribute('aria-hidden', 'true')
      Object.assign(ghost.style, { left: a.left - bounds.left + a.width / 2 + 'px', top: a.top - bounds.top + a.height / 2 + 'px' })
      root.appendChild(ghost); ghosts.push(ghost)
      if (hideValues) for (const node of [source, target]) {
        const label = node.querySelector<HTMLElement>('.memory-value')
        if (label) { label.style.visibility = 'hidden'; hidden.push(label) }
      }
      const dx = b.left + b.width / 2 - a.left - a.width / 2, dy = b.top + b.height / 2 - a.top - a.height / 2
      const animation = ghost.animate([
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: 'translate(calc(-50% + ' + dx / 2 + 'px), calc(-50% + ' + (dy / 2 + arc) + 'px))', opacity: 1, offset: .5 },
        { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))', opacity: 0 },
      ], { duration: duration * .85, easing: 'ease-in-out', fill: 'forwards' })
      animations.push(animation)
      animation.onfinish = () => { ghost.remove(); for (const label of hidden) label.style.visibility = '' }
    }
    const swaps = event.memoryEvents?.filter(e => e.kind === 'ON_SWAP') ?? []
    for (const swap of swaps) {
      move(swap.first, swap.second, swap.values[0], -36, true)
      move(swap.second, swap.first, swap.values[1], 36, true)
    }
    if (!swaps.length) for (const mutation of event.memoryEvents ?? []) {
      if (mutation.kind === 'ON_MUTATE' && mutation.source) move(mutation.source, mutation.target, mutation.value, -24)
    }
    return () => { window.clearTimeout(timer); for (const animation of animations) animation.cancel(); for (const ghost of ghosts) ghost.remove(); for (const label of hidden) label.style.visibility = '' }
  }, [event, speed])

  useEffect(() => {
    if (!followChanges) return
    const mutation = event?.memoryEvents?.findLast(effect => effect.kind === 'ON_MUTATE')
    if (!mutation) return
    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => { secondFrame = window.requestAnimationFrame(() => {
      const target = nodes.current.get(memoryKey(mutation.target))
      if (!target || !target.checkVisibility()) return
      for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (!parent.matches('.memory-array-scroll, .ide-memory-side-body, .ide-dock-body')) continue
        const bounds = parent.getBoundingClientRect(), box = target.getBoundingClientRect()
        if (box.left < bounds.left || box.right > bounds.left + parent.clientWidth) parent.scrollLeft += box.left - bounds.left - (parent.clientWidth - box.width) / 2
        const vertical = target.getBoundingClientRect()
        if (vertical.top < bounds.top || vertical.bottom > bounds.top + parent.clientHeight) parent.scrollTop += vertical.top - bounds.top - (parent.clientHeight - vertical.height) / 2
      }
    }) })
    return () => { window.cancelAnimationFrame(firstFrame); window.cancelAnimationFrame(secondFrame) }
  }, [event, followChanges])

  function cell(name: string, indexes: number[], value: Value | null | undefined) {
    const ref = { scopeId: event?.scopeId ?? 0, name, indexes }
    const key = memoryKey(ref), highlight = highlights.get(key)
    const updated = event?.memoryEvents?.some(effect => effect.kind === 'ON_MUTATE' && memoryKey(effect.target) === key)
    return <div key={key} ref={node => { if (node) nodes.current.set(key, node); else nodes.current.delete(key) }}
      className={'memory-cell' + (highlight ? ' memory-' + highlight : '') + (updated ? ' memory-last-mutation' : '')}
      aria-label={refLabel(ref) + ': ' + (value ? text(value) : 'Χωρίς αρχική τιμή')}
      title={refLabel(ref) + ': ' + (value ? text(value) : 'Χωρίς αρχική τιμή')}>
      <span className="memory-value" key={highlight ? String(event?.kind === 'done' ? 'done' : event?.line) + text(value) : 'idle'}>{text(value)}</span>
    </div>
  }
  const last = event?.memoryEvents?.findLast(e => e.kind === 'ON_SWAP' || e.kind === 'ON_MUTATE' || e.kind === 'ON_COMPARE')
  const description = last?.kind === 'ON_SWAP' ? 'Αντιμετάθεση ' + refLabel(last.first) + ' ↔ ' + refLabel(last.second) + ' μέσω ' + last.temporary.name
    : last?.kind === 'ON_MUTATE' ? describeChanges(event)
    : last?.kind === 'ON_COMPARE' ? 'Σύγκριση: ' + text(last.leftValue) + ' ' + last.operator + ' ' + text(last.rightValue) + ' → ' + (last.result ? 'ΑΛΗΘΗΣ' : 'ΨΕΥΔΗΣ') + (last.operands.length ? ' (' + last.operands.map(refLabel).join(', ') + ')' : '')
    : event?.kind === 'input' ? 'Αναμονή εισόδου: ' + event.name : 'Παρακολούθησε τις τιμές σε κάθε βήμα.'

  return <section className="memory-panel" aria-labelledby={id + '-title'} style={{ '--memory-duration': 900 / speed + 'ms' } as CSSProperties}>
    <header className="memory-header"><div><p className="memory-eyebrow">ΖΩΝΤΑΝΗ ΜΝΗΜΗ</p><h2 id={id + '-title'}>Οπτικοποιητής Μνήμης & Πινάκων</h2><p>{event?.scopeName ? 'Πλαίσιο: ' + event.scopeName : 'Οι θέσεις μνήμης εμφανίζονται με την εκτέλεση.'}</p></div>
      <label className="memory-speed" htmlFor={id + '-speed'}>Ταχύτητα <strong>{speed}×</strong><input id={id + '-speed'} type="range" min="0" max="2" step="1" value={[0.5, 1, 2].indexOf(speed)} aria-valuetext={speed + ' φορές'} onChange={e => onSpeedChange(([0.5, 1, 2] as const)[Number(e.target.value)])} /><span>0.5× · 1× · 2×</span></label>
    </header>
    <label className="memory-follow-control"><input type="checkbox" checked={followChanges} onChange={e => setFollowChanges(e.target.checked)} />Ακολούθηση αλλαγών</label>
    <div className="memory-legend"><span className="legend-read">Ανάγνωση</span><span className="legend-compare">Σύγκριση</span><span className="legend-mutate">Ενημέρωση</span><span className="legend-swap">Αντιμετάθεση</span><span>— Χωρίς αρχική τιμή</span></div>
    <p className="memory-description" role="status">{description}</p>
    <div ref={rootRef} className="memory-surface">
      <section aria-label="Απλές μεταβλητές"><h3>Απλές μεταβλητές <span>{scalars.length}</span></h3><div className="memory-scalars">{scalars.map(v => <div key={(event?.scopeId ?? 0) + ':' + v.name} className="memory-scalar"><p>{v.name}{v.constant ? ' ★' : ''}</p>{cell(v.name, [], v.value)}<small>{typeLabels[v.type]}</small></div>)}{!scalars.length && <p className="memory-empty">Δεν υπάρχουν απλές μεταβλητές ακόμη.</p>}</div></section>
      <section aria-label="Πίνακες"><h3>Πίνακες <span>{arrays.length}</span></h3>
        {oneDimensional.length > 0 && <details className="memory-pointer-settings"><summary>Δείκτες δυαδικής αναζήτησης</summary><div className="memory-bindings"><label>Πίνακας<select value={selectedArray} onChange={e => setPointerArray(e.target.value)}><option value="">Χωρίς δείκτες</option>{oneDimensional.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></label>{pointers.map((pointer, index) => <label key={pointer.role}>{pointer.role}<select value={pointer.name} onChange={e => setBindings(old => old.map((value, i) => i === index ? e.target.value : value))}><option value="">Χωρίς δείκτη</option>{integerScalars.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}</select></label>)}</div></details>}
        {arrays.map(array => <ArrayMemory key={(event?.scopeId ?? 0) + ':' + array.name} array={array} cell={cell} pointers={array.name === selectedArray ? pointers : []} event={event} followChanges={followChanges} />)}
        {!arrays.length && <p className="memory-empty">Δήλωσε πίνακα 1Δ ή 2Δ για να δεις τις θέσεις του από το 1.</p>}
      </section>
    </div>
  </section>
}

type Pointer = { role: string; name: string; value: string | number | boolean | undefined; index: number }
function ArrayMemory({ array, cell, pointers, event, followChanges }: {
  array: VariableSnapshot; cell: (name: string, indexes: number[], value: Value | null | undefined) => React.ReactNode; pointers: Pointer[]; event: ExecutionEvent | null; followChanges: boolean
}) {
  const dimensions = array.dimensions!, rows = dimensions.length === 2 ? dimensions[0] : 1, columns = dimensions.at(-1)!
  const [rowPage, setRowPage] = useState(0), [columnPage, setColumnPage] = useState(0)
  const rowSize = 6, columnSize = dimensions.length === 1 ? 24 : 8
  const rowStart = rowPage * rowSize + 1, columnStart = columnPage * columnSize + 1
  const rowIndexes = Array.from({ length: Math.min(rowSize, rows - rowStart + 1) }, (_, i) => rowStart + i)
  const columnIndexes = Array.from({ length: Math.min(columnSize, columns - columnStart + 1) }, (_, i) => columnStart + i)
  useEffect(() => {
    if (!followChanges) return
    const effect = event?.memoryEvents?.findLast(e => e.kind === 'ON_MUTATE' || e.kind === 'ON_COMPARE' || e.kind === 'ON_READ' || e.kind === 'ON_SWAP')
    const references = effect?.kind === 'ON_COMPARE' ? effect.operands : effect?.kind === 'ON_SWAP' ? [effect.first, effect.second] : effect ? [effect.target] : []
    const ref = references.find(r => r.name === array.name && r.scopeId === event?.scopeId && r.indexes.length > 0)
    if (ref) { setColumnPage(Math.floor((ref.indexes.at(-1)! - 1) / columnSize)); if (dimensions.length === 2) setRowPage(Math.floor((ref.indexes[0] - 1) / rowSize)) }
  }, [event, array.name, columnSize, dimensions.length, followChanges])
  const visiblePointers = pointers.filter(p => p.name && typeof p.value === 'number' && p.value >= columnStart && p.value < columnStart + columnIndexes.length)
  return <article className="memory-array"><header><h4>{array.name} <span>[{dimensions.join(', ')}]</span></h4><small>{typeLabels[array.type]} · {dimensions.length}Δ · δείκτες από το 1</small></header>
    {(rows > rowSize || columns > columnSize) && <div className="memory-pages">{rows > rowSize && <label>Γραμμές<select value={rowPage} onChange={e => setRowPage(Number(e.target.value))}>{Array.from({ length: Math.ceil(rows / rowSize) }, (_, i) => <option key={i} value={i}>{i * rowSize + 1}–{Math.min(rows, (i + 1) * rowSize)}</option>)}</select></label>}{columns > columnSize && <label>Στήλες<select value={columnPage} onChange={e => setColumnPage(Number(e.target.value))}>{Array.from({ length: Math.ceil(columns / columnSize) }, (_, i) => <option key={i} value={i}>{i * columnSize + 1}–{Math.min(columns, (i + 1) * columnSize)}</option>)}</select></label>}</div>}
    <div className="memory-array-scroll"><div className="memory-array-content" style={{ width: columnIndexes.length * 76 + (dimensions.length === 2 ? 44 : 0) }}>
      {pointers.some(p => p.name) && <div className="memory-pointer-track">{visiblePointers.map(p => <span key={p.role} className={'memory-pointer pointer-' + p.index} style={{ left: ((p.value as number) - columnStart) * 76 + 38, top: p.index * 23 }}><span>{p.name}</span>↓</span>)}</div>}
      <div className="memory-matrix" style={{ gridTemplateColumns: (dimensions.length === 2 ? '44px ' : '') + 'repeat(' + columnIndexes.length + ', 76px)' }}>
        {dimensions.length === 2 && <span className="memory-axis">γ / σ</span>}{columnIndexes.map(j => <span key={'col-' + j} className="memory-axis">[{j}]</span>)}
        {rowIndexes.map(i => <div key={i} className="memory-row">{dimensions.length === 2 && <span className="memory-axis">[{i}]</span>}{columnIndexes.map(j => {
          const indexes = dimensions.length === 2 ? [i, j] : [j]
          return <div className="memory-array-slot" key={j}>{cell(array.name, indexes, array.elements?.[indexes.join(',')])}{dimensions.length === 2 && <small>[{i}, {j}]</small>}</div>
        })}</div>)}
      </div>
    </div></div>
    {pointers.some(p => p.name) && <p className="memory-pointer-values">{pointers.filter(p => p.name).map(p => p.name + ' = ' + (p.value ?? '—') + (typeof p.value === 'number' && (p.value < 1 || p.value > columns) ? ' (εκτός πίνακα)' : '')).join(' · ')}</p>}
  </article>
}
