import type { VisualizerId } from '../../data/courses/lesson1'
import { searchAlgorithms } from './searchSteps'
import { sortAlgorithms } from './sortSteps'
import type { ArrayAlgorithm } from './types'

export const arrayAlgorithms: Record<VisualizerId, ArrayAlgorithm> = { ...sortAlgorithms, ...searchAlgorithms }

export const defaultSortValues = [45, 18, 72, 12, 60, 33, 24]
export const defaultSearchValues = [3, 8, 12, 17, 24, 31, 40, 46, 52, 60]
export const defaultSearchKey = 46

export function parseArrayValues(input: string): { values: number[] } | { error: string } {
  const parts = input
    .split(/[\s,;]+/)
    .map(part => part.trim())
    .filter(Boolean)
  if (parts.length < 2 || parts.length > 12) return { error: 'Δώσε από 2 έως 12 ακέραιους.' }
  const values = parts.map(Number)
  if (values.some(value => !Number.isInteger(value) || value < -999 || value > 999))
    return { error: 'Όλες οι τιμές πρέπει να είναι ακέραιοι από -999 έως 999.' }
  return { values }
}

export function parseKey(input: string): { key: number } | { error: string } {
  const key = Number(input.trim())
  if (input.trim() === '' || !Number.isInteger(key) || key < -999 || key > 999)
    return { error: 'Το key πρέπει να είναι ακέραιος από -999 έως 999.' }
  return { key }
}

export function randomArrayValues(length = 6 + Math.floor(Math.random() * 3)): number[] {
  return Array.from({ length }, () => 10 + Math.floor(Math.random() * 90))
}

/** Τυχαίος πίνακας διαφορετικών τιμών για αναζήτηση και ένα key που άλλοτε υπάρχει κι άλλοτε όχι. */
export function randomSearchCase(): { values: number[]; key: number } {
  const pool = new Set<number>()
  while (pool.size < 10) pool.add(1 + Math.floor(Math.random() * 99))
  const values = [...pool]
  const key =
    Math.random() < 0.75 ? values[Math.floor(Math.random() * values.length)] : 100 + Math.floor(Math.random() * 20)
  return { values, key }
}

export const ascending = (values: number[]) => [...values].sort((a, b) => a - b)
