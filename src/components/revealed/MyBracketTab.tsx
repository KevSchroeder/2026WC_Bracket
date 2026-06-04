import { usePool } from '../../context/PoolContext'
import { TEAMS } from '../../lib/data'
import { KnockoutBracket } from '../bracket/KnockoutBracket'
import { ScoreSummary } from './ScoreSummary'
import { LegendGreen } from './LegendGreen'

export function MyBracketTab() {
  const { pool } = usePool()
  if (!pool) return null
  const me = pool.members.find(m => m.id === pool.you.id)
  const champ = pool.you.picks.results?.[104]

  return (
    <div>
      <LegendGreen />
      {me && <ScoreSummary member={me} maxScore={pool.maxScore} />}
      <div className="mt-4">
        <div className="flex items-center gap-3 px-2 pb-4">
          <span className="w-[44px] h-[44px] rounded-[12px] grid place-items-center font-sora font-extrabold text-white bg-brand-grad">26</span>
          <div>
            <strong className="font-sora text-[18px] font-extrabold text-ink">You — World Cup 2026 Bracket</strong>
            <em className="block text-[12.5px] text-muted not-italic">
              {champ ? `Champion pick: ${TEAMS[champ]?.name ?? champ}` : '—'}
            </em>
          </div>
        </div>
        <KnockoutBracket picks={pool.you.picks} mode="view" official={pool.official ?? undefined} />
      </div>
    </div>
  )
}
