import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {after,test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createServer} from 'vite'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const {defaultSettings,sanitizeSettings,restoreSettings,resolveEditorTheme,restoreSource,SOURCE_KEY}=await server.ssrLoadModule('/src/settings/settings.ts')
const {pairedEdit}=await server.ssrLoadModule('/src/settings/editorKeys.ts')
const {parseProgram}=await server.ssrLoadModule('/src/interpreter/parser.ts')
const {Interpreter}=await server.ssrLoadModule('/src/interpreter/runtime.ts')
const {default:Modal}=await server.ssrLoadModule('/src/settings/SettingsModal.tsx')
const {applyTheme}=await server.ssrLoadModule('/src/settings/applyTheme.ts')
after(()=>server.close())
test('theme switching and reset synchronize root class, data attributes and native controls',()=>{
 const classes=new Set(),properties={}
 const root={dataset:{},classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name)}},style:{setProperty(name,value){properties[name]=value}}}
 applyTheme({...defaultSettings,theme:'dark',density:'compact',fontSize:18},root)
 assert.equal(classes.has('dark'),true)
 assert.equal(root.dataset.theme,'dark')
 assert.equal(root.style.colorScheme,'dark')
 assert.equal(properties['--settings-code-font-size'],'18px')
 applyTheme(defaultSettings,root)
 assert.equal(classes.has('dark'),false)
 assert.equal(root.dataset.theme,'light')
 assert.equal(root.dataset.density,'comfortable')
 assert.equal(root.style.colorScheme,'light')
})
test('storage corruption, absent data and future versions safely restore defaults',()=>{for(const raw of [null,'','null','{broken','[]','{"version":2}'])assert.deepEqual(restoreSettings(raw),defaultSettings)})
test('settings restore valid choices and reject invalid enums, types and unsafe limits',()=>{assert.deepEqual(restoreSettings(JSON.stringify({version:1,settings:defaultSettings})),defaultSettings);const s=sanitizeSettings({fontSize:99,executionDelay:-1,loopLimit:Infinity,tabSize:3,voiceRate:2,sounds:'true',theme:'dark',editorTheme:'monokai',wordWrap:true});assert.equal(s.fontSize,24);assert.equal(s.executionDelay,100);assert.equal(s.loopLimit,100000);assert.equal(s.tabSize,2);assert.equal(s.voiceRate,1);assert.equal(s.sounds,false);assert.equal(s.theme,'dark');assert.equal(s.editorTheme,'monokai');assert.equal(s.wordWrap,true)})
test('light mode overrides every saved dark palette without losing the dark preference',()=>{
 for(const editorTheme of ['dark-default','monokai','vscode','contrast']) {
  const restored=restoreSettings(JSON.stringify({version:1,settings:{...defaultSettings,editorTheme}}))
  assert.equal(resolveEditorTheme(restored),'light')
  assert.equal(resolveEditorTheme({...restored,theme:'dark'}),editorTheme)
  assert.equal(restored.editorTheme,editorTheme)
 }
})
test('saved empty code stays empty and unavailable storage uses the starter',()=>{const prior=globalThis.localStorage;try{globalThis.localStorage={getItem:key=>key===SOURCE_KEY?'':null};assert.equal(restoreSource('starter'),'');globalThis.localStorage={getItem(){throw Error('blocked')}};assert.equal(restoreSource('starter'),'starter')}finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior}})
test('pair editing wraps selection, skips existing closers and deletes an empty pair',()=>{assert.deepEqual(pairedEdit('abc',0,3,'('),{text:'(abc)',start:0,end:3,caret:4});assert.equal(pairedEdit('A[]',2,2,']').caret,3);assert.deepEqual(pairedEdit('()',1,1,'Backspace'),{text:'',start:0,end:2,caret:0});assert.equal(pairedEdit('! σχόλιο',8,8,'('),null);assert.equal(pairedEdit("'κείμενο",8,8,'('),null)})
test('modal exposes named categories and remains closed until opened',()=>{const html=renderToStaticMarkup(createElement(Modal,{open:false,onClose(){}}));assert.equal((html.match(/role="tab"/g)||[]).length,4);assert.ok(html.includes('Επαναφορά Προεπιλογών'));assert.ok(!html.includes('<dialog open'));assert.ok(html.includes('aria-labelledby="settings-title"'))})
test('global theme tokens cover readable light and dark surfaces',async()=>{const css=await readFile(new URL('../src/index.css',import.meta.url),'utf8');for(const token of ['--bg-primary','--bg-surface','--text-primary','--text-secondary','--border-color'])assert.ok(css.includes(token));assert.match(css,/:root\.dark/);assert.match(css,/bg-white/);assert.match(css,/text-slate-900/)})
const program=parseProgram('ΠΡΟΓΡΑΜΜΑ Όριο\nΜΕΤΑΒΛΗΤΕΣ\n ΑΚΕΡΑΙΕΣ: i\nΑΡΧΗ\n i <- 0\n ΟΣΟ i >= 0 ΕΠΑΝΑΛΑΒΕ\n i <- i + 1\n ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ')
test('chosen loop limit actually stops interpreter execution',()=>{const run=new Interpreter(program,{maxLoopIterations:10000}).execute();assert.throws(()=>{while(!run.next().done){}},/10\.000/)})
test('changing limit while paused applies to the existing interpreter',()=>{let limit=100000;const run=new Interpreter(program,{maxLoopIterations:()=>limit}).execute();for(let i=0;i<20;i++)run.next();limit=10000;assert.throws(()=>{while(!run.next().done){}},/10\.000/)})
