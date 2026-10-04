import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function Button({ className, variant = 'primary', type = 'button', ...props }: Props) {
  return <button type={type} className={cn(
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' && 'bg-teal-800 text-white hover:bg-teal-900',
    variant === 'secondary' && 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
    variant === 'ghost' && 'text-stone-600 hover:bg-stone-100', className,
  )} {...props} />
}
