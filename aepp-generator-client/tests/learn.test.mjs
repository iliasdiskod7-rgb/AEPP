import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const data=await server.ssrLoadModule('/src/patterns/methodologiesData.ts')
const legacy=await server.ssrLoadModule('/src/patterns/catalog.ts')
const {courseCatalog}=await server.ssrLoadModule('/src/data/courses/catalog.ts')
const {default:Related}=await server.ssrLoadModule('/src/components/courses/RelatedMethodologies.tsx')
const {default:Learn}=await server.ssrLoadModule('/src/components/courses/LearnWorkspace.tsx')
after(()=>server.close())
test('both navigation entry points share one catalog and link only to real lessons',()=>{
 assert.equal(legacy.patterns,data.methodologiesData)
 const lessonIds=new Set(courseCatalog.flatMap(ch=>ch.lessons.map(l=>l.id)))
 for(const m of data.methodologiesData){
  assert.ok(m.relatedLessonIds.length,m.id)
  for(const id of m.relatedLessonIds)assert.ok(lessonIds.has(id),`${m.id}: ${id}`)
 }
 for(const lessonId of lessonIds)for(const methodology of data.getRelatedMethodologies(lessonId))assert.ok(data.methodologiesData.includes(methodology))
})
test('nested-loop lesson links to bubble sort; algorithm design links to binary search',()=>{
 assert.ok(data.getRelatedMethodologies('lesson-13').some(m=>m.id==='bubble'))
 assert.ok(data.getRelatedMethodologies('lesson-16').some(m=>m.id==='binary'))
 const html=renderToStaticMarkup(createElement(Related,{lessonId:'lesson-13',onOpen(){}}))
 assert.ok(html.includes('Σχετικές Μεθοδολογίες &amp; Τεχνικές'))
 assert.ok(html.includes('Ταξινόμηση φυσαλίδας'))
 assert.equal(renderToStaticMarkup(createElement(Related,{lessonId:'lesson-1',onOpen(){}})),'')
})
test('learning hub exposes connected accessible tabs and preserves the chosen lesson',()=>{
 const html=renderToStaticMarkup(createElement(Learn,{active:true,tab:'lessons',onTabChange(){},selectedLessonId:'lesson-13',onSelectLesson(){},selectedMethodologyId:'bubble',onSelectMethodology(){},methodologyRequest:0,onOpenMethodology(){},onOpenProgram(){},hasCustomProgram:false}))
 assert.ok(html.includes('Μαθήματα &amp; Εξάσκηση'))
 assert.equal((html.match(/role="tab"/g)||[]).length,2)
 assert.ok(html.includes('id="learn-tab-lessons" aria-controls="learn-panel-lessons" aria-selected="true"'))
 assert.ok(html.includes('id="learn-panel-methodologies" role="tabpanel" aria-labelledby="learn-tab-methodologies" hidden'))
 assert.ok(html.includes('Ταξινόμηση φυσαλίδας'))
})
