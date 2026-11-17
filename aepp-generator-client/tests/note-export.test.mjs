import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {createServer} from 'vite'
import JSZip from 'jszip'
import {Packer} from 'docx'
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});after(()=>server.close())
const {createNoteDocument,noteFilename}=await server.ssrLoadModule('/src/notes/exportNote.ts')
const note={title:'Εύρεση Μεγίστου',code:"ΠΡΟΓΡΑΜΜΑ Μέγιστο\r\n\tΓΡΑΨΕ 'Α < Β & Γ'\r\n  ! σχόλιο\r\n\r\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ",comment:'Προσοχή στην αρχικοποίηση.\nΤο μηδέν δεν είναι πάντα κατάλληλο.',authorName:'Μαρία Παπαδοπούλου',createdAt:'2026-10-14T10:00:00Z',updatedAt:'2026-10-15T11:00:00Z'}
async function contents(input){const buffer=await Packer.toBuffer(await createNoteDocument(input));const zip=await JSZip.loadAsync(buffer);return {buffer,xml:await zip.file('word/document.xml').async('string'),footer:await zip.file('word/footer1.xml').async('string')}}
test('Word export preserves Greek, indentation, font sizes, shaded comments/code and page fields',async()=>{
 const {buffer,xml,footer}=await contents(note)
 assert.match(xml,/Εύρεση Μεγίστου/);assert.match(xml,/Μαρία Παπαδοπούλου/);assert.match(xml,/w:sz w:val="36"/);assert.match(xml,/w:sz w:val="21"/)
 assert.match(xml,/Consolas/);assert.match(xml,/w:fill="F2F2F2"/);assert.match(xml,/w:fill="F1F5F9"/);assert.match(xml,/<w:tab\s*\/>/)
 assert.match(xml,/xml:space="preserve">  ! σχόλιο/);assert.match(xml,/Α &lt; Β &amp; Γ/)
 assert.match(footer,/Δημιουργήθηκε μέσω του AeppHub/);assert.match(footer,/PAGE/);assert.match(footer,/NUMPAGES/)
 await mkdir('.tmp/note-export',{recursive:true});await writeFile('.tmp/note-export/Εύρεση_Μεγίστου_Note.docx',buffer)
})
test('optional comments are omitted and filenames remain safe on Windows',async()=>{
 const {xml}=await contents({...note,comment:null})
 assert.doesNotMatch(xml,/Προσωπικά σχόλια και σημειώσεις/)
 assert.equal(noteFilename('Εύρεση Μεγίστου'),'Εύρεση_Μεγίστου_Note.docx')
 assert.doesNotMatch(noteFilename('../foo:<bar>?*|/'),/[<>:"/\\|?*]/)
 assert.equal(noteFilename('   '),'Σημείωση_Note.docx')
})
