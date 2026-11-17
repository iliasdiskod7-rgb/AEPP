import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = new URL('../src/gamification/', import.meta.url)
export function importDailySeed(bank) {
 const seed = JSON.parse(readFileSync(new URL('dailyChallengesSeed.json', root), 'utf8'))
 if(seed.length<15||new Set(seed.map(p=>p.id)).size!==seed.length)throw Error('Invalid daily seed identities')
 for(const [i,p] of seed.entries()) {
  if(p.dayIndex!==i+1||p.questions.map(q=>q.type).join(',')!=='TRUE_FALSE,FILL_BLANK,TRACE_OUTPUT')throw Error('Invalid daily seed structure: '+p.id)
  if(typeof p.questions[0].correctAnswer!=='boolean'||!p.questions[1].options.includes(p.questions[1].correctAnswer))throw Error('Invalid answer contract: '+p.id)
 }
 const additions = seed.map(pack => ({id:pack.id, dayIndex:pack.dayIndex, title:pack.topic, questions:pack.questions.map(q => ({
  id:pack.id+'-'+q.id, kind:({TRUE_FALSE:'theory',FILL_BLANK:'fill',TRACE_OUTPUT:'trace'})[q.type], prompt:q.questionText,
  code:q.codeSnippet?.replaceAll('[BLANK]','{{1}}')??null, declarations:q.declarations??null,
  blanks:q.type==='FILL_BLANK'?[{id:'1',options:q.options,accepted:[q.correctAnswer]}]:[],
  answer:q.type==='FILL_BLANK'?'':String(q.correctAnswer), explanation:q.explanation, reference:q.reference,tags:q.tags??[],
  ...(q.verification?{verification:q.verification}:{})
 }))}))
 const ids = new Set(additions.map(p=>p.id))
 bank.packs = [...bank.packs.filter(p=>!ids.has(p.id)),...additions]
 bank.rotation.expansion = {startsOn:"2026-10-16",firstPackIndex:100,previousPackCount:100}
 return bank
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
 const path = new URL('challenge-bank.json',root)
 const bank = importDailySeed(JSON.parse(readFileSync(path,'utf8')))
 writeFileSync(path, JSON.stringify(bank,null,2)+'\n')
 console.log('Daily bank: '+bank.packs.length+' challenges')
}
