import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { lessonComponent } from '../../components/courses/lessonComponent'
import type { Lesson } from './lesson1'

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

type LessonEntry = Omit<CatalogLesson, 'Component'> & { Component?: CatalogLesson['Component'] }
type ChapterEntry = Omit<CatalogChapter, 'lessons'> & { lessons: LessonEntry[] }

// Τα δεδομένα κάθε μαθήματος βρίσκονται στο lesson<κωδικός>.ts και φορτώνονται όταν ανοίξει.
// Το id «lesson-5a» αντιστοιχεί στο αρχείο lesson5a.ts και στην εξαγωγή lesson5aData.
const lessonFiles = import.meta.glob<Record<string, Lesson>>('./lesson*.ts')

function loadLesson(id: string): () => Promise<Lesson> {
  const key = id.replace('-', '')
  const load = lessonFiles['./' + key + '.ts']
  if (!load) throw new Error('Δεν βρέθηκε αρχείο δεδομένων για το μάθημα ' + id + '.')
  return async () => (await load())[key + 'Data']
}

// Κάθε νέο μάθημα δηλώνεται μία φορά εδώ. Το Component χρειάζεται μόνο όταν το μάθημα έχει δική του διάταξη.
const chapters: ChapterEntry[] = [
  {
    id: 'chapter-1',
    title: 'Κεφάλαιο 1',
    subtitle: 'Ανάλυση Προβλήματος',
    lessons: [
      {
        id: 'lesson-1',
        number: 1,
        title: 'Ανάλυση Προβλήματος',
        summary: 'Δεδομένα, ζητούμενα και στάδια αντιμετώπισης.',
      },
    ],
  },
  {
    id: 'chapter-2',
    title: 'Κεφάλαιο 2',
    subtitle: 'Προγραμματισμός & Αλγόριθμοι',
    lessons: [
      {
        id: 'lesson-2',
        number: 2,
        title: 'Εισαγωγή στον Προγραμματισμό',
        summary: 'Γλώσσες και τεχνικές σχεδίασης προγραμμάτων.',
      },
      {
        id: 'lesson-3',
        number: 3,
        title: 'Προγραμματιστικές Τεχνικές & Περιβάλλοντα',
        summary: 'Μεταγλώττιση, διερμηνεία και είδη λαθών.',
        searchTerms: 'λάθη προγράμματος μεταγλωττιστής διερμηνευτής',
      },
      {
        id: 'lesson-4',
        number: 4,
        title: 'Αλγόριθμοι & Δομή Ακολουθίας',
        summary: 'Ορισμός, κριτήρια, αναπαράσταση και βασικές εντολές αλγορίθμου.',
        searchTerms: 'διάγραμμα ροής ψευδογλώσσα δεδομένα αποτελέσματα είσοδος έξοδος',
      },
    ],
  },
  {
    id: 'chapter-7',
    title: 'Κεφάλαιο 7',
    subtitle: 'Βασικές Έννοιες Προγραμματισμού',
    lessons: [
      {
        id: 'lesson-5a',
        number: '5Α',
        title: 'Βασικές Έννοιες της ΓΛΩΣΣΑΣ',
        summary: 'Τύποι, μεταβλητές, τελεστές, εκφράσεις και εκχώρηση.',
        searchTerms: 'αλφάβητο σταθερές div mod συναρτήσεις ακέραιο μέρος',
      },
      {
        id: 'lesson-5b',
        number: '5Β',
        title: 'Βασικές Συνιστώσες Προγράμματος σε ΓΛΩΣΣΑ',
        summary: 'ΔΙΑΒΑΣΕ, ΓΡΑΨΕ, δομή προγράμματος και πίνακες τιμών.',
        searchTerms: 'είσοδος έξοδος σταθερές μεταβλητές ιχνηλάτηση ψηφία αντιμετάθεση στρογγυλοποίηση λάθη',
      },
    ],
  },
  {
    id: 'selection',
    title: 'Δομή Επιλογής',
    subtitle: 'Απλή, σύνθετη & πολλαπλή επιλογή',
    lessons: [
      {
        id: 'lesson-6',
        number: 6,
        title: 'Απλή & Σύνθετη Επιλογή',
        summary: 'Συνθήκες, μέγιστο, μετρητές και πίνακες τιμών.',
        searchTerms: 'ΑΝ ΤΟΤΕ ΑΛΛΙΩΣ max min ιχνηλάτηση',
      },
      {
        id: 'lesson-7',
        number: 7,
        title: 'Πολλαπλή Επιλογή & Κλιμακωτοί Υπολογισμοί',
        summary: 'ΑΛΛΙΩΣ_ΑΝ, διαστήματα τιμών και κλιμακωτές χρεώσεις.',
        searchTerms: 'ΕΠΙΛΕΞΕ ΠΕΡΙΠΤΩΣΗ όρια κλίμακες χρέωση',
      },
      {
        id: 'lesson-8',
        number: 8,
        title: 'Η Εντολή ΕΠΙΛΕΞΕ',
        summary: 'ΠΕΡΙΠΤΩΣΗ, λίστες τιμών και ισοδύναμες μετατροπές.',
        searchTerms: 'διαστήματα τιμών επικάλυψη ΑΛΛΙΩΣ_ΑΝ διάγραμμα ροής',
      },
      {
        id: 'lesson-9',
        number: 9,
        title: 'Εμφωλευμένες Εντολές Επιλογής',
        summary: 'ΑΝ μέσα σε ΑΝ, κλάδοι, εσοχές και μετατροπές.',
        searchTerms: 'εμφώλευση ΤΕΛΟΣ_ΑΝ απλές ΑΝ ΕΠΙΛΕΞΕ',
      },
    ],
  },
  {
    id: 'repetition',
    title: 'Δομή Επανάληψης',
    subtitle: 'Βρόχοι, φρουροί & επεξεργασία τιμών',
    lessons: [
      {
        id: 'lesson-10',
        number: 10,
        title: 'Η Εντολή ΟΣΟ…ΕΠΑΝΑΛΑΒΕ',
        summary: 'Συνθήκη, τιμή φρουρός, άθροισμα, πλήθος, μέσος όρος και μέγιστες τιμές.',
        searchTerms: 'βρόχος ατέρμων φρουρός max min μετρητής άθροισμα',
      },
      {
        id: 'lesson-11',
        number: 11,
        title: 'Η Εντολή ΑΡΧΗ_ΕΠΑΝΑΛΗΨΗΣ…ΜΕΧΡΙΣ_ΟΤΟΥ',
        summary: 'Έλεγχος στο τέλος, εγκυρότητα εισόδου, τιμή φρουρός και μενού.',
        searchTerms: 'ΜΕΧΡΙΣ_ΟΤΟΥ βρόχος εγκυρότητα φρουρός μενού ΟΣΟ',
      },
      {
        id: 'lesson-12',
        number: 12,
        title: 'Η Εντολή ΓΙΑ…ΑΠΟ…ΜΕΧΡΙ',
        summary: 'Γνωστό πλήθος επαναλήψεων, βήμα, επεξεργασία Ν τιμών και ακραίες τιμές.',
        searchTerms: 'ΓΙΑ ΜΕ ΒΗΜΑ βρόχος μετρητής άθροισμα μέσος όρος μέγιστο ελάχιστο',
      },
      {
        id: 'lesson-13',
        number: 13,
        title: 'Εμφωλευμένοι Βρόχοι & Μετατροπές',
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
        id: 'lesson-14',
        number: 14,
        title: 'Φυσική Γλώσσα κατά Βήματα',
        summary: 'Αριθμημένα βήματα, επιλογές, επαναλήψεις και μετατροπή από ψευδογλώσσα.',
        searchTerms: 'είσοδος έξοδος βήματα αλγόριθμος πήγαινε ΟΣΟ ΜΕΧΡΙΣ_ΟΤΟΥ ΓΙΑ',
      },
      {
        id: 'lesson-15',
        number: 15,
        title: 'Ολίσθηση & Πολλαπλασιασμός αλά Ρωσικά',
        summary: 'Δυαδικές ολισθήσεις, περιττές τιμές και ιχνηλάτηση του γινομένου.',
        searchTerms: 'shift αριστερά δεξιά διπλασιασμός υποδιπλασιασμός DIV MOD',
      },
    ],
  },
  {
    id: 'algorithm-design',
    title: 'Τεχνικές Σχεδίασης Αλγορίθμων',
    subtitle: 'Ανάλυση & διαίρει και βασίλευε',
    lessons: [
      {
        id: 'lesson-16',
        number: 16,
        title: 'Τεχνικές Σχεδίασης Αλγορίθμων',
        summary: 'Ανάλυση προβλήματος, διαίρει και βασίλευε και δυαδική αναζήτηση.',
        searchTerms: 'συγγενή προβλήματα δυαδική αναζήτηση ταξινομημένα λογάριθμος συγκρίσεις',
      },
    ],
  },
  {
    id: 'data-structures',
    title: 'Δομές Δεδομένων',
    subtitle: 'Στατικές δομές & μονοδιάστατοι πίνακες',
    lessons: [
      {
        id: 'lesson-17',
        number: 17,
        title: 'Δομές Δεδομένων & Μονοδιάστατοι Πίνακες',
        summary: 'Δεδομένα, λειτουργίες δομών, στατικές/δυναμικές δομές και δήλωση πινάκων.',
        searchTerms: 'πληροφορία Wirth στατική δυναμική δείκτης στοιχείο πίνακα ΜΕΤΑΒΛΗΤΕΣ',
      },
      {
        id: 'lesson-18',
        number: 18,
        title: 'Μονοδιάστατοι Πίνακες: Λειτουργίες & Τεχνικές',
        summary: 'Ακρότατα και θέσεις τους, παράλληλοι πίνακες, δύο μεγαλύτεροι και πίνακας μετρητών.',
        searchTerms: 'max min θέση παράλληλοι πίνακες max1 max2 συχνότητα μετρητές εισαγωγή διαγραφή',
      },
      {
        id: 'lesson-19',
        number: 19,
        title: 'Ταξινόμηση, Συγχώνευση & Αρχεία',
        summary: 'Φυσαλίδα, επιλογή, ευθεία εισαγωγή, συγχώνευση και δομές δευτερεύουσας μνήμης.',
        searchTerms: 'ταξινόμηση φυσαλίδα ευθεία ανταλλαγή επιλογή εισαγωγή αντιμετάθεσε συγχώνευση αρχεία εγγραφή πεδίο κλειδί εργαστήριο οπτικοποίηση',
        Component: lazy(() => import('../../components/courses/Lesson19Module')),
      },
      {
        id: 'lesson-20',
        number: 20,
        title: 'Αναζήτηση σε Πίνακες',
        summary: 'Σειριακή και δυαδική αναζήτηση, παράλληλοι πίνακες, όλες οι θέσεις και μοναδικά στοιχεία.',
        searchTerms: 'σειριακή δυαδική αναζήτηση key flag θέση μέσος ταξινομημένος παράλληλοι μοναδικά εργαστήριο οπτικοποίηση',
        Component: lazy(() => import('../../components/courses/Lesson20Module')),
      },
    ],
  },
]

export const courseCatalog: CatalogChapter[] = chapters.map(chapter => ({
  ...chapter,
  lessons: chapter.lessons.map(lesson => ({
    ...lesson,
    Component: lesson.Component ?? lessonComponent(lesson.number, loadLesson(lesson.id)),
  })),
}))
