using System.Text.Json;
using System.Text.Json.Nodes;
using AeppGenerator.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AeppGenerator.Api.Assessment;

public static class ExamDbInitializer
{
    private static readonly (string Text, bool Answer)[][] Statements =
    [
        [
            ("Η ουρά εξυπηρετεί πρώτη την τιμή που εισήχθη πρώτη.", true),
            ("Οι δείκτες πίνακα στη ΓΛΩΣΣΑ ξεκινούν από το 0.", false),
            ("Μια συνάρτηση επιστρέφει μία τιμή.", true),
            ("Η ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ εκτελεί το σώμα της τουλάχιστον μία φορά.", true),
            ("Η εκχώρηση στη ΓΛΩΣΣΑ γράφεται με το σύμβολο =.", false)
        ],
        [
            ("Η εκχώρηση στη ΓΛΩΣΣΑ γράφεται με το σύμβολο <-.", true),
            ("Το όνομα μιας μεταβλητής μπορεί να αρχίζει με ψηφίο.", false),
            ("Η εντολή ΔΙΑΒΑΣΕ εισάγει δεδομένα.", true),
            ("Η εντολή ΓΡΑΨΕ εμφανίζει αποτελέσματα.", true),
            ("Η ισότητα και η εκχώρηση χρησιμοποιούν υποχρεωτικά το ίδιο σύμβολο.", false)
        ],
        [
            ("Η ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ εκτελεί το σώμα τουλάχιστον μία φορά.", true),
            ("Η ΜΕΧΡΙΣ_ΟΤΟΥ τερματίζει όταν η συνθήκη γίνει αληθής.", true),
            ("Η δομή ΓΙΑ είναι κατάλληλη όταν είναι γνωστό το πλήθος επαναλήψεων.", true),
            ("Η ΑΝ εκτελεί πάντοτε και τους δύο κλάδους.", false),
            ("Μια ατέρμονη επανάληψη ικανοποιεί την περατότητα.", false)
        ],
        [
            ("Οι δείκτες ενός πίνακα στη ΓΛΩΣΣΑ αρχίζουν από το 1.", true),
            ("Όλα τα στοιχεία ενός πίνακα έχουν τον ίδιο τύπο.", true),
            ("Ένας μονοδιάστατος πίνακας απαιτεί δύο δείκτες για πρόσβαση.", false),
            ("Το πλήθος στοιχείων δηλώνεται κατά τη δημιουργία του πίνακα.", true),
            ("Η ταξινόμηση φυσαλίδας συγκρίνει γειτονικά στοιχεία.", true)
        ],
        [
            ("Ένας πίνακας δύο διαστάσεων προσπελαύνεται με δύο δείκτες.", true),
            ("Σε δισδιάστατο πίνακα κάθε γραμμή μπορεί να έχει διαφορετικό τύπο.", false),
            ("Για να διασχίσουμε έναν πίνακα δύο διαστάσεων χρησιμοποιούμε συνήθως εμφωλευμένες επαναλήψεις.", true),
            ("Η αναζήτηση μπορεί να αποτύχει όταν το στοιχείο δεν υπάρχει.", true),
            ("Η δυαδική αναζήτηση εφαρμόζεται σε μη ταξινομημένο πίνακα χωρίς προϋπόθεση.", false)
        ],
        [
            ("Μια συνάρτηση επιστρέφει μία τιμή.", true),
            ("Μια διαδικασία καλείται με την εντολή ΚΑΛΕΣΕ.", true),
            ("Οι τυπικές παράμετροι δηλώνονται στην επικεφαλίδα υποπρογράμματος.", true),
            ("Η κλήση συνάρτησης δεν μπορεί να συμμετέχει σε έκφραση.", false),
            ("Τοπικές μεταβλητές υποπρογράμματος είναι ορατές παντού.", false)
        ],
        [
            ("Η ουρά εξυπηρετεί πρώτη την τιμή που εισήχθη πρώτη.", true),
            ("Η στοίβα ακολουθεί τη λογική τελευταίο μέσα, πρώτο έξω.", true),
            ("Η ώθηση εισάγει στοιχείο σε στοίβα.", true),
            ("Η απώθηση αφαιρεί το παλαιότερο στοιχείο ουράς.", false),
            ("Μια δομή δεδομένων οργανώνει και αποθηκεύει δεδομένα.", true)
        ],
        [
            ("Η σειριακή αναζήτηση μπορεί να εφαρμοστεί σε μη ταξινομημένο πίνακα.", true),
            ("Η δυαδική αναζήτηση περιορίζει διαδοχικά το εύρος ελέγχου.", true),
            ("Η ταξινόμηση αλλάζει τη σειρά των στοιχείων.", true),
            ("Ένας πίνακας μπορεί να περιέχει στοιχεία διαφορετικού τύπου.", false),
            ("Η θέση ενός στοιχείου σε πίνακα ονομάζεται δείκτης.", true)
        ],
        [
            ("Η διαδικασία μπορεί να επιστρέφει πολλές τιμές μέσω παραμέτρων.", true),
            ("Η συνάρτηση καλείται με ΚΑΛΕΣΕ.", false),
            ("Οι πίνακες μπορούν να περαστούν ως παράμετροι υποπρογράμματος.", true),
            ("Μια ουρά λειτουργεί με πολιτική FIFO.", true),
            ("Η στοίβα λειτουργεί με πολιτική FIFO.", false)
        ],
        [
            ("Το βέλος σε διάγραμμα ροής δηλώνει τη ροή εκτέλεσης.", true),
            ("Ο ρόμβος σε διάγραμμα ροής συμβολίζει είσοδο δεδομένων.", false),
            ("Το παραλληλόγραμμο συμβολίζει είσοδο ή έξοδο.", true),
            ("Η αντιμετάθεση ανταλλάσσει τις τιμές δύο μεταβλητών.", true),
            ("Η αρχικοποίηση μεταβλητής δεν είναι εκχώρηση.", false)
        ]
    ];

