import { useEffect, useRef, useState } from 'react'
import { usePool } from '../../context/PoolContext'
import { TEAMS } from '../../lib/data'
import { Flag } from '../ui/Flag'
import { Button } from '../ui/Button'
import { Avatar } from '../ui/Avatar'

export function FinaleOverlay() {
  const { pool, finale: _f, setRevealTab } = usePool() as ReturnType<typeof usePool> & { finale: unknown }
  const [shown, setShown] = useState(false)
  const [visible, setVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const finale = pool?.finale
  const prevComplete = useRef(false)

  useEffect(() => {
    if (!pool?.complete || !pool.finale) return
    if (!prevComplete.current) {
      prevComplete.current = true
      setVisible(true)
      setShown(true)
    }
  }, [pool?.complete, pool?.finale])

  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr
    const colors = ['#ff2e7e','#7b5cff','#19d8d8','#ffce4a','#ffffff']
    const P = Array.from({ length: 260 }, () => ({
      x: canvas.width / 2 + (Math.random() - .5) * canvas.width * .4,
      y: canvas.height * .32 + (Math.random() - .5) * 90,
      vx: (Math.random() - .5) * 18 * dpr, vy: (Math.random() * -17 - 4) * dpr,
      g: (.34 + Math.random() * .26) * dpr, s: (5 + Math.random() * 8) * dpr,
      rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
      c: colors[(Math.random() * colors.length) | 0], life: 1,
    }))
    const start = performance.now()
    const frame = (now: number) => {
      const el = now - start; ctx.clearRect(0, 0, canvas.width, canvas.height)
      P.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.rot += p.vr
        if (el > 2800) p.life -= .02
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y)
        ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6); ctx.restore()
      })
      if (el < 4600) rafRef.current = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafRef.current); ctx.clearRect(0, 0, canvas.width, canvas.height) }
  }, [visible])

  if (!visible || !finale) return null
  const w = finale.winner
  const champId = pool?.members.find(m => m.id === w.id)?.picks?.results?.[104]
  const myMsg = finale.messages.find(m => m.id === pool?.you.id)

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(20,28,64,0.85),rgba(4,7,16,0.94))] backdrop-blur-sm">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="relative text-center px-10 py-10 rounded-[24px] max-w-[90vw] bg-[linear-gradient(180deg,#161f48,#0d1330)] border border-gold/40 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] animate-champ-in">
        <p className="text-[12px] font-[750] tracking-[0.2em] uppercase bg-brand-grad bg-clip-text text-transparent mb-4">Pool Champion</p>
        <div className="flex justify-center mb-4">
          {champId ? (
            <Flag teamId={champId} size="xl" className="shadow-[0_14px_34px_-10px_rgba(0,0,0,0.8)]" />
          ) : (
            <Avatar name={w.name} size="xl" />
          )}
        </div>
        <h2 className="font-sora font-extrabold text-[40px] leading-none mb-1.5">{w.name}</h2>
        <p className="text-sm text-muted mb-5">
          {w.total} points · {w.accuracyPct}% of a perfect bracket
          {w.championRight ? ' · called the champion 🎯' : ''}
        </p>
        {myMsg && (
          <div className="mx-auto max-w-[440px] text-[14.5px] leading-relaxed text-ink bg-white/[0.04] border border-line rounded-[14px] px-[18px] py-[14px] mb-6">
            {myMsg.message}
          </div>
        )}
        <div className="flex gap-3 justify-center flex-wrap">
          <Button variant="primary" size="lg" onClick={() => { setVisible(false); setRevealTab('leaderboard') }}>
            See everyone's roast
          </Button>
          <Button size="lg" onClick={() => setVisible(false)}>Close</Button>
        </div>
      </div>
    </div>
  )
}
