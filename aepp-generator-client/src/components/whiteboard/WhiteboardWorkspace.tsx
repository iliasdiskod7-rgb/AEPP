import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight, Circle, Diamond, Download, Eraser, FileCode2, Hand, Highlighter, ImagePlus, Minus, MousePointer2, Pencil, Redo2, Save, Square, Table2, Trash2, Type, Undo2, WandSparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { toDiagnostic, formatDiagnostic } from '../../interpreter/diagnostics'
import { flowchartFromCode } from '../../whiteboard/flowchart'
import { boardBounds, emptyBoard, ensureOutputColumn, isConnectable, itemBounds, loadBoard, moveItem, newId, tableCellHeight, tableCellWidth, tableDimensions, type BoardDocument, type BoardItem, type DrawTool, type ImageItem, type Point, type ShapeItem, type ShapeKind, type TableItem, type Tool } from '../../whiteboard/model'
import { FlowConnection, FlowShape } from './FlowShape'
import TraceTable from './TraceTable'
import './whiteboard.css'

const shapeLabels: Record<ShapeKind, string> = { start: 'Αρχή / Τέλος', io: 'Πλάγιο Παραλληλόγραμμο (ΔΙΑΒΑΣΕ / ΓΡΑΨΕ)', process: 'Επεξεργασία', decision: 'Συνθήκη', connector: 'Σύνδεσμος', note: 'Κείμενο' }
const tools = [
  { id: 'select', label: 'Επιλογή', icon: MousePointer2 }, { id: 'hand', label: 'Μετακίνηση καμβά', icon: Hand },
  { id: 'start', label: 'Αρχή / Τέλος', icon: Circle }, { id: 'io', label: 'Πλάγιο Παραλληλόγραμμο (ΔΙΑΒΑΣΕ / ΓΡΑΨΕ)', icon: Square },
  { id: 'process', label: 'Επεξεργασία', icon: Square }, { id: 'decision', label: 'Συνθήκη', icon: Diamond },
  { id: 'connector', label: 'Σύνδεσμος', icon: Circle }, { id: 'arrow', label: 'Βέλος σύνδεσης', icon: ArrowRight },
  { id: 'line', label: 'Γραμμή', icon: Minus }, { id: 'pencil', label: 'Μολύβι', icon: Pencil },
  { id: 'highlighter', label: 'Μαρκαδόρος', icon: Highlighter }, { id: 'note', label: 'Κείμενο', icon: Type },
  { id: 'table', label: 'Πίνακας Τιμών', icon: Table2 }, { id: 'image', label: 'Εικόνα', icon: ImagePlus },
  { id: 'eraser', label: 'Γόμα', icon: Eraser },
] as const
interface History { past: BoardDocument[]; present: BoardDocument; future: BoardDocument[] }
type Gesture =
  | { kind: 'draw'; tool: DrawTool; start: Point; current: Point; points: Point[] }
  | { kind: 'move' | 'resize' | 'rotate'; id: string; start: Point; base: BoardDocument; corner?: 'nw' | 'ne' | 'sw' | 'se' }
  | { kind: 'pan'; startX: number; startY: number; pan: Point }
interface Editing { id: string; value: string; row?: number; column?: number }
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function drawnItem(gesture: Extract<Gesture, { kind: 'draw' }>): BoardItem {
  const { start, current, tool } = gesture
  if (tool === 'line' || tool === 'arrow') return { id: newId(), type: 'line', x: start.x, y: start.y, width: current.x - start.x || 120, height: current.y - start.y, rotation: 0, arrow: tool === 'arrow' }
  if (tool === 'pencil' || tool === 'highlighter') return { id: newId(), type: 'stroke', x: start.x, y: start.y, width: 0, height: 0, rotation: 0, points: gesture.points.length > 1 ? gesture.points : [start, { x: start.x + 1, y: start.y + 1 }], highlight: tool === 'highlighter' }
  const dx = current.x - start.x, dy = current.y - start.y
  const kind = tool as ShapeKind
  const defaultSize = kind === 'connector' ? { w: 36, h: 36 } : kind === 'decision' ? { w: 230, h: 130 } : kind === 'start' ? { w: 190, h: 80 } : { w: 210, h: 90 }
  const width = Math.abs(dx) < 12 ? defaultSize.w : Math.max(36, Math.abs(dx))
  const height = Math.abs(dy) < 12 ? defaultSize.h : Math.max(36, Math.abs(dy))
  const x = Math.abs(dx) < 12 ? start.x - width / 2 : Math.min(start.x, current.x)
  const y = Math.abs(dy) < 12 ? start.y - height / 2 : Math.min(start.y, current.y)
  return { id: newId(), type: 'shape', kind, text: '', x, y, width, height, rotation: 0 }
}

