# ΑΕΠΠ

Εργαστήριο δημιουργίας και προεπισκόπησης διαγωνισμάτων Πληροφορικής Προσανατολισμού Γ΄ Λυκείου, με ελληνική διεπαφή και εκπαιδευτικό περιεχόμενο σε ΓΛΩΣΣΑ.

## Περιεχόμενα

- `AeppGenerator/`: λύση .NET 8 με Domain, Application, Infrastructure και Web API.
- `aepp-generator-client/`: React, TypeScript, Vite, Tailwind CSS, TanStack Query και Axios.
- [Κανόνες ΑΕΠΠ](AEPP_RULES.md).
- [Βάση γνώσης](AEPP_KNOWLEDGE_BASE.md).

## Εκκίνηση frontend

```powershell
cd aepp-generator-client
npm ci
npm run dev
```

Ανοίξτε τη διεύθυνση που εμφανίζεται στο τερματικό. Το σταθερό δείγμα λειτουργεί χωρίς backend. Περιλαμβάνει επιλογή θεμάτων, καρτέλες εκφώνησης και λύσεων, προβολή ΓΛΩΣΣΑΣ, πίνακες τιμών, εκτύπωση και λήψη JSON.

## Εκκίνηση backend

Από τη ρίζα του repository, σε ξεχωριστό τερματικό:

```powershell
cd AeppGenerator
dotnet user-secrets set "LlmSettings:ApiKey" "ΤΟ_GEMINI_API_KEY_ΣΟΥ" --project src/AeppGenerator.Api
dotnet restore
dotnet build --no-restore
dotnet run --project src/AeppGenerator.Api --launch-profile http
```

Το SDK ορίζεται στο `AeppGenerator/global.json`. Η διεύθυνση του HTTP προφίλ είναι `http://localhost:5210`, με Swagger στο `/swagger` κατά την ανάπτυξη.

## Τρέχουσα κατάσταση

Το backend καλεί το Gemini με δομημένη έξοδο JSON και παράγει νέο διαγώνισμα σε κάθε αίτημα. Για ζωντανή λειτουργία του frontend, αντιγράψτε το `aepp-generator-client/.env.example` σε `.env.local` και διατηρήστε `VITE_USE_DEMO=false`. Το κλειδί Gemini αποθηκεύεται μόνο στα .NET user secrets και ποτέ σε αρχείο του frontend.

Έχουν ελεγχθεί τα builds backend και frontend, η εναλλαγή μοντέλων, οι ακυρώσεις και τα
όρια αναμονής. Στις 4/10/2026 η πραγματική δοκιμή παρήγαγε διαγώνισμα τεσσάρων θεμάτων
και 100 μονάδων μέσω του gemini-3.5-flash, μετά από 503 του gemini-3.8-flash.
Η δοκιμή έγινε με `--live-node` λόγω περιορισμού Schannel του περιβάλλοντος ελέγχου.
Δεν έχει γίνει εκτέλεση των εκπαιδευτικών προγραμμάτων στον Διερμηνευτή της ΓΛΩΣΣΑΣ.

## Τοπικές ρυθμίσεις

Το `LlmSettings` στο `AeppGenerator/src/AeppGenerator.Api/appsettings.json` ορίζει κύριο
και εναλλακτικά μοντέλα (`FallbackModels`). Σε προσωρινά σφάλματα 408/500/502/503/504
ή λήξη χρόνου δοκιμάζεται το επόμενο μοντέλο. Γίνονται έως δύο γύροι, με εκθετική αναμονή
και μικρή τυχαία καθυστέρηση ανάμεσα στους γύρους. Το `Retry-After` γίνεται σεβαστό.
Κάθε προσπάθεια έχει όριο 90 δευτερολέπτων και όλη η κλήση Gemini 240 δευτερολέπτων.
Μοντέλο που απαντά 404 παραλείπεται στον επόμενο γύρο.

Τα σφάλματα κλειδιού/ρυθμίσεων δεν επαναλαμβάνονται. Το όριο χρήσης επιστρέφει 429,
η υπερφόρτωση όλων των μοντέλων 503 και η λήξη χρόνου 504, με ελληνικά μηνύματα.
Η αυτόματη εναλλαγή δεν εγγυάται διαθεσιμότητα όταν υπάρχει γενικό πρόβλημα του παρόχου.

Έλεγχοι χωρίς κλειδί και χρέωση, από τον φάκελο `AeppGenerator`:

```powershell
dotnet run --project tests/AeppGenerator.Checks
```

Πραγματική παραγωγή τεσσάρων θεμάτων με το κλειδί στα user secrets (χρεώσιμη κλήση):

```powershell
dotnet run --project tests/AeppGenerator.Checks -- --live
```

Το προαιρετικό `--live-node` χρησιμοποιεί Node μόνο ως μεταφορά HTTPS για περιβάλλοντα
δοκιμών όπου το Windows sandbox δεν επιτρέπει Schannel. Το αίτημα, οι επαναλήψεις,
η επικύρωση και ο controller παραμένουν οι πραγματικές C# κλάσεις. Στην εφαρμογή
χρησιμοποιείται πάντα το HttpClient. Το αποτέλεσμα του ελέγχου γράφεται σε `live-exam.json`
μέσα στον φάκελο εξόδου του ελέγχου.

Χρησιμοποιήστε το `aepp-generator-client/.env.example` ως υπόδειγμα. Αρχεία `.env`, τοπικές ρυθμίσεις ανάπτυξης, πιστοποιητικά και παραγόμενα αρχεία εξαιρούνται από το Git. Τα κλειδιά υπηρεσιών LLM ανήκουν στο backend και δεν πρέπει να τοποθετούνται σε μεταβλητές `VITE_`.
