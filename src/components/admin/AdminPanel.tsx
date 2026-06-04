import { useState } from 'react'
import { usePool, useToast } from '../../context/PoolContext'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { toLocalInput } from '../../lib/utils'
import * as API from '../../lib/api'

export function AdminPanel() {
  const { pool, me, poolId, isAdmin: _isAdmin, loadPool } = usePool() as ReturnType<typeof usePool> & { isAdmin: boolean }
  const toast = useToast()
  const [lockVal, setLockVal] = useState('')

  if (!pool?.isAdmin || pool.revealed) return null

  async function saveLockAt() {
    if (!lockVal || !poolId || !me) return
    try {
      await API.setSettings(poolId, me.token, { lockAt: new Date(lockVal).toISOString() })
      toast('Kickoff updated')
      await loadPool()
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  async function startNow() {
    if (!window.confirm('Start the tournament now? This locks every bracket and reveals all picks.')) return
    if (!poolId || !me) return
    try {
      await API.setSettings(poolId, me.token, { lockAt: new Date(Date.now() - 1000).toISOString() })
      toast('Tournament started!')
      await loadPool()
    } catch (e) { toast(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <div className="mt-4 bg-card-grad border border-gold/35 rounded-[18px] p-5 shadow-card">
      <h3 className="text-base font-[750] mb-1">🛠️ Commissioner controls</h3>
      <p className="text-sm text-muted mb-4">Set when the first match kicks off — every bracket locks and becomes visible at that moment.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2.5">
          <span className="text-xs font-[650] text-muted whitespace-nowrap">Kickoff</span>
          <Input
            type="datetime-local"
            defaultValue={toLocalInput(pool.lockAt)}
            onChange={e => setLockVal(e.target.value)}
            className="w-52"
          />
        </label>
        <Button size="sm" onClick={saveLockAt}>Save time</Button>
        <Button size="sm" variant="primary" onClick={startNow}>Start tournament now →</Button>
      </div>
    </div>
  )
}
