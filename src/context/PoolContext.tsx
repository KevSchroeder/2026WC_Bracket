import React, {
  createContext, useCallback, useContext, useRef, useState,
} from 'react'
import type {
  PoolView, Picks, MemberIdentity, Screen, EditStep, RevealTab,
} from '../types'
import { emptyPicks } from '../types'
import * as API from '../lib/api'
import { Identity } from '../lib/identity'
import { prune, thirdAssignment, resolveRef } from '../lib/engine'
import { clone } from '../lib/utils'
import { GROUP_LETTERS, GROUPS, BRACKET } from '../lib/data'

// ---- toast ----------------------------------------------------------------
type ToastFn = (msg: string) => void
const ToastCtx = createContext<ToastFn>(() => {})
export const useToast = () => useContext(ToastCtx)

// ---- pool context ---------------------------------------------------------
interface PoolCtx {
  // session
  poolId: string | null
  me: MemberIdentity | null
  pool: PoolView | null
  screen: Screen
  // edit picks
  working: Picks
  setWorking: (p: Picks | ((prev: Picks) => Picks)) => void
  savingState: 'idle' | 'saving' | 'saved' | 'error'
  editStep: EditStep
  setEditStep: (s: EditStep) => void
  // official picks (admin)
  officialWorking: Picks
  setOfficialWorking: (p: Picks) => void
  officialStep: EditStep
  setOfficialStep: (s: EditStep) => void
  // revealed
  revealTab: RevealTab
  setRevealTab: (t: RevealTab) => void
  everyoneView: string | null
  setEveryoneView: (id: string | null) => void
  // actions
  goLanding: () => void
  loadPool: (id?: string, me?: MemberIdentity, opts?: { keepWorking?: boolean }) => Promise<void>
  doCreate: (poolName: string, displayName: string) => Promise<void>
  doJoin: (poolId: string, code: string, name: string) => Promise<void>
  showJoin: (poolId: string, inviteCode: string) => void
  doSubmit: () => Promise<void>
  doLeave: () => void
  schedulePickSave: (picks: Picks) => void
  scheduleOfficialSave: (official: Picks, finalGoals?: number) => void
  simulateOfficial: () => void
}

const Ctx = createContext<PoolCtx | null>(null)
export const usePool = (): PoolCtx => {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePool must be used inside PoolProvider')
  return c
}

function normPicks(p: Partial<Picks>): Picks {
  const out = clone(p) as Picks
  out.groups = out.groups ?? {}
  GROUP_LETTERS.forEach(L => { if (!Array.isArray(out.groups[L])) out.groups[L] = [] })
  out.thirds = Array.isArray(out.thirds) ? out.thirds : []
  out.results = out.results ?? {}
  if (typeof out.tiebreakerGoals !== 'number') out.tiebreakerGoals = null
  return out
}

