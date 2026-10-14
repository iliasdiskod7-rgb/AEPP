import { GlossaError, type Token } from './types'
interface SourcePosition { line: number; column: number }
interface LogicalLine { text: string; positions: SourcePosition[]; end: SourcePosition }

/** Ενώνει μόνο τις συνέχειες, διατηρώντας τη φυσική θέση κάθε χαρακτήρα. */
function logicalLines(source: string): LogicalLine[] {
  const rows = source.replace(/\r\n?/g, '\n').split('\n')
  const result: LogicalLine[] = []
  let trailing = false, quoted = false
  for (let row = 0; row < rows.length; row++) {
    const original = rows[row]
    const first = original.search(/\S/u)
    const leading = first >= 0 && original[first] === '&'
    const join = trailing || leading
    if(trailing && first<0)throw new GlossaError(row,'Το & απαιτεί επόμενη γραμμή συνέχειας.')
    if (leading && (!result.length || !result.at(-1)!.text.trim())) throw new GlossaError(row+1,'Το & δεν έχει προηγούμενη εντολή για συνέχιση.')
    if (!join) { result.push({text:'',positions:[],end:{line:row+1,column:original.length+1}}); quoted=false }
    const current = result.at(-1)!
    if (join && !quoted) { current.text += ' '; current.positions.push({line:row+1,column:1}) }
    const start = leading ? first+1 : 0
    let end = original.length
    let quote: boolean = quoted
    const outside = new Set<number>()
    for (let index=start;index<original.length;index++) {
      if (original[index] === "'") {
        if (quote && original[index+1] === "'") { index++; continue }
        quote = !quote
      } else if (!quote) {
        if (original[index] === '!') { end=index; break }
        if (original[index] === '&') outside.add(index)
      }
    }
    let last=end-1
    while(last>=start && /\s/u.test(original[last]))last--
    trailing = outside.has(last) || quote && original[last] === '&'
    if (trailing) end=last
    for(let index=start;index<end;index++) { current.text+=original[index];current.positions.push({line:row+1,column:index+1}) }
    current.end={line:row+1,column:original.length+1}
    quoted=quote
    if (trailing && row===rows.length-1) throw new GlossaError(row+1,'Το & απαιτεί επόμενη γραμμή συνέχειας.')
  }
  if(trailing)throw new GlossaError(rows.length,'Το & απαιτεί επόμενη γραμμή συνέχειας.')
  return result
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  const lines=logicalLines(source)
  for (const logical of lines) {
    const line=logical.text
    let index=0
    while(index<line.length) {
      const char=line[index]
      if(/\s/u.test(char)){index++;continue}
      const position=logical.positions[index]
      if(char==='!')break
      if(char==="'") {
        let value='',closed=false
        index++
        while(index<line.length){
          if(line[index]==="'"){
            if(line[index+1]==="'"){value+="'";index+=2;continue}
            index++;closed=true;break
          }
          value+=line[index++]
        }
        if(!closed)throw new GlossaError(position.line,'Το αλφαριθμητικό δεν κλείνει με απόστροφο.')
        tokens.push({kind:'string',text:value,...position});continue
      }
      const number=/^(?:\d+(?:\.\d+)?)/u.exec(line.slice(index))
      if(number){tokens.push({kind:'number',text:number[0],...position});index+=number[0].length;continue}
      const word=/^[\p{L}_][\p{L}\p{N}_]*/u.exec(line.slice(index))
      if(word){tokens.push({kind:'word',text:word[0],...position});index+=word[0].length;continue}
      const pair=line.slice(index,index+2)
      if(['<-','<=','>=','<>','..'].includes(pair)){tokens.push({kind:'symbol',text:pair,...position});index+=2;continue}
      if('+-*/^=<>:,()[]'.includes(char)){tokens.push({kind:'symbol',text:char,...position});index++;continue}
      throw new GlossaError(position.line,'Μη αναγνωρισμένο σύμβολο «'+char+'» στη στήλη '+position.column+'.')
    }
    tokens.push({kind:'newline',text:'\n',...logical.end})
  }
  tokens.push({kind:'eof',text:'',...lines.at(-1)!.end})
  return tokens
}
