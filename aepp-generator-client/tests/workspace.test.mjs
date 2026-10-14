import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
const { defaults, restorePreferences, resizeSize, shortcutAction } = await server.ssrLoadModule('/src/components/interpreter/workspaceState.ts')
const { default: Layout } = await server.ssrLoadModule('/src/components/interpreter/ResponsiveIdeLayout.tsx')
const { default: Editor } = await server.ssrLoadModule('/src/components/interpreter/CodeEditorPane.tsx')
const { default: Tabs } = await server.ssrLoadModule('/src/components/layout/WorkspaceTabs.tsx')
const { followLineScroll } = await server.ssrLoadModule('/src/components/interpreter/editorScroll.ts')
const { describeChanges } = await server.ssrLoadModule('/src/components/interpreter/memoryChanges.ts')
after(() => server.close())
test('corrupt, absent and incompatible storage fall back safely', () => { for (const raw of [null, '', '{bad', 'null', '[]', '{"version":2}']) assert.deepEqual(restorePreferences(raw), defaults) })
test('valid layout round-trips all panel settings', () => { const saved = { version:1,commands:'rail',side:'left',width:410,dock:'maximized',tab:'memory',height:450 }; assert.deepEqual(restorePreferences(JSON.stringify(saved)), saved) })
test('untrusted dimensions and enums are bounded independently', () => { const result = restorePreferences(JSON.stringify({version:1,width:99999,height:-10,commands:'bad',side:'bad',dock:'bad',tab:'bad'})); assert.deepEqual(result,{...defaults,width:480,height:120}); assert.equal(restorePreferences('{"version":1,"width":"300","height":null}').width,defaults.width) })
test('dragging opposite sidebar edges preserves resize direction', () => { assert.equal(resizeSize(300,80,1,220,480),380);assert.equal(resizeSize(300,80,-1,220,480),220);assert.equal(resizeSize(300,-100,-1,220,480),400) })
test('bottom splitter grows upward and respects remaining editor space', () => { assert.equal(resizeSize(260,-100,-1,120,300),300);assert.equal(resizeSize(260,100,-1,120,300),160);assert.equal(resizeSize(260,500,-1,120,300),120) })
const key = code => ({ code,ctrlKey:true,metaKey:false,altKey:false,shiftKey:false })
test('physical shortcuts work regardless of Greek keyboard layout', () => { assert.equal(shortcutAction(key('KeyB'),true),'commands');assert.equal(shortcutAction(key('Backquote'),true),'console');assert.equal(shortcutAction({...key('F9'),ctrlKey:false},true),'zen');assert.equal(shortcutAction({...key('KeyB'),ctrlKey:false,metaKey:true},true),'commands') })
test('inactive workspace, composition and reserved modifiers leave keys alone', () => { assert.equal(shortcutAction(key('KeyB'),false),null);for(const flag of ['isComposing','defaultPrevented','altKey','shiftKey'])assert.equal(shortcutAction({...key('KeyB'),[flag]:true},true),null) })
test('initial layout prioritizes editor and defers memory mounting', () => { const html = renderToStaticMarkup(createElement(Layout,{editor:createElement('textarea',{'aria-label':'Κώδικας'}),commands:'Εντολές',console:'Κονσόλα',memory:'UNMOUNTED_MEMORY_MARKER',controls:'Εκτέλεση',status:'Έτοιμο',cursor:{line:3,column:8},errors:0,attention:null,needsInput:false,onFocusEditor:()=>{}}));assert.ok(html.includes('textarea'));assert.ok(!html.includes('UNMOUNTED_MEMORY_MARKER'));assert.ok(!html.includes('<dialog open'));assert.ok(html.includes('Γραμμή 3'));assert.ok(html.includes('Στήλη 8'));assert.ok(html.includes('Σφάλματα: 0')) })
test('editor status strip can be removed for Zen without losing code', () => { const html = renderToStaticMarkup(createElement(Editor,{initialValue:'ΠΡΟΓΡΑΜΜΑ Δοκιμή',onSourceChange:()=>{},activeLine:null,errorLine:null,showLint:false}));assert.ok(html.includes('ΠΡΟΓΡΑΜΜΑ'));assert.ok(!html.includes('ide-lint'));assert.ok(html.includes('ide-editor-pane')) })
test('top navigation exposes four separately controlled workspaces', () => { const html=renderToStaticMarkup(createElement(Tabs,{activeTab:'interpreter',onSelect:()=>{}}));assert.equal((html.match(/role="tab"/g)||[]).length,4);assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert.ok(html.includes('aria-controls="workspace-whiteboard"')) })

test('execution scroll follows downward and backward jumps without moving visible lines', () => {
  const current = followLineScroll(30,24,12,240,0,2000)
  assert.ok(current <= 708 && current + 240 >= 732)
  assert.equal(followLineScroll(31,24,12,240,current,2000),current)
  assert.equal(followLineScroll(2,24,12,240,current,2000),0)
})
test('first and last lines respect scroll limits, including short editors', () => {
  assert.equal(followLineScroll(1,24,12,240,800,2000),0)
  assert.equal(followLineScroll(80,24,12,240,0,1944),1704)
  const short = followLineScroll(20,24,12,48,0,1000)
  assert.ok(short <= 468 && short + 48 >= 492)
})
test('hidden editor and absent execution never reset the user scroll', () => {
  assert.equal(followLineScroll(20,24,12,0,300,1000),300)
  assert.equal(followLineScroll(0,24,12,240,300,1000),300)
})

test('memory change descriptions preserve zero values and actual 2D indexes', () => {
 const value = number => ({type:'integer',value:number})
 const event = {kind:'step',line:5,memoryEvents:[{kind:'ON_MUTATE',target:{scopeId:1,name:'ΑΠΟΘ',indexes:[2,5]},previous:value(10),value:value(0)},{kind:'ON_MUTATE',target:{scopeId:1,name:'ΠΛ',indexes:[]},previous:value(0),value:value(1)}]}
 assert.equal(describeChanges(event),'ΑΠΟΘ[2, 5]: 10 → 0 · ΠΛ: 0 → 1')
})
test('first assignment uses uninitialized marker and reads are not called updates', () => {
 const target = {scopeId:1,name:'Χ',indexes:[]},value={type:'boolean',value:false}
 assert.equal(describeChanges({memoryEvents:[{kind:'ON_MUTATE',target,previous:null,value}]}),'Χ: — → ΨΕΥΔΗΣ')
 assert.equal(describeChanges({memoryEvents:[{kind:'ON_READ',target,value}]}),'')
 assert.equal(describeChanges(null),'')
})
test('editor displays actual value transition with the active assignment line', () => {
 const html=renderToStaticMarkup(createElement(Editor,{initialValue:'Χ <- Χ + 1',onSourceChange:()=>{},activeLine:1,errorLine:null,showLint:false,changeSummary:'Χ: 0 → 1'}))
 assert.ok(html.includes('ide-updated-line'))
 assert.ok(html.includes('Ενημέρωση: Χ: 0 → 1'))
})
