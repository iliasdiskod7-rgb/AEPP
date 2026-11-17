import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { practiceExam } = await server.ssrLoadModule('/src/assessment/practiceExam.ts')
const { gradeAssessment } = await server.ssrLoadModule('/src/assessment/grading.ts')
const { buildAttemptSubmission } = await server.ssrLoadModule('/src/assessment/attempts.ts')
const calls = await server.ssrLoadModule('/src/api/attempts.ts')
const { apiClient } = await server.ssrLoadModule('/src/api/client.ts')
const report = await gradeAssessment(practiceExam, {}, async () => [])
test('complete submission preserves raw answers and test results without identity overposting', () => {
 const payload = buildAttemptSubmission('attempt-id', practiceExam, { a1: { one: 'Σωστό' }, c1: 'ΓΡΑΨΕ 1' }, report)
 assert.equal(payload.questions.length, practiceExam.sections.flatMap(section => section.questions).length)
 assert.deepEqual(JSON.parse(payload.questions.find(question => question.questionId === 'a1').studentAnswerJson), { one: 'Σωστό' })
 assert.equal(JSON.parse(payload.questions.find(question => question.questionId === 'c1').studentAnswerJson), 'ΓΡΑΨΕ 1')
 assert.equal('userId' in payload, false)
 assert.ok(payload.questions.every(question => question.maxPoints > 0 && Array.isArray(JSON.parse(question.testResultsJson))))
})
test('missing question grade cannot produce incomplete submission', () => {
 assert.throws(() => buildAttemptSubmission('id', practiceExam, {}, { ...report, sections: [] }))
})
test('API requests expose only personal attempt routes', async () => {
 const seen = []
 const detail = { attemptId:'00000000-0000-4000-8000-000000000001',examId:practiceExam.id,examTitle:practiceExam.title,studentName:'Μαθητής',startedAt:'2026-10-11T10:00:00Z',submittedAt:null,autoGradeScore:0,finalScore:0,status:'IN_PROGRESS',version:0,exam:practiceExam,report:null,questionSubmissions:[],gradeRevisions:[] }
 apiClient.defaults.adapter = async config => { seen.push(config); const data = config.url === '/exams/random' ? { examId: practiceExam.id, title: practiceExam.title, exam: practiceExam, hiddenTestCases: 7 } : config.method==='get' ? {items:[],total:0,page:config.params.page,pageSize:20} : detail; return { data, status: 200, statusText: 'OK', headers: {}, config } }
 const random = await calls.getRandomPracticeExam()
 assert.equal(random.exam.sections.length, 4)
 await calls.startExamAttempt('id', practiceExam.id)
 await calls.submitExamAttempt(buildAttemptSubmission('id', practiceExam, {}, report))
 await calls.getAttemptHistory(2)
 assert.deepEqual(seen.map(config => config.url), ['/exams/random', '/exams/attempts/start', '/exams/attempts/submit', '/exams/attempts/my-history'])
 assert.equal('gradeExamAttempt' in calls, false)
})
test('friendly conflict and login errors', () => {
 assert.equal(calls.attemptError({ response: { status: 409, data: { message: 'Νεότερη αξιολόγηση' } } }), 'Νεότερη αξιολόγηση')
 assert.match(calls.attemptError({ response: { status: 401 } }), /Συνδέσου/)
})
test('retired teacher form grants no capabilities to any account', async () => {
 const React = await import('react')
 const { renderToStaticMarkup } = await import('react-dom/server')
 const { AuthContext } = await server.ssrLoadModule('/src/auth/AuthContext.tsx')
 const { default: Panel } = await server.ssrLoadModule('/src/components/assessment/TeacherGradePanel.tsx')
 const attempt = { attemptId: 'id', version: 1, finalScore: 0, status: 'SUBMITTED', studentName: 'Μαθητής' }
 const render = (role, status = 'SUBMITTED') => renderToStaticMarkup(React.createElement(AuthContext.Provider, { value: { user: role ? { role } : null } }, React.createElement(Panel, { attempt: { ...attempt, status }, onGrade: async () => {}, onRefresh: async () => {} })))
 assert.equal(render(null), '')
 assert.equal(render('STUDENT'), '')
 assert.equal(render('TEACHER', 'IN_PROGRESS'), '')
 assert.equal(render('TEACHER'), '')
})

test('API response validation απορρίπτει ελλιπή attempts χωρίς assertion',async()=>{
 apiClient.defaults.adapter=async config=>({data:{attemptId:'id'},status:200,statusText:'OK',headers:{},config})
 await assert.rejects(()=>calls.getExamAttempt('id'),/δεδομένα αξιολόγησης/)
})
