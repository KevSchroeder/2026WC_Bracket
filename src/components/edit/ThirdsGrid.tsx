import { cn } from '../../lib/utils'
import { GROUP_LETTERS, TEAMS } from '../../lib/data'
import { Flag } from '../ui/Flag'
import type { Picks } from '../../types'

interface ThirdsGridProps {
  picks: Picks
  mode: 'edit' | 'view' | 'official'
  official?: Picks
  onChange?: (updated: Picks) => void
  onChangeFn?: (updater: (prev: Picks) => Picks) => void
  onToast?: (msg: string) => void
}

export function ThirdsGrid({ picks, mode, official, onChange, onChangeFn, onToast }: ThirdsGridProps) {
  const interactive = mode === 'edit' || mode === 'official'
  const thirds = picks.thirds ?? []
  const full = thirds.length >= 8

  const thirdTeams = GROUP_LETTERS
    .map(L => ({ L, id: (picks.groups[L] ?? [])[2] }))
    .filter(x => x.id)

  function toggle(id: string) {
    if (onChangeFn) {
      onChangeFn(prev => {
        const t = prev.thirds ?? []
        const i = t.indexOf(id)
        if (i >= 0) return { ...prev, thirds: t.filter(x => x !== id) }
        if (t.length < 8) return { ...prev, thirds: [...t, id] }
        onToast?.("That's 8 already — deselect one to swap"); return prev
      })
      return
    }
    const i = thirds.indexOf(id)
    let next: string[]
    if (i >= 0) next = thirds.filter(t => t !== id)
    else if (thirds.length < 8) next = [...thirds, id]
    else { onToast?.("That's 8 already — deselect one to swap"); return }
    onChange?.({ ...picks, thirds: next })
  }

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
      {thirdTeams.map(({ L, id }) => {
        const selected = thirds.includes(id)
        const locked = interactive && !selected && full
        const correct = mode === 'view' && selected && (official?.thirds ?? []).includes(id)
        const t = TEAMS[id]
        return (
          <div
            key={id}
            onClick={() => interactive && !locked && toggle(id)}
            className={cn(
              'third-card flex items-center gap-3 px-[15px] py-[13px] rounded-[14px] cursor-pointer transition-all duration-200',
              'bg-card-grad border',
              selected && 'selected',
              locked && 'locked',
              selected
                ? 'border-accent-3 shadow-[0_0_0_1px_rgba(25,216,216,1),0_14px_30px_-16px_rgba(25,216,216,0.7)]'
                : 'border-line hover:-translate-y-0.5 hover:border-accent-2',
              locked && 'opacity-40 pointer-events-none grayscale-[0.5]',
              correct && 'border-green shadow-[0_0_0_1px_rgba(43,237,107,0.55)]',
            )}
          >
            <Flag teamId={id} size="lg" />
            <div className="flex-1">
              <div className="text-[14.5px] font-[650] text-ink">{t?.name}</div>
              <div className="text-[11px] text-muted-2 font-semibold">3rd · Group {L}</div>
            </div>
            <div className={cn(
              'w-[22px] h-[22px] rounded-full border-2 flex-none transition-all',
              selected ? 'bg-accent-3 border-accent-3 shadow-[inset_0_0_0_3px_#0e1430]' : 'border-line',
            )} />
          </div>
        )
      })}
    </div>
  )
}
