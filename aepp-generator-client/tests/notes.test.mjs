import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'vite'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close())
const {suggestedNoteTitle,filterNotes,NoteInputSchema}=await server.ssrLoadModule('/src/notes/model.ts')
const {NoteCard}=await server.ssrLoadModule('/src/notes/NotesLibrary.tsx')
const {sourceStorageKey}=await server.ssrLoadModule('/src/settings/settings.ts')
const {notesApi}=await server.ssrLoadModule('/src/api/notes.ts')
const {apiClient}=await server.ssrLoadModule('/src/api/client.ts')
test('τίτλος από ΠΡΟΓΡΑΜΜΑ και αποθήκευση ημιτελούς κώδικα χωρίς μεταβολή',()=>{
 const code="ΠΡΟΓΡΑΜΜΑ Μέγιστο ! σχόλιο\r\n  ΑΝ\r\n"
 assert.equal(suggestedNoteTitle(code),'Μέγιστο');assert.equal(NoteInputSchema.parse({title:'Άσκηση',code}).code,code)
 assert.equal(suggestedNoteTitle('ΓΡΑΨΕ 1'),'Νέα άσκηση ΓΛΩΣΣΑΣ');assert.equal(NoteInputSchema.safeParse({title:' ',code}).success,false)
})
test('το κουμπί κάρτας παραδίδει στον editor το ίδιο σώμα κώδικα και την ταυτότητα σημείωσης',()=>{
 const note={id:'00000000-0000-4000-8000-000000000001',title:'Άσκηση',code:'! σχόλιο\nΓΡΑΨΕ 1',comment:null,createdAt:'2026-10-12T10:00:00Z',updatedAt:'2026-10-12T10:00:00Z'}
 let opened;const element=NoteCard({note,onView:()=>{},onDelete:()=>{},onOpen:n=>opened=n})
 const actions=element.props.children.find(child=>child?.props?.className==='note-actions');actions.props.children[1].props.onClick();assert.equal(opened.code,note.code);assert.equal(opened.id,note.id)
 assert.equal(filterNotes([{...note,comment:'Αναζήτηση σε πίνακα'}],'αναζητηση').length,1)
 assert.notEqual(sourceStorageKey('A'),sourceStorageKey('B'))
})
test('το εργαστήριο βρίσκεται μόνο στο Μάθημα 13 και οι σημειώσεις συνδέονται στην αρχική',async()=>{
 const app=await readFile('src/App.tsx','utf8'),navigation=await readFile('src/components/layout/DashboardLayout.tsx','utf8'),lesson=await readFile('src/components/courses/Lesson13Module.tsx','utf8')
 assert.doesNotMatch(navigation,/id: 'loops'/);assert.doesNotMatch(app,/activeTab === 'loops'/)
 assert.match(lesson,/tools\/LoopLab/);assert.match(app,/NotesLibrary[^>]*compact/);assert.match(app,/codeNote=\{openedNote\?\.note\}/)
})
test('αλλοιωμένες αποκρίσεις σημειώσεων απορρίπτονται με φιλικό μήνυμα',async()=>{
 const previous=apiClient.defaults.adapter
 apiClient.defaults.adapter=async config=>({config,data:[{id:'invalid',title:'λάθος'}],status:200,statusText:'OK',headers:{}})
 try{await assert.rejects(notesApi.list(),/μη έγκυρα δεδομένα σημειώσεων/)}finally{apiClient.defaults.adapter=previous}
})
