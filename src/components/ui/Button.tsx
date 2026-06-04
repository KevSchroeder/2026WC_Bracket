import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'ghost', size = 'md', className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 cursor-pointer border-0 rounded-[11px] font-[650] text-[13.5px] transition-all duration-200 active:scale-[0.99]',
        size === 'sm' && 'px-[13px] py-2 text-xs rounded-[9px]',
        size === 'md' && 'px-4 py-[10px]',
        size === 'lg' && 'px-6 py-[13px] text-[15px] rounded-[13px]',
        variant === 'primary' && 'bg-brand-grad text-white shadow-glow hover:shadow-[0_14px_30px_-10px_rgba(123,92,255,0.95)] hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
        variant === 'ghost' && 'bg-white/[0.06] border border-line text-ink hover:bg-white/[0.11]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
