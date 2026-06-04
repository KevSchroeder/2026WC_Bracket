import { usePool, useToast } from '../../context/PoolContext'
import { Button } from '../ui/Button'
import { copyText } from '../../lib/utils'

export function TopBar() {
  const { pool, me, goLanding, doLeave, screen } = usePool()
  const toast = useToast()

  const inviteUrl = pool?.invite ? location.origin + pool.invite.path : null

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 flex-wrap px-[clamp(16px,3vw,34px)] py-[14px] bg-bg-2/[0.72] backdrop-blur-md border-b border-line-soft">
      {/* brand */}
      <button
        onClick={goLanding}
        className="flex items-center gap-3 min-w-max cursor-pointer bg-transparent border-0 p-0"
      >
        <div className="w-[46px] h-[46px] rounded-[13px] grid place-items-center font-sora font-extrabold text-[19px] text-white bg-brand-grad shadow-[0_8px_22px_-6px_rgba(255,46,126,0.6)]">
          26
        </div>
        <div className="text-left">
          <h1 className="font-sora font-extrabold text-[20px] leading-none tracking-tight text-ink">
            World Cup{' '}
            <span className="bg-brand-grad bg-clip-text text-transparent">2026</span>
          </h1>
          <p className="text-[11.5px] text-muted mt-[3px] tracking-[0.04em]">Bracket Pool</p>
        </div>
      </button>

      {/* pool chip */}
      {pool && (
        <div className="ml-auto flex items-center gap-2.5 flex-wrap justify-end">
          <div className="flex items-center gap-2 px-[13px] py-[7px] rounded-[11px] bg-white/[0.05] border border-line-soft">
            <span className="text-[13.5px] font-bold text-ink">{pool.poolName}</span>
            <span className="text-[11.5px] text-muted">{pool.members.length} player{pool.members.length !== 1 ? 's' : ''}</span>
            {me?.isAdmin && (
              <span className="text-[9.5px] font-extrabold uppercase tracking-[0.05em] px-2 py-0.5 rounded-full bg-brand-grad text-white ml-1">
                Commissioner
              </span>
            )}
          </div>
          {inviteUrl && (
            <Button size="sm" onClick={() => copyText(inviteUrl, toast)}>Invite</Button>
          )}
          <Button size="sm" onClick={doLeave} title="Leave pool on this device">Leave</Button>
        </div>
      )}

      {/* landing screen — no pool chip */}
      {!pool && screen === 'landing' && (
        <div className="ml-auto" />
      )}
    </header>
  )
}
