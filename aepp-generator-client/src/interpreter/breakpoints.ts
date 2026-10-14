export class BreakpointManager {
  private lines = new Set<number>()
  toggle(line: number): number[] {
    if (!Number.isSafeInteger(line) || line < 1) return this.list()
    if (this.lines.has(line)) this.lines.delete(line); else this.lines.add(line)
    return this.list()
  }
  replace(lines: Iterable<number>) { this.lines = new Set([...lines].filter(line => Number.isSafeInteger(line) && line > 0)) }
  has = (line: number) => this.lines.has(line)
  list = () => [...this.lines].sort((a, b) => a - b)
  clear() { this.lines.clear() }
}
