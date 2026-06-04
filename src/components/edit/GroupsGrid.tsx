import { cn } from '../../lib/utils'
import { GROUPS, GROUP_LETTERS, TEAMS } from '../../lib/data'
import { Flag } from '../ui/Flag'
import type { Picks } from '../../types'

interface GroupsGridProps {
  picks: Picks
  mode: 'edit' | 'view' | 'official'
  official?: Picks
  onChange?: (updated: Picks) => void
  // used for functional-form updates (avoids stale closure on rapid clicks)
  onChangeFn?: (updater: (prev: Picks) => Picks) => void
  onToast?: (msg: string) => void
}

export function GroupsGrid({ picks, mode, official, onChange, onChangeFn, onToast }: GroupsGridProps) {
  const interactive = mode === 'edit' || mode === 'official'

  function handlePick(L: string, teamId: string) {
    // Use functional updater (onChangeFn) when available to avoid stale closures on rapid clicks
    if (onChangeFn) {
      onChangeFn(prev => {
        const prevGroup = prev.groups[L] ?? []
        const i = prevGroup.indexOf(teamId)
        let next: string[]
        if (i >= 0) next = prevGroup.filter((_, idx) => idx !== i)
        else if (prevGroup.length < 3) next = [...prevGroup, teamId]
        else { onToast?.('Top 3 set — tap a ranked team to change it'); return prev }
        const newGroups = { ...prev.groups, [L]: next }
        const newThirds = (prev.thirds ?? []).filter(tid =>
          GROUP_LETTERS.some(g => (newGroups[g] ?? [])[2] === tid)
        )
        return { ...prev, groups: newGroups, thirds: newThirds }
      })
      return
    }
    // fallback: value-based update (for OfficialEditor which uses local state)
    const prevGroup = picks.groups[L] ?? []
    const i = prevGroup.indexOf(teamId)
    let next: string[]
    if (i >= 0) next = prevGroup.filter((_, idx) => idx !== i)
    else if (prevGroup.length < 3) next = [...prevGroup, teamId]
    else { onToast?.('Top 3 set — tap a ranked team to change it'); return }
    const newGroups = { ...picks.groups, [L]: next }
    const newThirds = (picks.thirds ?? []).filter(tid =>
      GROUP_LETTERS.some(g => (newGroups[g] ?? [])[2] === tid)
    )
    onChange?.({ ...picks, groups: newGroups, thirds: newThirds })
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(286px,1fr))' }}>
      {GROUP_LETTERS.map(L => (
        <GroupCard
          key={L} letter={L} picks={picks} mode={mode} official={official}
          onPick={interactive ? (id) => handlePick(L, id) : undefined}
        />
      ))}
    </div>
  )
}

function GroupCard({ letter: L, picks, mode, official, onPick }: {
  letter: string; picks: Picks; mode: string; official?: Picks; onPick?: (id: string) => void
}) {
  const groupPicks = picks.groups[L] ?? []
  const complete = groupPicks.length === 3
  const officialTop2 = new Set(official?.groups[L]?.slice(0, 2) ?? [])

  function rankOf(id: string): 0 | 1 | 2 | 3 | 4 {
    const i = groupPicks.indexOf(id)
    if (i >= 0) return (i + 1) as 1 | 2 | 3
    if (groupPicks.length === 3) return 4
    return 0
  }

  const hint = groupPicks.length === 0 ? 'Tap the group winner'
    : groupPicks.length === 1 ? 'Now the runner-up'
    : groupPicks.length === 2 ? 'Tap who finishes 3rd'
    : '1st & 2nd advance · 3rd enters the thirds race'

  return (
    <div
      className={cn('group-card relative bg-card-grad border rounded-[16px] p-[14px] shadow-card overflow-hidden transition-[border-color]', complete ? 'border-accent-3/45' : 'border-line')}
      data-group={L}
    >
      {complete && (
        <div className="absolute top-3 right-3 text-[10.5px] font-bold text-accent-3 bg-accent-3/[0.14] px-2 py-0.5 rounded-full tracking-[0.04em]">
          ✓ set
        </div>
      )}
      <div className="flex items-center gap-[10px] mb-3">
        <div className="w-8 h-8 rounded-[9px] grid place-items-center font-sora font-extrabold text-[16px] text-white bg-brand-grad">
          {L}
        </div>
        <h3 className="text-sm font-bold text-muted uppercase tracking-[0.08em]">Group {L}</h3>
      </div>

      {GROUPS[L].map(id => {
        const r = rankOf(id)
        const t = TEAMS[id]
        const correct = mode === 'view' && officialTop2.size > 0 && r >= 1 && r <= 2 && officialTop2.has(id)
        return (
          <div
            key={id}
            onClick={() => onPick?.(id)}
            className={cn(
              'team-row flex items-center gap-[11px] px-[11px] py-[9px] my-1.5 rounded-[11px] transition-all duration-[180ms] relative select-none',
              'bg-white/[0.025] border border-transparent',
              onPick && 'cursor-pointer hover:bg-white/[0.07] hover:translate-x-0.5',
              r === 1 && 'bg-[linear-gradient(90deg,rgba(255,206,74,0.22),rgba(255,206,74,0.04))] border-gold/50',
              r === 2 && 'bg-[linear-gradient(90deg,rgba(207,217,238,0.18),rgba(207,217,238,0.03))] border-silver/40',
              r === 3 && 'bg-[linear-gradient(90deg,rgba(224,160,106,0.18),rgba(224,160,106,0.03))] border-bronze/40',
              r === 4 && 'opacity-[0.46] grayscale-[0.55]',
              correct && 'shadow-[inset_0_0_0_1px_rgba(43,237,107,0.55)]',
            )}
          >
            <Flag teamId={id} size="md" />
            <div className="flex-1 text-sm font-semibold leading-tight">{t.name}</div>
            <span className="text-[11px] text-muted-2 font-[600] tracking-[0.05em]">{id}</span>
            {r >= 1 && r <= 3 && (
              <div className={cn(
                'w-[26px] h-[26px] rounded-[8px] grid place-items-center text-[11px] font-extrabold text-[#0a0f22]',
                r === 1 && 'bg-gold', r === 2 && 'bg-silver', r === 3 && 'bg-bronze',
              )}>
                {r}
              </div>
            )}
            {correct && <span className="absolute right-2 text-green font-extrabold text-xs">✓</span>}
          </div>
        )
      })}

      {(mode === 'edit' || mode === 'official') && (
        <div className="text-[11px] text-muted-2 mt-[9px] text-center tracking-[0.02em]">{hint}</div>
      )}
    </div>
  )
}
