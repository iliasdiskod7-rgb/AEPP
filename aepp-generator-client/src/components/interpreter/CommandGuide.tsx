import { memo, useState } from 'react'
import { ChevronDown, Code2 } from 'lucide-react'
import { commandGroups, type CommandSnippet } from '../../interpreter/examples'

function CommandGuide({ onInsert }: { onInsert: (command: CommandSnippet) => void }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(['structures']))
  function toggle(id: string) {
    setOpen(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  return <section className="ide-guide rounded-2xl shadow-xl" aria-labelledby="commands-title">
    <div className="ide-guide-heading"><p className="text-[10px] font-semibold tracking-[.18em] text-sky-300">ΕΡΓΑΛΕΙΟΘΗΚΗ ΓΛΩΣΣΑΣ</p><h2 id="commands-title" className="mt-1 text-base font-semibold text-white">Οδηγός εντολών</h2><p className="mt-1 text-xs leading-5 text-slate-300">Κλικ για εισαγωγή στον κέρσορα. Προσαρμόζεις τα ονόματα στις δηλώσεις σου.</p></div>
    <div className="ide-guide-groups">{commandGroups.map(group => <div key={group.id} className="ide-guide-group">
      <button type="button" aria-expanded={open.has(group.id)} aria-controls={`guide-${group.id}`} onClick={() => toggle(group.id)} className="ide-guide-toggle"><span>{group.title}</span><ChevronDown size={16} className={open.has(group.id) ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" /></button>
      <div id={`guide-${group.id}`} hidden={!open.has(group.id)} className="ide-guide-items">{group.commands.map(command => <button key={command.label} type="button" onMouseDown={event => event.preventDefault()} onClick={() => onInsert(command)} className="ide-guide-item" title={command.description ?? (command.supported === false ? 'Σκελετός για μελλοντική υποστήριξη εκτέλεσης' : `Εισαγωγή ${command.label}`)} aria-label={`Εισαγωγή ${command.label}`}><span className="min-w-0 break-words text-left">{command.label}</span><span className="flex shrink-0 items-center gap-1">{command.supported === false && <span className="ide-guide-later">σύντομα</span>}{command.kind === 'block' && <Code2 size={16} className="text-sky-300" aria-label="Σκελετός πολλών γραμμών" />}</span></button>)}</div>
    </div>)}</div>
  </section>
}

export default memo(CommandGuide)
