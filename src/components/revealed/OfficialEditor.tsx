import { useRef } from 'react'
import { usePool, useToast } from '../../context/PoolContext'
import { prune } from '../../lib/engine'
import { Button } from '../ui/Button'
import { GroupsGrid } from '../edit/GroupsGrid'
import { ThirdsGrid } from '../edit/ThirdsGrid'
import { KnockoutBracket } from '../bracket/KnockoutBracket'
import type { EditStep, Picks } from '../../types'
import { cn } from '../../lib/utils'

export function OfficialEditor() {
  const { officialWorking, setOfficialWorking, officialStep, setOfficialStep, scheduleOfficialSave, simulateOfficial } = usePool()
  const toast = useToast()
  const finalGoalsRef = useRef<HTMLInputElement>(null)

  function update(picks: Picks) {
    const pruned = prune(picks)
    setOfficialWorking(pruned)
    const fg = finalGoalsRef.current
    const finalGoals = fg && fg.value !== '' ? parseInt(fg.value, 10) : undefined
    scheduleOfficialSave(pruned, finalGoals)
  }

  function handlePickWinner(matchNum: number, teamId: string) {
    const next = { ...officialWorking, results: { ...officialWorking.results, [matchNum]: teamId } }
    update(prune(next))
  }

  const steps: { key: EditStep; label: string }[] = [
    { key: 'groups', label: 'Groups' },
    { key: 'thirds', label: 'Thirds' },
    { key: 'knockout', label: 'Knockout' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-4 px-5 py-4 bg-card-grad border border-line rounded-[18px] mb-4">
        <div>
          <h3 className="text-base font-[750] mb-1">Official results</h3>
          <p className="text-sm text-muted">Enter what actually happens. Everyone's score updates live against this master bracket.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={simulateOfficial}>Simulate sample results</Button>
          <label className="flex items-center gap-2.5">
            <span className="text-xs font-[650] text-muted whitespace-nowrap">Final total goals</span>
            <input
              ref={finalGoalsRef}
              type="number" min={0} max={30}
              defaultValue={officialWorking.finalGoals ?? ''}
              onChange={() => scheduleOfficialSave(officialWorking, finalGoalsRef.current && finalGoalsRef.current.value !== '' ? parseInt(finalGoalsRef.current.value, 10) : undefined)}
              className="w-20 px-3 py-2 rounded-[9px] border border-line bg-white/[0.04] text-ink text-sm outline-none focus:border-accent-2"
            />
          </label>
        </div>
      </div>

      <nav className="flex gap-1.5 bg-white/[0.03] p-[5px] rounded-[14px] border border-line-soft mb-5 w-max">
        {steps.map(({ key, label }, i) => (
          <button
            key={key}
            onClick={() => setOfficialStep(key)}
            className={cn(
              'flex items-center gap-2 border-0 cursor-pointer px-4 py-[9px] rounded-[10px] text-[13.5px] font-semibold transition-all text-muted whitespace-nowrap',
              officialStep === key && 'text-white bg-grad-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
            )}
          >
            <i className={cn('not-italic w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold bg-white/[0.08] text-muted', officialStep === key && 'bg-brand-grad text-white')}>
              {i + 1}
            </i>
            {label}
          </button>
        ))}
      </nav>

      {officialStep === 'groups' && (
        <GroupsGrid picks={officialWorking} mode="official" onChange={update} onToast={toast} />
      )}
      {officialStep === 'thirds' && (
        <ThirdsGrid picks={officialWorking} mode="official" onChange={update} onToast={toast} />
      )}
      {officialStep === 'knockout' && (
        <KnockoutBracket picks={officialWorking} mode="official" onPickWinner={handlePickWinner} />
      )}

      <p className="text-right text-xs text-muted-2 mt-2.5">Saved automatically</p>
    </div>
  )
}
