import { useState } from 'react'
import { usePool, useToast } from '../../context/PoolContext'
import { Identity } from '../../lib/identity'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

export function LandingScreen() {
  return (
    <section className="max-w-[1040px] mx-auto animate-view-in">
      <div className="text-center px-4 py-7">
        <h2 className="font-sora font-extrabold leading-[1.05] tracking-tight text-[clamp(28px,5vw,46px)] text-ink">
          Run the World Cup <span className="bg-brand-grad bg-clip-text text-transparent">bracket pool</span>
        </h2>
        <p className="max-w-[620px] mx-auto mt-4 text-muted text-[15px] leading-[1.55]">
          Pick all 48 teams from the group stage to the Final, invite your friends, and battle up a live leaderboard. Nobody sees each other's picks until the first whistle.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <CreatePanel />
        <JoinPanel />
      </div>
      <RecentPools />
    </section>
  )
}

function CreatePanel() {
  const { doCreate } = usePool()
  const toast = useToast()
  const [poolName, setPoolName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!displayName.trim()) { toast('Enter your display name'); return }
    setLoading(true)
    try { await doCreate(poolName.trim(), displayName.trim()) }
    catch (e) { toast(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-card-grad border border-line rounded-[18px] p-5 shadow-card">
      <h3 className="text-[18px] font-[750] mb-1">Create a pool</h3>
      <p className="text-sm text-muted mb-4">You'll be the commissioner — share the invite link and enter results as the tournament plays out.</p>
      <Input label="Pool name" placeholder="The Office World Cup" maxLength={60} className="mb-3" value={poolName} onChange={e => setPoolName(e.target.value)} wrapClass="mb-3" />
      <Input label="Your display name" placeholder="e.g. Alex" maxLength={40} value={displayName} onChange={e => setDisplayName(e.target.value)} wrapClass="mb-4" />
      <Button variant="primary" size="lg" className="w-full justify-center" disabled={loading} onClick={submit}>
        {loading ? 'Creating…' : 'Create pool →'}
      </Button>
    </div>
  )
}

function JoinPanel() {
  const { doJoin } = usePool()
  const toast = useToast()
  const [inviteLink, setInviteLink] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)

  function parseInvite(link: string) {
    try {
      const u = new URL(link.trim(), location.origin)
      return { pool: u.searchParams.get('pool'), code: u.searchParams.get('code') }
    } catch { return { pool: null, code: null } }
  }

  async function submit() {
    const { pool, code } = parseInvite(inviteLink)
    if (!pool || !code) { toast("That doesn't look like a valid invite link"); return }
    if (!displayName.trim()) { toast('Enter your display name'); return }
    setLoading(true)
    try { await doJoin(pool, code, displayName.trim()) }
    catch (e) { toast(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="bg-card-grad border border-line rounded-[18px] p-5 shadow-card">
      <h3 className="text-[18px] font-[750] mb-1">Have an invite?</h3>
      <p className="text-sm text-muted mb-4">Paste the invite link a friend sent you, pick a name, and you're in.</p>
      <Input label="Invite link" placeholder={`${location.origin}/?pool=…&code=…`} value={inviteLink} onChange={e => setInviteLink(e.target.value)} wrapClass="mb-3" />
      <Input label="Your display name" placeholder="e.g. Sam" maxLength={40} value={displayName} onChange={e => setDisplayName(e.target.value)} wrapClass="mb-4" />
      <Button size="lg" className="w-full justify-center" disabled={loading} onClick={submit}>
        {loading ? 'Joining…' : 'Join pool →'}
      </Button>
    </div>
  )
}

function RecentPools() {
  const { loadPool } = usePool()
  const recent = Identity.list()
  if (!recent.length) return null
  return (
    <div className="mt-6 text-center">
      <h4 className="text-xs uppercase tracking-[0.1em] text-muted-2 mb-3">Your pools</h4>
      <div className="flex flex-wrap justify-center gap-2.5">
        {recent.map(({ id, member: m }) => (
          <button
            key={id}
            onClick={() => loadPool(id, m)}
            className="flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-[12px] bg-white/[0.05] border border-line cursor-pointer text-ink hover:border-accent-2 hover:-translate-y-0.5 transition-all"
          >
            <b className="text-sm">{m.poolName || 'Pool'}</b>
            <span className="text-[11.5px] text-muted">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
