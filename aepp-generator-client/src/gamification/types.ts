export interface Reference { label: string; url: string; lessonId: string | null }
export interface Question { id: string; kind: string; prompt: string; code: string | null; declarations: string | null; blanks: { id: string; options: string[] }[] }
export interface Feedback { correct: boolean; expected: string; explanation: string; reference: Reference }
export interface Completion { day: string; startedAt: string; completedAt: string; durationSeconds: number; answers: Record<string,string>; feedback: Feedback[]; correctCount: number; xp: number; multiplier: number; streak: number; newBadges: string[]; loopResults: boolean[] }
export interface Profile { id: string; username: string; avatar: string; group: string; friends: string[]; publicCode: string; completions: Completion[]; freezes: string[]; studies: string[]; badges: string[]; attempt: { day: string; startedAt: string; theoryAnswer: string | null } | null }
export interface DailyState { profile: Profile; day: string; title: string; questions: Question[]; streak: number; xp: number; completion: Completion | null; theoryFeedback: Feedback | null; serverNow: string }
export interface LeaderRow { rank: number; username: string; avatar: string; streak: number; totalXp: number; rankingXp: number; self: boolean }
export type Scope = 'national' | 'group' | 'friends'
export type Period = 'weekly' | 'all'
export const badges: Record<string,{icon:string;name:string;description:string}> = {
 first:{icon:'🐣',name:'Πρώτο Βήμα',description:'Ολοκλήρωση πρώτου challenge'},
 loops:{icon:'🔄',name:'Master των Βρόχων',description:'5 τελευταίες απαντήσεις σε επαναλήψεις σωστές'},
 arrays:{icon:'📊',name:'Άρχοντας των Πινάκων',description:'3/3 σε challenge αναζήτησης ή ταξινόμησης'},
 lightning:{icon:'⚡',name:'Αστραπιαίος',description:'Ολοκλήρωση σε λιγότερο από 3 λεπτά'},
 month:{icon:'🏆',name:'Μήνας Φωτιά',description:'30 ολοκληρώσεις σε προστατευμένο σερί'}
}

export interface LeaderboardPage { items: LeaderRow[]; page: number; pageSize: number; hasNextPage: boolean }
