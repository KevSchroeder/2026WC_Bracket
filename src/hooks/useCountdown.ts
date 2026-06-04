import { useEffect, useState } from 'react'

export function useCountdown(lockAtISO: string) {
  const [display, setDisplay] = useState('')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(lockAtISO) - Date.now()
      if (ms <= 0) { setExpired(true); setDisplay('Kicking off…'); return }
      const d = Math.floor(ms / 864e5)
      const hh = Math.floor(ms % 864e5 / 36e5)
      const mm = Math.floor(ms % 36e5 / 6e4)
      const ss = Math.floor(ms % 6e4 / 1e3)
      setDisplay(`${d}d ${hh}h ${mm}m ${ss}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockAtISO])

  return { display, expired }
}
