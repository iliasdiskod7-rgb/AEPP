import type { Difficulty, SectionType } from '../types/exam'

export const difficultyLabels: Record<Difficulty, string> = {
  Easy: 'Εύκολη', Medium: 'Μέτρια', Hard: 'Δύσκολη',
}
export const sectionLetters: Record<SectionType, string> = {
  ThemeA: 'Α', ThemeB: 'Β', ThemeC: 'Γ', ThemeD: 'Δ',
}
