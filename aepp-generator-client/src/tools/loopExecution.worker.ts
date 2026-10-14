import { runLoopSource } from './loopExecution'
self.onmessage=(event:MessageEvent<{source:string;inputs:string[]}>)=>self.postMessage(runLoopSource(event.data.source,event.data.inputs))
