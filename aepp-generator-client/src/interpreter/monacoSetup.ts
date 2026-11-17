import * as monaco from 'monaco-editor/editor/editor.api'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import 'monaco-editor/editor/contrib/find/browser/findController.js'
import 'monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js'
import 'monaco-editor/editor/contrib/format/browser/formatActions.js'
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js'
import 'monaco-editor/editor/contrib/snippet/browser/snippetController2.js'
import { registerGlossaLanguage } from './glossaLanguage'

// Το Vite δημιουργεί τοπικό worker bundle, χωρίς CDN ή εξωτερικό loader.
self.MonacoEnvironment = { getWorker: () => new EditorWorker() }
registerGlossaLanguage(monaco)
// Οι providers καταχωρίζονται μία φορά. Ανανέωση της γλώσσας απαιτεί νέα εγγραφή.
if (import.meta.hot) {
  import.meta.hot.accept('./glossaLanguage', () => window.location.reload())
}
export { monaco }
