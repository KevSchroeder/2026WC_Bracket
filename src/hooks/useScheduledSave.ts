import { useCallback, useRef, useState } from 'react'
import type { Picks } from '../types'
import * as API from '../lib/api'

export type SavingState = 'idle' | 'saving' | 'saved' | 'error'

export function useScheduledSave(
  poolId: string | null,
  token: string | null,
  onLocked: () => void,
  delayMs = 700,
) {
  const [savingState, setSavingState] = useState<SavingState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSave = useCallback((picks: Picks) => {
    if (!poolId || !token) return
    setSavingState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        await API.savePicks(poolId, token, picks)
        setSavingState('saved')
      } catch (e) {
        setSavingState('error')
        const msg = e instanceof Error ? e.message : ''
        if (/locked|started|423/i.test(msg)) onLocked()
      }
    }, delayMs)
  }, [poolId, token, onLocked, delayMs])

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return { savingState, scheduleSave, cancel }
}
