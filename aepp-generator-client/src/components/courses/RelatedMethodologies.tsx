import { ArrowUpRight, Zap } from 'lucide-react'
import { getRelatedMethodologies } from '../../patterns/methodologiesData'

export default function RelatedMethodologies({ lessonId, onOpen }: { lessonId: string; onOpen: (id: string) => void }) {
 const related = getRelatedMethodologies(lessonId)
 if (!related.length) return null
 return <section className="related-methodologies" aria-labelledby="related-methodologies-title">
  <h3 id="related-methodologies-title"><Zap size={18} aria-hidden="true" />Σχετικές Μεθοδολογίες & Τεχνικές</h3>
  <div className="methodology-chips">{related.map(methodology => <button key={methodology.id} type="button" onClick={() => onOpen(methodology.id)} title={methodology.summary}>
   {methodology.title}<ArrowUpRight size={15} aria-hidden="true" />
  </button>)}</div>
 </section>
}
