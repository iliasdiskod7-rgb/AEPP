# Λογαριασμοί και μόνιμη αποθήκευση

Υλοποίηση στο υπάρχον .NET 8 API, με SQLite, BCrypt.Net και JWT Bearer authentication. Το React χρησιμοποιεί AuthProvider, ProtectedRoute και φόρμες σύνδεσης/εγγραφής.

## Βάση

Προεπιλεγμένο αρχείο: AeppGenerator/src/AeppGenerator.Api/App_Data/accounts.sqlite.
Η εκκίνηση δημιουργεί τη βάση και το schema από το Data/schema.sql. Εναλλακτική διαδρομή: Accounts__DatabasePath.
Πίνακες: Users, UserProgress, DailyChallengeCompletions, SavedExams, AuthSessions.
Τα αρχεία accounts.sqlite-wal και accounts.sqlite-shm ανήκουν στην ενεργή SQLite βάση. Για ασφαλές αντίγραφο χρησιμοποίησε SQLite backup ή σταμάτησε πρώτα το API. Τα App_Data αρχεία δεν καταχωρίζονται στο Git.

Προβολή με DB Browser for SQLite: https://sqlitebrowser.org/ → Open Database → accounts.sqlite → Browse Data → επιλογή πίνακα.
Το schema.sql είναι ο πηγαίος ορισμός των πινάκων, όχι το αρχείο με τα δεδομένα.

## API

| Endpoint | Πρόσβαση | Λειτουργία |
| --- | --- | --- |
| POST /api/auth/register | Δημόσια | Εγγραφή μαθητή, αρχικοποίηση προόδου και σύνδεση |
| POST /api/auth/login | Δημόσια | Επαλήθευση κωδικού, JWT και cookie |
| GET /api/auth/me | Συνδεδεμένος | Στοιχεία χρήστη και πρόοδος |
| POST /api/auth/logout | Συνδεδεμένος | Ανάκληση συνεδρίας και διαγραφή cookie |
| GET /api/gamification | Συνδεδεμένος | Σημερινό challenge και ιστορικό του χρήστη |
| POST /api/gamification/start | Συνδεδεμένος | Έναρξη χρονόμετρου server |
| POST /api/gamification/theory | Συνδεδεμένος | Κλείδωμα πρώτης θεωρητικής απάντησης |
| POST /api/daily-challenge/submit | Συνδεδεμένος | Server grading, XP, streak και badges |
| GET /api/user-exams | Συνδεδεμένος | Τελευταία 100 δικά του διαγωνίσματα |
| GET /api/user-exams/{id} | Ιδιοκτήτης | Πλήρες διαγώνισμα |
| POST /api/user-exams | Συνδεδεμένος | Αποθήκευση πλήρους διαγωνίσματος 100 μονάδων |
| POST /api/exams/generate | Καθηγητής | Παραγωγή και αυτόματη αποθήκευση |

Η εγγραφή δέχεται email, password και fullName. Ο ρόλος δεν λαμβάνεται από τον browser: κάθε νέος λογαριασμός είναι STUDENT. Οι δημόσιες εγγραφές δεν μπορούν να αποκτήσουν δικαιώματα TEACHER.

Ο διαχειριστής προάγει υπάρχοντα λογαριασμό από τον φάκελο του έργου:

~~~powershell
dotnet run --project AeppGenerator/src/AeppGenerator.Api -c Release -- --promote-teacher teacher@example.com --environment Development
~~~

Η προαγωγή ανακαλεί τις παλιές συνεδρίες. Ο καθηγητής συνδέεται ξανά.

## Ρυθμίσεις εκκίνησης

Ανάπτυξη:

~~~powershell
dotnet run --project AeppGenerator/src/AeppGenerator.Api -c Release -- --urls http://localhost:5210 --environment Development
~~~

