import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import ExamForm, { defaultRequest } from './components/ExamForm'
import ExamPreview from './components/ExamPreview'
import { isDemoMode, useGenerateExam } from './api/exams'
import { createStructuredSampleExam } from './api/structuredSampleExam'
import { getApiError } from './api/client'
import type { ExamJsonResponseDto, GenerateExamRequest } from './types/exam'

export default function App() {
  const [exam, setExam] = useState<ExamJsonResponseDto | null>(() => isDemoMode ? createStructuredSampleExam(defaultRequest) : null)
  const [notice, setNotice] = useState('')
  const generation = useGenerateExam()

  async function generate(request: GenerateExamRequest) {
    setNotice('')
    const result = await generation.mutateAsync(request)
    setExam(result)
    setNotice(isDemoMode ? 'Η προεπισκόπηση του δείγματος ενημερώθηκε.' : 'Το διαγώνισμα δημιουργήθηκε επιτυχώς.')
  }

  return <div className="min-h-screen bg-[#f6f5f1] text-stone-800">
    <a href="#exam-preview" className="skip-link">Μετάβαση στην προεπισκόπηση</a>
    <header className="app-header flex min-h-19 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-5 py-4 lg:px-8"><div className="flex items-center gap-3"><div className="rounded-xl bg-[#172f32] p-2.5 text-white"><BookOpen size={22} /></div><div><p className="text-lg font-bold">ΑΕΠΠ <span className="font-normal text-stone-400">/ εργαστήριο</span></p><p className="text-[10px] text-stone-500">Πληροφορική Προσανατολισμού · Γ΄ Λυκείου</p></div></div><span className="rounded-full border border-stone-200 px-3 py-1.5 text-xs text-stone-500">{isDemoMode ? 'Ενδεικτικό διαγώνισμα' : 'Σύνδεση με διακομιστή'}</span></header>
    <div className="workspace grid lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="settings border-b border-stone-200 bg-white lg:border-r"><ExamForm onSubmit={generate} isLoading={generation.isPending} error={generation.error ? getApiError(generation.error) : null} isDemo={isDemoMode} /></aside>
      <main id="exam-preview" tabIndex={-1} className="min-w-0 p-4 sm:p-8"><div className="mx-auto max-w-5xl"><p role="status" className="preview-controls mb-3 text-xs text-teal-800">{notice}</p><ExamPreview exam={exam} isLoading={generation.isPending} isDemo={isDemoMode} /></div></main>
    </div>
  </div>
}
