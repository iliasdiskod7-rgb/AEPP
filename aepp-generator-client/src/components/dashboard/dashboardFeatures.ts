import {
  BookOpenCheck,
  Braces,
  FileQuestion,
  LibraryBig,
  PanelsTopLeft,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import type { DashboardTab } from '../layout/DashboardLayout'

export interface DashboardFeature {
  id: string
  title: string
  description: string
  benefit: string
  destination: DashboardTab
  icon: LucideIcon
  iconClass: string
}

export const dashboardFeatures: DashboardFeature[] = [
  {
    id: 'interpreter',
    title: 'Διερμηνευτής ΓΛΩΣΣΑΣ',
    description: 'Γράψε κώδικα σε πλήρες διαδραστικό περιβάλλον με συντακτική επισήμανση και βηματική εκτέλεση.',
    benefit: 'Γράψε, δοκίμασε και εκτέλεσε πραγματικό κώδικα ΓΛΩΣΣΑΣ όπως στις Πανελλαδικές.',
    destination: 'interpreter',
    icon: Braces,
    iconClass: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'memory',
    title: 'Οπτικοποιητής Μνήμης & Πινάκων',
    description: 'Παρακολούθησε τις μεταβλητές και τους πίνακες 1Δ και 2Δ να αλλάζουν κατά την εκτέλεση.',
    benefit: 'Δες με animations πώς αλλάζουν οι τιμές και πώς εκτελείται η ταξινόμηση και η αναζήτηση.',
    destination: 'interpreter',
    icon: PanelsTopLeft,
    iconClass: 'bg-violet-100 text-violet-700',
  },
  {
    id: 'assessment',
    title: 'Διαγωνίσματα & Αυτόματη Αξιολόγηση',
    description: 'Λύσε προσομοιώσεις με Θέματα Α, Β, Γ και Δ, δοκιμές κώδικα και αυτόματη βαθμολόγηση.',
    benefit: 'Εξασκήσου σε συνθήκες εξέτασης και δες αναλυτική αναφορά λαθών ανά κεφάλαιο.',
    destination: 'assessment',
    icon: FileQuestion,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'daily',
    title: 'Καθημερινό 10-λεπτο Challenge',
    description: 'Απάντησε καθημερινά σε τρεις σύντομες ερωτήσεις θεωρίας, συμπλήρωσης και ίχνους εκτέλεσης.',
    benefit: 'Κράτα το streak σου ζωντανό, μάζεψε XP και διατήρησε την επαφή σου με την ύλη χωρίς άγχος.',
    destination: 'daily',
    icon: BookOpenCheck,
    iconClass: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'notes',
    title: 'Οι Σημειώσεις & Τα Προγράμματά μου',
    description: 'Οργάνωσε αλγορίθμους και σημειώσεις στην προσωπική σου βιβλιοθήκη.',
    benefit: 'Αποθήκευσε τις ασκήσεις σου και άνοιξέ τες ξανά από οποιαδήποτε συσκευή.',
    destination: 'notes',
    icon: LibraryBig,
    iconClass: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'whiteboard',
    title: 'Ψηφιακός Πίνακας & Διαγράμματα Ροής',
    description: 'Δημιούργησε διάγραμμα ροής από τον κώδικα και παρακολούθησε τον ενεργό κόμβο.',
    benefit: 'Κατανόησε οπτικά τη ροή εκτέλεσης του αλγορίθμου σου.',
    destination: 'whiteboard',
    icon: Workflow,
    iconClass: 'bg-cyan-100 text-cyan-700',
  },
]
