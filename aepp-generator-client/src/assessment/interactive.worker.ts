import { parseProgram } from '../interpreter/parser'
import { Interpreter, parseInput } from '../interpreter/runtime'
import type { ExecutionEvent, Value } from '../interpreter/types'

let iterator: Generator<ExecutionEvent, void, Value> | undefined
let pending: Extract<ExecutionEvent, { kind: 'input' }> | undefined
let events = 0
let outputCount = 0
function pump(value?: Value) {
  try {
    let next = iterator!.next(value!)
    while (!next.done) {
      if (++events > 120000) throw Error('Ξεπεράστηκε το όριο βημάτων εκτέλεσης.')
      const event = next.value
      if (event.kind === 'input') {
        pending = event
        self.postMessage({ kind: 'input', name: event.name, line: event.line, output: event.output })
        return
      }
      if (event.kind === 'done' || event.output.length !== outputCount) {
        outputCount = event.output.length
        self.postMessage({ kind: event.kind === 'done' ? 'done' : 'output', output: event.output })
      }
      if (event.kind === 'done') {
        iterator = undefined
        return
      }
      next = iterator!.next()
    }
    self.postMessage({ kind: 'done' })
    iterator = undefined
  } catch (cause) {
    self.postMessage({ kind: 'error', error: cause instanceof Error ? cause.message : 'Αποτυχία εκτέλεσης.' })
    iterator = undefined
  }
}
self.onmessage = (event: MessageEvent<{ action: 'start'; source: string } | { action: 'input'; value: string }>) => {
  if (event.data.action === 'start') {
    try {
      iterator = new Interpreter(parseProgram(event.data.source)).execute()
      events = 0
      outputCount = 0
      pending = undefined
      pump()
    } catch (cause) {
      self.postMessage({ kind: 'error', error: cause instanceof Error ? cause.message : 'Αποτυχία εκτέλεσης.' })
    }
  } else if (pending && iterator) {
    let value: Value
    try {
      value = parseInput(event.data.value, pending.type, pending.line)
    } catch (cause) {
      self.postMessage({ kind: 'invalid', error: cause instanceof Error ? cause.message : 'Μη έγκυρη τιμή.' })
      return
    }
    pending = undefined
    pump(value)
  }
}
