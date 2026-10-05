import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

export interface CatalogLesson {
  id: string
  number: number | string
  title: string
  summary: string
  searchTerms?: string
  Component: LazyExoticComponent<ComponentType>
}

export interface CatalogChapter {
  id: string
  title: string
  subtitle: string
  lessons: CatalogLesson[]
}

// Κάθε νέο μάθημα δηλώνεται μία φορά εδώ. Το περιεχόμενό του φορτώνεται όταν ανοίξει.
export const courseCatalog: CatalogChapter[] = [
  {
    id: 'chapter-1',
    title: 'Κεφάλαιο 1',
    subtitle: 'Ανάλυση Προβλήματος',
    lessons: [
      {
        id: 'lesson-1', number: 1, title: 'Ανάλυση Προβλήματος',
        summary: 'Δεδομένα, ζητούμενα και στάδια αντιμετώπισης.',
        Component: lazy(() => import('../../components/courses/Lesson1Module')),
      },
    ],
  },
  {
    id: 'chapter-2',
    title: 'Κεφάλαιο 2',
    subtitle: 'Προγραμματισμός & Αλγόριθμοι',
    lessons: [
      {
        id: 'lesson-2', number: 2, title: 'Εισαγωγή στον Προγραμματισμό',
        summary: 'Γλώσσες και τεχνικές σχεδίασης προγραμμάτων.',
        Component: lazy(() => import('../../components/courses/Lesson2Module')),
      },
      {
        id: 'lesson-3', number: 3, title: 'Προγραμματιστικές Τεχνικές & Περιβάλλοντα',
        summary: 'Μεταγλώττιση, διερμηνεία και είδη λαθών.',
        searchTerms: 'λάθη προγράμματος μεταγλωττιστής διερμηνευτής',
        Component: lazy(() => import('../../components/courses/Lesson3Module')),
      },
      {
        id: 'lesson-4', number: 4, title: 'Αλγόριθμοι & Δομή Ακολουθίας',
        summary: 'Ορισμός, κριτήρια, αναπαράσταση και βασικές εντολές αλγορίθμου.',
        searchTerms: 'διάγραμμα ροής ψευδογλώσσα δεδομένα αποτελέσματα είσοδος έξοδος',
        Component: lazy(() => import('../../components/courses/Lesson4Module')),
      },
    ],
  },
  {
    id: 'chapter-7',
    title: 'Κεφάλαιο 7',
    subtitle: 'Βασικές Έννοιες Προγραμματισμού',
    lessons: [
      {
        id: 'lesson-5a', number: '5Α', title: 'Βασικές Έννοιες της ΓΛΩΣΣΑΣ',
        summary: 'Τύποι, μεταβλητές, τελεστές, εκφράσεις και εκχώρηση.',
        searchTerms: 'αλφάβητο σταθερές div mod συναρτήσεις ακέραιο μέρος',
        Component: lazy(() => import('../../components/courses/Lesson5aModule')),
      },
      {
        id: 'lesson-5b', number: '5Β', title: 'Βασικές Συνιστώσες Προγράμματος σε ΓΛΩΣΣΑ',
        summary: 'ΔΙΑΒΑΣΕ, ΓΡΑΨΕ, δομή προγράμματος και πίνακες τιμών.',
        searchTerms: 'είσοδος έξοδος σταθερές μεταβλητές ιχνηλάτηση ψηφία αντιμετάθεση στρογγυλοποίηση λάθη',
        Component: lazy(() => import('../../components/courses/Lesson5bModule')),
      },
    ],
  },
  {
    id: 'selection',
    title: 'Δομή Επιλογής',
    subtitle: 'Απλή, σύνθετη & πολλαπλή επιλογή',
    lessons: [
      {
        id: 'lesson-6', number: 6, title: 'Απλή & Σύνθετη Επιλογή',
        summary: 'Συνθήκες, μέγιστο, μετρητές και πίνακες τιμών.',
        searchTerms: 'ΑΝ ΤΟΤΕ ΑΛΛΙΩΣ max min ιχνηλάτηση',
        Component: lazy(() => import('../../components/courses/Lesson6Module')),
      },
      {
        id: 'lesson-7', number: 7, title: 'Πολλαπλή Επιλογή & Κλιμακωτοί Υπολογισμοί',
        summary: 'ΑΛΛΙΩΣ_ΑΝ, διαστήματα τιμών και κλιμακωτές χρεώσεις.',
        searchTerms: 'ΕΠΙΛΕΞΕ ΠΕΡΙΠΤΩΣΗ όρια κλίμακες χρέωση',
        Component: lazy(() => import('../../components/courses/Lesson7Module')),
      },
      {
        id: 'lesson-8', number: 8, title: 'Η Εντολή ΕΠΙΛΕΞΕ',
        summary: 'ΠΕΡΙΠΤΩΣΗ, λίστες τιμών και ισοδύναμες μετατροπές.',
        searchTerms: 'διαστήματα τιμών επικάλυψη ΑΛΛΙΩΣ_ΑΝ διάγραμμα ροής',
        Component: lazy(() => import('../../components/courses/Lesson8Module')),
      },
      {
        id: 'lesson-9', number: 9, title: 'Εμφωλευμένες Εντολές Επιλογής',
        summary: 'ΑΝ μέσα σε ΑΝ, κλάδοι, εσοχές και μετατροπές.',
        searchTerms: 'εμφώλευση ΤΕΛΟΣ_ΑΝ απλές ΑΝ ΕΠΙΛΕΞΕ',
        Component: lazy(() => import('../../components/courses/Lesson9Module')),
      },
    ],
  },
  {
    id: 'repetition',
    title: 'Δομή Επανάληψης',
    subtitle: 'Βρόχοι, φρουροί & επεξεργασία τιμών',
    lessons: [
      {
        id: 'lesson-10', number: 10, title: 'Η Εντολή ΟΣΟ…ΕΠΑΝΑΛΑΒΕ',
        summary: 'Συνθήκη, τιμή φρουρός, άθροισμα, πλήθος, μέσος όρος και μέγιστες τιμές.',
        searchTerms: 'βρόχος ατέρμων φρουρός max min μετρητής άθροισμα',
        Component: lazy(() => import('../../components/courses/Lesson10Module')),
      },
      {
        id: 'lesson-11', number: 11, title: 'Η Εντολή ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ…ΜΕΧΡΙΣ_ΟΤΟΥ',
        summary: 'Έλεγχος στο τέλος, εγκυρότητα εισόδου, τιμή φρουρός και μενού.',
        searchTerms: 'ΜΕΧΡΙΣ_ΟΤΟΥ βρόχος εγκυρότητα φρουρός μενού ΟΣΟ',
        Component: lazy(() => import('../../components/courses/Lesson11Module')),
      },
      {
        id: 'lesson-12', number: 12, title: 'Η Εντολή ΓΙΑ…ΑΠΟ…ΜΕΧΡΙ',
        summary: 'Γνωστό πλήθος επαναλήψεων, βήμα, επεξεργασία Ν τιμών και ακραίες τιμές.',
        searchTerms: 'ΓΙΑ ΜΕ ΒΗΜΑ βρόχος μετρητής άθροισμα μέσος όρος μέγιστο ελάχιστο',
        Component: lazy(() => import('../../components/courses/Lesson12Module')),
      },
      {
        id: 'lesson-13', number: 13, title: 'Εμφωλευμένοι Βρόχοι & Μετατροπές',
        summary: 'Εμφώλευση, σημαίες, πίνακες τιμών και ισοδύναμες δομές επανάληψης.',
        searchTerms: 'ΟΣΟ ΜΕΧΡΙΣ_ΟΤΟΥ ΓΙΑ εμφωλευμένοι βρόχοι μετατροπές λογική σημαία',
        Component: lazy(() => import('../../components/courses/Lesson13Module')),
      },
    ],
  },
  {
    id: 'algorithm-representation',
    title: 'Αναπαράσταση Αλγορίθμων',
    subtitle: 'Φυσική γλώσσα, ολίσθηση & πολλαπλασιασμός',
    lessons: [
      {
        id: 'lesson-14', number: 14, title: 'Φυσική Γλώσσα κατά Βήματα',
        summary: 'Αριθμημένα βήματα, επιλογές, επαναλήψεις και μετατροπή από ψευδογλώσσα.',
        searchTerms: 'είσοδος έξοδος βήματα αλγόριθμος πήγαινε ΟΣΟ ΜΕΧΡΙΣ_ΟΤΟΥ ΓΙΑ',
        Component: lazy(() => import('../../components/courses/Lesson14Module')),
      },
      {
        id: 'lesson-15', number: 15, title: 'Ολίσθηση & Πολλαπλασιασμός αλά Ρωσικά',
        summary: 'Δυαδικές ολισθήσεις, περιττές τιμές και ιχνηλάτηση του γινομένου.',
        searchTerms: 'shift αριστερά δεξιά διπλασιασμός υποδιπλασιασμός DIV MOD',
        Component: lazy(() => import('../../components/courses/Lesson15Module')),
      },
    ],
  },
  {
    id: 'algorithm-design',
    title: 'Τεχνικές Σχεδίασης Αλγορίθμων',
    subtitle: 'Ανάλυση & διαίρει και βασίλευε',
    lessons: [
      {
        id: 'lesson-16', number: 16, title: 'Τεχνικές Σχεδίασης Αλγορίθμων',
        summary: 'Ανάλυση προβλήματος, διαίρει και βασίλευε και δυαδική αναζήτηση.',
        searchTerms: 'συγγενή προβλήματα δυαδική αναζήτηση ταξινομημένα λογάριθμος συγκρίσεις',
        Component: lazy(() => import('../../components/courses/Lesson16Module')),
      },
    ],
  },
]
