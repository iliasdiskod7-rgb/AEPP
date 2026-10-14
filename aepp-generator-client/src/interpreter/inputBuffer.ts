export class DebugInputBuffer {
  private values: string[] = []
  private cursor = 0

  load(values: readonly string[]) {
    this.values = [...values]
    this.cursor = 0
  }

  peek() {
    return this.values[this.cursor]
  }

  consume() {
    if (this.cursor < this.values.length) this.cursor++
  }
  seek(index:number){this.cursor=Math.max(0,Math.min(this.values.length,Math.trunc(index)))}
}
