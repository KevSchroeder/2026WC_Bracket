import { useEffect } from 'react'
import { usePool } from './context/PoolContext'
import { Identity } from './lib/identity'
import { TopBar } from './components/layout/TopBar'
import { ProgressRail } from './components/layout/ProgressRail'
import { LandingScreen } from './components/landing/LandingScreen'
import { JoinScreen } from './components/landing/JoinScreen'
import { EditScreen } from './components/edit/EditScreen'
import { LockedScreen } from './components/locked/LockedScreen'
import { RevealedScreen } from './components/revealed/RevealedScreen'
import { FinaleOverlay } from './components/finale/FinaleOverlay'

function Router() {
  const { screen, loadPool, showJoin } = usePool()
  const ctx = usePool() as ReturnType<typeof usePool> & { joinPoolId: string; joinCode: string }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pidParam = params.get('pool')
    const codeParam = params.get('code')

    if (pidParam) {
      const id = Identity.get(pidParam)
      if (id) { loadPool(pidParam, id); return }
      showJoin(pidParam, codeParam ?? '')
      return
    }
    const last = Identity.last()
    if (last) {
      const id = Identity.get(last)
      if (id) { loadPool(last, id); return }
    }
    // stays on landing (default)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="relative z-[1] max-w-[1500px] mx-auto px-[clamp(14px,3vw,34px)] pb-16 pt-6">
      {screen === 'landing' && <LandingScreen />}
      {screen === 'join' && <JoinScreen poolId={ctx.joinPoolId} inviteCode={ctx.joinCode} />}
      {screen === 'edit' && <EditScreen />}
      {screen === 'locked' && <LockedScreen />}
      {screen === 'revealed' && <RevealedScreen />}
    </main>
  )
}

export default function App() {
  return (
    <>
      {/* ambient orbs */}
      <div className="fixed inset-0 overflow-hidden z-0 pointer-events-none" style={{ filter: 'blur(40px)' }} aria-hidden>
        <span className="orb opacity-50 w-[420px] h-[420px] bg-accent -top-[120px] -left-[80px]" style={{ animationDelay: '0s' }} />
        <span className="orb opacity-50 w-[520px] h-[520px] bg-accent-2 -bottom-[200px] -right-[120px]" style={{ animationDelay: '-6s' }} />
        <span className="orb opacity-50 w-[360px] h-[360px] bg-accent-3 top-[38%] left-[55%]" style={{ animationDelay: '-11s' }} />
      </div>
      <TopBar />
      <ProgressRail />
      <Router />
      <FinaleOverlay />
      <footer className="relative z-[1] max-w-[1000px] mx-auto px-6 pt-5 pb-12 text-center">
        <p className="text-[11.5px] text-muted-2 leading-relaxed">
          Format &amp; draw verified to the official 2026 FIFA World Cup (48 teams · 12 groups · Round of 32).
          Scoring adapted from ESPN Tournament Challenge. Friendly prediction pool — not affiliated with FIFA.
          Flags via flagcdn.
        </p>
      </footer>
    </>
  )
}
