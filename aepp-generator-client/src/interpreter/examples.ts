export const starterProgram = `ΠΡΟΓΡΑΜΜΑ Ελεγχος_Βαθμου
ΜΕΤΑΒΛΗΤΕΣ
  ΑΚΕΡΑΙΕΣ: ΒΑΘΜΟΣ, Ι
ΑΡΧΗ
  ΓΡΑΨΕ 'Δώσε βαθμό (0 έως 20):'
  ΔΙΑΒΑΣΕ ΒΑΘΜΟΣ
  ΑΝ ΒΑΘΜΟΣ >= 10 ΤΟΤΕ
    ΓΡΑΨΕ 'Επιτυχία'
  ΑΛΛΙΩΣ
    ΓΡΑΨΕ 'Χρειάζεται προσπάθεια'
  ΤΕΛΟΣ_ΑΝ
  ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 3
    ΓΡΑΨΕ 'Επανάληψη ', Ι
  ΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ
ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ`

export interface CommandSnippet {
  label: string
  insert: string
  kind?: 'block'
  supported?: false
  description?: string
}
export interface CommandGroup { id: string; title: string; commands: CommandSnippet[] }
export const commandGroups: CommandGroup[] = [
  { id: 'structures', title: 'ΔΟΜΕΣ & ΕΝΤΟΛΕΣ', commands: [
    { label: 'ΠΡΟΓΡΑΜΜΑ', kind: 'block', insert: 'ΠΡΟΓΡΑΜΜΑ Νεο_Προγραμμα\nΜΕΤΑΒΛΗΤΕΣ\n  ΑΚΕΡΑΙΕΣ: Α\nΑΡΧΗ\n  Α <- 0\n  ΓΡΑΨΕ Α\nΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ' },
    { label: 'ΣΤΑΘΕΡΕΣ', insert: 'ΣΤΑΘΕΡΕΣ' },
    { label: 'ΜΕΤΑΒΛΗΤΕΣ', kind: 'block', insert: 'ΜΕΤΑΒΛΗΤΕΣ\n  ΑΚΕΡΑΙΕΣ: Α' },
    { label: 'ΑΚΕΡΑΙΕΣ:', insert: 'ΑΚΕΡΑΙΕΣ:' },
    { label: 'ΠΡΑΓΜΑΤΙΚΕΣ:', insert: 'ΠΡΑΓΜΑΤΙΚΕΣ:' },
    { label: 'ΧΑΡΑΚΤΗΡΕΣ:', insert: 'ΧΑΡΑΚΤΗΡΕΣ:' },
    { label: 'ΛΟΓΙΚΕΣ:', insert: 'ΛΟΓΙΚΕΣ:' },
    { label: 'ΑΡΧΗ', insert: 'ΑΡΧΗ' },
    { label: 'ΓΡΑΨΕ', insert: 'ΓΡΑΨΕ' },
    { label: 'ΔΙΑΒΑΣΕ', insert: 'ΔΙΑΒΑΣΕ' },
    { label: 'ΑΝ ... ΤΟΤΕ', kind: 'block', insert: "ΑΝ Α > 0 ΤΟΤΕ\n  ΓΡΑΨΕ 'Θετικός'\nΤΕΛΟΣ_ΑΝ" },
    { label: 'ΑΛΛΙΩΣ', kind: 'block', insert: "ΑΛΛΙΩΣ\n  ΓΡΑΨΕ 'Εναλλακτική περίπτωση'" },
    { label: 'ΑΛΛΙΩΣ_ΑΝ', kind: 'block', insert: "ΑΛΛΙΩΣ_ΑΝ Α = 0 ΤΟΤΕ\n  ΓΡΑΨΕ 'Μηδέν'" },
    { label: 'ΤΕΛΟΣ_ΑΝ', insert: 'ΤΕΛΟΣ_ΑΝ' },
    { label: 'ΕΠΙΛΕΞΕ', kind: 'block', supported: false, description: 'Σκελετός μόνο — η εκτέλεση θα προστεθεί αργότερα.', insert: "ΕΠΙΛΕΞΕ Α\n  ΠΕΡΙΠΤΩΣΗ 1\n    ΓΡΑΨΕ 'Ένα'\n  ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ\n    ΓΡΑΨΕ 'Άλλη τιμή'\nΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ" },
    { label: 'ΠΕΡΙΠΤΩΣΗ', insert: 'ΠΕΡΙΠΤΩΣΗ', supported: false },
    { label: 'ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ', insert: 'ΠΕΡΙΠΤΩΣΗ ΑΛΛΙΩΣ', supported: false },
    { label: 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ', insert: 'ΤΕΛΟΣ_ΕΠΙΛΟΓΩΝ', supported: false },
    { label: 'ΓΙΑ ... ΜΕ_ΒΗΜΑ', kind: 'block', insert: 'ΓΙΑ Ι ΑΠΟ 1 ΜΕΧΡΙ 5 ΜΕ_ΒΗΜΑ 1\n  ΓΡΑΨΕ Ι\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ' },
    { label: 'ΟΣΟ ... ΕΠΑΝΑΛΑΒΕ', kind: 'block', insert: 'ΟΣΟ Α < 10 ΕΠΑΝΑΛΑΒΕ\n  Α <- Α + 1\nΤΕΛΟΣ_ΕΠΑΝΑΛΗΨΗΣ' },
    { label: 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ ... ΜΕΧΡΙΣ_ΟΤΟΥ', kind: 'block', insert: 'ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ\n  ΔΙΑΒΑΣΕ Α\nΜΕΧΡΙΣ_ΟΤΟΥ Α >= 0' },
    { label: 'ΚΑΛΕΣΕ', insert: 'ΚΑΛΕΣΕ', supported: false },
    { label: 'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ', insert: 'ΤΕΛΟΣ_ΠΡΟΓΡΑΜΜΑΤΟΣ' },
  ] },
  { id: 'arithmetic', title: 'ΑΡΙΘΜΗΤΙΚΟΙ ΤΕΛΕΣΤΕΣ', commands: ['+', '-', '*', '/', '^', 'DIV', 'MOD'].map(label => ({ label, insert: label })) },
  { id: 'logical', title: 'ΣΥΓΚΡΙΤΙΚΟΙ & ΛΟΓΙΚΟΙ ΤΕΛΕΣΤΕΣ', commands: ['=', '<>', '>', '<', '>=', '<=', 'ΚΑΙ', 'Ή', 'ΟΧΙ'].map(label => ({ label, insert: label })) },
  { id: 'functions', title: 'ΕΝΣΩΜΑΤΩΜΕΝΕΣ ΣΥΝΑΡΤΗΣΕΙΣ', commands: ['ΗΜ()', 'ΣΥΝ()', 'ΕΦ()', 'Τ_Ρ()', 'Α_Τ()', 'Α_Μ()'].map(label => ({ label, insert: label })) },
]
