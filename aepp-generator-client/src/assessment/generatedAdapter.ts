import type { ExamJsonResponseDto } from '../types/exam'
import type { AssessmentExam, AssessmentQuestion } from './model'

/** Το σημερινό συμβόλαιο Gemini δεν περιέχει δομημένο κλειδί ή δοκιμές. Αυτές οι απαντήσεις απαιτούν έλεγχο. */
export function generatedToAssessment(source: ExamJsonResponseDto): AssessmentExam {
  const content = JSON.stringify(source.sections)
  let signature = 2166136261
  for (let index = 0; index < content.length; index++) signature = Math.imul(signature ^ content.charCodeAt(index), 16777619)
  return {
    id: `generated-${(signature >>> 0).toString(36)}`,
    title: source.title,
    durationMinutes: source.durationMinutes,
    source: 'generated',
    sections: source.sections.map(section => ({
      theme: section.theme,
      marks: section.totalMarks,
      questions: section.questions.map((question): AssessmentQuestion => {
        const base = {
          id: `${section.theme}-${question.code}`, code: question.code, title: question.code,
          prompt: question.questionText + (question.glowCodeSnippet ? `\n\n\`\`\`glossa\n${question.glowCodeSnippet}\n\`\`\`` : ''),
          marks: question.marks, chapter: 'Ύλη διαγωνίσματος', solution: question.solutionText,
        }
        if (section.theme === 'Θέμα Γ' || section.theme === 'Θέμα Δ') {
          const referenceCode = /```(?:glossa|ΓΛΩΣΣΑ)\s*\n([\s\S]*?)```/iu.exec(question.solutionText)?.[1]?.trim() ?? ''
          return { ...base, kind: 'program', gradingMode: 'review', referenceCode, testCases: [], rubric: [] }
        }
        return { ...base, kind: 'open' }
      }),
    })),
  }
}
