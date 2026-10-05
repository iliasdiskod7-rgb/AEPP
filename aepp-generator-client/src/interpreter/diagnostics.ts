import { GlossaError } from './types'

export type ErrorCategory = 'syntax' | 'type' | 'runtime'
export interface Diagnostic {
  line: number
  category: ErrorCategory
  description: string
}

const labels: Record<ErrorCategory, string> = {
  syntax: 'Σφάλμα Συντακτικό',
  type: 'Σφάλμα Μεταβλητών & Τύπων',
  runtime: 'Σφάλμα Εκτέλεσης',
}

export function toDiagnostic(cause: unknown, fallback: ErrorCategory = 'runtime'): Diagnostic {
  if (cause instanceof GlossaError) return {
    line: cause.line,
    category: cause.category,
    description: cause.description,
  }
  return {
    line: 1,
    category: fallback,
    description: cause instanceof Error ? cause.message : 'Παρουσιάστηκε άγνωστο σφάλμα.',
  }
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `🔴 [${labels[diagnostic.category]}] Γραμμή ${diagnostic.line}: ${diagnostic.description}`
}
