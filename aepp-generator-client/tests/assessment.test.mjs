import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
after(() => server.close())
const { practiceExam: publicPracticeExam, validateAssessmentExam } = await server.ssrLoadModule('/src/assessment/practiceExam.ts')
const { executeSource, runTestCases } = await server.ssrLoadModule('/src/assessment/execution.ts')
const { findCounterExample } = await server.ssrLoadModule('/src/assessment/counterExampleEngine.ts')
const { DebugInputBuffer } = await server.ssrLoadModule('/src/interpreter/inputBuffer.ts')
const { applyTeacherScore, gradeAssessment, evaluateCodeSubmission } = await server.ssrLoadModule('/src/assessment/grading.ts')
const { generatedToAssessment } = await server.ssrLoadModule('/src/assessment/generatedAdapter.ts')
const { readAssessmentDraft, draftKey } = await server.ssrLoadModule('/src/assessment/drafts.ts')
const { AssessmentExamSchema, AnswerSheetSchema, AssessmentReportSchema, AttemptDetailSchema } = await server.ssrLoadModule('/src/assessment/schemas.ts')
const { default: AssessmentReportView } = await server.ssrLoadModule('/src/components/assessment/AssessmentReportView.tsx')
const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const privateExamJson = JSON.parse(await readFile(new URL('../src/assessment/practice-exam.json', import.meta.url), 'utf8'))
const practiceExam = AssessmentExamSchema.parse(privateExamJson)
const { GeneratedExamSchema, SavedExamEntriesSchema } = await server.ssrLoadModule('/src/assessment/examSchemas.ts')
const programC = practiceExam.sections[2].questions[0]
const programD = practiceExam.sections[3].questions[0]

test('το public client fallback δεν περιέχει answer keys, reference code ή κρυφά test cases', () => {
  const questions = publicPracticeExam.sections.flatMap(section => section.questions)
  assert.ok(questions.every(question => question.solution === ''))
  for (const question of questions.filter(question => question.kind === 'program')) {
    assert.equal(question.referenceCode, '')
    assert.deepEqual(question.testCases, [])
  }
  assert.equal(JSON.stringify(publicPracticeExam).includes('expectedOutput'), false)
})

test('η αναφορά κρύβει τις ενδεικτικές απαντήσεις μέχρι το αίτημα αποκάλυψης', async () => {
  const report = await gradeAssessment(practiceExam, {}, async () => [])
  const html = renderToStaticMarkup(React.createElement(AssessmentReportView, {
    exam: practiceExam, report, insight: null, insightLoading: false, insightError: '', aiAvailable: false,
    onRetry() {}, onRetryInsight() {}, onOpenDebugger() {}, onGrade: async () => {}, onRefresh: async () => {},
    attempt: { attemptId: 'attempt', examId: practiceExam.id, examTitle: practiceExam.title, studentName: 'Μαθητής', startedAt: '', submittedAt: '', autoGradeScore: 0, finalScore: 0, status: 'SUBMITTED', version: 1, exam: practiceExam, report, questionSubmissions: [], gradeRevisions: [] },
  }))
  assert.match(html, /Προβολή ενδεικτικής λύσης/u)
  assert.doesNotMatch(html, /Η ουρά λειτουργεί με σειρά άφιξης/u)
})

test('το διαγώνισμα έχει 25 μόρια ανά θέμα και ο πίνακας καταλήγει στην ΕΞΟΔΟΣ', () => {
  assert.doesNotThrow(() => validateAssessmentExam(practiceExam))
  assert.deepEqual(practiceExam.sections.map(section => section.marks), [25, 25, 25, 25])
  assert.equal(practiceExam.sections[1].questions[1].columns.at(-1), 'ΕΞΟΔΟΣ')
})

test('η ενδεικτική λύση του Γ περνά τέσσερις δοκιμές, συμπεριλαμβανομένων μηδενικών και άκυρης εισόδου', () => {
  const results = runTestCases(programC.referenceCode, programC.testCases)
  assert.equal(results.length, 4)
  assert.ok(results.every(result => result.passed), JSON.stringify(results))
})

