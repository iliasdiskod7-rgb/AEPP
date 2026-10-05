export interface Point { x: number; y: number }
export type ShapeKind = 'start' | 'io' | 'process' | 'decision' | 'connector' | 'note'
export type DrawTool = ShapeKind | 'line' | 'arrow' | 'pencil' | 'highlighter' | 'table'
export type Tool = DrawTool | 'select' | 'hand' | 'eraser'

interface BaseItem { id: string; x: number; y: number; width: number; height: number; rotation: number }
export interface ShapeItem extends BaseItem { type: 'shape'; kind: ShapeKind; text: string }
export interface LineItem extends BaseItem { type: 'line'; arrow: boolean }
export interface StrokeItem extends BaseItem { type: 'stroke'; points: Point[]; highlight: boolean }
export interface ImageItem extends BaseItem { type: 'image'; src: string; alt: string }
export interface TableItem extends BaseItem { type: 'table'; columns: string[]; rows: string[][] }
export type BoardItem = ShapeItem | LineItem | StrokeItem | ImageItem | TableItem
export type PortSide = 'top' | 'right' | 'bottom' | 'left'
export interface LinkRoute { from: PortSide; to: PortSide; via?: Point[] }
export interface FlowLink { id: string; from: string; to: string; label: string; route?: LinkRoute }
export interface BoardDocument { version: 1; items: BoardItem[]; links: FlowLink[] }

export const emptyBoard = (): BoardDocument => ({ version: 1, items: [], links: [] })
export const newId = () => crypto.randomUUID()
export const isConnectable = (item: BoardItem): item is ShapeItem => item.type === 'shape' && item.kind !== 'note'
export const tableCellWidth = 152
export const tableCellHeight = 42
export const tableDimensions = (columns: string[], rows: string[][]) => ({ width: (columns.length + 1) * tableCellWidth, height: (rows.length + 1) * tableCellHeight })

export function ensureOutputColumn(table: TableItem): TableItem {
  const outputIndexes = table.columns.flatMap((name, index) => name.trim().toLocaleUpperCase('el-GR') === 'ΕΞΟΔΟΣ' ? [index] : [])
  const otherIndexes = table.columns.map((_, index) => index).filter(index => !outputIndexes.includes(index))
  const columns = [...otherIndexes.map(index => table.columns[index]), 'ΕΞΟΔΟΣ']
  const rows = table.rows.map(row => [...otherIndexes.map(index => row[index] ?? ''), outputIndexes.length ? row[outputIndexes[0]] ?? '' : ''])
  return { ...table, columns, rows, ...tableDimensions(columns, rows) }
}

export function itemBounds(item: BoardItem) {
  if (item.type === 'line') return { x: Math.min(item.x, item.x + item.width), y: Math.min(item.y, item.y + item.height), width: Math.abs(item.width), height: Math.abs(item.height) }
  if (item.type === 'stroke') {
    const xs = item.points.map(point => point.x), ys = item.points.map(point => point.y)
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
  }
  return { x: item.x, y: item.y, width: item.width, height: item.height }
}

export function boardBounds(board: BoardDocument) {
  if (!board.items.length) return { x: 0, y: 0, width: 1200, height: 760 }
  const boxes = board.items.map(itemBounds)
  const vias = board.links.flatMap(link => link.route?.via ?? [])
  const minX = Math.min(...boxes.map(box => box.x), ...vias.map(point => point.x)) - 80
  const minY = Math.min(...boxes.map(box => box.y), ...vias.map(point => point.y)) - 80
  const maxX = Math.max(...boxes.map(box => box.x + box.width), ...vias.map(point => point.x)) + 80
  const maxY = Math.max(...boxes.map(box => box.y + box.height), ...vias.map(point => point.y)) + 80
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function moveItem(item: BoardItem, dx: number, dy: number): BoardItem {
  if (item.type === 'stroke') return { ...item, x: item.x + dx, y: item.y + dy, points: item.points.map(point => ({ x: point.x + dx, y: point.y + dy })) }
  return { ...item, x: item.x + dx, y: item.y + dy }
}

export function loadBoard(): BoardDocument {
  try {
    const saved = JSON.parse(localStorage.getItem('aepp-whiteboard-v1') ?? 'null') as BoardDocument | null
    if (saved?.version === 1 && Array.isArray(saved.items) && Array.isArray(saved.links)) return {
      ...saved,
      items: saved.items.map(item => item.type === 'table' ? ensureOutputColumn(item) : item),
    }
  } catch { /* Άκυρα τοπικά δεδομένα: ξεκινά κενός πίνακας. */ }
  return emptyBoard()
}
