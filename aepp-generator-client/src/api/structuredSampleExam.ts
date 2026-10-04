import type { ExamJsonResponseDto, ExamTheme, GenerateExamRequest, SectionType, ExecutionTrace } from '../types/exam'
import { createDemoExam, defaultCommand } from './sampleExam'

const themeMap: Record<ExamTheme, SectionType> = {
  'Θέμα Α': 'ThemeA', 'Θέμα Β': 'ThemeB', 'Θέμα Γ': 'ThemeC', 'Θέμα Δ': 'ThemeD',
}

function traceMarkdown(trace: ExecutionTrace, answers: boolean): string {
  const row = (cells: unknown[]) => '| ' + cells.map(value => String(value ?? '').replaceAll('|', '\\|')).join(' | ') + ' |'
  return '\n\n' + [row(trace.columns), row(trace.columns.map(() => '---')),
    ...trace.rows.map(cells => row(cells.map((cell, index) => answers || index === 0 ? cell : '…'))),
  ].join('\n')
}

/** Προσαρμογή του σταθερού δείγματος στο νέο συμβόλαιο, χωρίς παραγωγή από μοντέλο. */
export function createStructuredSampleExam(request: GenerateExamRequest): ExamJsonResponseDto {
  const sample = createDemoExam(defaultCommand, request.includeThemes.map(theme => themeMap[theme]))
  return {
    title: sample.title,
    durationMinutes: 180,
    sections: sample.sections.map(section => ({
      theme: (Object.keys(themeMap) as ExamTheme[]).find(theme => themeMap[theme] === section.sectionType)!,
      totalMarks: section.totalMarks,
      questions: section.questions.map(question => {
        const match = /```glossa\n([\s\S]*?)```/.exec(question.contentMarkdown)
        const trace = question.executionTraceJson ? JSON.parse(question.executionTraceJson) as ExecutionTrace : null
        return {
          code: question.subTitle,
          questionText: question.contentMarkdown.replace(/```glossa\n[\s\S]*?```/, '').trim() + (trace ? traceMarkdown(trace, false) : ''),
          glowCodeSnippet: match?.[1].trim() ?? null,
          solutionText: question.solutionMarkdown + (trace ? traceMarkdown(trace, true) : ''),
          marks: question.marks,
        }
      }),
    })),
  }
}
