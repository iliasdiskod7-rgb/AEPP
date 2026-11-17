# Καθημερινό Challenge και μαθητική πρόοδος

Η αρχική οθόνη, το header και οι καρτέλες «Daily Challenge» και «Κατάταξη & Επιτεύγματα» συνδέονται με το ίδιο προφίλ. Το demo κρατά τοπική πρόοδο στον browser· το API χρησιμοποιεί λογαριασμούς και κοινή βάση SQLite.

## Αρχεία

- aepp-generator-client/src/gamification/types.ts: συμβόλαια προφίλ, προσπάθειας, ολοκλήρωσης, feedback και κατάταξης.
- aepp-generator-client/src/gamification/engine.ts: τοπικός μηχανισμός για το demo.
- aepp-generator-client/src/gamification/challenge-bank.json: κοινή τράπεζα 115 ημερήσιων συνόλων (345 ερωτήσεις), ενσωματωμένη και στο backend. Τα αρχικά 21 πακέτα διατηρούνται. Στις 15/10/2026 χρησιμοποιείται το πρώτο από τα 79 νέα πακέτα. Από 16/10/2026 αρχίζει ο κύκλος 115 ημερών με τα 15 επιμελημένα σετ πρώτα. Οι προηγούμενες ημερομηνίες κρατούν την παλιά αντιστοίχιση, ώστε να μη μεταβάλλονται οι υπάρχουσες προσπάθειες και αναφορές.
- aepp-generator-client/scripts/expand-daily-bank.mjs: επιμελημένες νέες προτάσεις θεωρίας και 20 οικογένειες ασκήσεων με διαφορετικά δεδομένα. Τα 79 νέα πακέτα είναι παραλλαγές εξάσκησης αυτών των οικογενειών, όχι 79 διαφορετικοί τύποι προβλημάτων. Κάθε νέο συμπληρωμένο τμήμα και ίχνος διαθέτει δεδομένα επαλήθευσης για εκτέλεση στον διερμηνευτή του έργου.
- aepp-generator-client/src/gamification/GamificationProvider.tsx: φόρτωση, αλλαγή ημέρας, συγχρονισμός και API adapter.
- aepp-generator-client/src/components/gamification/: challenge, banner, header widget, leaderboard, CSS και confetti.
- AeppGenerator/src/AeppGenerator.Api/Gamification/GamificationService.cs: server grading, χρονόμετρο, XP, streak και badges.
- AeppGenerator/src/AeppGenerator.Api/Data/AccountProgressRepository.cs: στοχευμένα queries προόδου, μία συναλλαγή ανά χρήστη και σελιδοποιημένο leaderboard.
- AeppGenerator/src/AeppGenerator.Api/Data/ProgressMigration.cs: μεταφορά παλιών ολοκληρώσεων σε πίνακες ιστορικού και αφαίρεση του `ProfileJson`.
- AeppGenerator/src/AeppGenerator.Api/Controllers/LeaderboardController.cs: αυθεντικοποιημένο, σελιδοποιημένο `GET /api/leaderboard`.
- AeppGenerator/src/AeppGenerator.Api/Controllers/GamificationController.cs: endpoints και προστατευμένο cookie ταυτότητας.

## Εκκίνηση

Το υπάρχον demo λειτουργεί με localStorage. Για κοινή, πραγματική κατάταξη θέσε VITE_USE_DEMO=false στο frontend και ξεκίνησε το ανανεωμένο API με dotnet run --project AeppGenerator/src/AeppGenerator.Api --launch-profile http. Ο Vite proxy προωθεί /api στο localhost:5210. Πρότεινε ενιαίο origin για frontend/API στην εγκατάσταση: το cookie έχει SameSite=Strict, HttpOnly και Secure σε HTTPS.

Το API αποθηκεύει λογαριασμούς και πρόοδο στο `App_Data/accounts.sqlite`. Η ρύθμιση `Accounts:DatabasePath` αλλάζει τη θέση· ο φάκελος πρέπει να είναι μόνιμος και εγγράψιμος και η βάση να περιλαμβάνεται στα αντίγραφα ασφαλείας. Οι ολοκληρώσεις φυλάσσονται αποκλειστικά στον πίνακα `DailyChallengeCompletions`. Ο πίνακας `UserProgress` κρατά συνολικά XP/streak και τα πεδία του τρέχοντος προφίλ· δεν αποθηκεύεται εκεί ιστορικό `ProfileJson`. Η μετάβαση από παλιό σχήμα εισάγει το ιστορικό μία φορά και αφαιρεί τη στήλη `ProfileJson`.

Οι ενέργειες προόδου διαβάζουν μόνο την εγγραφή του συγκεκριμένου χρήστη και τα δεδομένα της τρέχουσας ημέρας. Η ολοκλήρωση και το μοναδικό ημερήσιο XP update εκτελούνται στην ίδια SQLite συναλλαγή. Το εθνικό leaderboard επιλέγει μόνο τη ζητούμενη σελίδα από SQL, με όριο 50 αποτελεσμάτων ανά σελίδα και ranking index· δεν φορτώνει προφίλ ή ιστορικά αποτελεσμάτων στη μνήμη. Η εναλλακτική λειτουργία αρχείου της `GamificationService` χρησιμοποιείται μόνο όταν η υπηρεσία κατασκευάζεται χωρίς `AccountStore`, όχι από το API.

