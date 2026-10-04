import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeEditor } from './CodeEditor'

export function Markdown({ children }: { children: string }) {
  return <div className="exam-prose"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    table({ children: content }) { return <div className="my-4 overflow-x-auto"><table>{content}</table></div> },
    pre({ children: content }) { return <>{content}</> },
    code({ className, children: content }) {
      const value = String(content).replace(/\n$/, '')
      return className?.startsWith('language-') || value.includes('\n')
        ? <CodeEditor value={value} readOnly /> : <code>{content}</code>
    },
  }}>{children}</ReactMarkdown></div>
}
