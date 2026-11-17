import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
const server=await createServer({cacheDir:'.tmp/bank-check',server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close());
const {AssessmentExamSchema}=await server.ssrLoadModule('/src/assessment/schemas.ts');
const {runTestCases,executeProgram}=await server.ssrLoadModule('/src/assessment/execution.ts');
const {gradeAssessment}=await server.ssrLoadModule('/src/assessment/grading.ts');
const {getMockExamBank}=await server.ssrLoadModule('/src/assessment/mockExamBank.ts');
const bank=JSON.parse(fs.readFileSync('../AeppGenerator/src/AeppGenerator.Api/Assessment/exam-bank.json','utf8'));
const publicBank=JSON.parse(fs.readFileSync('src/assessment/exam-bank-public.json','utf8'));
const mockBank=await getMockExamBank();
test('exactly five complete new exams and no old identifiers',()=>{
 assert.equal(bank.length,5);assert.equal(new Set(bank.map(e=>e.id)).size,5);
 for(const exam of bank){AssessmentExamSchema.parse(exam);assert.deepEqual(exam.sections.map(s=>s.marks),[25,25,25,25]);
 const a=exam.sections[0].questions;assert.deepEqual(a.map(q=>q.code),['Α1','Α2','Α3','Α4','Α5']);assert.deepEqual(a.map(q=>q.marks),[10,4,3,3,5]);assert.equal(a[0].statements.length,5);assert.equal(a[1].pairs.length,4);assert.equal(a[4].kind,'choice');
 const b=exam.sections[1].questions;assert.deepEqual(b.map(q=>q.code),['Β1','Β2α','Β2β','Β3']);assert.deepEqual(b.map(q=>q.marks),[10,5,5,5]);assert.equal(b[0].blanks.length,5);assert.equal(b[3].kind,'trace');assert.equal(b[3].rowLabels.length,5);
 for(const [i,theme] of [[2,'Γ'],[3,'Δ']]){assert.deepEqual(exam.sections[i].questions[0].subquestions.map(q=>q.code),[1,2,3,4].map(n=>theme+n));assert.deepEqual(exam.sections[i].questions[0].subquestions.map(q=>q.marks),[5,7,7,6]);assert.equal(exam.sections[i].questions[0].testCases.length,4);}}
});
test('public API fixture withholds every key and private test',()=>{for(const e of publicBank){AssessmentExamSchema.parse(e);for(const q of e.sections.flatMap(s=>s.questions)){assert.equal(q.solution,'');if(q.kind==='program'){assert.equal(q.referenceCode,'');assert.equal(q.testCases.length,0);}}}});
test('browser practice includes complete solutions without automatic program grading',()=>{assert.equal(mockBank.length,5);for(const e of mockBank)for(const q of e.sections.flatMap(s=>s.questions))if(q.kind==='program'){assert.ok(q.referenceCode.startsWith('ΠΡΟΓΡΑΜΜΑ'));assert.equal(q.testCases.length,0);assert.equal(q.gradingMode,'review');assert.ok(q.solution.includes(q.referenceCode))}});
for(const e of bank){
 for(const q of e.sections.flatMap(s=>s.questions).filter(q=>q.kind==='program'))test(e.id+' '+q.code+' reference passes all boundary cases',()=>{const results=runTestCases(q.referenceCode,q.testCases);assert.ok(results.every(r=>r.passed),JSON.stringify(results,null,2))});
 test(e.id+' perfect objective/code answers and honest pending theory',async()=>{
  const answers={};for(const q of e.sections.flatMap(s=>s.questions)){
   answers[q.id]=q.kind==='trueFalse'?Object.fromEntries(q.statements.map(s=>[s.id,s.answer?'Σωστό':'Λάθος'])):q.kind==='matching'?Object.fromEntries(q.pairs.map(p=>[p.id,p.rightId])):q.kind==='choice'?q.correctId:q.kind==='fill'?q.accepted[0]:q.kind==='codeBlanks'?Object.fromEntries(q.blanks.map(b=>[b.id,b.accepted[0]])):q.kind==='trace'?q.expected:q.kind==='program'?q.referenceCode:q.solution;
  }
  const report=await gradeAssessment(e,answers,async(source,cases)=>runTestCases(source,cases));assert.equal(report.earned+report.pending,100);assert.equal(report.pending,8);
 });
}


test('exam 1 B2 uses plain increments and B3 tracks only TOP and the current top element',()=>{
 for(const dataset of [bank,publicBank,mockBank]){
  const questions=dataset.find(exam=>exam.id==='aepp-2026-01').sections[1].questions;
  for(const id of ['b2a','b2b']){const q=questions.find(q=>q.id===id);assert.match(q.prompt,/i <- i \+ 1/);assert.doesNotMatch(q.prompt,/i <- i \+ \(1\)/)}
  const stack=questions.find(q=>q.id==='b3');assert.equal(stack.columns.length,2);assert.equal(stack.columns[0],'TOP');assert.ok(!stack.columns.includes('ΕΞΟΔΟΣ'));assert.ok(stack.expected.every(row=>row.length===2));
 }
 const stack=bank[0].sections[1].questions.find(q=>q.id==='b3');
 assert.deepEqual(stack.expected,[['3','9'],['2','7'],['3','3'],['2','7'],['1','4']]);
 assert.equal(bank[0].sections[1].questions.reduce((sum,q)=>sum+q.marks,0),25);
});
