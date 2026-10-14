import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const {parseProgram}=await server.ssrLoadModule('/src/interpreter/parser.ts')
const {Interpreter,parseInput}=await server.ssrLoadModule('/src/interpreter/runtime.ts')
const {flowchartFromCode}=await server.ssrLoadModule('/src/whiteboard/flowchart.ts')
const {matchesExecution,centeredPan}=await server.ssrLoadModule('/src/components/whiteboard/liveHighlight.ts')
const {LiveExecutionSession}=await server.ssrLoadModule('/src/interpreter/liveExecution.ts')
const {FlowShape}=await server.ssrLoadModule('/src/components/whiteboard/FlowShape.tsx')
const {default:DynamicTraceTable}=await server.ssrLoadModule('/src/components/whiteboard/DynamicTraceTable.tsx')
const source=body=>'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Ι, Σ, Α[2]\nΑΡΧΗ\n'+body+'\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
const run=(code,inputs=[])=>{
 const program=parseProgram(code), session=new LiveExecutionSession(), observed=[]
 session.start(code,program)
 const iterator=new Interpreter(program,{memory:true,onNodeExecute:event=>observed.push(event)}).execute()
 let next=iterator.next(),at=0
 while(!next.done){session.accept(next.value);next=next.value.kind==='input'?iterator.next(parseInput(inputs[at++],next.value.type,next.value.line)):iterator.next()}
 return {state:session.getSnapshot(),observed,session}
}
test('IDs μοναδικά, σταθερά σε επαναληπτική ανάλυση και ίδιο mapping στο διάγραμμα',()=>{
 const code=source('Ι <- 0\nΟΣΟ Ι < 2 ΕΠΑΝΑΛΑΒΕ\nΙ <- Ι + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')
 const a=parseProgram(code),b=parseProgram(code),ids=[]
 const visit=node=>{if(!node||typeof node!=='object')return;if(node.nodeId)ids.push(node.nodeId);Object.values(node).forEach(visit)}
 visit(a);assert.equal(ids.length,new Set(ids).size);assert.deepEqual(a,b)
 assert.ok(a.body.every(node=>node.nodeId))
 const board=flowchartFromCode(code)
 for(const node of a.body) assert.ok(board.items.some(item=>item.nodeId===node.nodeId))
})
test('κάθε έλεγχος ΟΣΟ φωτίζει τον ίδιο ρόμβο με Αληθής, Αληθής, Ψευδής',()=>{
 const code=source('Ι <- 0\nΟΣΟ Ι < 2 ΕΠΑΝΑΛΑΒΕ\nΙ <- Ι + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')
 const {observed}=run(code),diamond=flowchartFromCode(code).items.find(item=>item.kind==='decision')
 const checks=observed.filter(event=>event.phase==='condition')
 assert.deepEqual(checks.map(event=>event.condition),[true,true,false])
 assert.ok(checks.every(event=>matchesExecution(diamond,event)))
 const markup=renderToStaticMarkup(React.createElement(FlowShape,{item:diamond,selected:false,active:true,onPointerDown(){},onDoubleClick(){}}))
 assert.match(markup,/wb-executing/u);assert.match(markup,/data-node-id/u)
 const pan=centeredPan(diamond,400,300)
 assert.equal(pan.x+200,diamond.x+diamond.width/2);assert.equal(pan.y+150,diamond.y+diamond.height/2)
})
test('στιγμιότυπα μετά τις εκχωρήσεις και έξοδος μόνο στο αντίστοιχο ΓΡΑΨΕ',()=>{
 const {state}=run(source('Ι <- 0\nΣ <- 0\nΟΣΟ Ι < 2 ΕΠΑΝΑΛΑΒΕ\nΣ <- Σ + Ι\nΙ <- Ι + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ Σ'))
 assert.deepEqual(state.rows.filter(row=>row.condition!==undefined).map(row=>[row.values.Ι,row.values.Σ,row.condition]),[['0','0',true],['1','0',true],['2','1',false]])
 assert.equal(state.rows.at(-1).output,'1');assert.ok(state.rows.slice(0,-1).every(row=>row.output===''))
 assert.equal(state.rows[0].values.Ι,'0')
 const html=renderToStaticMarkup(React.createElement(DynamicTraceTable,{state}))
 assert.match(html,/Μεταβλητές παρακολούθησης/u);assert.match(html,/Ψευδής/u);assert.match(html,/Έξοδος/u)
})
test('ΔΙΑΒΑΣΕ δημιουργεί μία γραμμή μετά την είσοδο, reset καθαρίζει το ιστορικό',()=>{
 const {state,observed,session}=run(source('ΔΙΑΒΑΣΕ Α[1]\nΓΡΑΨΕ Α[1]'),['7'])
 assert.equal(state.rows.length,2);assert.equal(state.rows[0].values.Α,'[1]=7')
 assert.ok(observed.some(event=>event.phase==='input'));assert.equal(state.rows[1].output,'7')
 session.reset();assert.equal(session.getSnapshot().rows.length,0)
})
test('ΓΙΑ έχει διακριτά σχήματα και συμβάντα αρχικοποίησης/ελέγχου/αύξησης',()=>{
 const code=source('ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2\nΓΡΑΨΕ Ι\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),{observed}=run(code),board=flowchartFromCode(code)
 for(const event of observed) assert.equal(board.items.filter(item=>item.type==='shape'&&matchesExecution(item,event)).length,1)
 assert.deepEqual(observed.filter(event=>event.phase==='condition').map(event=>event.condition),[true,true,false])
 assert.equal(observed.filter(event=>event.phase==='increment').length,2)
})
test('ΜΕΧΡΙΣ_ΟΤΟΥ κρατά γραμμή συνθήκης, origin και σωστό ρόμβο',()=>{
 const code=source('Ι <- 0\nΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\nΙ <- Ι + 1\nΜΕΧΡΙΣ_ΟΤΟΥ Ι = 2'),{observed}=run(code)
 const checks=observed.filter(event=>event.phase==='condition'),diamond=flowchartFromCode(code).items.find(item=>item.kind==='decision')
 assert.deepEqual(checks.map(event=>event.condition),[false,true]);assert.equal(checks[0].line,8);assert.equal(checks[0].originLine,6)
 assert.ok(checks.every(event=>matchesExecution(diamond,event)))
})
test('ΑΛΛΙΩΣ_ΑΝ και υποπρόγραμμα αντιστοιχίζονται στον δικό τους κόμβο',()=>{
 const code=source('Ι <- 1\nΑΝ Ι = 0 ΤΟΤΕ\nΓΡΑΨΕ 0\nΑΛΛΙΩΣ_ΑΝ Ι = 1 ΤΟΤΕ\nΚΑΛΕΣΕ Αυξηση(Ι)\nΤΕΛΟΣ_ΑΝ\nΓΡΑΨΕ Ι')+'\nΔΙΑΔΙΚΑΣΙΑ Αυξηση(Χ)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΧ <- Χ + 1\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
 const {state,observed}=run(code),board=flowchartFromCode(code)
 assert.deepEqual(observed.filter(event=>event.phase==='condition').map(event=>event.condition),[false,true])
 for(const event of observed) assert.equal(board.items.filter(item=>item.type==='shape'&&matchesExecution(item,event)).length,1)
 assert.ok(state.rows.some(row=>row.scope==='ΑΥΞΗΣΗ'&&row.values.Χ==='2'))
 assert.equal(state.rows.at(-1).values.Ι,'2')
})

test('ΕΠΙΛΕΞΕ: selector, αποτυχημένη περίπτωση και default έχουν ξεχωριστό φωτισμό',()=>{
 const code=source('Ι <- 5\nΕΠΙΛΕΞΕ Ι\nΠΕΡΙΠΤΩΣΗ 1\nΓΡΑΨΕ 1\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 5\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ'),{observed}=run(code),board=flowchartFromCode(code)
 for(const event of observed) assert.equal(board.items.filter(item=>item.type==='shape'&&matchesExecution(item,event)).length,1)
 assert.ok(observed.some(event=>event.phase==='default'))
 const onlyDefault=source('ΕΠΙΛΕΞΕ 5\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΓΡΑΨΕ 5\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ')
 assert.throws(()=>flowchartFromCode(onlyDefault),/τουλάχιστον μία ΠΕΡΙΠΤΩΣΗ/u)
})
