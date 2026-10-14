import bank from './challenge-bank.json'
import type { Completion, DailyState, Feedback, Profile, LeaderRow, Period, Scope } from './types'
export function dayAt(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens',year:'numeric',month:'2-digit',day:'2-digit'}).format(now) }
export function dayNumber(day:string) { return Math.floor(Date.parse(day+'T00:00:00Z')/86400000) }
export function week(day:string) { const d=dayNumber(day); return d-((d+3)%7+7)%7 }
export function packAt(day:string) {
 const rotation=bank.rotation, delta=dayNumber(day)-dayNumber(rotation.startsOn)
 const index=delta<0 ? ((dayNumber(day)%rotation.legacyPackCount)+rotation.legacyPackCount)%rotation.legacyPackCount : (rotation.firstPackIndex+delta)%bank.packs.length
 return bank.packs[index]
}
export function normalize(s:string) { return s.normalize('NFC').trim().replace(/\s+/g,'').toLocaleUpperCase('el-GR').replace(/≤/g,'<=').replace(/≥/g,'>=') }
export function streakOf(p:Profile,day:string) {
 const entries=[...p.completions.map(c=>({day:c.day,complete:true})),...p.freezes.filter(d=>!p.completions.some(c=>c.day===d)).map(day=>({day,complete:false}))].sort((a,b)=>a.day.localeCompare(b.day));
 let streak=0,last=-Infinity;
 for(const e of entries){const n=dayNumber(e.day); if(n>dayNumber(day))continue; if(n!==last+1)streak=0; if(e.complete)streak++; last=n}
 return last>=dayNumber(day)-1?streak:0
}
export function newProfile():Profile { return {id:crypto.randomUUID(),publicCode:crypto.randomUUID().replaceAll('-','').slice(0,12),username:'Μαθητής',avatar:'🦉',group:'',friends:[],completions:[],freezes:[],studies:[],badges:[],attempt:null} }
export function feedback(day:string,index:number,answers:Record<string,string>):Feedback {
 const q=packAt(day).questions[index]; const expected=q.kind==='fill'?q.blanks.map(b=>b.accepted[0]).join(', '):q.answer;
 const correct=q.kind==='fill'?q.blanks.every(b=>b.accepted.some(a=>normalize(a)===normalize(answers[q.id+':'+b.id]??''))):normalize(q.answer)===normalize(answers[q.id]??'');
 return {correct,expected:q.kind==='theory'?(expected==='true'?'Σωστό':'Λάθος'):expected,explanation:q.explanation,reference:q.reference}
}
export function state(p:Profile,now=new Date()):DailyState {const day=dayAt(now),pack=packAt(day),c=p.completions.find(c=>c.day===day)??null; return {profile:p,day,title:pack.title,questions:pack.questions.map(q=>({id:q.id,kind:q.kind,prompt:q.prompt,code:q.code,declarations:q.declarations,blanks:q.blanks.map(b=>({id:b.id,options:b.options}))})),streak:streakOf(p,day),xp:p.completions.reduce((s,c)=>s+c.xp,0),completion:c,theoryFeedback:p.attempt?.day===day&&p.attempt.theoryAnswer!==null?feedback(day,0,{[pack.questions[0].id]:p.attempt.theoryAnswer}):null,serverNow:now.toISOString()} }
export function start(p:Profile,now=new Date()) {const day=dayAt(now); if(!p.completions.some(c=>c.day===day)&&p.attempt?.day!==day)p.attempt={day,startedAt:now.toISOString(),theoryAnswer:null}; return state(p,now)}
export function answerTheory(p:Profile,answer:string,now=new Date()) {const day=dayAt(now); if(p.completions.some(c=>c.day===day))return state(p,now); if(!p.attempt||p.attempt.day!==day)throw Error('Ξεκίνα πρώτα το σημερινό challenge.'); if(!['true','false'].includes(answer))throw Error('Μη έγκυρη επιλογή.'); if((now.getTime()-Date.parse(p.attempt.startedAt))/1000>=600)throw Error('Ο χρόνος τελείωσε. Υπόβαλε τις απαντήσεις σου.'); p.attempt.theoryAnswer??=answer; return state(p,now)}
export function complete(p:Profile,answers:Record<string,string>,now=new Date()) {
 const day=dayAt(now); if(p.completions.some(c=>c.day===day))return state(p,now); if(!p.attempt||p.attempt.day!==day)throw Error('Ξεκίνα το σημερινό challenge.');
 const startedAt=p.attempt.startedAt,durationSeconds=Math.max(0,Math.floor((now.getTime()-Date.parse(startedAt))/1000));
 const accepted={...(durationSeconds>605?{}:answers),[packAt(day).questions[0].id]:p.attempt.theoryAnswer??''};
 const results=[0,1,2].map(i=>feedback(day,i,accepted)); const correctCount=results.filter(f=>f.correct).length;
 const c:Completion={day,startedAt,completedAt:now.toISOString(),durationSeconds,answers:accepted,feedback:results,correctCount,xp:0,multiplier:1,streak:0,newBadges:[],loopResults:packAt(day).questions.flatMap((q,i)=>(q.tags as string[]).includes('loops')?[results[i].correct]:[])};
 p.completions.push(c); c.streak=streakOf(p,day); c.multiplier=Math.min(2,1+Math.floor(c.streak/7)*0.1); c.xp=Math.round((10+30*correctCount+(durationSeconds<180?10*correctCount:durationSeconds<600?5*correctCount:0))*c.multiplier);
 const eligible=['first']; if(durationSeconds<180)eligible.push('lightning'); if(c.streak>=30)eligible.push('month'); const loops=p.completions.flatMap(c=>c.loopResults).slice(-5); if(loops.length===5&&loops.every(Boolean))eligible.push('loops'); if(correctCount===3&&(['search','sort'].includes(packAt(day).id)||(packAt(day).id.startsWith('daily-')&&packAt(day).questions.some(q=>(q.tags as string[]).includes('search')))))eligible.push('arrays');
 c.newBadges=eligible.filter(b=>!p.badges.includes(b)); p.badges.push(...c.newBadges); return state(p,now)
}
export function study(p:Profile,now=new Date()){const day=dayAt(now); if(!p.studies.includes(day))p.studies.push(day); return state(p,now)}
export function freeze(p:Profile,now=new Date()){const day=dayAt(now); if(p.freezes.includes(day))return state(p,now); if(p.completions.some(c=>c.day===day)||streakOf(p,day)===0||!p.studies.includes(day)||p.freezes.some(d=>week(d)===week(day)))throw Error('Το freeze απαιτεί ενεργό σερί, μελέτη σήμερα και διαθέσιμη εβδομαδιαία χρήση.'); p.freezes.push(day);return state(p,now)}
export function leaderboard(profiles:Profile[],self:Profile,period:Period,scope:Scope,now=new Date()):LeaderRow[]{const day=dayAt(now);const rows=profiles.filter(p=>scope==='national'||p.id===self.id||(scope==='group'?!!self.group&&p.group===self.group:self.friends.includes(p.publicCode))).map(p=>({rank:0,username:p.username,avatar:p.avatar,streak:streakOf(p,day),totalXp:p.completions.reduce((s,c)=>s+c.xp,0),rankingXp:p.completions.filter(c=>period==='all'||week(c.day)===week(day)).reduce((s,c)=>s+c.xp,0),self:p.id===self.id})).sort((a,b)=>b.rankingXp-a.rankingXp||a.username.localeCompare(b.username));return rows.map((r,i)=>({...r,rank:i>0&&r.rankingXp===rows[i-1].rankingXp?rows.findIndex(x=>x.rankingXp===r.rankingXp)+1:i+1}))}
