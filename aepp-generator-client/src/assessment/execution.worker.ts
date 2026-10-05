import { executeSource, runTestCases } from './execution'
import type { ProgramTestCase } from './model'

type Request = { id: number; action: 'preview'; source: string; inputs: string[] }
  | { id: number; action: 'cases'; source: string; cases: ProgramTestCase[] }

self.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data
  const result = request.action === 'preview'
    ? executeSource(request.source, request.inputs)
    : runTestCases(request.source, request.cases)
  self.postMessage({ id: request.id, result })
}
