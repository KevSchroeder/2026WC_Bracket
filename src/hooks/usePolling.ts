import { useEffect, useRef } from 'react'

export function usePolling(enabled: boolean, intervalMs: number, onTick: () => void) {
  const cbRef = useRef(onTick)
  cbRef.current = onTick

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => cbRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
