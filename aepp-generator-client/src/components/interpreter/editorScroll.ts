export function followLineScroll(line: number, lineHeight: number, paddingTop: number, viewportHeight: number, scrollTop: number, scrollHeight: number): number {
  if (!Number.isInteger(line) || line < 1 || lineHeight <= 0 || viewportHeight <= 0) return scrollTop
  const top = paddingTop + (line - 1) * lineHeight
  const bottom = top + lineHeight
  const margin = Math.min(lineHeight, Math.max(0, (viewportHeight - lineHeight) / 2))
  if (top >= scrollTop + margin && bottom <= scrollTop + viewportHeight - margin) return scrollTop
  return Math.max(0, Math.min(top - (viewportHeight - lineHeight) / 2, Math.max(0, scrollHeight - viewportHeight)))
}
