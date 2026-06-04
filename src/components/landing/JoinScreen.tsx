import { useState } from 'react'
import { usePool, useToast } from '../../context/PoolContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

interface JoinScreenProps {
  poolId: string
  inviteCode: string
}

export function JoinScreen({ poolId, inviteCode }: JoinScreenProps) {
  const { doJoin, goLanding } = usePool()
  const toast = useToast()
  const [code, setCode] = useState(inviteCode)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim()) { toast('Enter your display name'); return }
    setLoading(true)
    try { await doJoin(poolId, code.trim().toUpperCase(), name.trim()) }
    catch (e) { toast(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <section className="max-w-[460px] mx-auto mt-6 animate-view-in">
      <div className="bg-card-grad border border-line rounded-[18px] p-5 shadow-card">
        <div className="inline-block text-xs font-bold text-[#ffe39a] bg-gold/[0.14] border border-gold/40 px-3 py-1 rounded-full mb-3">🎟️ You've been invited</div>
        <h3 className="text-[18px] font-[750] mb-2">Join the World Cup pool</h3>
        <p className="text-sm text-muted mb-5">Pick a display name to join. Your picks stay hidden from everyone until the tournament kicks off.</p>
        <Input label="Invite code" value={code} onChange={e => setCode(e.target.value)} placeholder="ABC123" wrapClass="mb-3" />
        <Input label="Your display name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sam" maxLength={40} wrapClass="mb-5" />
        <div className="flex gap-3">
          <Button variant="primary" size="lg" className="flex-1 justify-center" disabled={loading} onClick={submit}>
            {loading ? 'Joining…' : 'Join pool →'}
          </Button>
          <Button size="lg" onClick={goLanding}>Back</Button>
        </div>
      </div>
    </section>
  )
}
