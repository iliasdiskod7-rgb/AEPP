import { z } from 'zod'
export const NoteInputSchema=z.object({title:z.string().trim().min(1,'Συμπλήρωσε τίτλο.').max(200),code:z.string().min(1).max(100000).refine(s=>s.trim().length>0,'Γράψε πρώτα κάποιον κώδικα.'),comment:z.string().max(5000).nullable().optional(),expectedUpdatedAt:z.iso.datetime({offset:true}).optional()})
export const CodeNoteSchema=z.object({id:z.uuid(),title:z.string().min(1).max(200),code:z.string().min(1).max(100000),comment:z.string().max(5000).nullable(),createdAt:z.iso.datetime({offset:true}),updatedAt:z.iso.datetime({offset:true})})
export type CodeNote=z.infer<typeof CodeNoteSchema>
export type NoteInput=z.infer<typeof NoteInputSchema>
export function suggestedNoteTitle(code:string){return /^\s*ΠΡΟΓΡΑΜΜΑ\s+([^!\r\n]+)/imu.exec(code)?.[1].trim().slice(0,200)||'Νέα άσκηση ΓΛΩΣΣΑΣ'}
export function noteSnippet(code:string){return code.split(/\r?\n/).slice(0,5).join('\n').slice(0,700)}
export function filterNotes(notes:CodeNote[],search:string){const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('el-GR');const q=normalize(search.trim());return notes.filter(n=>normalize(n.title+' '+(n.comment??'')).includes(q))}
