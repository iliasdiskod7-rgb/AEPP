import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { readFile } from 'node:fs/promises'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const e=await server.ssrLoadModule('/src/gamification/engine.ts')
const {Interpreter}=await server.ssrLoadModule('/src/interpreter/runtime.ts')
const {parseProgram}=await server.ssrLoadModule('/src/interpreter/parser.ts')
after(()=>server.close())
const bank=JSON.parse(await readFile(new URL('../src/gamification/challenge-bank.json',import.meta.url),'utf8'))
test('100 packs preserve old attempts and start new content at cutover',()=>{
 assert.equal(bank.packs.length,100)
 for(const day of ['2026-01-01','2026-10-08','2026-10-14']) assert.equal(e.packAt(day).id,bank.packs[((e.dayNumber(day)%21)+21)%21].id)
 assert.equal(e.packAt('2026-10-15').id,'daily-022')
 assert.equal(e.packAt('2027-01-23').id,'daily-022')
 assert.equal(new Set(bank.packs.map(p=>p.id)).size,100)
 assert.equal(new Set(bank.packs.flatMap(p=>p.questions.map(q=>q.id))).size,300)
 assert.equal(new Set(bank.packs.slice(21).map(p=>p.questions[0].prompt)).size,79)
})
function executeQuestion(q,code) {
 const declarations=q.declarations.split('.')[0].replace(/^Ακέραι(?:ες|α) /,'ΑΚΕΡΑΙΕΣ: ')
 const source=`ΠΡΟΓΡΑΜΜΑ Έλεγχος\nΜΕΤΑΒΛΗΤΕΣ\n${declarations}\nΑΡΧΗ\n${q.verification.initialization}\n${code}\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`
 const run=new Interpreter(parseProgram(source),{maxLoopIterations:1000}).execute()
 let step=run.next(),output=[]
 for(let i=0;!step.done&&i<2000;i++){output=step.value.output;step=run.next()}
 if(!step.done)throw Error('Η εκτέλεση δεν τερματίστηκε')
 return output
}
test('all 79 new filled exercises execute correctly; every distractor fails the stated goal',()=>{
 for(const pack of bank.packs.slice(21)) {
  const q=pack.questions[1],b=q.blanks[0]
  assert.equal(new Set(b.options).size,b.options.length,pack.id)
  assert.ok(b.options.includes(b.accepted[0]),pack.id)
  assert.deepEqual(executeQuestion(q,q.code.replace('{{1}}',b.accepted[0])),[q.verification.expectedOutput],pack.id)
  for(const option of b.options.filter(o=>!b.accepted.includes(o))) {
   let result
   try {result=executeQuestion(q,q.code.replace('{{1}}',option))}catch{continue}
   assert.notDeepEqual(result,[q.verification.expectedOutput],`${pack.id}: ambiguous option ${option}`)
  }
 }
})
const time=day=>new Date(day+'T10:00:00Z')
function answers(day){return Object.fromEntries(e.packAt(day).questions.flatMap(q=>q.kind==='fill'?q.blanks.map(b=>[q.id+':'+b.id,b.accepted[0]]):[[q.id,q.answer]]))}
function finish(p,day,duration=120){const now=time(day),a=answers(day);e.start(p,now);e.answerTheory(p,e.packAt(day).questions[0].answer,now);return e.complete(p,a,new Date(+now+duration*1000))}
test('new search variants also award the array achievement',()=>{
 const p=e.newProfile()
 assert.equal(e.packAt('2026-10-27').questions[2].tags.includes('search'),true)
 finish(p,'2026-10-27')
 assert.equal(p.badges.includes('arrays'),true)
})
test('Athens midnight and summer/winter timezone',()=>{assert.equal(e.dayAt(new Date('2026-10-07T20:59:59Z')),'2026-10-07');assert.equal(e.dayAt(new Date('2026-10-07T21:00:00Z')),'2026-10-08');assert.equal(e.dayAt(new Date('2026-12-01T22:00:00Z')),'2026-12-02')})
test('Monday week and year boundary',()=>{assert.equal(e.week('2026-12-28'),e.week('2027-01-03'));assert.notEqual(e.week('2027-01-03'),e.week('2027-01-04'))})
test('full deterministic rotation, exactly three question kinds',()=>{for(let i=0;i<bank.packs.length;i++){const day=new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10);assert.deepEqual(e.packAt(day).questions.map(q=>q.kind),['theory','fill','trace']);assert.equal(e.packAt(day).questions[2].code.split('\n').length>=5,true);assert.equal(e.packAt(day).questions[2].code.split('\n').length<=8,true)}assert.equal(new Set(Array.from({length:bank.packs.length},(_,i)=>e.packAt(new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10)).id)).size,bank.packs.length)})
test('public state hides answers and explanation until feedback',()=>{const s=e.state(e.newProfile(),time('2026-10-08'));assert.equal(JSON.stringify(s.questions).includes('accepted'),false);assert.equal('answer' in s.questions[0],false);assert.equal('explanation' in s.questions[0],false)})
test('first theory answer stays locked, reload does not restart clock',()=>{const p=e.newProfile(),now=time('2026-10-08');e.start(p,now);e.answerTheory(p,'false',now);e.answerTheory(p,'true',now);e.start(p,new Date(+now+30000));assert.equal(p.attempt.theoryAnswer,'false');assert.equal(p.attempt.startedAt,now.toISOString())})
test('full score, XP and duplicate completion are idempotent',()=>{const p=e.newProfile();const s=finish(p,'2026-10-08');assert.equal(s.completion.correctCount,3);assert.equal(s.xp,130);assert.equal(s.streak,1);e.complete(p,{},time('2026-10-08'));assert.equal(p.completions.length,1);assert.equal(e.state(p,time('2026-10-08')).xp,130);assert.deepEqual(p.badges,['first','lightning'])})
test('speed boundaries below 180 and 600 seconds',()=>{for(const [duration,xp] of [[179,130],[180,115],[599,115],[600,100]]){const p=e.newProfile();assert.equal(finish(p,'2026-10-08',duration).xp,xp);assert.equal(p.badges.includes('lightning'),duration<180)}})
test('unanswered questions score zero correctness, completion awards 10',()=>{const p=e.newProfile(),now=time('2026-10-08');e.start(p,now);const s=e.complete(p,{},new Date(+now+600000));assert.equal(s.completion.correctCount,0);assert.equal(s.xp,10)})
test('answers after deadline grace are ignored',()=>{const p=e.newProfile(),s=finish(p,'2026-10-08',606);assert.equal(s.completion.correctCount,1);assert.equal(s.xp,40)})
test('streak gaps reset and freeze requires study',()=>{const p=e.newProfile();finish(p,'2026-10-05');assert.throws(()=>e.freeze(p,time('2026-10-06')));e.study(p,time('2026-10-06'));e.freeze(p,time('2026-10-06'));assert.equal(e.streakOf(p,'2026-10-06'),1);assert.equal(finish(p,'2026-10-07').streak,2);assert.equal(e.streakOf(p,'2026-10-09'),0);assert.equal(finish(p,'2026-10-09').streak,1)})
test('one freeze per week and no XP or count from freeze',()=>{const p=e.newProfile();finish(p,'2026-10-05');e.study(p,time('2026-10-06'));const s=e.freeze(p,time('2026-10-06'));e.freeze(p,time('2026-10-06'));assert.equal(s.xp,130);assert.equal(s.streak,1);finish(p,'2026-10-07');e.study(p,time('2026-10-08'));assert.throws(()=>e.freeze(p,time('2026-10-08')));assert.equal(p.freezes.length,1)})
test('completion on frozen day increases once, next week freeze available',()=>{const p=e.newProfile();finish(p,'2026-10-05');e.study(p,time('2026-10-06'));e.freeze(p,time('2026-10-06'));assert.equal(finish(p,'2026-10-06').streak,2);for(let d=7;d<=12;d++)finish(p,'2026-10-'+String(d).padStart(2,'0'));e.study(p,time('2026-10-13'));assert.equal(e.freeze(p,time('2026-10-13')).streak,8)})
test('badges and multipliers unlock once over 30 days',()=>{const p=e.newProfile();for(let i=0;i<30;i++){const day=new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10);finish(p,day)}assert.equal(p.badges.includes('month'),true);assert.equal(p.badges.includes('loops'),true);assert.equal(p.badges.includes('arrays'),true);assert.equal(new Set(p.badges).size,p.badges.length);assert.equal(p.completions[6].multiplier,1.1);assert.equal(p.completions[29].streak,30)})
test('loop badge uses last five eligible correct answers',()=>{const p=e.newProfile();for(let i=0;i<3;i++)finish(p,new Date(Date.UTC(2027,0,1+i)).toISOString().slice(0,10));const seq=p.completions.flatMap(c=>c.loopResults);assert.equal(p.badges.includes('loops'),seq.length>=5&&seq.slice(-5).every(Boolean))})
test('leaderboard uses real records and excludes others from group/friends',()=>{const a=e.newProfile(),b=e.newProfile(),c=e.newProfile();a.group=b.group='A';c.group='B';finish(a,'2026-10-08');finish(b,'2026-10-08');finish(c,'2026-10-07');a.friends=[c.publicCode];assert.equal(e.leaderboard([a,b,c],a,'all','national',time('2026-10-08')).length,3);assert.equal(e.leaderboard([a,b,c],a,'all','group',time('2026-10-08')).length,2);assert.equal(e.leaderboard([a,b,c],a,'all','friends',time('2026-10-08')).length,2);assert.deepEqual(e.leaderboard([a,b],a,'all','national',time('2026-10-08')).map(r=>r.rank),[1,1]);assert.equal('id' in e.leaderboard([a],a,'all','national',time('2026-10-08'))[0],false)})
test('weekly ranking excludes previous week XP',()=>{const p=e.newProfile();finish(p,'2026-10-04');finish(p,'2026-10-05');const r=e.leaderboard([p],p,'weekly','national',time('2026-10-06'))[0];assert.equal(r.totalXp,260);assert.equal(r.rankingXp,130)})

test('all trace answers execute correctly in the project interpreter',()=>{for(const p of bank.packs){const q=p.questions[2];let decl=q.declarations.split('.')[0].replace(/^Ακέραι(?:ες|α) /,'ΑΚΕΡΑΙΕΣ: '),init=(q.verification?.initialization??'')+'\n';if(['arrays','search','design'].includes(p.id))init='Α[1] <- 2\nΑ[2] <- 5\nΑ[3] <- 2\nΑ[4] <- 2\n';if(p.id==='sort')init='Α[1] <- 7\nΑ[2] <- 3\n';if(p.id==='queue')init='ΟΥ[1] <- 4\nΟΥ[2] <- 8\nΟΥ[3] <- 12\n';const source='ΠΡΟΓΡΑΜΜΑ Έλεγχος\nΜΕΤΑΒΛΗΤΕΣ\n'+decl+'\nΑΡΧΗ\n'+init+q.code+'\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ';const iterator=new Interpreter(parseProgram(source)).execute();let step=iterator.next(),output=[];for(let n=0;!step.done&&n<1000;n++){output=step.value.output;step=iterator.next()}assert.ok(step.done,p.id+' must terminate');assert.deepEqual(output,[q.answer],p.id+' output')}})
