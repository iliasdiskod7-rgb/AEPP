# Ιστορικό διαγωνισμάτων και επίσημη αξιολόγηση

Η μονάδα χρησιμοποιεί EF Core 8 με τον ήδη υπάρχοντα λογαριασμό SQLite. Το migration είναι πρόσθετο: δεν αντικαθιστά τους πίνακες Users, UserProgress, DailyChallengeCompletions ή SavedExams. Εφαρμόζεται στην εκκίνηση του API.

## Αρχεία

- AeppGenerator/src/AeppGenerator.Api/Assessment/Entities.cs: Exam, ExamAttempt, QuestionSubmission, GradeRevision και status.
- Data/AssessmentDbContext.cs: σχέσεις, foreign keys, μοναδικά indexes, όρια βαθμών και concurrency token Version.
- Data/Migrations/: αρχικό migration και σταθερό snapshot του μοντέλου.
- Assessment/ExamCatalog.cs: αμετάβλητο αποθηκευμένο διαγώνισμα και ιδιωτικά παραγόμενα διαγωνίσματα.
- Assessment/ExamAttemptService.cs: υποβολή, ιστορικό και αναθεωρήσεις.
- Controllers/ExamAttemptsController.cs: προστατευμένα endpoints.
- aepp-generator-client/src/api/attempts.ts: API calls.
- src/components/assessment/: AssessmentWorkspace, AssessmentHistory, AssessmentReportView και TeacherGradePanel.

## Ροή API

Όλα τα endpoints απαιτούν την υπάρχουσα JWT συνεδρία (Bearer ή HttpOnly cookie με έλεγχο προέλευσης).

1. POST /api/exams/attempts/start: { attemptId: UUID, examId, generatedExam?: ExamJsonResponseDto }. Αποθηκεύει IN_PROGRESS με StartedAt από το API και επιστρέφει το διαγώνισμα της βάσης. Το ίδιο UUID επαναχρησιμοποιείται σε επανάληψη αποτυχημένου αιτήματος.
2. POST /api/exams/attempts/submit: { attemptId, questions: [{ questionId, studentAnswerJson, testResultsJson, autoPoints, maxPoints, feedback?, studentAnswer?, astSummary? }] }. Απαιτεί ακριβώς μία απάντηση ανά ερώτημα, αποθηκεύει ατομικά την υποβολή και επιστρέφει AttemptDetail, μαζί με attemptId και report.
3. GET /api/exams/attempts/my-history?page=1&pageSize=20: αποκλειστικά προσπάθειες του συνδεδεμένου χρήστη, με σκορ ανά θέμα.
4. GET /api/exams/attempts/{attemptId}: ιδιοκτήτης ή καθηγητής για ήδη υποβλημένη προσπάθεια.
5. GET /api/exams/attempts/review-history: μόνο TEACHER, υποβλημένες προσπάθειες προς αξιολόγηση.
6. POST /api/exams/attempts/{attemptId}/grade: μόνο TEACHER. Σώμα { revisedScore: 85.25, teacherComments: "Αιτιολόγηση αξιολόγησης", expectedVersion: 1 }. Κάθε επιτυχία προσθέτει νέα GradeRevision, ενημερώνει FinalScore/Status και αυξάνει Version. Παλιή έκδοση επιστρέφει 409.

UserId, TeacherId και χρονικές σημάνσεις προέρχονται από το API. Δεν γίνονται δεκτά από τον browser. Η επανάληψη της ίδιας υποβολής επιστρέφει την ήδη αποθηκευμένη προσπάθεια. Διαφορετικές απαντήσεις μετά την υποβολή απαιτούν νέα προσπάθεια. Ο αυτόματος βαθμός διατηρείται μετά την αξιολόγηση καθηγητή.

## Βαθμολογία και πεδίο πρόσβασης

Τα αντικειμενικά ερωτήματα διορθώνονται ξανά στον server από την κοινή τράπεζα practice-exam.json. Τα αποτελέσματα εκτέλεσης ΓΛΩΣΣΑΣ εξακολουθούν να προέρχονται από τον browser και είναι προσωρινή αυτοαξιολόγηση, όχι ασφαλής βαθμολογία επίσημης εξέτασης. Οι ελεύθερες απαντήσεις και τα παραγόμενα διαγωνίσματα παραμένουν προς έλεγχο καθηγητή. Επίσημος βαθμός υπάρχει όταν το status είναι GRADED_BY_TEACHER. Το API δεν διαθέτει ακόμη σχέσεις ανάθεσης καθηγητή/τάξης: οι λογαριασμοί TEACHER έχουν πρόσβαση σε όλες τις υποβλημένες προσπάθειες.

Τα decimal scores αποθηκεύονται ως ακέραια εκατοστά μονάδας στη SQLite. Το SubmittedAt είναι nullable όσο η προσπάθεια είναι IN_PROGRESS. Οι παλαιές προσπάθειες διατηρούν το αρχικό αποθηκευμένο διαγώνισμα. Για αλλαγή της κοινής τράπεζας απαιτείται νέο exam id.

## Εκκίνηση και έλεγχοι

Επανεκκίνησε το API για να ενεργοποιηθούν τα endpoints και να εφαρμοστεί το migration. Για εφαρμογή μόνο του migration: dotnet run --project AeppGenerator/src/AeppGenerator.Api -- --migrate-assessments (με το υπάρχον περιβάλλον Development ή ρυθμισμένο Auth:SigningKey).

- dotnet run --project AeppGenerator/tests/AeppGenerator.AttemptChecks
- cd aepp-generator-client και npm run test:attempts
- npm run test:assessment
- npm run build

Το HTTP test host χρησιμοποιεί ξεχωριστή προσωρινή SQLite και πραγματικές JWT συνεδρίες. Ελέγχει ownership, ρόλους, idempotency, concurrent revisions, migration, βαθμούς και διατήρηση των παλαιών δεδομένων.