test('η ενδεικτική λύση του Δ περνά τις δοκιμές πινάκων και συνάρτησης', () => {
  const results = runTestCases(programD.referenceCode, programD.testCases)
  assert.equal(results.length, 3)
  assert.ok(results.every(result => result.passed), JSON.stringify(results))
})

test('η αυτόματη βαθμολόγηση δίνει αναλυτικά μόρια και στο Δ', async () => {
  const answers = {
    a1: Object.fromEntries(practiceExam.sections[0].questions[0].statements.map(item => [item.id, item.answer ? 'Σωστό' : 'Λάθος'])),
    a2: Object.fromEntries(practiceExam.sections[0].questions[1].pairs.map(item => [item.id, item.rightId])),
    a3: practiceExam.sections[0].questions[2].correctId,
    a4: 'καλεσε',
    b1: Object.fromEntries(practiceExam.sections[1].questions[0].blanks.map(item => [item.id, item.accepted[0]])),
    b2: practiceExam.sections[1].questions[1].expected,
    c1: programC.referenceCode,
    d1: practiceExam.sections[3].questions[0].referenceCode,
  }
  const report = await gradeAssessment(practiceExam, answers, async (source, cases) => runTestCases(source, cases))
  assert.equal(report.earned, 100, JSON.stringify(report.sections.slice(2)))
  assert.equal(report.pending, 0)
  assert.equal(report.grade20, 20)
  assert.deepEqual(report.sections.map(section => section.earned), [25, 25, 25, 25])
  assert.equal(report.sections[2].questions[0].programCases.length, 4)
  assert.equal(report.sections[3].questions[0].programCases.length, 3)
  assert.throws(() => applyTeacherScore(report, 'd1', 30), /έγκυρο βαθμό/u)
})

test('λανθασμένες τιμές και κώδικας δεν λαμβάνουν πλήρη βαθμό', async () => {
  const report = await gradeAssessment(practiceExam, { a1: { 'a1-1': 'Λάθος' }, c1: 'ΠΡΟΓΡΑΜΜΑ Λ\nΑΡΧΗ' },
    async (source, cases) => runTestCases(source, cases))
  assert.ok(report.sections[0].questions[0].earned < 10)
  assert.equal(report.sections[2].questions[0].earned, 0)
  assert.equal(report.pending, 0)
})

test('η μερική βαθμολογία μοιράζεται σωστά σε προτάσεις, κενά και κελιά', async () => {
  const trace = practiceExam.sections[1].questions[1].expected.map(row => [...row])
  trace[1][4] = 'λάθος'
  const report = await gradeAssessment(practiceExam, {
    a1: { 'a1-1': 'Σωστό', 'a1-2': 'Λάθος', 'a1-3': 'Σωστό', 'a1-4': 'Σωστό', 'a1-5': 'Σωστό' },
    b1: { '1': '0', '2': '1', '3': 'ΤΟΤΕ', '4': '-', '5': 'ΓΡΑΨΕ' },
    b2: trace,
  }, async (source, cases) => runTestCases(source, cases))
  assert.equal(report.sections[0].questions[0].earned, 8)
  assert.equal(report.sections[1].questions[0].earned, 12)
  assert.equal(report.sections[1].questions[1].earned, 9)
})

test('παραγόμενο διαγώνισμα χωρίς δομημένο κλειδί παραμένει για έλεγχο καθηγητή', async () => {
  const generated = generatedToAssessment({ title: 'Δείγμα', durationMinutes: 180, sections: [
    { theme: 'Θέμα Α', totalMarks: 50, questions: [{ code: 'Α1', questionText: 'Ερώτηση', glowCodeSnippet: null, solutionText: 'Λύση', marks: 50 }] },
    { theme: 'Θέμα Γ', totalMarks: 50, questions: [{ code: 'Γ1', questionText: 'Πρόγραμμα', glowCodeSnippet: null, solutionText: 'Λύση', marks: 50 }] },
  ] })
  const report = await gradeAssessment(generated, { 'Θέμα Α-Α1': 'Απάντηση', 'Θέμα Γ-Γ1': 'Κώδικας' }, async () => { throw new Error('Δεν πρέπει να εκτελεστεί') })
  assert.equal(report.earned, 0)
  assert.equal(report.pending, 100)
})

