import { usePool } from '../../context/PoolContext'
import { Avatar } from '../ui/Avatar'

export function RosterPanel() {
  const { pool } = usePool()
  if (!pool) return null
  const submitted = pool.members.filter(m => m.submitted).length

  return (
    <div className="mt-6 bg-card-grad border border-line rounded-[18px] p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-[750]">Players</h3>
        <span className="text-xs font-[650] text-ink px-[14px] py-2 rounded-full border border-line bg-white/[0.04]">
          {submitted}/{pool.members.length} locked in
        </span>
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
        {pool.members.map(m => (
          <div
            key={m.id}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] border border-line-soft bg-white/[0.03] ${m.id === pool.you.id ? 'border-accent-2 !bg-accent-2/[0.1]' : ''}`}
          >
            <Avatar name={m.name} />
            <span className="flex-1 text-[13.5px] font-semibold flex items-center gap-1">
              {m.name}{m.id === pool.you.id ? ' (you)' : ''}
              {m.isAdmin && <span className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-brand-grad text-white ml-1">C</span>}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${m.submitted ? 'text-green bg-green/[0.13]' : 'text-muted bg-white/[0.05]'}`}>
              {m.submitted ? 'Locked in ✓' : 'Still picking…'}
            </span>
          </div>
        ))}
      </div>
      {!pool.revealed && (
        <p className="mt-3 text-center text-xs text-muted-2">🙈 Brackets stay private until the first whistle.</p>
      )}
    </div>
  )
}
