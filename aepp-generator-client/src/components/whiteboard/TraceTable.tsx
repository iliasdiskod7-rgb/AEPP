import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { tableCellHeight, tableCellWidth, type TableItem } from '../../whiteboard/model'

export default function TraceTable({ item, selected, onPointerDown, onCellDoubleClick }: {
  item: TableItem
  selected: boolean
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void
  onCellDoubleClick: (row: number, column: number) => void
}) {
  const lastCellTap = useRef<{ row: number; column: number; at: number } | null>(null)
  const headers = ['Βήμα', ...item.columns]
  const rows = [headers, ...item.rows.map((row, index) => [String(index + 1), ...row])]
  return <g className="wb-object" data-item-id={item.id} onPointerDown={onPointerDown}>
    <title>Πίνακας Τιμών</title>
    {rows.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
      const x = item.x + columnIndex * tableCellWidth, y = item.y + rowIndex * tableCellHeight
      const editable = rowIndex > 0 && columnIndex > 0
      return <g key={`${rowIndex}-${columnIndex}`} onPointerDown={event => {
        if (!editable) return
        const now = Date.now(), row = rowIndex - 1, column = columnIndex - 1
        if (lastCellTap.current?.row === row && lastCellTap.current.column === column && now - lastCellTap.current.at < 500) {
          event.stopPropagation(); lastCellTap.current = null; onCellDoubleClick(row, column)
        } else lastCellTap.current = { row, column, at: now }
      }} onDoubleClick={event => { if (editable) { event.stopPropagation(); onCellDoubleClick(rowIndex - 1, columnIndex - 1) } }}>
        <rect x={x} y={y} width={tableCellWidth} height={tableCellHeight} fill={rowIndex === 0 ? '#254169' : columnIndex === 0 ? '#1c304d' : '#14233b'} stroke={selected ? '#60a5fa' : '#426080'} strokeWidth="1" />
        <text x={x + 10} y={y + 26} fill={rowIndex === 0 ? '#dbeafe' : '#e2e8f0'} fontSize="12" fontWeight={rowIndex === 0 ? '700' : '400'} fontFamily="Segoe UI, sans-serif" style={{ pointerEvents: 'none' }}>{value.length > 21 ? `${value.slice(0, 19)}…` : value}</text>
      </g>
    }))}
  </g>
}