const whileProcedure = 'ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΚΑΛΕΣΕ Μετρηση(Χ)\nΓΡΑΨΕ Χ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\nΔΙΑΔΙΚΑΣΙΑ Μετρηση(Ν)\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Ν\nΑΡΧΗ\nΟΣΟ Ν < 3 ΕΠΑΝΑΛΑΒΕ\nΝ <- Ν + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΔΙΑΔΙΚΑΣΙΑΣ'
const custom = (rubric, cases = [0,1,2].map((value,index)=>({id:'t'+index,inputs:[String(value)],expectedOutput:['3']}))) => ({ ...programC, testCases:cases, rubric })
const run = async(source,cases)=>runTestCases(source,cases)
test('ΟΣΟ μέσα σε καλούμενη διαδικασία και σωστές παράμετροι πιστώνονται', async()=>{
 const q=custom([{kind:'while',points:1,subprogram:'Μετρηση'},{kind:'subprogramParameters',points:1,subprogram:'Μετρηση',parameters:[{name:'Ν',type:'integer'}]}])
 const result=await evaluateCodeSubmission(q,whileProcedure,run)
 assert.equal(result.earned,25,result.feedback)
 const wrong=await evaluateCodeSubmission({...q,rubric:[{kind:'subprogramParameters',points:1,parameters:[{type:'real'}]}]},whileProcedure,run)
 assert.equal(wrong.earned,15)
})
test('μη καλούμενη διαδικασία δεν δίνει δομικά μόρια',async()=>{
 const source=whileProcedure.replace('ΚΑΛΕΣΕ Μετρηση(Χ)','Χ <- 3')
 const result=await evaluateCodeSubmission(custom([{kind:'while',points:1}]),source,run)
 assert.equal(result.earned,15,result.feedback)
})
test('νεκρό branch, βρόχος μηδενικών επαναλήψεων και σχόλια δεν πιστώνονται',async()=>{
 for(const fragment of ['ΑΝ ΨΕΥΔΗΣ ΤΟΤΕ\nΟΣΟ Χ < 3 ΕΠΑΝΑΛΑΒΕ\nΧ <- Χ + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΑΝ','ΟΣΟ ΨΕΥΔΗΣ ΕΠΑΝΑΛΑΒΕ\nΧ <- Χ + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ','! ΟΣΟ Χ < 3 ΕΠΑΝΑΛΑΒΕ']){
  const source=whileProcedure.slice(0,whileProcedure.indexOf('ΔΙΑΔΙΚΑΣΙΑ')).replace('ΚΑΛΕΣΕ Μετρηση(Χ)',fragment+'\nΧ <- 3')
  assert.equal((await evaluateCodeSubmission(custom([{kind:'while',points:1}]),source,run)).earned,15)
 }
})
test('εκτελεσμένος άσχετος βρόχος χωρίς επίδραση στην έξοδο δεν πιστώνεται',async()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ, Ι, ΑΧΡΗΣΤΟ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΑΧΡΗΣΤΟ <- 0\nΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 3\nΑΧΡΗΣΤΟ <- ΑΧΡΗΣΤΟ + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΧ <- 3\nΓΡΑΨΕ Χ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 assert.equal((await evaluateCodeSubmission(custom([{kind:'for',points:1}]),source,run)).earned,15)
})
test('60% λειτουργικότητας και 40% δομής με σχετική στάθμιση rubric',async()=>{
 const q=custom([{kind:'while',points:1}], [{id:'a',inputs:['0'],expectedOutput:['3']},{id:'b',inputs:['1'],expectedOutput:['4']},{id:'c',inputs:['2'],expectedOutput:['3']}])
 assert.equal((await evaluateCodeSubmission(q,whileProcedure,run)).earned,20)
})
test('αλλοιωμένα και διπλά αποτελέσματα Worker απορρίπτονται',async()=>{
 for(const values of [[{id:'t0',passed:'yes',actual:[]}],[{id:'t0',passed:true,actual:[]},{id:'t0',passed:true,actual:[]}]]){
  assert.equal((await evaluateCodeSubmission(custom([{kind:'while',points:1}]),whileProcedure,async()=>values)).earned,0)
 }
})
test('corrupted LocalStorage καθαρίζεται χωρίς εξαίρεση και χωρίς διαγραφή άλλων drafts',()=>{
 for(const raw of ['{bad',JSON.stringify({c1:42}),JSON.stringify({b2:[['x']]}),JSON.stringify({unknown:'x'})]){
  const values=new Map([[draftKey(practiceExam.id,'student'),raw],['other','keep']])
  const storage={getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key)}
  assert.deepEqual(readAssessmentDraft(practiceExam,'student',storage),{})
  assert.equal(values.has(draftKey(practiceExam.id,'student')),false)
  assert.equal(values.get('other'),'keep')
 }
})
test('έγκυρο draft διατηρείται και αποκλεισμένο storage δεν προκαλεί crash',()=>{
 const answer={c1:'ΓΡΑΨΕ 1',b2:practiceExam.sections[1].questions[1].expected}
 assert.deepEqual(readAssessmentDraft(practiceExam,'student',{getItem:()=>JSON.stringify(answer),removeItem:()=>assert.fail('valid')}),answer)
 assert.deepEqual(readAssessmentDraft(practiceExam,'student',{getItem:()=>{throw Error('blocked')},removeItem:()=>{throw Error('blocked')}}),{})
})
test('schemas απορρίπτουν μη πεπερασμένους βαθμούς, λάθος discriminants και ασυνεπείς αναφορές',()=>{
 assert.equal(AnswerSheetSchema.safeParse({c1:123}).success,false)
 const bad=structuredClone(practiceExam);bad.sections[0].questions[0].kind='invalid'
 assert.equal(AssessmentExamSchema.safeParse(bad).success,false)
 assert.equal(AssessmentReportSchema.safeParse({earned:NaN}).success,false)
})

