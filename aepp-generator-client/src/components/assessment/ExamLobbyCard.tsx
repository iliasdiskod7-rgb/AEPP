import { BookOpen, Clock3, Dice5, ArrowRight, ShieldCheck } from 'lucide-react'
import type { AssessmentExam } from '../../assessment/model'
import { examOverview } from '../../assessment/examLobby'
export default function ExamLobbyCard({
  exam,
  busy,
  onShuffle,
  onStart,
  canShuffle,
}: {
  exam: AssessmentExam
  busy: string | null
  onShuffle: () => void
  onStart: () => void
  canShuffle: boolean
}) {
  const overview = examOverview(exam)
  return (
    <article className="exam-lobby-card" aria-busy={!!busy}>
      <div className="exam-lobby-main">
        <div className="exam-lobby-heading">
          <BookOpen size={28} aria-hidden="true" />
          <span>Προεπισκόπηση διαγωνίσματος</span>
        </div>
        <h2 key={exam.id} className="exam-lobby-title">
          {exam.title}
        </h2>
        <div className="exam-lobby-badges">
          <span>
            <Clock3 size={16} />
            {exam.durationMinutes} λεπτά
          </span>
          <span>
            <ShieldCheck size={16} />
            {overview.marks} μονάδες · {exam.sections.length} θέματα
          </span>
          <span>Δυσκολία: {exam.difficulty ?? 'δεν έχει οριστεί'}</span>
        </div>
        <h3>Καλυπτόμενη ύλη</h3>
        <ul className="exam-lobby-topics">
          {overview.topics.map(topic => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
        <p className="exam-lobby-help">
          Το χρονόμετρο ξεκινά όταν πατήσεις «Έναρξη». Οι λύσεις εμφανίζονται μετά την υποβολή.
        </p>
      </div>
      <div className="exam-lobby-outline">
        <h3>Η δομή της εξέτασης</h3>
        <ol>
          {exam.sections.map(section => (
            <li key={section.theme}>
              <div>
                <strong>{section.theme}</strong>
                <span>{section.marks} μονάδες</span>
              </div>
              <p>{[...new Set(section.questions.map(q => q.title))].join(' · ')}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="exam-lobby-actions">
        <button type="button" disabled={!!busy || !canShuffle} onClick={onShuffle} className="exam-lobby-shuffle">
          <Dice5 aria-hidden="true" className={busy === 'random' ? 'exam-dice-rolling' : ''} size={20} />
          {busy === 'random' ? 'Επιλογή διαγωνίσματος…' : 'Τυχαίο διαγώνισμα'}
        </button>
        <button type="button" className="exam-lobby-start" disabled={!!busy} onClick={onStart}>
          {busy === 'start' ? 'Προετοιμασία…' : 'Έναρξη διαγωνίσματος'}
          <ArrowRight size={19} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
