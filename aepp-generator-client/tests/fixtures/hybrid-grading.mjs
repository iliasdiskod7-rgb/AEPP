export const reference = `ΠΡΟΓΡΑΜΜΑ Πινακας
ΜΕΤΑΒΛΗΤΕΣ
ΑΚΕΡΑΙΕΣ: Χ, Υ, Ι, J, Α[2,2]
ΑΡΧΗ
ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ
  ΔΙΑΒΑΣΕ Χ
ΜΕΧΡΙΣ_ΟΤΟΥ Χ >= -100
ΔΙΑΒΑΣΕ Υ
ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2
  ΓΙΑ J ΑΠΟ 1 ΜΕΧΡΙ 2
    Α[Ι,J] <- Χ + Υ
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΓΡΑΨΕ Συνολο(Α)
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ
ΣΥΝΑΡΤΗΣΗ Συνολο(Π): ΑΚΕΡΑΙΑ
ΜΕΤΑΒΛΗΤΕΣ
ΑΚΕΡΑΙΕΣ: Π[2,2], Ι, J, Σ
ΑΡΧΗ
Σ <- 0
ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 2
  ΓΙΑ J ΑΠΟ 1 ΜΕΧΡΙ 2
    Σ <- Σ + Π[Ι,J]
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
Συνολο <- Σ
ΤΕΛΟΣ_ΣΥΝΑΡΤΗΣΗΣ`

export const functionalReference = 'ΠΡΟΓΡΑΜΜΑ Διπλασιο\nΜΕΤΑΒΛΗΤΕΣ\nΑΚΕΡΑΙΕΣ: Χ\nΑΡΧΗ\nΔΙΑΒΑΣΕ Χ\nΓΡΑΨΕ Χ * 2\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ'
const base = {title: 'Δοκιμή μηχανής βαθμολόγησης', prompt: 'Εκπαιδευτικό δείγμα ελέγχου.', chapter: 'Πίνακες και υποπρογράμματα', solution: 'Ενδεικτική λύση'}
const rubric = ['hasValidDeclarations', 'hasValidationLoop', 'hasNestedLoops', 'hasSubprogramCall'].map(kind => ({kind, points: 1}))
const cases = [
  {id: 'κανονικές', inputs: ['1','2'], expectedOutput: ['12'], description: 'Θετικές τιμές'},
  {id: 'μηδέν', inputs: ['0','0'], expectedOutput: ['0'], description: 'Μηδενικές τιμές'},
  {id: 'αρνητικές1', inputs: ['-2','1'], expectedOutput: ['-4'], description: 'Αρνητικό αποτέλεσμα'},
  {id: 'αρνητικές2', inputs: ['-4','-3'], expectedOutput: ['-28'], description: 'Αρνητικές τιμές'},
]
const program = (id, code) => ({...base, id, code, marks: 30, kind: 'program', gradingMode: 'runtime', referenceCode: reference, testCases: cases, rubric})
export const examTemplate = {
  id: 'hybrid-engine-fixture', title: 'Δείγμα κατανομής 20/20/30/30', source: 'practice', durationMinutes: 180,
  sections: [
    {theme: 'Θέμα Α', marks: 20, questions: [
      {...base, id:'a1', code:'Α1', marks:10, kind:'trueFalse', statements:[{id:'one',text:'Δήλωση δοκιμής',answer:true}]},
      {...base, id:'a2', code:'Α2', marks:10, kind:'fill', accepted:['ΟΥΡΑ']},
    ]},
    {theme: 'Θέμα Β', marks: 20, questions: [
      {...base, id:'b1', code:'Β1', marks:10, kind:'codeBlanks', template:'{{1}}', blanks:[{id:'1',accepted:['ΜΕ_ΒΗΜΑ','ΜΕ ΒΗΜΑ','ΒΗΜΑ']}]},
      {...base, id:'b2', code:'Β2', marks:10, kind:'program', gradingMode:'runtime', evaluationStrategy:'functional', referenceCode:functionalReference,
        testCases:[{id:'δύο',inputs:['2'],expectedOutput:['4']},{id:'πέντε',inputs:['5'],expectedOutput:['10']}], rubric:[]},
    ]},
    {theme: 'Θέμα Γ', marks:30, questions:[program('c1','Γ1')]},
    {theme: 'Θέμα Δ', marks:30, questions:[program('d1','Δ1')]},
  ],
}
export const correctAnswers = {a1:{one:'σωςτο'},a2:'  ουρά! ',b1:{'1':'με   βήμα'},b2:functionalReference,c1:reference,d1:reference}
export const faultySource = reference.replace('ΓΡΑΨΕ Συνολο(Α)', 'ΓΡΑΨΕ Α_Τ(Συνολο(Α))')
