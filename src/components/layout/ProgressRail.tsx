import { usePool } from '../../context/PoolContext'
import { GROUP_LETTERS } from '../../lib/data'
import { BRACKET } from '../../lib/data'

export function ProgressRail() {
  const { working, pool, screen } = usePool()

  let pct = 0
  if (screen === 'revealed') {
    pct = 100
  } else if (screen === 'edit') {
    const groups = GROUP_LETTERS.filter(L => (working.groups[L] ?? []).length === 3).length
    const thirds = (working.thirds ?? []).length
    const koDone = BRACKET.filter(m => working.results?.[m.m]).length
    const tiebreak = typeof working.tiebreakerGoals === 'number' ? 1 : 0
    pct = Math.round((groups + thirds + koDone + tiebreak) / 52 * 100)
  } else if (screen === 'locked') {
    pct = pool?.you.submitted ? 50 : 0
  }

  return (
    <div className="h-[3px] bg-white/[0.05] sticky top-[74px] z-[29]">
      <span
        className="block h-full bg-brand-grad transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
