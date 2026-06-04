import { cn } from '../../lib/utils'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: ReactNode
  wrapClass?: string
}

export function Input({ label, hint, wrapClass, className, ...rest }: InputProps) {
  const input = (
    <input
      className={cn(
        'w-full px-[14px] py-3 rounded-[11px] border border-line bg-white/[0.04]',
        'text-ink text-sm font-normal outline-none transition-all',
        'focus:border-accent-2 focus:bg-accent-2/[0.08]',
        'placeholder:text-muted-2',
        className,
      )}
      {...rest}
    />
  )
  if (!label) return <>{input}{hint}</>
  return (
    <label className={cn('flex flex-col gap-1.5', wrapClass)}>
      <span className="text-xs font-[650] text-muted tracking-[0.02em]">{label}</span>
      {input}
      {hint}
    </label>
  )
}
