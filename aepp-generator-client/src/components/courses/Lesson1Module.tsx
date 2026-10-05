import { lesson1Data } from '../../data/courses/lesson1'
import { LessonModule } from './LessonModule'

export default function Lesson1Module() {
  return <LessonModule lesson={lesson1Data} lessonNumber={1} />
}
