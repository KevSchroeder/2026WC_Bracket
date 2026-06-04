import { usePool } from '../../context/PoolContext'
import { usePolling } from '../../hooks/usePolling'
import { cn } from '../../lib/utils'
import type { RevealTab } from '../../types'
import { MyBracketTab } from './MyBracketTab'
import { LeaderboardTab } from './LeaderboardTab'
import { EveryoneTab } from './EveryoneTab'
import { OfficialEditor } from './OfficialEditor'

export function RevealedScreen() {
  const { pool, revealTab, setRevealTab, loadPool } = usePool()
  if (!pool) return null

  usePolling(pool.revealed && !pool.complete, 25000, () => loadPool())

  const tabs: { key: RevealTab; label: string }[] = [
    { key: 'mybracket', label: 'My Bracket' },
    { key: 'leaderboard', label: `Leaderboard${pool.complete ? ' 🏆' : ''}` },
    { key: 'everyone', label: 'Everyone' },
    ...(pool.isAdmin ? [{ key: 'official' as RevealTab, label: 'Official Results' }] : []),
  ]

  return (
    <section className="max-w-[1500px] mx-auto animate-view-in">
      <nav className="flex gap-1.5 bg-white/[0.03] p-[5px] rounded-[14px] border border-line-soft mb-5 w-max max-w-full overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setRevealTab(key)}
            className={cn(
              'border-0 cursor-pointer px-[18px] py-2.5 rounded-[10px] text-[13.5px] font-[650] text-muted whitespace-nowrap transition-all',
              revealTab === key && 'text-white bg-grad-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
              revealTab !== key && 'hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="animate-view-in">
        {revealTab === 'mybracket' && <MyBracketTab />}
        {revealTab === 'leaderboard' && <LeaderboardTab />}
        {revealTab === 'everyone' && <EveryoneTab />}
        {revealTab === 'official' && pool.isAdmin && <OfficialEditor />}
      </div>
    </section>
  )
}
