import { usePool, useToast } from '../../context/PoolContext'
import { prune } from '../../lib/engine'
import { GROUP_LETTERS, BRACKET } from '../../lib/data'
import { Button } from '../ui/Button'
import { GroupsGrid } from './GroupsGrid'
import { ThirdsGrid } from './ThirdsGrid'
import { KnockoutBracket } from '../bracket/KnockoutBracket'
import { RosterPanel } from '../roster/RosterPanel'
import { AdminPanel } from '../admin/AdminPanel'
import { copyText } from '../../lib/utils'
import type { EditStep, Picks } from '../../types'
import { cn } from '../../lib/utils'

function allGroupsComplete(picks: Picks) {
  return GROUP_LETTERS.every(L => (picks.groups[L] ?? []).length === 3)
}
function knockoutCount(picks: Picks) {
  return BRACKET.filter(m => picks.results?.[m.m]).length
}
function bracketComplete(picks: Picks) {
  return allGroupsComplete(picks) && (picks.thirds ?? []).length === 8 &&
    knockoutCount(picks) === 31 && typeof picks.tiebreakerGoals === 'number'
}

const STEPS: { key: EditStep; label: string }[] = [
  { key: 'groups', label: 'Group Stage' },
  { key: 'thirds', label: 'Best Thirds' },
  { key: 'knockout', label: 'Knockout' },
]