function download(content: Blob, filename: string) {
  const url = URL.createObjectURL(content)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function WhiteboardWorkspace({ getSource }: { getSource: () => string }) {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: loadBoard(), future: [] }))
  const [preview, setPreview] = useState<BoardDocument | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLink, setSelectedLink] = useState<string | null>(null)
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [tableDialog, setTableDialog] = useState(false)
  const [columnsInput, setColumnsInput] = useState('i, Χ, άθροισμα, Συνθήκη (Χ > 0)')
  const [saveOpen, setSaveOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [viewport, setViewport] = useState({ width: 900, height: 650 })
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastShapeTap = useRef<{ id: string; at: number } | null>(null)
  const previewRef = useRef<BoardDocument | null>(null)
  const board = preview ?? history.present
  const selected = board.items.find(item => item.id === selectedId) ?? null
  const selectedConnection = board.links.find(link => link.id === selectedLink) ?? null

  const commit = useCallback((next: BoardDocument) => {
    setHistory(current => ({ past: [...current.past, current.present].slice(-60), present: next, future: [] }))
    previewRef.current = null
    setPreview(null)
  }, [])
  const undo = useCallback(() => {
    setHistory(current => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1)!, future: [current.present, ...current.future] } : current)
    setSelectedId(null); setSelectedLink(null)
  }, [])
  const redo = useCallback(() => {
    setHistory(current => current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) } : current)
    setSelectedId(null); setSelectedLink(null)
  }, [])
  const removeSelected = useCallback(() => {
    if (selectedId) commit({ ...history.present, items: history.present.items.filter(item => item.id !== selectedId), links: history.present.links.filter(link => link.from !== selectedId && link.to !== selectedId) })
    else if (selectedLink) commit({ ...history.present, links: history.present.links.filter(link => link.id !== selectedLink) })
    setSelectedId(null); setSelectedLink(null)
  }, [commit, history.present, selectedId, selectedLink])

  useEffect(() => { try { localStorage.setItem('aepp-whiteboard-v1', JSON.stringify(history.present)) } catch { /* Η εξαγωγή αρχείου παραμένει διαθέσιμη. */ } }, [history.present])
  useEffect(() => {
    const element = stageRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewport({ width: element.clientWidth, height: element.clientHeight }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo() }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
      else if (event.key === 'Delete' || event.key === 'Backspace') { if (selectedId || selectedLink) { event.preventDefault(); removeSelected() } }
      else if (event.key === 'Escape') { setEditing(null); setPendingFrom(null); setSelectedId(null); setSelectedLink(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, removeSelected, selectedId, selectedLink])

  function worldPoint(event: ReactPointerEvent<SVGElement>): Point {
    const svg = svgRef.current!
    const point = svg.createSVGPoint()
    point.x = event.clientX; point.y = event.clientY
    const world = point.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: world.x, y: world.y }
  }
  function capture(event: ReactPointerEvent<SVGElement>) { svgRef.current?.setPointerCapture(event.pointerId) }
  function startOnBackground(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.target !== svgRef.current && !(event.target as Element).hasAttribute('data-board-background')) return
    const point = worldPoint(event)
    if (tool === 'select') { setSelectedId(null); setSelectedLink(null); setPendingFrom(null); return }
    if (tool === 'hand') { gesture.current = { kind: 'pan', startX: event.clientX, startY: event.clientY, pan }; capture(event); return }
    if (tool === 'eraser') return
    if (tool === 'note') {
      const item: ShapeItem = { id: newId(), type: 'shape', kind: 'note', text: '', x: point.x, y: point.y, width: 220, height: 100, rotation: 0 }
      commit({ ...history.present, items: [...history.present.items, item] }); setSelectedId(item.id); setEditing({ id: item.id, value: '' }); return
    }
    if (tool === 'table') { setTableDialog(true); return }
    if (pendingFrom) setPendingFrom(null)
    gesture.current = { kind: 'draw', tool, start: point, current: point, points: [point] }
    capture(event)
  }
  function startOnItem(event: ReactPointerEvent<SVGGElement>, item: BoardItem) {
    event.stopPropagation()
    if (editing) return
    if (tool === 'select' && item.type === 'shape') {
      const now = Date.now()
      if (lastShapeTap.current?.id === item.id && now - lastShapeTap.current.at < 500) {
        lastShapeTap.current = null
        beginEdit(item)
        return
      }
      lastShapeTap.current = { id: item.id, at: now }
    }
    if (tool === 'eraser') {
      commit({ ...history.present, items: history.present.items.filter(candidate => candidate.id !== item.id), links: history.present.links.filter(link => link.from !== item.id && link.to !== item.id) })
      setSelectedId(null); return
    }
    if (tool === 'arrow' && isConnectable(item)) {
      if (pendingFrom && pendingFrom !== item.id) {
        const source = history.present.items.find(candidate => candidate.id === pendingFrom)
        const trueCount = history.present.links.filter(link => link.from === pendingFrom).length
        const label = source?.type === 'shape' && source.kind === 'decision' ? trueCount === 0 ? 'Αληθής' : trueCount === 1 ? 'Ψευδής' : '' : ''
        commit({ ...history.present, links: [...history.present.links, { id: newId(), from: pendingFrom, to: item.id, label }] })
        setPendingFrom(null); setNotice('Τα σχήματα συνδέθηκαν. Το βέλος ακολουθεί τις μετακινήσεις τους.')
      } else setPendingFrom(item.id)
      setSelectedId(item.id); return
    }
    if (tool !== 'select') return
    setSelectedId(item.id); setSelectedLink(null)
    gesture.current = { kind: 'move', id: item.id, start: worldPoint(event), base: history.present }
    capture(event)
  }
  function startHandle(event: ReactPointerEvent<SVGGElement>, kind: 'resize' | 'rotate', item: BoardItem, corner?: 'nw' | 'ne' | 'sw' | 'se') {
    event.stopPropagation()
    gesture.current = { kind, id: item.id, start: worldPoint(event), base: history.present, corner }
    capture(event)
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current
    if (!active) return
    if (active.kind === 'pan') { setPan({ x: active.pan.x - (event.clientX - active.startX) / zoom, y: active.pan.y - (event.clientY - active.startY) / zoom }); return }
    const point = worldPoint(event)
    if (active.kind === 'draw') {
      active.current = point
      if (active.tool === 'pencil' || active.tool === 'highlighter') active.points.push(point)
      const item = drawnItem(active)
      previewRef.current = { ...history.present, items: [...history.present.items, item] }
      setPreview(previewRef.current)
      return
    }
    const dx = point.x - active.start.x, dy = point.y - active.start.y
    const next = { ...active.base, items: active.base.items.map(item => {
      if (item.id !== active.id) return item
      if (active.kind === 'move') return moveItem(item, dx, dy)
      if (active.kind === 'resize') {
        const corner = active.corner ?? 'se'
        const left = corner.includes('w') ? Math.min(item.x + dx, item.x + item.width - 36) : item.x
        const top = corner.includes('n') ? Math.min(item.y + dy, item.y + item.height - 36) : item.y
        const right = corner.includes('e') ? Math.max(item.x + item.width + dx, item.x + 36) : item.x + item.width
        const bottom = corner.includes('s') ? Math.max(item.y + item.height + dy, item.y + 36) : item.y + item.height
        return { ...item, x: left, y: top, width: right - left, height: bottom - top }
      }
      const angle = Math.atan2(point.y - (item.y + item.height / 2), point.x - (item.x + item.width / 2)) * 180 / Math.PI + 90
      return { ...item, rotation: Math.round(angle / 5) * 5 }
    }) }
    previewRef.current = next
    setPreview(next)
  }
  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current
    if (!active) return
    gesture.current = null
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId)
    if (active.kind === 'pan') return
    if (active.kind === 'draw') {
      const item = drawnItem(active)
      commit({ ...history.present, items: [...history.present.items, item] })
      setSelectedId(item.id); setSelectedLink(null)
      return
    }
    if (previewRef.current) commit(previewRef.current)
  }

  function updateItem(id: string, update: (item: BoardItem) => BoardItem) {
    commit({ ...history.present, items: history.present.items.map(item => item.id === id ? update(item) : item) })
  }
  function beginEdit(item: BoardItem) {
    if (item.type === 'shape') setEditing({ id: item.id, value: item.text })
  }
  function finishEdit(save: boolean) {
    if (!editing) return
    if (save) {
      const { id, row, column, value } = editing
      updateItem(id, item => {
        if (item.type === 'shape') return { ...item, text: value }
        if (item.type === 'table' && row !== undefined && column !== undefined) return { ...item, rows: item.rows.map((cells, index) => index === row ? cells.map((cell, col) => col === column ? value : cell) : cells) }
        return item
      })
    }
    setEditing(null)
  }
  function createTable() {
    const columns = [...new Set(columnsInput.split(',').map(name => name.trim()).filter(name => name && name.toLocaleUpperCase('el-GR') !== 'ΕΞΟΔΟΣ'))].slice(0, 7)
    if (!columns.length) { setNotice('Γράψε τουλάχιστον μία μεταβλητή για τον Πίνακα Τιμών.'); return }
    const tableColumns = [...columns, 'ΕΞΟΔΟΣ']
    const rows = Array.from({ length: 5 }, () => tableColumns.map(() => ''))
    const dimensions = tableDimensions(tableColumns, rows)
    const item: TableItem = ensureOutputColumn({ id: newId(), type: 'table', columns: tableColumns, rows, x: pan.x + 70, y: pan.y + 150, ...dimensions, rotation: 0 })
    commit({ ...history.present, items: [...history.present.items, item] })
    setSelectedId(item.id); setTableDialog(false); setTool('select'); setNotice('Ο Πίνακας Τιμών προστέθηκε. Κάνε διπλό κλικ σε ένα κελί για συμπλήρωση.')
  }
  function addTableRow(table: TableItem) {
    const rows = [...table.rows, table.columns.map(() => '')]
    updateItem(table.id, item => item.type === 'table' ? { ...item, rows, ...tableDimensions(table.columns, rows) } : item)
  }
  function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) { setNotice('Επίλεξε εικόνα PNG, JPEG ή WebP έως 8 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const item: ImageItem = { id: newId(), type: 'image', src: String(reader.result), alt: file.name, x: pan.x + 100, y: pan.y + 160, width: 340, height: 240, rotation: 0 }
      commit({ ...history.present, items: [...history.present.items, item] }); setSelectedId(item.id); setTool('select')
    }
    reader.readAsDataURL(file)
  }
  function generateDiagram() {
    try {
      const generated = flowchartFromCode(getSource())
      const currentBounds = boardBounds(history.present)
      const shift = history.present.items.length ? currentBounds.x + currentBounds.width + 140 : 0
      const items = generated.items.map(item => moveItem(item, shift, 0))
      const links = generated.links.map(link => link.route?.via ? { ...link, route: { ...link.route, via: link.route.via.map(point => ({ x: point.x + shift, y: point.y })) } } : link)
      commit({ ...history.present, items: [...history.present.items, ...items], links: [...history.present.links, ...links] })
      const bounds = boardBounds({ ...generated, items, links })
      const fit = clamp((viewport.width / bounds.width) * .88, .65, 1.1)
      setZoom(fit); setPan({ x: bounds.x - 20, y: bounds.y - 20 }); setTool('select')
      setNotice('Δημιουργήθηκε διάγραμμα από τον κώδικα της ΓΛΩΣΣΑΣ. Χρησιμοποίησε το Χέρι για να δεις τα επόμενα βήματα της ροής.')
    } catch (cause) { setNotice(formatDiagnostic(toDiagnostic(cause, 'syntax'))) }
  }
  function serializeSvg(): { source: string; width: number; height: number } | null {
    const original = svgRef.current
    if (!original) return null
    const bounds = boardBounds(history.present)
    const clone = original.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(Math.ceil(bounds.width)))
    clone.setAttribute('height', String(Math.ceil(bounds.height)))
    clone.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`)
    clone.querySelectorAll('.wb-ui-overlay, foreignObject').forEach(element => element.remove())
    const background = clone.querySelector('[data-board-background]')
    background?.setAttribute('x', String(bounds.x)); background?.setAttribute('y', String(bounds.y))
    background?.setAttribute('width', String(bounds.width)); background?.setAttribute('height', String(bounds.height))
    return { source: new XMLSerializer().serializeToString(clone), width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) }
  }
  async function exportBoard(format: 'json' | 'svg' | 'png') {
    setSaveOpen(false)
    if (format === 'json') { download(new Blob([JSON.stringify(history.present, null, 2)], { type: 'application/json' }), 'πίνακας-αεππ.json'); return }
    const result = serializeSvg()
    if (!result) return
    if (format === 'svg') { download(new Blob([result.source], { type: 'image/svg+xml;charset=utf-8' }), 'πίνακας-αεππ.svg'); return }
    const url = URL.createObjectURL(new Blob([result.source], { type: 'image/svg+xml;charset=utf-8' }))
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = result.width; canvas.height = result.height
      canvas.getContext('2d')!.drawImage(image, 0, 0)
      canvas.toBlob(blob => { if (blob) download(blob, 'πίνακας-αεππ.png'); else setNotice('Δεν ήταν δυνατή η εξαγωγή PNG.') }, 'image/png')
    } catch { setNotice('Δεν ήταν δυνατή η εξαγωγή PNG. Δοκίμασε SVG ή JSON.') }
    finally { URL.revokeObjectURL(url) }
  }

  const selectedShape = selected?.type === 'shape' ? selected : null
  const viewWidth = viewport.width / zoom, viewHeight = viewport.height / zoom
  const draw = board.items.map(item => {
    if (item.type === 'shape') return <FlowShape key={item.id} item={item} selected={selectedId === item.id || pendingFrom === item.id} onPointerDown={event => startOnItem(event, item)} onDoubleClick={() => beginEdit(item)} />
    if (item.type === 'table') return <TraceTable key={item.id} item={item} selected={selectedId === item.id} onPointerDown={event => startOnItem(event, item)} onCellDoubleClick={(row, column) => { setSelectedId(item.id); setEditing({ id: item.id, row, column, value: item.rows[row][column] }) }} />
    if (item.type === 'image') return <g key={item.id} className="wb-object" data-item-id={item.id} transform={`rotate(${item.rotation} ${item.x + item.width / 2} ${item.y + item.height / 2})`} onPointerDown={event => startOnItem(event, item)}><image href={item.src} x={item.x} y={item.y} width={item.width} height={item.height} preserveAspectRatio="xMidYMid meet" /><rect x={item.x} y={item.y} width={item.width} height={item.height} fill="transparent" stroke={selectedId === item.id ? '#60a5fa' : 'transparent'} strokeWidth="2" /></g>
    if (item.type === 'stroke') return <polyline key={item.id} className="wb-object" data-item-id={item.id} points={item.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={item.highlight ? '#facc15' : '#b9d6ff'} strokeWidth={item.highlight ? 14 : 3} opacity={item.highlight ? .45 : 1} strokeLinecap="round" strokeLinejoin="round" onPointerDown={event => startOnItem(event as ReactPointerEvent<SVGGElement>, item)} />
    return <line key={item.id} className="wb-object" data-item-id={item.id} x1={item.x} y1={item.y} x2={item.x + item.width} y2={item.y + item.height} stroke={selectedId === item.id ? '#fbbf24' : '#8dbcf6'} strokeWidth="3" markerEnd={item.arrow ? 'url(#wb-arrowhead)' : undefined} onPointerDown={event => startOnItem(event as ReactPointerEvent<SVGGElement>, item)} />
  })

  return <section className="wb-workspace" aria-labelledby="whiteboard-title">
    <header className="wb-header"><div className="wb-header-start"><div className="wb-save-wrap"><button type="button" onClick={() => setSaveOpen(open => !open)} className="wb-secondary" aria-expanded={saveOpen}><Save size={17} />Αποθήκευση</button>{saveOpen && <div className="wb-save-menu">{(['png', 'svg', 'json'] as const).map(format => <button key={format} type="button" onClick={() => void exportBoard(format)}><Download size={15} />Εξαγωγή {format.toUpperCase()}</button>)}</div>}</div><div><p className="wb-eyebrow">ΕΡΓΑΣΤΗΡΙΟ ΑΛΓΟΡΙΘΜΩΝ</p><h1 id="whiteboard-title">Πίνακας & Διαγράμματα</h1><p>Σχεδίασε ροές, συμπλήρωσε Πίνακες Τιμών και εξήγησε κάθε βήμα.</p></div></div><div className="wb-header-actions"><button type="button" onClick={generateDiagram} className="wb-primary"><WandSparkles size={17} />Διάγραμμα από κώδικα</button></div></header>
    <div className="wb-shell">
      <div className="wb-board-column">
        <div className="wb-toolbar" role="toolbar" aria-label="Εργαλεία Ψηφιακού Πίνακα">
          {tools.map(({ id, label, icon: Icon }, index) => <button key={id} type="button" title={label} aria-label={label} aria-pressed={tool === id} className={`wb-tool wb-tool-${id}${tool === id ? ' is-active' : ''}${[2, 7, 9, 11, 14].includes(index) ? ' wb-tool-divider' : ''}`} onClick={() => { if (id === 'image') uploadRef.current?.click(); else if (id === 'table') setTableDialog(true); else { setTool(id as Tool); setPendingFrom(null) } }}><Icon size={18} /></button>)}
          <input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadImage} />
        </div>
        <div ref={stageRef} className="wb-stage">
          <svg ref={svgRef} className={`wb-svg wb-cursor-${tool}`} viewBox={`${pan.x} ${pan.y} ${viewWidth} ${viewHeight}`} preserveAspectRatio="none" onPointerDown={startOnBackground} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label="Καμβάς Ψηφιακού Πίνακα">
            <defs><pattern id="wb-grid" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#30415f" /></pattern><marker id="wb-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#79aff3" /></marker></defs>
            <rect data-board-background x={pan.x} y={pan.y} width={viewWidth} height={viewHeight} fill="#101b2d" />
            <rect className="wb-ui-overlay" x={pan.x} y={pan.y} width={viewWidth} height={viewHeight} fill="url(#wb-grid)" pointerEvents="none" />
            {board.links.map(link => { const from = board.items.find(item => item.id === link.from), to = board.items.find(item => item.id === link.to); return from?.type === 'shape' && to?.type === 'shape' ? <FlowConnection key={link.id} link={link} from={from} to={to} selected={selectedLink === link.id} onSelect={() => { setSelectedLink(link.id); setSelectedId(null) }} /> : null })}
            {draw}
            {selected && tool === 'select' && <g className="wb-ui-overlay"><rect x={itemBounds(selected).x - 7} y={itemBounds(selected).y - 7} width={itemBounds(selected).width + 14} height={itemBounds(selected).height + 14} fill="none" stroke="#60a5fa" strokeDasharray="6 4" pointerEvents="none" />{(selected.type === 'shape' || selected.type === 'image') && (['nw', 'ne', 'sw', 'se'] as const).map(corner => <g key={corner} className={`wb-resize-${corner}`} onPointerDown={event => startHandle(event, 'resize', selected, corner)}><rect x={selected.x + (corner.includes('e') ? selected.width : 0) - 9} y={selected.y + (corner.includes('s') ? selected.height : 0) - 9} width="18" height="18" rx="3" fill="#60a5fa" stroke="#eaf3ff" /></g>)}{selected.type === 'line' && <g onPointerDown={event => startHandle(event, 'resize', selected, 'se')}><rect x={selected.x + selected.width - 8} y={selected.y + selected.height - 8} width="17" height="17" rx="3" fill="#60a5fa" stroke="#eaf3ff" /></g>}{(selected.type === 'shape' || selected.type === 'image') && <g onPointerDown={event => startHandle(event, 'rotate', selected)}><line x1={selected.x + selected.width / 2} y1={selected.y - 7} x2={selected.x + selected.width / 2} y2={selected.y - 36} stroke="#60a5fa" /><circle cx={selected.x + selected.width / 2} cy={selected.y - 40} r="9" fill="#60a5fa" stroke="#eaf3ff" /></g>}</g>}
            {editing && (() => { const item = board.items.find(candidate => candidate.id === editing.id); if (!item) return null; const x = item.type === 'table' ? item.x + (editing.column! + 1) * tableCellWidth : item.x + 14; const y = item.type === 'table' ? item.y + (editing.row! + 1) * tableCellHeight : item.y + 12; const width = item.type === 'table' ? tableCellWidth : item.width - 28; const height = item.type === 'table' ? tableCellHeight : item.height - 24; return <foreignObject className="wb-ui-overlay" x={x} y={y} width={Math.max(24, width)} height={Math.max(30, height)}><textarea autoFocus aria-label="Επεξεργασία κειμένου πίνακα" className="wb-inline-editor" value={editing.value} onChange={event => setEditing({ ...editing, value: event.target.value })} onBlur={() => finishEdit(true)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); finishEdit(false) } else if (event.key === 'Enter' && (event.ctrlKey || item.type === 'table')) { event.preventDefault(); finishEdit(true) } }} /></foreignObject> })()}
          </svg>
          <div className="wb-zoom"><button type="button" aria-label="Σμίκρυνση" onClick={() => setZoom(value => clamp(value / 1.2, .3, 3))}><ZoomOut size={16} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="Μεγέθυνση" onClick={() => setZoom(value => clamp(value * 1.2, .3, 3))}><ZoomIn size={16} /></button><span className="wb-zoom-separator" /><button type="button" aria-label="Αναίρεση" disabled={!history.past.length} onClick={undo}><Undo2 size={16} /></button><button type="button" aria-label="Επανάληψη" disabled={!history.future.length} onClick={redo}><Redo2 size={16} /></button></div>
          <div className="wb-stage-hint">{pendingFrom ? 'Επίλεξε το δεύτερο σχήμα για να συνδεθεί.' : tool === 'arrow' ? 'Πάτησε δύο σχήματα για έξυπνο βέλος ή σύρε για απλό βέλος.' : tool === 'select' ? 'Σύρε αντικείμενα · διπλό κλικ για κείμενο' : 'Πάτησε και σύρε στον καμβά'}</div>
        </div>
      </div>
      <aside className="wb-inspector"><div className="wb-inspector-top"><span>ΙΔΙΟΤΗΤΕΣ</span><button type="button" title="Καθαρισμός πίνακα" aria-label="Καθαρισμός πίνακα" onClick={() => { commit(emptyBoard()); setSelectedId(null); setSelectedLink(null); setNotice('Ο πίνακας καθαρίστηκε. Μπορείς να κάνεις αναίρεση.') }}><Trash2 size={16} /></button></div>
        {selected ? <div className="wb-inspector-body"><p className="wb-inspector-kicker">ΕΠΙΛΕΓΜΕΝΟ ΣΤΟΙΧΕΙΟ</p><h2>{selected.type === 'shape' ? shapeLabels[selected.kind] : selected.type === 'table' ? 'Πίνακας Τιμών' : selected.type === 'image' ? 'Εικόνα' : selected.type === 'line' ? 'Γραμμή / Βέλος' : 'Ελεύθερη σχεδίαση'}</h2><p className="wb-muted">Σύρε το στοιχείο για μετακίνηση.{(selected.type === 'shape' || selected.type === 'image') && ' Σύρε μία από τις τέσσερις γωνιακές λαβές για αλλαγή μεγέθους ή την επάνω λαβή για περιστροφή.'}{selected.type === 'line' && ' Η γωνιακή λαβή αλλάζει το μήκος και την κατεύθυνση.'}</p>
          {selectedShape && <label className="wb-field">Κείμενο<textarea key={`${selectedShape.id}-${selectedShape.text}`} defaultValue={selectedShape.text} onBlur={event => { if (event.target.value !== selectedShape.text) updateItem(selectedShape.id, item => item.type === 'shape' ? { ...item, text: event.target.value } : item) }} rows={3} /></label>}
          {selected.type === 'table' && <div className="wb-table-editor"><p className="wb-muted">Κάθε σειρά είναι ένα βήμα ιχνηλάτησης. Συμπλήρωσε τις τιμές μετά την εκτέλεση της αντίστοιχης εντολής.</p><div className="wb-table-scroll"><table><thead><tr><th>Βήμα</th>{selected.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{selected.rows.map((row, rowIndex) => <tr key={rowIndex}><th>{rowIndex + 1}</th>{row.map((cell, columnIndex) => <td key={columnIndex}><input aria-label={`${selected.columns[columnIndex]}, βήμα ${rowIndex + 1}`} defaultValue={cell} key={`${selected.id}-${rowIndex}-${columnIndex}-${cell}`} onBlur={event => { if (event.target.value !== cell) updateItem(selected.id, item => item.type === 'table' ? { ...item, rows: item.rows.map((cells, index) => index === rowIndex ? cells.map((value, col) => col === columnIndex ? event.target.value : value) : cells) } : item) }} /></td>)}</tr>)}</tbody></table></div><button type="button" className="wb-secondary wb-full" onClick={() => addTableRow(selected)}>+ Προσθήκη βήματος</button></div>}
          <button type="button" className="wb-danger" onClick={removeSelected}><Trash2 size={15} />Διαγραφή στοιχείου</button></div>
          : selectedConnection ? <div className="wb-inspector-body"><p className="wb-inspector-kicker">ΣΥΝΔΕΣΗ ΡΟΗΣ</p><h2>Βέλος</h2><label className="wb-field">Ετικέτα<select value={selectedConnection.label} onChange={event => commit({ ...history.present, links: history.present.links.map(link => link.id === selectedConnection.id ? { ...link, label: event.target.value } : link) })}><option value="">Χωρίς ετικέτα</option><option>Αληθής</option><option>Ψευδής</option></select></label><button type="button" className="wb-danger" onClick={removeSelected}><Trash2 size={15} />Διαγραφή βέλους</button></div>
            : <div className="wb-inspector-body"><p className="wb-inspector-kicker">ΟΔΗΓΟΣ</p><h2>Ο δικός σου χώρος σκέψης</h2><p className="wb-muted">Επίλεξε εργαλείο επάνω, σχεδίασε στον καμβά και κάνε διπλό κλικ για να αλλάξεις κείμενο. Για σύνδεση σχημάτων, επίλεξε το βέλος και πάτησε διαδοχικά τα δύο σχήματα.</p><div className="wb-tip"><FileCode2 size={18} /><span>Το «Διάγραμμα από κώδικα» διαβάζει το πρόγραμμα που έγραψες στην καρτέλα του Διερμηνευτή.</span></div><div className="wb-tip"><Table2 size={18} /><span>Ο Πίνακας Τιμών οργανώνει τις μεταβλητές ανά βήμα εκτέλεσης.</span></div></div>}
      </aside>
    </div>
    <p role="status" className="wb-notice">{notice}</p>
    {tableDialog && <div className="wb-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setTableDialog(false) }}><form className="wb-dialog" role="dialog" aria-modal="true" aria-labelledby="wb-table-title" onSubmit={event => { event.preventDefault(); createTable() }}><p className="wb-eyebrow">ΙΧΝΗΛΑΤΗΣΗ ΑΛΓΟΡΙΘΜΟΥ</p><h2 id="wb-table-title">Νέος Πίνακας Τιμών</h2><p>Γράψε τις μεταβλητές και τις συνθήκες που θέλεις να παρακολουθείς, χωρισμένες με κόμμα. Η τελευταία στήλη «ΕΞΟΔΟΣ» προστίθεται αυτόματα.</p><label className="wb-field">Στήλες / μεταβλητές<input autoFocus value={columnsInput} onChange={event => setColumnsInput(event.target.value)} placeholder="i, Χ, άθροισμα, Συνθήκη (Χ > 0)" /></label><div className="wb-dialog-actions"><button type="button" className="wb-secondary" onClick={() => setTableDialog(false)}>Άκυρο</button><button type="submit" className="wb-primary"><Table2 size={16} />Δημιουργία πίνακα</button></div></form></div>}
  </section>
}
