import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
const server=await createServer({cacheDir:'.tmp/lobby-test-cache',server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const {remainingExamSeconds,formatExamTime,examOverview}=await server.ssrLoadModule('/src/assessment/examLobby.ts')
const {getMockExam}=await server.ssrLoadModule('/src/assessment/mockExamBank.ts')
test('countdown derives from original attempt start and clamps expiry',()=>{
 const start='2026-10-17T10:00:00Z',at=Date.parse(start)
 assert.equal(remainingExamSeconds(start,180,at),10800)
 assert.equal(remainingExamSeconds(start,180,at+61000),10739)
 assert.equal(remainingExamSeconds(start,180,at+10800001),0)
 assert.equal(formatExamTime(10739),'02:58:59')
})
test('lobby metadata uses actual exam marks and unique curriculum',async()=>{
 const exam=await getMockExam(),info=examOverview(exam)
 assert.equal(info.marks,100)
 assert.deepEqual(info.topics,[...new Set(exam.sections.flatMap(s=>s.questions.map(q=>q.chapter)))])
})
