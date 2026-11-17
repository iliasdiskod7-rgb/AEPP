import { GlossaError } from './types'

export type ErrorCategory = 'syntax' | 'runtime' | 'logic'
export interface Diagnostic {
  line: number
  category: ErrorCategory
  description: string
}

const labels: Record<ErrorCategory, string> = {
  syntax: 'Συντακτικό λάθος',
  logic: 'Λογικό λάθος',
  runtime: 'Λάθος κατά την εκτέλεση',
}

export function toDiagnostic(cause: unknown, fallback: ErrorCategory | 'type' = 'runtime'): Diagnostic {
  if (cause instanceof GlossaError)
    return {
      line: cause.line,
      category: cause.category === 'type' ? 'syntax' : cause.category,
      description: cause.description,
    }
  return {
    line: 1,
    category: fallback === 'type' ? 'syntax' : fallback,
    description: cause instanceof Error ? cause.message : 'Παρουσιάστηκε άγνωστο σφάλμα.',
  }
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `🔴 [${labels[diagnostic.category]}] Γραμμή ${diagnostic.line}: ${diagnostic.description}`
}
