import { usePool } from '../../context/PoolContext'
import { Avatar } from '../ui/Avatar'
import { Flag } from '../ui/Flag'
import { medal } from '../../lib/utils'

export function LeaderboardTab() {
  const { pool } = usePool()
  if (!pool) return null
  const board = pool.leaderboard ?? []

  const champPickOf = (memberId: string) => {
    const m = pool.members.find(x => x.id === memberId)
    return m?.picks?.results?.[104] ?? null
  }

  return (
    <div>
      {pool.complete && pool.finale && (
        <div className="flex items-center gap-4 px-5 py-[18px] rounded-[18px] mb-4 bg-[linear-gradient(90deg,rgba(255,206,74,0.18),rgba(255,46,126,0.08))] border border-gold/45">
          <div className="text-[42px] drop-shadow-[0_4px_12px_rgba(255,206,74,0.5)]">🏆</div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[#ffe39a] font-[750]">Pool Champion</div>
            <div className="font-sora text-[24px] font-extrabold">{pool.finale.winner.name}</div>
            <div className="text-sm text-muted">{pool.finale.winner.total} pts · {pool.finale.winner.accuracyPct}% of a perfect bracket</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {/* header */}
        <div className="grid items-center gap-2.5 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-2"
          style={{ gridTemplateColumns: '46px 1fr 110px 64px 70px' }}>
          <span className="text-center">#</span>
          <span>Player</span>
          <span>Champion</span>
          <span className="text-right">Acc</span>
          <span className="text-right">PTS</span>
        </div>
        {board.map(r => {
          const champId = champPickOf(r.id)
          const isYou = r.id === pool.you.id
          const msg = pool.finale?.messages.find(m => m.id === r.id)
          return (
            <div key={r.id}>
              <div
                className={`grid items-center gap-2.5 px-4 py-3 rounded-[12px] border
                  ${isYou ? 'border-accent-2 bg-accent-2/[0.1]' : r.rank === 1 ? 'border-gold/50 bg-[linear-gradient(90deg,rgba(255,206,74,0.12),transparent)]' : 'border-line-soft bg-white/[0.03]'}`}
                style={{ gridTemplateColumns: '46px 1fr 110px 64px 70px' }}
              >
                <span className="text-center text-[16px] font-extrabold">{medal(r.rank)}</span>
                <span className="flex items-center gap-2 font-semibold text-sm min-w-0">
                  <Avatar name={r.name} size="sm" />
                  <span className="truncate">{r.name}{isYou ? ' (you)' : ''}</span>
                </span>
                <span className="text-xs">
                  {champId ? (
                    <span className={`inline-flex items-center gap-1.5 font-bold ${r.championRight ? 'text-green' : 'text-muted'}`}>
                      <Flag teamId={champId} size="sm" className="!w-[22px] !h-[15px]" />
                      {champId}
                    </span>
                  ) : '—'}
                </span>
                <span className="text-sm text-muted text-right">{r.accuracyPct}%</span>
                <span className="font-sora font-extrabold text-[18px] text-right">{r.total}</span>
              </div>
              {msg && (
                <div className="text-[12.5px] text-muted italic px-4 pb-2.5 mt-[-4px]">{msg.message}</div>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-center text-xs text-muted mt-4">
        {pool.complete ? 'Final standings.' : 'Live standings — updates as official results come in.'}
      </p>
    </div>
  )
}
