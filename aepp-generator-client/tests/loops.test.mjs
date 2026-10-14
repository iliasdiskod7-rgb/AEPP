import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const {transformLoop,listLoops}=await server.ssrLoadModule('/src/tools/loopTransformer.ts')
const {runLoopSource,runsMatch}=await server.ssrLoadModule('/src/tools/loopExecution.ts')
const {parseProgram}=await server.ssrLoadModule('/src/interpreter/parser.ts')
const {loopExample}=await server.ssrLoadModule('/src/tools/LoopLab.tsx')
const convert=(source,target='while',guard=true,index=0)=>transformLoop(source,listLoops(parseProgram(source))[index].nodeId,target,guard)
const code=body=>`ΠΡΟΓΡΑΜΜΑ Τεστ\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: i, n, s\nΑΡΧΗ\n${body}\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
test('ΓΙΑ 1..10 βήμα 2: πέντε επαναλήψεις και τελικό i=11',()=>{
 const original=runLoopSource(loopExample,[]),result=runLoopSource(convert(loopExample).code,[])
 assert.equal(result.error,undefined);assert.equal(result.variables.find(v=>v.name==='I').value.value,11)
 assert.equal(Object.values(result.iterations).reduce((a,b)=>a+b,0),5);assert.ok(runsMatch(original,result))
})
test('αρνητικό βήμα και ΓΙΑ σε ΜΕΧΡΙΣ_ΟΤΟΥ',()=>{
 const source=code('s <- 0\nΓΙΑ i ΑΠΟ 10 ΜΕΧΡΙ 1 ΜΕ ΒΗΜΑ -2\ns <- s + i\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ i, s')
 for(const target of ['while','repeat']) assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source,target).code,[])))
})
test('μηδενικές επαναλήψεις ΓΙΑ προστατεύονται με ΑΝ',()=>{
 const source=code('s <- 0\nΓΙΑ i ΑΠΟ 5 ΜΕΧΡΙ 1\ns <- s+1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ i,s')
 assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source,'repeat').code,[])))
 assert.equal(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source,'repeat',false).code,[])),false)
})
test('ΟΣΟ ΨΕΥΔΗΣ: προειδοποίηση 0 vs 1 και αντιπαράδειγμα',()=>{
 const source=code('s <- 0\nΟΣΟ ΨΕΥΔΗΣ ΕΠΑΝΑΛΑΒΕ\ns <- s+1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ s')
 const unsafe=convert(source,'repeat',false),safe=convert(source,'repeat')
 assert.match(unsafe.warnings.join(' '),/0 φορές/);assert.equal(unsafe.semanticallySafe,false)
 assert.equal(runsMatch(runLoopSource(source,[]),runLoopSource(unsafe.code,[])),false)
 assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(safe.code,[])))
})
test('ΜΕΧΡΙΣ_ΟΤΟΥ σε ΟΣΟ εκτελεί το πρώτο σώμα ακόμη και με αρχικά αληθή συνθήκη',()=>{
 const source=code('s <- 0\nΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\ns <- s+1\nΜΕΧΡΙΣ_ΟΤΟΥ s >= 0\nΓΡΑΨΕ s')
 assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source).code,[])))
})
test('τα όρια της ΓΙΑ υπολογίζονται πριν την εκχώρηση μετρητή και δεν αλλάζουν στο σώμα',()=>{
 const source=code('i <- 4\nn <- 5\ns <- 0\nΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ i\nn <- 1\ns <- s+1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ i,s')
 assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source).code,[])))
 const mutable=source.replace('ΜΕΧΡΙ i','ΜΕΧΡΙ n')
 assert.ok(runsMatch(runLoopSource(mutable,[]),runLoopSource(convert(mutable).code,[])))
})
test('υποπρογράμματα και πίνακες διατηρούνται',()=>{
 const source=`ΠΡΟΓΡΑΜΜΑ Δοκιμή\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: x, A[2]\nΑΡΧΗ\nx <- 0\nΚΑΛΕΣΕ Αύξηση(x)\nA[1] <- x\nΓΡΑΨΕ A[1]\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\nΔΙΑΔΙΚΑΣΙΑ Αύξηση(x)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: x,i\nΑΡΧΗ\nΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 2\nx <- x+1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ`
 assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source).code,[])))
})
test('είσοδοι, έλεγχος ορίων και σφάλματα δεν πιστώνονται ως ισοδυναμία',()=>{
 const source=code('ΔΙΑΒΑΣΕ n\ns <- 0\nΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ n\ns <- s+i\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ s')
 const transformed=convert(source).code
 for(const n of ['-1','0','1','5'])assert.ok(runsMatch(runLoopSource(source,[n]),runLoopSource(transformed,[n])))
 assert.equal(runsMatch(runLoopSource(source,[]),runLoopSource(transformed,[])),false)
 assert.match(runLoopSource(code('ΟΣΟ ΑΛΗΘΗΣ ΕΠΑΝΑΛΑΒΕ\ni <- 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ'),[]).error,/όριο|επαναλήψ/i)
})
test('μεταβλητό βήμα διατηρεί την αρχική τιμή και το πρόσημο',()=>{
 for(const [start,end,step] of [[1,10,2],[10,1,-2]]){
 const source=code(`n <- ${step}\nΓΙΑ i ΑΠΟ ${start} ΜΕΧΡΙ ${end} ΜΕ ΒΗΜΑ n\nn <- 1\nΓΡΑΨΕ i\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ`)
 for(const target of ['while','repeat'])assert.ok(runsMatch(runLoopSource(source,[]),runLoopSource(convert(source,target).code,[])))
 }
 assert.throws(()=>convert(code('ΓΙΑ i ΑΠΟ 1 ΜΕΧΡΙ 10 ΜΕ ΒΗΜΑ 0\nΓΡΑΨΕ i\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ')),/μηδέν/)
})
