import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {readFile} from 'node:fs/promises'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const {apiClient}=await server.ssrLoadModule('/src/api/client.ts')
const {loadPracticeExam}=await server.ssrLoadModule('/src/api/assessmentLoader.ts')
const {getMockExam}=await server.ssrLoadModule('/src/assessment/mockExamBank.ts')
const {prepareAssessment}=await server.ssrLoadModule('/src/assessment/assessmentFlow.ts')
const {buildAttemptSubmission}=await server.ssrLoadModule('/src/assessment/attempts.ts')
const {runTestCases}=await server.ssrLoadModule('/src/assessment/execution.ts')
test('API failure and guests receive a complete usable fallback',async()=>{
 apiClient.defaults.adapter=async()=>{throw Error('offline')}
 for(const authenticated of [true,false]){
  const result=await loadPracticeExam(authenticated)
  assert.equal(result.local,true)
  assert.equal(result.exam.sections.length,4)
  assert.equal(result.exam.sections.reduce((sum,s)=>sum+s.marks,0),100)
  assert.deepEqual(result.exam.sections.slice(2).map(s=>s.questions[0].gradingMode),['review','review'])
 }
})
test('aborted loading never silently replaces an active exam with fallback',async()=>{
 const controller=new AbortController();controller.abort()
 await assert.rejects(()=>loadPracticeExam(true,controller.signal))
})
test('offline practice honestly leaves code points ungraded without private tests',async()=>{
 const exam=await getMockExam(),answers={};const seen=[]
 for(const section of exam.sections)for(const q of section.questions)if(q.kind==='program')answers[q.id]=q.referenceCode
 const report=await prepareAssessment(exam,answers,async(source,cases)=>{seen.push(cases.length);return runTestCases(source,cases)},true)
 assert.equal(seen.length,0)
 assert.equal(report.earned,0)
 assert.equal(report.pending,58)
 const payload=buildAttemptSubmission(crypto.randomUUID(),exam,answers,report)
 assert.ok(payload.questions.filter(q=>q.questionId==='c1'||q.questionId==='d1').every(q=>q.autoPoints===0))
 assert.deepEqual(report.sections.slice(2).map(s=>s.earned),[0,0])
})
test('online public cases run in Worker adapter and remain provisional until API grades',async()=>{
 const bank=JSON.parse(await readFile('../AeppGenerator/src/AeppGenerator.Api/Assessment/exam-bank.json','utf8'));const exam=structuredClone(bank[0]);let runs=0
 for(const s of exam.sections)for(const q of s.questions)if(q.kind==='program'){q.previewCases=q.testCases.slice(0,1);q.testCases=[];q.gradingMode='review';q.referenceCode=''}
 const report=await prepareAssessment(exam,{},async(source,cases)=>{runs++;return runTestCases(source,cases)},false)
 assert.equal(runs,2)
 assert.equal(report.pending,58)
 assert.equal(report.earned,0)
})
