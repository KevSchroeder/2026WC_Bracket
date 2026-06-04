import { usePool, useToast } from '../../context/PoolContext'
import { useCountdown } from '../../hooks/useCountdown'
import { Button } from '../ui/Button'
import { Flag } from '../ui/Flag'
import { TEAMS } from '../../lib/data'
import { RosterPanel } from '../roster/RosterPanel'
import { AdminPanel } from '../admin/AdminPanel'
import { copyText } from '../../lib/utils'

export function LockedScreen() {
  const { pool, loadPool } = usePool()
  const toast = useToast()
  if (!pool) return null

  const { display, expired } = useCountdown(pool.lockAt)
  const champ = pool.you.picks.results?.[104]
  const inviteUrl = pool.invite ? location.origin + pool.invite.path : null

  if (expired) {
    // auto-reload when the countdown hits zero
    loadPool().catch(() => {})
  }

  return (
    <section className="max-w-[1500px] mx-auto animate-view-in">
      <div className="text-center px-5 py-10 bg-card-grad border border-line rounded-[20px] shadow-card">
        <div className="text-[46px] mb-2.5">🔒</div>
        <h2 className="font-sora font-extrabold text-[28px]">You're locked in</h2>
        <p className="max-w-[520px] mx-auto text-muted mt-2.5 text-sm leading-relaxed">
          Your picks are sealed. Nobody — not even the commissioner — can see anyone's bracket until the first match kicks off.
        </p>
        <div className="mt-5 text-sm text-muted">
          <span className="text-[12px] uppercase tracking-[0.1em] text-muted-2">First match in</span>
          <b className="font-sora text-[22px] text-ink ml-2">{display}</b>
        </div>
        {champ && (
          <div className="inline-flex items-center gap-2.5 mt-1.5 px-4 py-2 rounded-full bg-gold/[0.1] border border-gold/40">
            Your champion pick: <Flag teamId={champ} size="sm" /> <b>{TEAMS[champ]?.name}</b>
          </div>
        )}
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          {inviteUrl && (
            <Button onClick={() => copyText(inviteUrl, toast)}>Invite more players</Button>
          )}
        </div>
      </div>
      <RosterPanel />
      <AdminPanel />
    </section>
  )
}