test('βρόχος και άθροιση μέσα σε συνάρτηση που επηρεάζει έξοδο',async()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΓΡΑΨΕ Υπολογισμος(Χ)\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ\nΣΥΝΑΡΤΗΣΗ Υπολογισμος(Ν): ΑΚΕΡΑΙΑ\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Ν, Ι, Σ\nΑΡΧΗ\nΙ <- 0\nΣ <- 0\nΟΣΟ Ι < Ν ΕΠΑΝΑΛΑΒΕ\nΣ <- Σ + 1\nΙ <- Ι + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΥπολογισμος <- Σ\nΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ'
 const q=custom([{kind:'while',points:1},{kind:'accumulation',points:1,variableName:'Σ'},{kind:'accumulation',points:1,variableName:'Ι'},{kind:'functionCall',points:1}], [1,2,3].map((value,index)=>({id:'t'+index,inputs:[String(value)],expectedOutput:[String(value)]})))
 assert.equal((await evaluateCodeSubmission(q,source,run)).earned,25)
})
test('πρόσβαση και ενημέρωση πίνακα πιστώνονται όταν επηρεάζουν την έξοδο',async()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Α[2]\nΑΡΧΗ\nΔΙΑΒΑΣΕ Α[1]\nΑ[2] <- Α[1] + 1\nΓΡΑΨΕ Α[2]\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 const q=custom([{kind:'arrayAccess',points:1,arrayName:'Α'},{kind:'arrayWrite',points:1,arrayName:'Α'}],[0,1,2].map((value,index)=>({id:'t'+index,inputs:[String(value)],expectedOutput:[String(value+1)]})))
 assert.equal((await evaluateCodeSubmission(q,source,run)).earned,25)
})
test('API αναφορά με άγνωστο ερώτημα απορρίπτεται πριν το render',async()=>{
 const report=await gradeAssessment(practiceExam,{},async()=>[])
 const detail={attemptId:'00000000-0000-4000-8000-000000000001',examId:practiceExam.id,examTitle:practiceExam.title,studentName:'Μαθητής',startedAt:'2026-10-11T10:00:00Z',submittedAt:'2026-10-11T10:10:00Z',autoGradeScore:report.earned,finalScore:report.earned,status:'SUBMITTED',version:0,exam:practiceExam,report,questionSubmissions:[],gradeRevisions:[]}
 assert.equal(AttemptDetailSchema.safeParse(detail).success,true)
 detail.report.sections[0].questions[0].questionId='unknown'
 assert.equal(AttemptDetailSchema.safeParse(detail).success,false)
})

