import { useEffect, useRef, useState } from 'react'
import { Clock3, Feather, Sparkles } from 'lucide-react'
import type { GenerateExamRequest } from '../types/exam'
import './ExamGenerationSplash.css'

interface Props {
  request: GenerateExamRequest
}

export default function ExamGenerationSplash({ request }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    if (window.matchMedia('(max-width: 1279px)').matches) {
      panel.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
    return () => window.clearInterval(timer)
  }, [])

  const time = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`
  const difficulty = request.difficulty === 'Αυξημένης Δυσκολίας'
    ? 'Πανελλαδικού επιπέδου' : request.difficulty === 'Εύκολο' ? 'Βασικό επίπεδο' : 'Μεσαίο επίπεδο'

  return <section ref={panel} className="generation-splash" aria-labelledby="generation-heading">
    <div className="generation-topline"><span><span className="generation-live-dot" />Το εργαστήριο δημιουργεί</span><Sparkles size={17} aria-hidden="true" /></div>

    <div className="generation-art" aria-hidden="true">
      <div className="generation-orbit" />
      <span className="generation-symbol generation-symbol-left">{'<-'}</span>
      <span className="generation-symbol generation-symbol-right">[1..Ν]</span>
      <div className="generation-paper-back" />
      <div className="generation-paper">
        <div className="generation-paper-heading"><span>ΑΕΠΠ</span><span>Γ΄ ΛΥΚΕΙΟΥ</span></div>
        <div className="generation-paper-rule" />
        <div className="generation-paper-title">Το επόμενο<br />διαγώνισμά σου.</div>
        <div className="generation-paper-lines"><i /><i /><i /></div>
        <div className="generation-paper-code"><span>ΑΡΧΗ</span><i /><i /><span>ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ</span></div>
        <div className="generation-paper-footer"><span>ΠΛΗΡΟΦΟΡΙΚΗ</span><span>01</span></div>
      </div>
      <span className="generation-pen"><Feather size={27} strokeWidth={1.5} /></span>
      <span className="generation-spark generation-spark-one">✦</span>
      <span className="generation-spark generation-spark-two">✦</span>
    </div>

    <div className="generation-copy">
      <p className="generation-eyebrow">Λίγη υπομονή, πολλή έμπνευση</p>
      <h2 id="generation-heading">Η επόμενη πρόκληση<br /><em>παίρνει μορφή.</em></h2>
      <p className="generation-description" role="status">Δημιουργείται το διαγώνισμά σου με βάση την ύλη<br className="hidden sm:block" /> και τις επιλογές που όρισες.</p>
      <ul className="generation-themes" aria-label="Επιλεγμένα θέματα">{request.includeThemes.map(theme => <li key={theme}>{theme}</li>)}</ul>
      <p className="generation-difficulty">{difficulty}</p>
    </div>

    <div className="generation-wait">
      <div className="generation-wait-label"><span>Δημιουργία σε εξέλιξη<span className="generation-dots" aria-hidden="true"><i /><i /><i /></span></span><span className="generation-clock" aria-label={`Χρόνος αναμονής ${Math.floor(elapsed / 60)} λεπτά και ${elapsed % 60} δευτερόλεπτα`}><Clock3 size={13} aria-hidden="true" />{time}</span></div>
      <div className="generation-track" aria-hidden="true"><span /></div>
      <p className="generation-wait-note">{elapsed >= 60 ? 'Η δημιουργία συνεχίζεται. Σε αυξημένο φόρτο μπορεί να χρειαστεί περισσότερος χρόνος.' : 'Μπορεί να χρειαστούν έως 4 λεπτά. Το διαγώνισμα θα εμφανιστεί αυτόματα εδώ.'}</p>
    </div>
    <div className="generation-bottomline"><span>ΠΛΗΡΟΦΟΡΙΚΗ ΠΡΟΣΑΝΑΤΟΛΙΣΜΟΥ</span><span>ΑΕΠΠ / εργαστήριο</span></div>
  </section>
}