## Κανόνες

- Η ημέρα είναι ημερολογιακή στην Europe/Athens, με χειμερινή/θερινή ώρα. Κάθε ημέρα επιλέγει σταθερά ένα σύνολο ερωτήσεων της τράπεζας. Όλοι βλέπουν το ίδιο challenge. Η κυκλική τράπεζα καλύπτει βασικές ενότητες και μπορεί να επεκτείνεται· δεν είναι δήλωση επίσημης εξεταστέας ύλης συγκεκριμένου έτους.
- 3 ερωτήσεις: Σωστό/Λάθος, συμπλήρωση 1–2 κενών και ίχνος 5–8 γραμμών. Οι δηλώσεις/αρχικές τιμές δίνονται χωριστά. Το API δεν στέλνει κλειδιά λύσεων πριν το feedback.
- Η πρώτη απάντηση θεωρίας κλειδώνει. Με την επιλογή εμφανίζεται εξήγηση. Οι υπόλοιπες λύσεις και οι παραπομπές εμφανίζονται στην αναφορά.
- Η προσπάθεια αρχίζει στον server, δεν ξαναρχίζει σε reload. Στα 10 λεπτά το UI υποβάλλει τις τρέχουσες απαντήσεις. Υπάρχει περιθώριο μεταφοράς 5 δευτερολέπτων· μετά από αυτό βαθμολογείται μόνο η ήδη κλειδωμένη θεωρία. Δεν αποδίδεται bonus χρόνου μετά τα 10 λεπτά. Στην αλλαγή ημέρας η παλιά προσπάθεια λήγει και χρειάζεται έναρξη του νέου challenge.
- Ολοκλήρωση μία φορά την ημέρα, ακόμη και με παράλληλες υποβολές. Δίνεται 10 XP ολοκλήρωσης + 30 ανά σωστή ερώτηση + ανά σωστή 10 πριν τα 180 δευτερόλεπτα ή 5 πριν τα 600. Multiplier = min(2, 1 + floor(streak / 7) × 0,1). Τελικό XP στρογγυλοποιείται στον κοντινότερο ακέραιο.
- Σερί: συνεχόμενες ημέρες ολοκλήρωσης. Μία ημέρα freeze ανά ημερολογιακή εβδομάδα Δευτέρα–Κυριακή προστατεύει το σερί, χωρίς XP ή αύξηση ημερών. Απαιτεί ενεργό σερί και καταγεγραμμένη σημερινή μελέτη. Το UI καταγράφει μελέτη μετά από 60 δευτερόλεπτα ορατής καρτέλας μαθήματος. Δεν πρόκειται για επιβεβαίωση κατανόησης ή σύστημα επιτήρησης. Ολοκλήρωση την ίδια ημέρα με freeze μετρά μία φορά.
- Badges: πρώτο challenge, τελευταίες 5 σωστές απαντήσεις με tag loops, 3/3 σε challenge search/sort, ολοκλήρωση κάτω από 180 δευτερόλεπτα, 30 ολοκληρώσεις σε προστατευμένο σερί. Απονέμονται μία φορά. Οι ημέρες freeze δεν προσμετρώνται στο 30.
- Level = 1 + floor(totalXP / 500). Κατάταξη εβδομάδας ή όλων των ημερών, με πραγματικά προφίλ, ισοβαθμίες και φίλτρα. Η εβδομαδιαία κατάταξη εξακολουθεί να δείχνει συνολικά XP. Ομάδες με κοινό κωδικό και φίλοι με δημόσιο κωδικό. Τα ονόματα, avatars, streak και XP είναι δημόσια· απαντήσεις και ιστορικό δεν περιλαμβάνονται στην κατάταξη.
- Το local demo εμφανίζει μόνο το δικό σου προφίλ και δεν επινοεί αντιπάλους. Η πρόοδος δεν μεταφέρεται αυτόματα από demo σε backend.

## Endpoints

GET /api/gamification · POST /start · POST /theory {day,answer} · POST /complete {day,answers} · POST /study {lessonId} · POST /freeze · PUT /profile {username,avatar,group,friends} · GET /api/gamification/leaderboard?period=weekly|all&scope=national|group|friends&page=1&pageSize=20.

Το `GET /api/leaderboard?page=1&pageSize=20` είναι το endpoint εθνικής κατάταξης όλων των ημερών (προεπιλογές: `page=1`, `pageSize=20`). Υποστηρίζει επίσης `period` και `scope`, ενώ η `hasNextPage` δείχνει αν υπάρχει επόμενη σελίδα. Η μέγιστη τιμή `pageSize` είναι 50.