test('αλλοιωμένα αποθηκευμένα διαγωνίσματα και λίστες API απορρίπτονται',()=>{
 assert.equal(GeneratedExamSchema.safeParse({title:'x',durationMinutes:180,sections:[{theme:'Θέμα Γ',totalMarks:25,questions:'corrupted'}]}).success,false)
 assert.equal(SavedExamEntriesSchema.safeParse([{id:'1',title:'x',format:'invalid',createdAt:'yesterday'}]).success,false)
})

test('ο fuzzer βρίσκει και ελαχιστοποιεί το λάθος MAX <- 0 σε πίνακα αρνητικών',()=>{
 const correct='ΠΡΟΓΡΑΜΜΑ Μεγιστο\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Ν, Ι, Α[3], MAX\nΑΡΧΗ\nΔΙΑΒΑΣΕ Ν\nΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ Ν\nΔΙΑΒΑΣΕ Α[Ι]\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nMAX <- Α[1]\nΓΙΑ Ι ΑΠΟ 2 ΜΕΧΡΙ Ν\nΑΝ Α[Ι] > MAX ΤΟΤΕ\nMAX <- Α[Ι]\nΤΕΛΟΣ_ΑΝ\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ MAX\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 const faulty=correct.replace('MAX <- Α[1]','MAX <- 0')
 const report=findCounterExample(faulty,correct,[{id:'seed',inputs:['3','1','2','3'],expectedOutput:['3']}])
 assert.ok(report.testedCases > 0)
 assert.ok(report.counterExample)
 assert.ok(report.counterExample.inputs.length < 4)
 assert.match(report.counterExample.studentError ?? report.counterExample.actualOutput.join(' '),/0/u)
 assert.match(report.counterExample.inputDescription,/Α/u)
})

test('το κουμπί debugger διατηρεί με τη σειρά τις τιμές του αντιπαραδείγματος στο input buffer',()=>{
 const inputs=['3','-10','-4','-1']
 const buffer=new DebugInputBuffer()
 buffer.load(inputs)
 assert.equal(buffer.peek(),'3')
 buffer.consume()
 assert.equal(buffer.peek(),'-10')
 buffer.consume()
 assert.equal(buffer.peek(),'-4')
 buffer.consume()
 assert.equal(buffer.peek(),'-1')
 buffer.consume()
 assert.equal(buffer.peek(),undefined)
})

test('ο διερμηνευτής καταγράφει συγκρίσεις, εκχωρήσεις και επαναλήψεις',()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Μετρησεις\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Ι, Α\nΑΡΧΗ\nΑ <- 0\nΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2\nΑ <- Α + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΓΡΑΨΕ Α\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 const execution=executeSource(source,[])
 assert.deepEqual(execution.metrics,{comparisonsCount:3,assignmentsCount:6,loopIterations:2})
 assert.deepEqual(runTestCases(source,[{id:'metrics',inputs:[],expectedOutput:['2']}])[0].metrics,execution.metrics)
})

test('η ΕΠΙΛΕΞΕ συμμετέχει στη δομική βαθμολόγηση και στον Worker',async()=>{
 const source='ΠΡΟΓΡΑΜΜΑ Δοκιμη\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΕΠΙΛΕΞΕ Χ\nΠΕΡΙΠΤΩΣΗ 0..2\nΧ <- 3\nΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\nΧ <- 4\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ\nΓΡΑΨΕ Χ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
 assert.equal((await evaluateCodeSubmission(custom([{kind:'select',points:1}]),source,run)).earned,25)
})
