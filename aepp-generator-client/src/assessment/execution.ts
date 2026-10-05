import { parseProgram } from '../interpreter/parser'
import { Interpreter, parseInput } from '../interpreter/runtime'
import type { ProgramTestCase } from './model'

export interface ExecutionResult { output: string[]; inputsUsed: number; error?: string }
const MAX_EVENTS = 120_000

/** Εκτελείται σε Web Worker στη διεπαφή, ώστε ένας βρόχος να μην παγώνει τον επεξεργαστή. */
export function executeSource(source: string, inputs: string[]): ExecutionResult {
  let used = 0
  try {
    const iterator = new Interpreter(parseProgram(source)).execute()
    let next = iterator.next()
    let events = 0
    while (!next.done) {
      if (++events > MAX_EVENTS) return { output: [], inputsUsed: used, error: 'Ξεπεράστηκε το όριο βημάτων εκτέλεσης.' }
      const event = next.value
      if (event.kind === 'input') {
        if (used >= inputs.length) return { output: event.output, inputsUsed: used, error: `Λείπει τιμή εισόδου για τη μεταβλητή ${event.name}.` }
        const value = parseInput(inputs[used++], event.type, event.line)
        next = iterator.next(value)
      } else if (event.kind === 'done') return { output: event.output, inputsUsed: used }
      else next = iterator.next()
    }
    return { output: [], inputsUsed: used }
  } catch (cause) {
    return { output: [], inputsUsed: used, error: cause instanceof Error ? cause.message : 'Άγνωστο σφάλμα εκτέλεσης.' }
  }
}

const comparable = (text: string) => text.trim().replace(/\s+/gu, ' ')
export function runTestCases(source: string, cases: ProgramTestCase[]) {
  return cases.map(test => {
    const result = executeSource(source, test.inputs)
    const passed = !result.error && result.inputsUsed === test.inputs.length &&
      result.output.length === test.expectedOutput.length &&
      result.output.every((line, index) => comparable(line) === comparable(test.expectedOutput[index]))
    return {
      id: test.id, passed, actual: result.output,
      error: result.error ?? (result.inputsUsed !== test.inputs.length ? 'Το πρόγραμμα δεν κατανάλωσε όλα τα δεδομένα εισόδου.' : undefined),
    }
  })
}
