import { useEffect, useRef } from 'react'
import { clampSize, resizeSize } from './workspaceState'
interface Props { axis: 'x' | 'y'; direction: 1 | -1; value: number; min: number; max: number; onChange: (value: number) => void; label: string; controls: string }
export default function ResizeHandle({ axis, direction, value, min, max, onChange, label, controls }: Props) {
  const drag = useRef<{ position: number; value: number; cursor: string; selection: string } | null>(null)
  function finish() { const current = drag.current; if (!current) return; document.body.style.cursor = current.cursor; document.body.style.userSelect = current.selection; drag.current = null }
  useEffect(() => () => finish(), [])
  return <div className={'ide-resizer ide-resizer-' + axis} role="separator" tabIndex={0} aria-label={label} title={label + ' · Σύρε ή χρησιμοποίησε τα βελάκια'} aria-controls={controls} aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'} aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={Math.max(min, max)} onPointerDown={e => {
    if (e.button !== 0) return
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { position: axis === 'x' ? e.clientX : e.clientY, value, cursor: document.body.style.cursor, selection: document.body.style.userSelect }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'; document.body.style.userSelect = 'none'
  }} onPointerMove={e => { if (drag.current) onChange(resizeSize(drag.current.value, (axis === 'x' ? e.clientX : e.clientY) - drag.current.position, direction, min, max)) }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={e => {
    const negative = axis === 'x' ? 'ArrowLeft' : 'ArrowUp', positive = axis === 'x' ? 'ArrowRight' : 'ArrowDown'
    if (![negative, positive, 'Home', 'End'].includes(e.key)) return
    e.preventDefault(); onChange(e.key === 'Home' ? min : e.key === 'End' ? Math.max(min, max) : clampSize(value + (e.key === positive ? 1 : -1) * direction * (e.shiftKey ? 40 : 10), min, max))
  }} />
}