Τα answers είναι λεξικό: questionId για ίχνος, questionId:blankId για κάθε κενό. Η βαθμολόγηση χρησιμοποιεί την ήδη κλειδωμένη επιλογή θεωρίας. Αν δεν έχει υποβληθεί ξεχωριστά, δέχεται true/false από το ίδιο λεξικό answers εντός του χρόνου. Ο client δεν επιλέγει studentId ούτε στέλνει score, XP ή χρόνο ολοκλήρωσης.

## Έλεγχοι

npm run test:gamification και npm run build μέσα στο aepp-generator-client.

dotnet run --project AeppGenerator/tests/AeppGenerator.GamificationChecks -c Release.

Το Release χρησιμοποιείται για να μην συγκρούεται με ήδη εκτελούμενο Debug API. Οι ασκήσεις ελέγχονται στον ενσωματωμένο διερμηνευτή του έργου, όχι στο εξωτερικό πρόγραμμα «Διερμηνευτής της ΓΛΩΣΣΑΣ». Δεν έχει πραγματοποιηθεί οπτικός έλεγχος browser στο συγκεκριμένο περιβάλλον.

## Επιμελημένο seed 15 ημερών

Το aepp-generator-client/src/gamification/dailyChallengesSeed.json περιέχει 15 σετ με 45 ερωτήσεις: TRUE_FALSE, FILL_BLANK και TRACE_OUTPUT. Κάθε απάντηση έχει αναλυτική εξήγηση και παραπομπή σε συγκεκριμένη παράγραφο του σχολικού βιβλίου (κεφάλαια 2, 3, 7, 8, 9, 10). Οι μικρές ασκήσεις αξιοποιούν ήδη ελεγμένες οικογένειες της τράπεζας, με νέα θεωρία και αναλυτικότερη διδακτική επεξήγηση· δεν πρόκειται για 45 εντελώς διαφορετικούς αλγορίθμους. Τα αποσπάσματα δηλώνονται ως τμήματα προγραμμάτων και συνοδεύονται από δηλώσεις και αρχικοποιήσεις.

Η εντολή npm run seed:daily αναδημιουργεί την κοινή τράπεζα και εισάγει το seed χωρίς διπλότυπα IDs. Η άμεση εισαγωγή γίνεται με node scripts/import-daily-seed.mjs. Το API ενσωματώνει την κοινή τράπεζα ως resource, οπότε χρειάζεται rebuild/restart μετά από αλλαγή περιεχομένου. Δεν απαιτείται migration ή αντικατάσταση ολοκληρώσεων στη βάση.

Νέα διαδρομή API, με την υπάρχουσα ταυτοποίηση:

1. GET /api/daily-challenge/today επιστρέφει DailyChallengeDto: id, day, dayIndex, topic, serverNow και questions. Κάθε ερώτηση έχει id, type, questionText, codeSnippet, declarations, blanks με id/options. Δεν περιέχει correctAnswer, answer, accepted, explanation ή verification. Το GET δεν ξεκινά το χρονόμετρο και απαγορεύει caching.
2. POST /api/daily-challenge/start ξεκινά το δεκάλεπτο. Η επανάληψη δεν μηδενίζει το χρονόμετρο. Είναι alias της υπάρχουσας έναρξης gamification/start.
3. POST /api/daily-challenge/submit δέχεται {day, answers}. Τα κλειδιά είναι το πλήρες questionId και questionId:1 για το κενό. Οι τιμές είναι strings· η θεωρία δέχεται "true" ή "false". Η απόκριση είναι η υπάρχουσα DailyState, με completion.feedback, correctCount, xp, streak. Δεν γίνονται δεκτά client XP ή χρόνος. Η ταυτότητα προκύπτει από τη συνεδρία.

Η επιλογή ημέρας χρησιμοποιεί το ρολόι του server σε Europe/Athens, χωρίς εξάρτηση από την ημερομηνία συσκευής. Η προσθήκη της φάσης 16/10 διατηρεί την παλιά αντιστοίχιση στις προηγούμενες ημερομηνίες. Τα 15 σετ εμφανίζονται από 16 έως 30/10/2026.

Έλεγχοι: npm run test:gamification και AeppGenerator.GamificationChecks. Οι εκτελέσεις αφορούν τον ενσωματωμένο διερμηνευτή και όχι το εξωτερικό σχολικό πρόγραμμα.

Επαλήθευση 15/10/2026: 21 έλεγχοι frontend, 33 backend checks και πραγματικά HTTP GET/start/submit σε ξεχωριστή SQLite. Επιβεβαιώθηκαν 3/3 σωστά, 130 XP, streak 1, μηδενική διπλή πίστωση σε ταυτόχρονα submits και απουσία λύσεων στο today DTO. Η θέση της σωστής επιλογής στα 15 κενά είναι ισορροπημένη (5 πρώτη, 5 δεύτερη, 5 τρίτη). Τα αποτελέσματα HTTP βρίσκονται στο .tmp/daily-verification/http-result.json.
