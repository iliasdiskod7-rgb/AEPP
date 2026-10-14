import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {mkdtemp,unlink,rmdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {randomBytes} from 'node:crypto'
const fixture=await mkdtemp(path.join(tmpdir(),'aepp-notes-http-')),database=path.join(fixture,'accounts.sqlite')
const api=path.resolve('../AeppGenerator/src/AeppGenerator.Api')
const dll=process.env.AEPP_NOTES_API_DLL??path.join(api,'bin/Release/net8.0/AeppGenerator.Api.dll')
const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r))
const base=`http://127.0.0.1:${port}/api`;let child,logs=''
async function start(){logs='';child=spawn('dotnet',[dll,'--urls',`http://127.0.0.1:${port}`],{cwd:api,env:{...process.env,ASPNETCORE_ENVIRONMENT:'Development',Accounts__DatabasePath:database,Auth__SigningKey:key},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<160;i++){if(child.exitCode!==null)throw Error(logs);try{if((await fetch(base+'/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,250))}throw Error('Startup timeout: '+logs)}
async function stop(){if(child&&child.exitCode===null){const exit=new Promise(r=>child.once('exit',r));child.kill();await exit}}
const key=randomBytes(32).toString('base64')
after(async()=>{await stop();for(const suffix of ['','-wal','-shm'])await unlink(database+suffix).catch(()=>{});await rmdir(fixture).catch(()=>{})})
async function request(route,{method='GET',token,body}={}){const response=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await response.json()}catch{}return {status:response.status,data}}
await start()
await test('ιδιωτικές σημειώσεις, ενημέρωση και διατήρηση στη SQLite μέσω HTTP',async t=>{
 let first,second,note
 const code="ΠΡΟΓΡΑΜΜΑ Δοκιμή\r\n! Ημιτελής άσκηση με σχόλια\r\n  ΓΡΑΨΕ 'γειά'\r\n"
 const body={title:'Εύρεση μεγίστου',code,comment:'Προσωπικό σχόλιο'}
 await t.test('ανώνυμες κλήσεις απορρίπτονται',async()=>{for(const method of ['GET','POST'])assert.equal((await request('/notes',{method,body:method==='POST'?body:undefined})).status,401)})
 await t.test('δημιουργία, τίτλος, κώδικας αυτούσιος και εμφάνιση στη λίστα Dashboard',async()=>{
  const register=async(email)=>request('/auth/register',{method:'POST',body:{email,password:'strong-notes-test-password',fullName:'Δοκιμαστικός μαθητής'}})
  first=(await register('first@example.test')).data;second=(await register('second@example.test')).data
  const result=await request('/notes',{method:'POST',token:first.token,body:{...body,userId:second.user.id}});assert.equal(result.status,201);note=result.data;assert.equal(note.code,code)
  const list=await request('/notes',{token:first.token});assert.equal(list.data[0].id,note.id);assert.equal(list.data[0].comment,body.comment)
 })
 await t.test('ο άλλος χρήστης δεν βλέπει, ενημερώνει ή διαγράφει την ξένη σημείωση',async()=>{
  assert.deepEqual((await request('/notes',{token:second.token})).data,[])
  for(const method of ['GET','PUT','DELETE'])assert.equal((await request('/notes/'+note.id,{method,token:second.token,body:method==='PUT'?body:undefined})).status,404)
  assert.equal((await request('/notes/'+note.id,{token:first.token})).status,200)
 })
 await t.test('ενημέρωση, προτεραιότητα πρόσφατων και προστασία παλιότερης έκδοσης',async()=>{
  const other=await request('/notes',{method:'POST',token:first.token,body:{...body,title:'Δεύτερη σημείωση'}})
  const updated=await request('/notes/'+note.id,{method:'PUT',token:first.token,body:{...body,title:'Νέος τίτλος',expectedUpdatedAt:note.updatedAt}});assert.equal(updated.status,200)
  assert.equal((await request('/notes',{token:first.token})).data[0].id,note.id)
  assert.equal((await request('/notes/'+note.id,{method:'PUT',token:first.token,body:{...body,expectedUpdatedAt:note.updatedAt}})).status,409)
  assert.equal((await request('/notes',{method:'POST',token:first.token,body:{...body,title:' '}})).status,400)
  assert.equal((await request('/notes',{method:'POST',token:first.token,body:{...body,code:'x'.repeat(100001)}})).status,400)
  assert.equal((await request('/notes/'+other.data.id,{method:'DELETE',token:first.token})).status,204)
 })
 await t.test('επανεκκίνηση διατηρεί τη σημείωση και τα δικαιώματα',async()=>{await stop();await start();assert.equal((await request('/notes/'+note.id,{token:first.token})).data.title,'Νέος τίτλος');assert.equal((await request('/notes/'+note.id,{token:second.token})).status,404)})
 await t.test('διαγραφή ιδιοκτήτη αφαιρεί μόνο τη δική του σημείωση',async()=>{assert.equal((await request('/notes/'+note.id,{method:'DELETE',token:first.token})).status,204);assert.equal((await request('/notes/'+note.id,{token:first.token})).status,404)})
})
