import { usePool } from '../../context/PoolContext'
import { TEAMS } from '../../lib/data'
import { Avatar } from '../ui/Avatar'
import { KnockoutBracket } from '../bracket/KnockoutBracket'
import { ScoreSummary } from './ScoreSummary'
import { LegendGreen } from './LegendGreen'
import { medal } from '../../lib/utils'
import { cn } from '../../lib/utils'

export function EveryoneTab() {
  const { pool, everyoneView, setEveryoneView } = usePool()
  if (!pool) return null

  const list = pool.leaderboard ?? pool.members
  const selected = pool.members.find(m => m.id === everyoneView)

  return (
    <div>
      <p className="text-sm text-muted mb-4">Everyone's picks are public now. Tap a player to study their bracket — correct calls light up green.</p>
      <div className="grid gap-2.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {list.map(r => {
          const champId = r.picks?.results?.[104]
          return (
            <button
              key={r.id}
              onClick={() => setEveryoneView(everyoneView === r.id ? null : r.id)}
              className={cn(
                'flex items-center gap-3 px-[14px] py-3 rounded-[13px] border cursor-pointer text-ink text-left transition-all',
                'bg-white/[0.03] hover:border-accent-2 hover:-translate-y-0.5',
                everyoneView === r.id ? 'border-accent-2 bg-accent-2/[0.12]' : 'border-line',
              )}
            >
              <Avatar name={r.name} />
              <div className="flex-1 min-w-0">
                <b className="text-[13.5px] block truncate">{r.name}{r.id === pool.you.id ? ' (you)' : ''}</b>
                <span className="text-[11.5px] text-muted">
                  {r.total != null ? `${r.total} pts` : ''}{champId ? ` · ${champId}` : ''}
                </span>
              </div>
              {r.rank != null && <span className="text-[18px] font-extrabold">{medal(r.rank)}</span>}
            </button>
          )
        })}
      </div>
      {selected?.picks && (
        <div>
          <LegendGreen />
          <ScoreSummary member={selected} maxScore={pool.maxScore} />
          <div className="flex items-center gap-3 px-2 pb-4">
            <Avatar name={selected.name} />
            <div>
              <strong className="font-sora text-[16px] font-extrabold">{selected.name} — World Cup 2026 Bracket</strong>
              {selected.picks.results?.[104] && (
                <em className="block text-[12.5px] text-muted not-italic">
                  Champion pick: {TEAMS[selected.picks.results[104]]?.name}
                </em>
              )}
            </div>
          </div>
          <KnockoutBracket picks={selected.picks} mode="view" official={pool.official ?? undefined} />
        </div>
      )}
    </div>
  )
}
