# Έλεγχοι ασφάλειας Assessment Insights

Εκτέλεση: `dotnet run --project AeppGenerator/tests/AeppGenerator.SecurityChecks -c SecurityVerify` από τη ρίζα του έργου.

Οι έλεγχοι χρησιμοποιούν προσωρινή SQLite, πραγματικά JWT και τον πραγματικό controller με εικονική υπηρεσία AI. Δεν καλείται εξωτερικό LLM API.

Η πολιτική AiInsightsPolicy επιτρέπει 5 αιτήματα ανά σταθερό παράθυρο 60 δευτερολέπτων, ανά επαληθευμένο sub. Ο global concurrency limiter εφαρμόζεται μόνο στα endpoints με αυτή την πολιτική και επιτρέπει 2 ταυτόχρονες εκτελέσεις ανά ίδιο sub, χωρίς ουρά.

Τα υπόλοιπα endpoints έχουν κοινό όριο 120 αιτημάτων ανά λεπτό ανά IP. Login/register διατηρούν επιπλέον κοινό όριο 10 αιτημάτων ανά λεπτό ανά IP. Τα όρια εφαρμόζονται μετά το authentication/authorization. Απορρίψεις επιστρέφουν HTTP 429, JSON message, Retry-After και Cache-Control: no-store.

Οι limiters διατηρούν κατάσταση ανά διεργασία. Σε πολλαπλά API instances απαιτείται επιπλέον κοινός limiter σε gateway ή κατανεμημένο store. Πίσω από proxy απαιτείται ρύθμιση forwarded headers αποκλειστικά για έμπιστους proxies· δεν χρησιμοποιείται απευθείας το X-Forwarded-For.
