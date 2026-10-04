import { useId, useState, type FormEvent } from 'react'
import { LoaderCircle, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { ExamDifficulty, ExamTheme, GenerateExamRequest } from '../types/exam'
import { Button } from './common/Button'
import { cn } from '../lib/utils'

export const topicOptions = [
  'Εισαγωγή/Αλγόριθμοι',
  'Δομές Επιλογής/Επανάληψης',
  'Πίνακες (1Δ & 2Δ)',
  'Ταξινόμηση & Αναζήτηση',
  'Υποπρογράμματα (Συναρτήσεις/Διαδικασίες)',
  'Δομές Δεδομένων (Στοίβα/Ουρά)',
]

// Οι ετικέτες της διεπαφής αντιστοιχούν στις τιμές που δέχεται το .NET.
export const difficultyOptions: { label: string; value: ExamDifficulty }[] = [
  { label: 'Βασικό', value: 'Εύκολο' },
  { label: 'Μεσαίο', value: 'Μεσαίο' },
  { label: 'Πανελλαδικού Επιπέδου', value: 'Αυξημένης Δυσκολίας' },
]
export const themeOptions: { label: string; value: ExamTheme }[] = [
  { label: 'Θέμα Α (Θεωρία)', value: 'Θέμα Α' },
  { label: 'Θέμα Β (Ιχνηλάτηση/Κενά)', value: 'Θέμα Β' },
  { label: 'Θέμα Γ (Πρόβλημα)', value: 'Θέμα Γ' },
  { label: 'Θέμα Δ (Υποπρογράμματα)', value: 'Θέμα Δ' },
]

export const defaultRequest: GenerateExamRequest = {
  targetTopics: [topicOptions[0], topicOptions[1], topicOptions[2], topicOptions[4]],
  difficulty: 'Μεσαίο',
  includeThemes: themeOptions.map(option => option.value),
  customInstructions: null,
}

export interface ExamFormProps {
  onSubmit: (request: GenerateExamRequest) => void | Promise<void>
  isLoading?: boolean
  error?: string | null
  initialValues?: GenerateExamRequest
  isDemo?: boolean
}

export default function ExamForm({ onSubmit, isLoading = false, error, initialValues = defaultRequest, isDemo = false }: ExamFormProps) {
  const id = useId()
  const [request, setRequest] = useState<GenerateExamRequest>(() => ({ ...initialValues,
    targetTopics: [...initialValues.targetTopics], includeThemes: [...initialValues.includeThemes],
  }))
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const busy = isLoading || submitting
  const topicsMissing = request.targetTopics.length === 0
  const themesMissing = request.includeThemes.length === 0

  function toggleTopic(topic: string) {
    setRequest(current => ({ ...current, targetTopics: current.targetTopics.includes(topic)
      ? current.targetTopics.filter(value => value !== topic) : [...current.targetTopics, topic] }))
  }
  function toggleTheme(theme: ExamTheme) {
    setRequest(current => ({ ...current, includeThemes: current.includeThemes.includes(theme)
      ? current.includeThemes.filter(value => value !== theme) : [...current.includeThemes, theme] }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setSubmitted(true)
    setSubmitError(null)
    if (topicsMissing || themesMissing) return
    setSubmitting(true)
    try {
      await onSubmit({ ...request, targetTopics: [...request.targetTopics],
        includeThemes: themeOptions.filter(option => request.includeThemes.includes(option.value)).map(option => option.value),
        customInstructions: request.customInstructions?.trim() || null,
      })
    } catch {
      setSubmitError('Δεν ήταν δυνατή η δημιουργία του διαγωνίσματος. Δοκίμασε ξανά.')
    } finally { setSubmitting(false) }
  }

  return <form onSubmit={event => void handleSubmit(event)} aria-busy={busy} className="space-y-6 p-6">
    <div><h1 className="flex items-center gap-2 text-sm font-semibold text-teal-900"><SlidersHorizontal size={17} />Ρυθμίσεις διαγωνίσματος</h1><p className="mt-2 text-xs leading-5 text-stone-500">Πληροφορική Προσανατολισμού · Γ΄ Λυκείου</p></div>
    <fieldset disabled={busy} aria-describedby={submitted && topicsMissing ? `${id}-topics-error` : undefined}>
      <legend className="mb-3 text-sm font-semibold">Επιλογή Ύλης</legend>
      <div className="space-y-2">{topicOptions.map(topic => <label key={topic} className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-stone-600"><input type="checkbox" checked={request.targetTopics.includes(topic)} onChange={() => toggleTopic(topic)} className="mt-1 h-4 w-4 shrink-0 accent-teal-800" />{topic}</label>)}</div>
      {submitted && topicsMissing && <p id={`${id}-topics-error`} role="alert" className="mt-2 text-xs text-red-700">Επίλεξε τουλάχιστον μία ενότητα ύλης.</p>}
    </fieldset>
    <fieldset disabled={busy}><legend className="mb-3 text-sm font-semibold">Βαθμός Δυσκολίας</legend><div className="space-y-2">{difficultyOptions.map(option => <label key={option.value} className={cn('flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-xs', request.difficulty === option.value ? 'border-teal-700/30 bg-teal-50 text-teal-900' : 'border-stone-200 text-stone-600')}><input type="radio" name={`${id}-difficulty`} value={option.value} checked={request.difficulty === option.value} onChange={() => setRequest(current => ({ ...current, difficulty: option.value }))} className="accent-teal-800" />{option.label}</label>)}</div></fieldset>
    <fieldset disabled={busy} aria-describedby={submitted && themesMissing ? `${id}-themes-error` : undefined}><legend className="mb-3 text-sm font-semibold">Επιλογή Θεμάτων</legend><div className="space-y-2">{themeOptions.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-stone-200 p-3 text-xs"><input type="checkbox" checked={request.includeThemes.includes(option.value)} onChange={() => toggleTheme(option.value)} className="h-4 w-4 accent-teal-800" />{option.label}</label>)}</div>
      {submitted && themesMissing && <p id={`${id}-themes-error`} role="alert" className="mt-2 text-xs text-red-700">Επίλεξε τουλάχιστον ένα θέμα.</p>}
    </fieldset>
    <label className="block text-xs font-semibold" htmlFor={`${id}-instructions`}>Ειδικές οδηγίες <span className="font-normal text-stone-400">(προαιρετικά)</span>
      <textarea id={`${id}-instructions`} rows={4} disabled={busy} value={request.customInstructions ?? ''} onChange={event => setRequest(current => ({ ...current, customInstructions: event.target.value }))} placeholder="π.χ. Να συμπεριληφθεί άσκηση με έλεγχο εγκυρότητας." className="mt-2 w-full resize-y rounded-lg border border-stone-200 p-3 text-sm font-normal leading-6 placeholder:text-stone-400" />
    </label>
    {isDemo && <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Σταθερό δείγμα με 25 μονάδες ανά θέμα. Η επιλογή θεμάτων εφαρμόζεται χωρίς αλλαγή βαθμολόγησης. Η ύλη, η δυσκολία και οι ειδικές οδηγίες θα χρησιμοποιηθούν όταν συνδεθεί η υπηρεσία παραγωγής.</p>}
    <Button type="submit" disabled={busy} className="w-full py-3">{busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}{busy ? 'Δημιουργία…' : 'Δημιουργία Διαγωνίσματος'}</Button>
    <p role="status" className="sr-only">{busy ? 'Το διαγώνισμα δημιουργείται. Παρακαλώ περιμένετε.' : ''}</p>
    {(error || submitError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-800">{error || submitError}</p>}
  </form>
}
