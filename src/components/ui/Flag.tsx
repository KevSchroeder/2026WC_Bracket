import { useState } from 'react'
import { cn } from '../../lib/utils'
import { TEAMS } from '../../lib/data'

interface FlagProps {
  teamId: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeMap = {
  sm:  'w-[22px] h-[15px]',
  md:  'w-[26px] h-[18px]',
  lg:  'w-[40px] h-[28px]',
  xl:  'w-[96px] h-[66px]',
}

export function Flag({ teamId, className, size = 'md' }: FlagProps) {
  const [errored, setErrored] = useState(false)
  const t = TEAMS[teamId]
  if (!t) return null

  if (errored) {
    return (
      <span className={cn('inline-grid place-items-center text-[9px] font-bold text-ink bg-card rounded', sizeMap[size], className)}>
        {teamId}
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w160/${t.iso}.png`}
      alt={`${t.name} flag`}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      decoding="async"
      className={cn('object-cover rounded shadow-[0_0_0_1px_rgba(255,255,255,0.12)] bg-card', sizeMap[size], className)}
      onError={() => setErrored(true)}
    />
  )
}
