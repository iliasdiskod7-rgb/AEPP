import type { PointerEvent as ReactPointerEvent } from 'react'
import type { FlowLink, ShapeItem, Point, PortSide } from '../../whiteboard/model'

function wrappedLines(text: string, width: number): string[] {
  const limit = Math.max(7, Math.floor(width / 8.2))
  return text.split('\n').flatMap(part => {
    const words = part.split(/\s+/u)
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      if (line && (line + ' ' + word).length > limit) { lines.push(line); line = word }
      else line = line ? `${line} ${word}` : word
    }
    lines.push(line)
    return lines
  }).slice(0, 9)
}

export function FlowShape({ item, selected, onPointerDown, onDoubleClick }: {
  item: ShapeItem
  selected: boolean
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void
  onDoubleClick: () => void
}) {
  const { x, y, width: w, height: h, kind } = item
  const fill = selected ? '#243b5a' : '#17243a'
  const stroke = selected ? '#60a5fa' : '#6182ae'
  const polygon = kind === 'io'
    ? `${x + 28},${y} ${x + w},${y} ${x + w - 28},${y + h} ${x},${y + h}`
    : `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`
  const lines = wrappedLines(item.text, kind === 'decision' ? w * .62 : w - 26)
  const lineHeight = 17
  return <g className="wb-object" data-item-id={item.id} transform={`rotate(${item.rotation} ${x + w / 2} ${y + h / 2})`} onPointerDown={onPointerDown} onDoubleClick={onDoubleClick}>
    <title>{item.text || (kind === 'connector' ? 'Σημείο σύνδεσης' : kind)}</title>
    {kind === 'start' && <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={stroke} strokeWidth="2" />}
    {(kind === 'io' || kind === 'decision') && <polygon points={polygon} fill={fill} stroke={stroke} strokeWidth="2" />}
    {kind === 'process' && <rect x={x} y={y} width={w} height={h} rx="8" fill={fill} stroke={stroke} strokeWidth="2" />}
    {kind === 'connector' && <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2} fill={fill} stroke={stroke} strokeWidth="2" />}
    {kind === 'note' && <rect x={x} y={y} width={w} height={h} rx="6" fill="#273752" stroke="#7ea6d8" strokeDasharray="5 4" />}
    {kind !== 'connector' && <text x={x + w / 2} y={y + h / 2 - (lines.length - 1) * lineHeight / 2} dominantBaseline="middle" textAnchor="middle" fill="#eaf3ff" fontSize="13" fontFamily="Segoe UI, sans-serif" style={{ pointerEvents: 'none' }}>{lines.map((line, index) => <tspan key={index} x={x + w / 2} dy={index ? lineHeight : 0}>{line}</tspan>)}</text>}
  </g>
}

function port(item: ShapeItem, side: PortSide): Point {
  const cx = item.x + item.width / 2, cy = item.y + item.height / 2
  if (side === 'top') return { x: cx, y: item.y }
  if (side === 'bottom') return { x: cx, y: item.y + item.height }
  if (side === 'left') return { x: item.x, y: cy }
  return { x: item.x + item.width, y: cy }
}

function compact(points: Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    const previous = result.at(-1)
    if (previous?.x === point.x && previous.y === point.y) continue
    result.push(point)
    while (result.length >= 3) {
      const [a, b, c] = result.slice(-3)
      if (a.x === b.x && b.x === c.x || a.y === b.y && b.y === c.y) result.splice(-2, 1)
      else break
    }
  }
  return result
}

export function connectionPath(from: ShapeItem, to: ShapeItem, link?: FlowLink): { path: string; label: Point; points: Point[] } {
  const ac = { x: from.x + from.width / 2, y: from.y + from.height / 2 }
  const bc = { x: to.x + to.width / 2, y: to.y + to.height / 2 }
  const horizontal = Math.abs(bc.x - ac.x) > Math.abs(bc.y - ac.y) * 1.15
  const fromSide = link?.route?.from ?? (horizontal ? bc.x >= ac.x ? 'right' : 'left' : bc.y >= ac.y ? 'bottom' : 'top')
  const toSide = link?.route?.to ?? (horizontal ? bc.x >= ac.x ? 'left' : 'right' : bc.y >= ac.y ? 'top' : 'bottom')
  const start = port(from, fromSide), end = port(to, toSide)
  const waypoints = link?.route?.via ?? []
  const points: Point[] = [start]
  if (!waypoints.length && start.x !== end.x && start.y !== end.y) {
    if (fromSide === 'left' || fromSide === 'right') {
      const midX = (start.x + end.x) / 2
      points.push({ x: midX, y: start.y }, { x: midX, y: end.y })
    } else {
      const midY = (start.y + end.y) / 2
      points.push({ x: start.x, y: midY }, { x: end.x, y: midY })
    }
  }
  for (const target of [...waypoints, end]) {
    const previous = points.at(-1)!
    if (previous.x !== target.x && previous.y !== target.y) {
      const first = points.length === 1 && (fromSide === 'left' || fromSide === 'right')
      const last = target === end && (toSide === 'top' || toSide === 'bottom')
      points.push(first || last ? { x: target.x, y: previous.y } : { x: previous.x, y: target.y })
    }
    points.push(target)
  }
  const orthogonal = compact(points)
  const labelSegment = orthogonal.find((point, index) => index > 0 && Math.abs(point.x - start.x) + Math.abs(point.y - start.y) >= 34) ?? orthogonal[1] ?? start
  const label = { x: start.x + (labelSegment.x - start.x) * .55, y: start.y + (labelSegment.y - start.y) * .55 - 14 }
  return { path: orthogonal.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '), label, points: orthogonal }
}

export function FlowConnection({ link, from, to, selected, onSelect }: { link: FlowLink; from: ShapeItem; to: ShapeItem; selected: boolean; onSelect: () => void }) {
  const geometry = connectionPath(from, to, link)
  return <g onPointerDown={event => { event.stopPropagation(); onSelect() }} className="wb-connection">
    <path d={geometry.path} fill="none" stroke="transparent" strokeWidth="18" />
    <path d={geometry.path} fill="none" stroke={selected ? '#fbbf24' : '#79aff3'} strokeWidth={selected ? 3.2 : 2.3} markerEnd="url(#wb-arrowhead)" />
    {link.label && <g><rect x={geometry.label.x - Math.max(31, link.label.length * 4.5)} y={geometry.label.y - 11} width={Math.max(62, link.label.length * 9)} height="22" rx="5" fill="#17243a" stroke="#395479" /><text x={geometry.label.x} y={geometry.label.y + 4} textAnchor="middle" fill="#dbeafe" fontSize="12">{link.label}</text></g>}
  </g>
}
