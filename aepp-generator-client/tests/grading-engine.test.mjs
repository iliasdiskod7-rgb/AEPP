import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { correctAnswers, examTemplate, faultySource, reference, functionalReference } from './fixtures/hybrid-grading.mjs'

const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
after(() => server.close())
const {gradeExam, inspectProgramAst, normalizeAnswer, matchesAcceptedAnswer, matchesBooleanAnswer} = await server.ssrLoadModule('/src/assessment/gradingEngine.ts')
const {parseProgram} = await server.ssrLoadModule('/src/interpreter/parser.ts')
const {evaluateCodeSubmission} = await server.ssrLoadModule('/src/assessment/grading.ts')
const {runTestCases} = await server.ssrLoadModule('/src/assessment/execution.ts')
const {ExamGradingResultSchema, AssessmentReportSchema} = await server.ssrLoadModule('/src/assessment/schemas.ts')
const {gradeAssessment} = await server.ssrLoadModule('/src/assessment/grading.ts')

test('πλήρως σωστή λύση και το ς/σ βαθμολογούνται με 100/100', async () => {
  const result = await gradeExam(correctAnswers, examTemplate)
  assert.equal(result.totalScore, 100)
  assert.equal(result.pendingScore, 0)
  assert.deepEqual(Object.values(result.breakdown).map(theme=>theme.score), [20,20,30,30])
  assert.equal(result.breakdown.themeC.structuralScore, '12/12')
  assert.equal(result.breakdown.themeC.testCasesPassed, '4/4')
  assert.equal(ExamGradingResultSchema.safeParse(result).success, true)
})

test('σωστή δομή και 2/4 επιτυχίες αποδίδουν 21/30 με στάθμιση 60/40', async () => {
  const result = await gradeExam({...correctAnswers,c1:faultySource}, examTemplate)
  assert.equal(result.breakdown.themeC.score, 21)
  assert.equal(result.breakdown.themeC.testCasesPassed, '2/4')
  assert.equal(result.breakdown.themeC.structuralScore, '12/12')
  assert.match(result.breakdown.themeC.feedback, /Αρνητικές τιμές/u)
  assert.equal(result.totalScore, 91)
})

test('μεμονωμένο σφάλμα εκτέλεσης δεν σβήνει τα στατικά μόρια', async () => {
  const source = reference.replace('ΓΡΑΨΕ Συνολο(Α)', 'ΓΡΑΨΕ Συνολο(Α) DIV 0')
  const result = await gradeExam({...correctAnswers,c1:source}, examTemplate)
  assert.equal(result.breakdown.themeC.score, 12)
  assert.equal(result.breakdown.themeC.testCasesPassed, '0/4')
  assert.equal(result.breakdown.themeC.structuralScore, '12/12')
})

test('το Β2 συγκρίνει πρότυπο και μαθητή στις ίδιες δύο εισόδους', async () => {
  const answers = {...correctAnswers,b2:functionalReference.replace('Χ * 2', 'Χ + Χ')}
  const template = structuredClone(examTemplate)
  template.sections[1].questions[1].testCases.forEach(test=>test.expectedOutput=['παλιό κλειδί'])
  const result = await gradeExam(answers,template)
  assert.equal(result.breakdown.themeB.score,20)
  assert.equal(result.breakdown.themeB.testCasesPassed,'2/2')
  const wrong = await gradeExam({...answers,b2:functionalReference.replace('Χ * 2','4')},examTemplate)
  assert.equal(wrong.breakdown.themeB.score,15)
  assert.equal(wrong.breakdown.themeB.testCasesPassed,'1/2')
})

