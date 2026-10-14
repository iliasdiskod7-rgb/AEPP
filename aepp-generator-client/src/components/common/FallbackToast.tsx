import { useEffect, useState } from 'react'

export default function FallbackToast({ message }: { message: string | null }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    setVisible(Boolean(message))
    if (!message) return
    const timer = window.setTimeout(() => setVisible(false), 12_000)
    return () => window.clearTimeout(timer)
  }, [message])
  if (!message || !visible) return null
  return <div role="status" aria-live="polite" className="preview-controls fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 shadow-lg">
    <p>{message}</p><button type="button" aria-label="Κλείσιμο ενημέρωσης" onClick={() => setVisible(false)} className="px-2 font-bold">×</button>
  </div>
}
