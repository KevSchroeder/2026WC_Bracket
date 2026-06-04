import type { Member } from '../../types'
import { cn } from '../../lib/utils'

interface ScoreSummaryProps { member: Member; maxScore: number }

export function ScoreSummary({ member, maxScore }: ScoreSummaryProps) {
  if (member.total == null) return null
  const bd = member.breakdown
  if (!bd) return null
  const parts: [string, number][] = [
    ['Groups', bd.group], ['Thirds', bd.thirds], ['R32', bd.R32], ['R16', bd.R16],
    ['QF', bd.QF], ['SF', bd.SF], ['Final', bd.F], ['Champ bonus', bd.champ],
  ]
  return (
    <div className="flex items-center gap-4 flex-wrap px-[18px] py-[14px] rounded-[14px] bg-white/[0.03] border border-line mb-4">
      <div className="score-total">
        <b className="font-sora text-[26px]">{member.total}</b>
        <span className="text-[12.5px] text-muted ml-1.5">/ {maxScore} pts · {member.accuracyPct}%</span>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {parts.map(([k, v]) => (
          <span key={k} className={cn(
            'text-[11px] font-[650] px-[10px] py-1 rounded-full border',
            v ? 'text-ink border-accent-2 bg-accent-2/[0.12]' : 'text-muted-2 border-line-soft bg-white/[0.04]',
          )}>
            {k} {v || 0}
          </span>
        ))}
      </div>
    </div>
  )
}