export function PoolProvider({ children }: { children: React.ReactNode }) {
  const [poolId, setPoolId] = useState<string | null>(null)
  const [me, setMe] = useState<MemberIdentity | null>(null)
  const [pool, setPool] = useState<PoolView | null>(null)
  const [screen, setScreen] = useState<Screen>('landing')
  const [working, _setWorking] = useState<Picks>(emptyPicks())
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [editStep, setEditStep] = useState<EditStep>('groups')
  const [officialWorking, _setOfficialWorking] = useState<Picks>(emptyPicks())
  const [officialStep, setOfficialStep] = useState<EditStep>('groups')
  const [revealTab, setRevealTab] = useState<RevealTab>('mybracket')
  const [everyoneView, setEveryoneView] = useState<string | null>(null)

  // join screen state
  const [joinPoolId, setJoinPoolId] = useState<string>('')
  const [joinCode, setJoinCode] = useState<string>('')

  // toast
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast: ToastFn = useCallback((msg: string) => {
    setToastMsg(msg)
    setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2800)
  }, [])

  // timers
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const officialSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setWorking = useCallback((p: Picks | ((prev: Picks) => Picks)) => {
    _setWorking(p)
  }, [])

  const setOfficialWorking = useCallback((p: Picks) => {
    _setOfficialWorking(p)
  }, [])

  const clearTimers = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (officialSaveTimerRef.current) clearTimeout(officialSaveTimerRef.current)
  }, [])

  const goLanding = useCallback(() => {
    clearTimers()
    setPoolId(null); setMe(null); setPool(null)
    setScreen('landing'); setEditStep('groups'); setOfficialStep('groups')
    setRevealTab('mybracket'); setEveryoneView(null)
    _setWorking(emptyPicks()); _setOfficialWorking(emptyPicks())
    history.replaceState(null, '', location.pathname)
  }, [clearTimers])

  const dispatch = useCallback((p: PoolView, currentPoolId: string, currentMe: MemberIdentity, keepWorking = false) => {
    setPool(p)
    setRevealTab('mybracket'); setEveryoneView(null)
    if (!keepWorking) _setWorking(normPicks(p.you.picks))
    _setOfficialWorking(normPicks(p.official ?? {}))
    if (!p.revealed) {
      setScreen(p.you.submitted ? 'locked' : 'edit')
    } else {
      setScreen('revealed')
    }
    history.replaceState(null, '', `${location.pathname}?pool=${currentPoolId}`)
  }, [])

  const loadPool = useCallback(async (
    id?: string, identity?: MemberIdentity, opts: { keepWorking?: boolean } = {}
  ) => {
    const pid = id ?? poolId
    const mid = identity ?? me
    if (!pid || !mid) { goLanding(); return }
    setPoolId(pid); setMe(mid)
    try {
      const p = await API.getPool(pid, mid.token)
      if (mid.poolName !== p.poolName) {
        const updated = { ...mid, poolName: p.poolName }
        Identity.save(pid, updated)
        setMe(updated)
      }
      dispatch(p, pid, mid, opts.keepWorking)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (/Not a member|401/i.test(msg)) { Identity.forget(pid); goLanding(); return }
      toast(msg || 'Could not load pool')
    }
  }, [poolId, me, dispatch, goLanding, toast])

  const doCreate = useCallback(async (poolName: string, displayName: string) => {
    const r = await API.createPool({ poolName, displayName })
    const member: MemberIdentity = { ...r.member, poolName: poolName || 'World Cup Pool' }
    Identity.save(r.poolId, member)
    await loadPool(r.poolId, member)
    toast('Pool created — share your invite link!')
  }, [loadPool, toast])

  const showJoin = useCallback((pid: string, code: string) => {
    setJoinPoolId(pid); setJoinCode(code)
    setScreen('join')
  }, [])
  // expose join state for the JoinScreen
  ;(showJoin as unknown as { joinPoolId: string; joinCode: string }).joinPoolId = joinPoolId
  ;(showJoin as unknown as { joinPoolId: string; joinCode: string }).joinCode = joinCode

  const doJoin = useCallback(async (pid: string, code: string, name: string) => {
    const r = await API.joinPool(pid, { inviteCode: code, displayName: name })
    const member: MemberIdentity = { ...r.member, poolName: r.poolName }
    Identity.save(pid, member)
    await loadPool(pid, member)
    toast("You're in! Fill out your bracket.")
  }, [loadPool, toast])

  const doSubmit = useCallback(async () => {
    if (!poolId || !me) return
    await API.submitBracket(poolId, me.token, working)
    toast('Locked in! 🔒')
    await loadPool()
  }, [poolId, me, working, loadPool, toast])

  const doLeave = useCallback(() => {
    if (!poolId) return
    if (!window.confirm('Leave this pool on this device? You can rejoin with the invite link.')) return
    Identity.forget(poolId)
    goLanding()
  }, [poolId, goLanding])

  const schedulePickSave = useCallback((picks: Picks) => {
    if (!poolId || !me) return
    setSavingState('saving')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await API.savePicks(poolId, me.token, picks)
        setSavingState('saved')
      } catch (e) {
        setSavingState('error')
        const msg = e instanceof Error ? e.message : ''
        if (/locked|started|423/i.test(msg)) {
          toast('The tournament just started — picks are locked.')
          await loadPool(undefined, undefined, { keepWorking: true })
        } else {
          toast(msg)
        }
      }
    }, 700)
  }, [poolId, me, loadPool, toast])

  const scheduleOfficialSave = useCallback((official: Picks, finalGoals?: number) => {
    if (!poolId || !me) return
    if (officialSaveTimerRef.current) clearTimeout(officialSaveTimerRef.current)
    officialSaveTimerRef.current = setTimeout(async () => {
      try {
        const r = await API.setOfficial(poolId, me.token, official, finalGoals)
        const fresh = await API.getPool(poolId, me.token)
        setPool(prev => prev ? {
          ...prev, official: r.official,
          leaderboard: fresh.leaderboard, members: fresh.members,
          complete: fresh.complete, finale: fresh.finale,
        } : fresh)
      } catch (e) { toast(e instanceof Error ? e.message : 'Save failed') }
    }, 600)
  }, [poolId, me, toast])

  const simulateOfficial = useCallback(() => {
    if (!pool) return
    const sim: Picks = { groups: {}, thirds: [], results: {}, tiebreakerGoals: null }
    GROUP_LETTERS.forEach(L => { sim.groups[L] = GROUPS[L].slice(0, 3) })
    sim.thirds = GROUP_LETTERS.slice(0, 8).map(L => GROUPS[L][2])
    const assign = thirdAssignment(sim.thirds)
    const rounds = ['R32', 'R16', 'QF', 'SF', 'F']
    rounds.forEach(r =>
      BRACKET.filter((m: { round: string }) => m.round === r).forEach((m: { a: Parameters<typeof resolveRef>[0]; b: Parameters<typeof resolveRef>[0]; m: number }) => {
        const a = resolveRef(m.a, sim, assign)
        const b = resolveRef(m.b, sim, assign)
        sim.results[m.m] = a ?? b ?? ''
      })
    )
    prune(sim)
    _setOfficialWorking(sim)
    scheduleOfficialSave(sim, 3)
    toast('Filled a sample tournament — tweak any match, scores update live')
  }, [pool, scheduleOfficialSave, toast])

  const value: PoolCtx = {
    poolId, me, pool, screen,
    working, setWorking, savingState, editStep, setEditStep,
    officialWorking, setOfficialWorking, officialStep, setOfficialStep,
    revealTab, setRevealTab, everyoneView, setEveryoneView,
    goLanding, loadPool, doCreate, doJoin, showJoin, doSubmit, doLeave,
    schedulePickSave, scheduleOfficialSave, simulateOfficial,
  }

  // expose join screen state on context so App can read it
  ;(value as PoolCtx & { joinPoolId: string; joinCode: string }).joinPoolId = joinPoolId
  ;(value as PoolCtx & { joinPoolId: string; joinCode: string }).joinCode = joinCode

  return (
    <Ctx.Provider value={value}>
      <ToastCtx.Provider value={toast}>
        {children}
        {/* Toast */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-[13px]
            bg-card border border-line text-ink text-sm font-semibold shadow-card
            transition-all duration-300 pointer-events-none
            ${toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {toastMsg}
        </div>
      </ToastCtx.Provider>
    </Ctx.Provider>
  )
}
