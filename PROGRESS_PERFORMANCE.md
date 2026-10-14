# Κανονικοποιημένη πρόοδος και paginated leaderboard

Το AccountStore δεν αποθηκεύει ProfileJson. Η ProgressMigration στην επόμενη εκκίνηση μεταφέρει τυχόν ιστορικό στο DailyChallengeCompletions, υπολογίζει αρχικούς μετρητές και αφαιρεί το παλιό ProfileJson. Η μεταφορά είναι transactional και επανεκτελέσιμη χωρίς διπλά XP. Users και ιστορικό διαγωνισμάτων διατηρούνται.

Το UserProgress κρατά συγκεντρωτικούς μετρητές και μεταδεδομένα. Το DailyChallengeCompletions είναι η πηγή ολοκληρώσεων. Freezes και study days έχουν χωριστούς πίνακες. Η ανάκτηση διαβάζει μόνο τον χρήστη, τη σημερινή ολοκλήρωση και έως ένα freeze της εβδομάδας. Το παλιό προαιρετικό file mode παραμένει για συμβατότητα εκτός AccountStore· το API χρησιμοποιεί SQLite.

Η υποβολή κάνει μία INSERT ολοκλήρωσης και ακριβώς ένα UPDATE UserProgress (TotalXP = TotalXP + @xp, streak και weekly XP) στην ίδια SQLite transaction. Μοναδικότητα χρήστη/ημέρας και συναλλαγή αποτρέπουν διπλή πίστωση από παράλληλα αιτήματα. GET προόδου δεν γράφει στη βάση.

GET /api/leaderboard?page=1&pageSize=20&period=all&scope=national

Απαιτεί σύνδεση. pageSize 1–50, προεπιλογή 20. period all/weekly, scope national/group/friends. Απόκριση items, page, pageSize, hasNextPage. Στοιχεία userId, fullName, totalXP, currentStreak, rank, username, avatar, rankingXP, self. Διαβάζει έως pageSize+1 scalar γραμμές με LIMIT/OFFSET χωρίς ProfileJson, ResultJson ή πλήρες count. Η παλιά gamification/leaderboard έχει ίδιο paginated συμβόλαιο με προεπιλογή weekly. Το UI υποστηρίζει προηγούμενη/επόμενη σελίδα και φίλτρα.

Κατάταξη: XP φθίνοντα, ενεργό streak φθίνοντα, UserId αύξοντα. Rank είναι η θέση στη λίστα. Υπάρχουν indexes XP, ομάδας, weekly XP και ολοκληρώσεων χρήστη/ημέρας. OFFSET και ταξινόμηση ισοβαθμιών έχουν κόστος σε πολύ βαθιές σελίδες.

Το ProgressChecks ελέγχει migration, idempotency, ένα UPDATE, concurrency, read-only GET, freezes, pagination, φίλτρα, JWT και query plan. Τοπική warmed HTTP σελίδα 20 στοιχείων από 10.002 χρήστες: περίπου 11 ms, όχι εγγύηση παραγωγής.

dotnet run --project AeppGenerator/tests/AeppGenerator.ProgressChecks -c AttemptVerify

Επανεκκίνησε το API για τη μεταφορά. Μην ανοίγεις την ίδια βάση με παλιά και νέα έκδοση του API ταυτόχρονα.