    private static readonly string[] Chapters =
    [
        "Κεφάλαιο 2 — Ανάλυση προβλήματος και αλγόριθμοι",
        "Κεφάλαιο 3 — Προγραμματισμός και ΓΛΩΣΣΑ",
        "Κεφάλαιο 7 — Δομές επιλογής και επανάληψης",
        "Κεφάλαιο 8 — Μονοδιάστατοι και δισδιάστατοι πίνακες",
        "Κεφάλαιο 9 — Αναζήτηση και ταξινόμηση",
        "Κεφάλαιο 10 — Υποπρογράμματα και δομές δεδομένων"
    ];

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static async Task SeedAsync(AssessmentDbContext db, string practiceJson, CancellationToken ct)
    {
        var source = JsonNode.Parse(practiceJson)!.AsObject();
        var definitions = Enumerable.Range(1, 10)
            .Select(number => CreateExam(source, number))
            .ToArray();

        foreach (var definition in definitions)
        {
            var id = definition["id"]!.GetValue<string>();
            var serialized = definition.ToJsonString(Json);
            var existing = await db.Exams.AsNoTracking().SingleOrDefaultAsync(exam => exam.Id == id, ct);
            if (existing is not null)
            {
                if (existing.Source != "practice")
                    throw new InvalidOperationException($"Το αναγνωριστικό προτύπου '{id}' χρησιμοποιείται από μη πρότυπο διαγώνισμα.");
                if (!JsonNode.DeepEquals(JsonNode.Parse(existing.DefinitionJson), JsonNode.Parse(serialized)))
                {
                    var hasAttempts = await db.ExamAttempts.AnyAsync(attempt => attempt.ExamId == id, ct);
                    if (hasAttempts)
                        continue;

                    var seededExam = await db.Exams.SingleAsync(exam => exam.Id == id, ct);
                    seededExam.Title = definition["title"]!.GetValue<string>();
                    seededExam.DefinitionJson = serialized;
                    db.Exams.Update(seededExam);
                }
                continue;
            }

            db.Exams.Add(new Exam
            {
                Id = id,
                Title = definition["title"]!.GetValue<string>(),
                Source = "practice",
                DefinitionJson = serialized,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private static JsonObject CreateExam(JsonObject source, int number)
    {
        var definition = source.DeepClone().AsObject();
        var id = number == 1 ? "aepp-practice-1" : $"aepp-model-{number:00}";
        definition["id"] = id;
        definition["title"] = number == 1 ? "Διαδραστικό διαγώνισμα εξάσκησης ΑΕΠΠ" : $"Πρότυπο διαγώνισμα ΑΕΠΠ {number:00}";

        var sections = definition["sections"]!.AsArray();
        if (number > 1)
            foreach (var section in sections)
                foreach (var question in section!["questions"]!.AsArray())
                    question!["id"] = $"{id}-{question["id"]!.GetValue<string>()}";
        else
        {
            definition["title"] = "Διαδραστικό διαγώνισμα εξάσκησης ΑΕΠΠ";
            return definition;
        }

        var statements = Statements[number - 1];
        var trueFalse = sections[0]!["questions"]![0]!;
        var statementNodes = trueFalse["statements"]!.AsArray();
        for (var index = 0; index < statements.Length; index++)
        {
            statementNodes[index]!["text"] = statements[index].Text;
            statementNodes[index]!["answer"] = statements[index].Answer;
        }
        trueFalse["chapter"] = Chapters[(number - 1) % Chapters.Length];
        trueFalse["solution"] = string.Join(" · ", statements.Select(item => item.Answer ? "Σωστό" : "Λάθος"))
            + ". Οι προτάσεις ελέγχουν βασικές έννοιες της ύλης.";

        var codeQuestion = sections[2]!["questions"]![0]!;
        codeQuestion["testCases"] = CreateMeasurementCases(number);
        codeQuestion["chapter"] = Chapters[2 + (number % 3)];
        codeQuestion["solution"] = "Ενδεικτική λύση: έλεγχος εγκυρότητας των δεδομένων, αρχικοποίηση αθροίσματος και μεγίστου και επεξεργασία κάθε μέτρησης. Το μέγιστο αρχικοποιείται από την ελάχιστη επιτρεπτή τιμή.";

        var arrayQuestion = sections[3]!["questions"]![0]!;
        arrayQuestion["testCases"] = CreateCandidateCases(number);
        arrayQuestion["chapter"] = Chapters[3 + (number % 3)];
        arrayQuestion["solution"] = "Ενδεικτική λύση: αποθήκευση των δεδομένων στους πίνακες, υπολογισμός του μέσου όρου με υποπρόγραμμα και ενημέρωση του καλύτερου μόνο όταν βρεθεί αυστηρά μεγαλύτερη τιμή. Έτσι διατηρείται η πρώτη περίπτωση σε ισοβαθμία.";

        return definition;
    }

    private static JsonArray CreateMeasurementCases(int number)
    {
        var first = new[] { number % 21, (number * 3) % 21, 20 };
        var allHigh = Enumerable.Repeat(20, 5).ToArray();
        return new JsonArray(
            MeasurementCase($"γ-{number}-1", ["3", .. first.Select(value => value.ToString())], first),
            MeasurementCase($"γ-{number}-2", ["1", "0"], [0]),
            MeasurementCase($"γ-{number}-3", ["0", "3", "21", number.ToString(), "20"], [number, 20]),
            MeasurementCase($"γ-{number}-4", ["5", .. allHigh.Select(value => value.ToString())], allHigh));
    }

    private static JsonObject MeasurementCase(string id, string[] inputs, int[] validValues)
    {
        var output = new[] { validValues.Sum().ToString(System.Globalization.CultureInfo.InvariantCulture), validValues.Max().ToString(System.Globalization.CultureInfo.InvariantCulture) };
        return new JsonObject { ["id"] = id, ["inputs"] = ToJsonArray(inputs), ["expectedOutput"] = ToJsonArray(output) };
    }

    private static JsonArray CreateCandidateCases(int number)
    {
        var names = new[] { "Άννα", "Βασίλης", "Γιώργος" };
        var data = new[]
        {
            new[] { number % 21, (number + 5) % 21, 19, 20, 9, 10 },
            new[] { 15, 15, 15, 15, number % 21, number % 21 },
            new[] { 0, 0, 0, 0, 0, 0 }
        };
        var cases = new JsonArray();
        for (var caseIndex = 0; caseIndex < data.Length; caseIndex++)
        {
            var inputs = new List<string>();
            var bestIndex = 0;
            var bestAverage = -1d;
            for (var row = 0; row < names.Length; row++)
            {
                inputs.Add(names[row]);
                var first = data[caseIndex][row * 2];
                var second = data[caseIndex][row * 2 + 1];
                inputs.Add(first.ToString(System.Globalization.CultureInfo.InvariantCulture));
                inputs.Add(second.ToString(System.Globalization.CultureInfo.InvariantCulture));
                var average = (first + second) / 2d;
                if (average > bestAverage)
                {
                    bestAverage = average;
                    bestIndex = row;
                }
            }
            cases.Add(new JsonObject
            {
                ["id"] = $"δ-{number}-{caseIndex + 1}",
                ["inputs"] = ToJsonArray(inputs),
                ["expectedOutput"] = ToJsonArray([names[bestIndex]])
            });
        }
        return cases;
    }

    private static JsonArray ToJsonArray(IEnumerable<string> values)
    {
        var result = new JsonArray();
        foreach (var value in values) result.Add(JsonValue.Create(value));
        return result;
    }
}
