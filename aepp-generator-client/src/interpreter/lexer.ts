import { GlossaError, type Token } from './types'

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row]
    let index = 0
    while (index < line.length) {
      const char = line[index]
      if (/\s/u.test(char)) { index++; continue }
      if (char === '!') break
      const column = index + 1
      if (char === "'") {
        let value = ''
        index++
        let closed = false
        while (index < line.length) {
          if (line[index] === "'") {
            if (line[index + 1] === "'") { value += "'"; index += 2; continue }
            index++; closed = true; break
          }
          value += line[index++]
        }
        if (!closed) throw new GlossaError(row + 1, 'Το αλφαριθμητικό δεν κλείνει με απόστροφο.')
        tokens.push({ kind: 'string', text: value, line: row + 1, column })
        continue
      }
      const number = /^(?:\d+(?:\.\d+)?)/u.exec(line.slice(index))
      if (number) { tokens.push({ kind: 'number', text: number[0], line: row + 1, column }); index += number[0].length; continue }
      const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(line.slice(index))
      if (word) { tokens.push({ kind: 'word', text: word[0], line: row + 1, column }); index += word[0].length; continue }
      const pair = line.slice(index, index + 2)
      if (['<-', '<=', '>=', '<>'].includes(pair)) { tokens.push({ kind: 'symbol', text: pair, line: row + 1, column }); index += 2; continue }
      if ('+-*/^=<>:,()'.includes(char)) { tokens.push({ kind: 'symbol', text: char, line: row + 1, column }); index++; continue }
      throw new GlossaError(row + 1, `Μη αναγνωρισμένο σύμβολο «${char}» στη στήλη ${column}.`)
    }
    tokens.push({ kind: 'newline', text: '\n', line: row + 1, column: line.length + 1 })
  }
  tokens.push({ kind: 'eof', text: '', line: lines.length, column: lines.at(-1)!.length + 1 })
  return tokens
}
