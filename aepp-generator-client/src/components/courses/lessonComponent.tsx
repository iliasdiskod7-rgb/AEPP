import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { Lesson } from '../../data/courses/lesson1'
import { LessonModule } from './LessonModule'

// Ένα component για όλα τα μαθήματα: τα δεδομένα φορτώνονται μόνο όταν ανοίξει το μάθημα.
export function lessonComponent(
  lessonNumber: number | string,
  load: () => Promise<Lesson>,
): LazyExoticComponent<ComponentType> {
  return lazy(async () => {
    const lesson = await load()
    return { default: () => <LessonModule lesson={lesson} lessonNumber={lessonNumber} /> }
  })
}