export function EditScreen() {
  const ctx = usePool()
  const { pool, working, setWorking, editStep, setEditStep, schedulePickSave, savingState, doSubmit, me } = ctx
  const toast = useToast()

  if (!pool) return null

  const inviteUrl = pool.invite ? location.origin + pool.invite.path : null

  function updatePicks(next: Picks) {
    const pruned = prune(next)
    setWorking(pruned)
    schedulePickSave(pruned)
  }

  function updatePicksFn(updater: (prev: Picks) => Picks) {
    setWorking(prev => {
      const next = updater(prev)
      const pruned = prune(next)
      schedulePickSave(pruned)
      return pruned
    })
  }

  function handlePickWinner(matchNum: number, teamId: string) {
    setWorking(prev => {
      const next = { ...prev, results: { ...prev.results, [matchNum]: teamId } }
      return prune(next)
    })
    schedulePickSave({ ...working, results: { ...working.results, [matchNum]: teamId } })
  }

  const groupsDone = GROUP_LETTERS.filter(L => (working.groups[L] ?? []).length === 3).length
  const thirdsCount = (working.thirds ?? []).length
  const stepDone = (k: EditStep) => k === 'groups' ? allGroupsComplete(working) : k === 'thirds' ? thirdsCount === 8 : knockoutCount(working) === 31
  const stepLocked = (k: EditStep) => (k === 'thirds' && !allGroupsComplete(working)) || (k === 'knockout' && thirdsCount !== 8)

  async function handleSubmit() {
    if (!bracketComplete(working)) { toast('Finish every round and set your tiebreaker first'); return }
    if (!window.confirm("Submit and lock your bracket? You won't be able to change it after this.")) return
    try { await doSubmit() } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  const saveChip = savingState === 'saving' ? 'Saving…' : savingState === 'saved' ? 'Draft saved ✓' : 'Draft'

  return (
    <section className="max-w-[1500px] mx-auto animate-view-in">
      {/* header */}
      <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
        <div>
          <h2 className="font-sora font-extrabold text-[27px]">Your bracket</h2>
          <p className="text-sm text-muted mt-1.5">Fill every round, set your Final tiebreaker, then submit to lock it in.</p>
        </div>
        <span className="text-xs font-[650] text-ink px-[14px] py-2 rounded-full border border-line bg-white/[0.04]">
          {saveChip}
        </span>
      </div>

      {/* invite bar (admin only) */}
      {inviteUrl && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[14px] bg-grad-soft border border-accent-2/30 mb-4 flex-wrap">
          <span className="text-xl">🔗</span>
          <div className="flex flex-col leading-tight">
            <b className="text-[13.5px]">Invite your friends</b>
            <span className="text-sm text-muted">Everyone needs the link to join before kickoff.</span>
          </div>
          <input
            readOnly value={inviteUrl}
            onClick={e => (e.target as HTMLInputElement).select()}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-[9px] bg-white/[0.04] border border-line text-muted-2 text-xs outline-none"
          />
          <Button size="sm" variant="primary" onClick={() => copyText(inviteUrl, toast)}>Copy link</Button>
        </div>
      )}

      {/* stepper */}
      <nav className="flex gap-1.5 bg-white/[0.03] p-[5px] rounded-[14px] border border-line-soft mb-5 w-max max-w-full overflow-x-auto">
        {STEPS.map(({ key, label }, i) => (
          <button
            key={key}
            disabled={stepLocked(key)}
            onClick={() => setEditStep(key)}
            className={cn(
              'flex items-center gap-[9px] border-0 cursor-pointer px-4 py-[9px] rounded-[10px] text-[13.5px] font-semibold transition-all text-muted whitespace-nowrap',
              editStep === key && 'text-white bg-grad-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
              stepDone(key) && 'text-accent-3',
              stepLocked(key) && 'opacity-45 cursor-not-allowed',
            )}
          >
            <i className={cn(
              'not-italic w-[21px] h-[21px] rounded-full grid place-items-center text-[11.5px] font-bold bg-white/[0.08] text-muted transition-all',
              editStep === key && 'bg-brand-grad text-white',
              stepDone(key) && 'bg-accent-3/[0.22] text-accent-3',
            )}>
              {i + 1}
            </i>
            {label}
          </button>
        ))}
      </nav>

      {/* step body */}
      {editStep === 'groups' && (
        <>
          <p className="text-sm text-muted mb-4">Tap teams to rank them 1st → 2nd → 3rd in all 12 groups. ({groupsDone}/12 groups set)</p>
          <GroupsGrid picks={working} mode="edit" onChange={updatePicks} onChangeFn={updatePicksFn} onToast={toast} />
        </>
      )}
      {editStep === 'thirds' && (
        <>
          <p className="text-sm text-muted mb-4">8 of the 12 third-placed teams advance. Pick your 8. ({thirdsCount}/8 selected)</p>
          <ThirdsGrid picks={working} mode="edit" onChange={updatePicks} onChangeFn={updatePicksFn} onToast={toast} />
        </>
      )}
      {editStep === 'knockout' && (
        <>
          <p className="text-sm text-muted mb-4">Click a team to send it through — Round of 32 to the Final.</p>
          <KnockoutBracket picks={working} mode="edit" onPickWinner={handlePickWinner} />
          {/* tiebreaker */}
          <div className="flex items-center justify-between gap-4 mt-5 px-5 py-4 rounded-[14px] bg-gold/[0.07] border border-gold/30 flex-wrap">
            <div>
              <b className="text-[14.5px]">Tiebreaker</b>
              <span className="block text-xs text-muted mt-0.5">Total goals scored by both teams in the Final</span>
            </div>
            <input
              type="number" min={0} max={20} placeholder="e.g. 3"
              value={working.tiebreakerGoals ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? null : Math.max(0, Math.min(20, parseInt(e.target.value, 10)))
                const next = { ...working, tiebreakerGoals: isNaN(v as number) ? null : v }
                setWorking(next); schedulePickSave(next)
              }}
              className="w-[120px] px-[14px] py-3 rounded-[11px] border border-line bg-white/[0.04] text-ink text-base font-bold outline-none focus:border-accent-2"
            />
          </div>
        </>
      )}

      {/* footer */}
      <div className="flex justify-end gap-3 mt-7 flex-wrap">
        {editStep !== 'knockout' ? (
          <Button
            variant="primary" size="lg"
            disabled={!stepDone(editStep)}
            onClick={() => setEditStep(editStep === 'groups' ? 'thirds' : 'knockout')}
          >
            {editStep === 'groups' ? 'Continue to Best Thirds →' : 'Build the Knockout →'}
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => setEditStep('thirds')}>← Thirds</Button>
            <Button variant="primary" size="lg" disabled={!bracketComplete(working)} onClick={handleSubmit}>
              Lock in my bracket 🔒
            </Button>
          </>
        )}
      </div>

      <RosterPanel />
      <AdminPanel />
    </section>
  )
}