test('οι τέσσερις inspectors βασίζονται στον AST και σε καλούμενα υποπρογράμματα', () => {
  const inspection = inspectProgramAst(parseProgram(reference))
  for (const key of ['hasValidDeclarations','hasValidationLoop','hasNestedLoops','hasSubprogramCall']) assert.equal(inspection[key],true,key)
  const empty = parseProgram('ΠΡΟΓΡΑΜΜΑ Κενο\nΑΡΧΗ\n! ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ ΚΑΛΕΣΕ\nΓΡΑΨΕ 1\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')
  const none = inspectProgramAst(empty)
  assert.equal(none.hasValidationLoop,false)
  assert.equal(none.hasNestedLoops,false)
  assert.equal(none.hasSubprogramCall,false)
  const unused = parseProgram(reference.replace('ΓΡΑΨΕ Συνολο(Α)','ΓΡΑΨΕ Α[1,1]'))
  assert.equal(inspectProgramAst(unused).hasSubprogramCall,false)
  const malformed = structuredClone(empty)
  malformed.body[0].expressions = [{kind:'variable',name:'ΑΔΗΛΩΤΗ',line:3}]
  assert.equal(inspectProgramAst(malformed).hasValidDeclarations,false)
})

test('η κανονικοποίηση δεν εξισώνει αριθμητικά πρόσημα ή διαφορετικούς τελεστές', () => {
  assert.equal(normalizeAnswer('  μέ__βήμα! '), normalizeAnswer('ΜΕ ΒΗΜΑ'))
  assert.equal(matchesAcceptedAnswer('βήμα',['ΜΕ_ΒΗΜΑ','ΒΗΜΑ']),true)
  assert.equal(matchesBooleanAnswer('σωςτο',true),true)
  assert.equal(matchesBooleanAnswer('σωτσο',true),true)
  assert.equal(matchesBooleanAnswer('λάθος',true),false)
  for (const [value, expected] of [['-1','1'],['<=','>='],['1.5','15'],['',''],['ή','και']])
    assert.equal(matchesAcceptedAnswer(value,[expected]),false)
})

test('κενή ή συντακτικά λανθασμένη λύση δεν παίρνει δομικά μόρια', async () => {
  for (const source of ['', 'ΠΡΟΓΡΑΜΜΑ Ανοικτο\nΑΡΧΗ']) {
    const result = await gradeExam({...correctAnswers,c1:source},examTemplate)
    assert.equal(result.breakdown.themeC.score,0)
  }
})

test('ελλιπή, διπλά και άγνωστα αποτελέσματα Worker απορρίπτονται', async () => {
  const question=examTemplate.sections[2].questions[0]
  const valid = runTestCases(reference,question.testCases)
  for (const results of [valid.slice(1), [...valid.slice(0,3),valid[0]], [...valid.slice(0,3),{...valid[3],id:'άγνωστο'}]]) {
    const result=await evaluateCodeSubmission(question,reference,async()=>results)
    assert.equal(result.earned,0)
    assert.match(result.feedback,/αποτελέσματα/u)
  }
})

test('πρόβλημα προτύπου Β2 παραμένει εκκρεμές και η νέα αναφορά περνά το υπάρχον συμβόλαιο', async () => {
  const template=structuredClone(examTemplate)
  template.sections[1].questions[1].referenceCode=functionalReference.replace('Χ * 2','Χ DIV 0')
  const result=await gradeExam(correctAnswers,template)
  assert.equal(result.pendingScore,10)
  assert.equal(result.breakdown.themeB.pending,10)
  assert.equal(ExamGradingResultSchema.safeParse(result).success,true)
  const report=await gradeAssessment(examTemplate,correctAnswers,async(source,cases)=>runTestCases(source,cases))
  const parsed=AssessmentReportSchema.parse(report)
  assert.equal(parsed.sections[2].questions[0].grading.structuralScore,12)
})

test('η είσοδος Worker επιστρέφει το gradeExam payload και ελεγχόμενο σφάλμα για άκυρο πρότυπο', async () => {
  const original=globalThis.self
  const messages=[]
  globalThis.self={postMessage:message=>messages.push(message)}
  try {
    await server.ssrLoadModule('/src/assessment/grading.worker.ts')
    await self.onmessage({data:{id:1,examTemplate,studentAnswers:correctAnswers}})
    assert.equal(messages.at(-1).result.totalScore,100)
    await self.onmessage({data:{id:2,examTemplate:{},studentAnswers:{}}})
    assert.equal(messages.at(-1).id,2)
    assert.equal(typeof messages.at(-1).error,'string')
  } finally { globalThis.self=original }
})