Το frontend κάνει proxy στο localhost:5210. Ρύθμιση διαφορετικού API: API_PROXY_TARGET για το Vite, ή VITE_API_BASE_URL για ξεχωριστό deployment.
Η ταυτοποίηση και η πρόοδος χρησιμοποιούν πάντα το API. Το VITE_USE_DEMO αφορά μόνο την παραγωγή/ανάλυση διαγωνισμάτων. Τα ενδεικτικά διαγωνίσματα αποθηκεύονται επίσης όταν δημιουργούνται από συνδεδεμένο καθηγητή.

Σε παραγωγή απαιτούνται HTTPS και Auth__SigningKey: Base64 κλειδί τουλάχιστον 32 τυχαίων bytes, εκτός repository. Auth__FrontendOrigins: επιτρεπόμενα origins χωρισμένα με κόμμα. Το Accounts__DatabasePath πρέπει να δείχνει σε μόνιμο δίσκο με δικαίωμα εγγραφής. Στην ανάπτυξη το κλειδί δημιουργείται στο App_Data/auth-signing.key και επαναχρησιμοποιείται.

## Συνεδρίες και δεδομένα

JWT HS256 με διάρκεια μία ώρα, έλεγχο υπογραφής, issuer, audience και λήξης. Κάθε αίτημα ελέγχει επίσης ότι η συνεδρία παραμένει ενεργή και ο ρόλος συμφωνεί με τη βάση. JWT επιστρέφεται στο login/register και κρατείται μόνο στη μνήμη React. HttpOnly/SameSite=Strict cookie αποκαθιστά τη σύνδεση με το /auth/me μετά την ανανέωση. Δεν γράφεται JWT στο LocalStorage. Το token του AuthContext μπορεί να είναι null μετά την ανανέωση, ενώ isAuthenticated παραμένει true επειδή χρησιμοποιείται το cookie.

Τα αιτήματα με Authorization: Bearer επαληθεύονται από το JWT middleware. Με cookie, οι ενέργειες εγγραφής απαιτούν επιτρεπόμενο Origin. Logout ανακαλεί και το bearer token, όχι μόνο την κατάσταση του frontend. Οι κωδικοί αποθηκεύονται με bcrypt cost 12, με έλεγχο του ορίου 72 UTF-8 bytes. Login/register διαθέτουν όριο 10 προσπαθειών ανά λεπτό ανά IP.

Το userId προκύπτει από το JWT. Το submit δέχεται day και answers, ποτέ έτοιμα XP/streak από τον πελάτη. Η ολοκλήρωση, οι πόντοι και το σερί γράφονται σε μία SQLite συναλλαγή και το UNIQUE(UserId,ChallengeDate) εμποδίζει διπλή καταχώριση. Διπλή υποβολή επιστρέφει το ίδιο ήδη αποθηκευμένο αποτέλεσμα.

Τα παλαιά ανώνυμα/demo δεδομένα σε gamification.json ή LocalStorage δεν μεταφέρονται αυτόματα σε νέο λογαριασμό. Η νέα πρόοδος συνδέεται με τον επαληθευμένο χρήστη. Τα πρόχειρα διαγωνισμάτων στον browser διαχωρίζονται με το id του χρήστη. Η αποθήκευση κώδικα και οι ρυθμίσεις IDE παραμένουν προτιμήσεις της συσκευής.

## Έλεγχοι

~~~powershell
dotnet run --project AeppGenerator/tests/AeppGenerator.AuthChecks -c Release
dotnet run --project AeppGenerator/tests/AeppGenerator.GamificationChecks -c Release
~~~

Από το aepp-generator-client:

~~~powershell
npm run test:auth
npm run test:auth:integration
npm run build
~~~

Το integration test εκκινεί δικό του API σε ελεύθερη θύρα, χρησιμοποιεί προσωρινή SQLite βάση και ελέγχει επανεκκίνηση, αλλοιωμένα/ληγμένα JWT, δικαιώματα, ιδιοκτησία διαγωνισμάτων και idempotency. Δεν δημιουργεί λογαριασμούς στην πραγματική βάση.


Τεκμηρίωση βιβλιοθηκών: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication και https://github.com/BcryptNet/bcrypt.net.
