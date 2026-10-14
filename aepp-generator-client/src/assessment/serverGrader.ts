import { stdin, stdout } from 'node:process'
import { gradeAssessment } from './grading'
import { runTestCases } from './execution'
import { AssessmentExamSchema, AnswerSheetSchema, AssessmentReportSchema } from './schemas'

// The .NET process supplies the trusted definition through stdin. Student text is
// parsed as ΓΛΩΣΣΑ; it is never evaluated as JavaScript or a shell command.
let input=''
for await(const chunk of stdin){input+=chunk;if(input.length>2_000_000)throw new Error('Υπέρβαση μεγέθους υποβολής.')}
const request=JSON.parse(input)
const report=await gradeAssessment(AssessmentExamSchema.parse(request.exam),AnswerSheetSchema.parse(request.answers),async(source,cases)=>runTestCases(source,cases))
stdout.write(JSON.stringify(AssessmentReportSchema.parse(report)))
