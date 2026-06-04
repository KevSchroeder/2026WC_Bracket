import { useMemo, useState } from 'react'
import type { Picks, BracketSideId, RoundId } from '../../types'
import { BRACKET, ROUND_META, TEAMS } from '../../lib/data'
import { thirdAssignment, resolveRef, matchCorrectness } from '../../lib/engine'
import { cn } from '../../lib/utils'
import { Flag } from '../ui/Flag'
import '../../styles/bracket.css'

export type BracketMode = 'edit' | 'view' | 'official'

interface KnockoutBracketProps {
  picks: Picks
  mode: BracketMode
  official?: Picks
  onPickWinner?: (matchNum: number, teamId: string) => void
}

const SIDES: { key: BracketSideId; rounds: RoundId[] }[] = [
  { key: 'L', rounds: ['R32', 'R16', 'QF', 'SF'] },
  { key: 'F', rounds: ['F'] },
  { key: 'R', rounds: ['R32', 'R16', 'QF', 'SF'] },
]

export function KnockoutBracket({ picks, mode, official, onPickWinner }: KnockoutBracketProps) {
  const assign = useMemo(() => thirdAssignment(picks.thirds ?? []), [picks.thirds])
  const correctness = useMemo(
    () => mode === 'view' && official ? matchCorrectness(picks, official) : {} as Record<number, boolean>,
    [mode, picks, official],
  )
  const resolve = useMemo(
    () => (ref: Parameters<typeof resolveRef>[0]) => resolveRef(ref, picks, assign),
    [picks, assign],
  )

  return (
    <div className="bracket bg-[linear-gradient(180deg,#0c1230,#080c1d)] border border-line rounded-[20px] shadow-card p-5 overflow-hidden">
      <div className="overflow-x-auto overflow-y-hidden pb-3 scrollbar-thin" style={{ paddingTop: '26px' }}>
        <div className="flex items-stretch justify-center min-w-max gap-0">
          {SIDES.map(side =>
            side.key === 'F' ? (
              <FinalColumn key="F" picks={picks} mode={mode} resolve={resolve} correctness={correctness} onPickWinner={onPickWinner} />
            ) : (
              <div key={side.key} className={cn('flex items-stretch', side.key === 'L' ? 'bracket-side left flex-row' : 'bracket-side right flex-row-reverse')} style={{ gap: 'var(--gap)' }}>
                {side.rounds.map(round => (
                  <RoundColumn key={round} sideKey={side.key} round={round} picks={picks} mode={mode} resolve={resolve} correctness={correctness} onPickWinner={onPickWinner} />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function RoundColumn({ sideKey, round, picks, mode, resolve, correctness, onPickWinner }: {
  sideKey: BracketSideId; round: RoundId; picks: Picks; mode: BracketMode
  resolve: (ref: Parameters<typeof resolveRef>[0]) => string | null
  correctness: Record<number, boolean>
  onPickWinner?: (m: number, id: string) => void
}) {
  const matches = BRACKET.filter(m => m.side === sideKey && m.round === round)
  return (
    <div className="relative flex flex-col justify-around" style={{ minHeight: 'calc(var(--match-h) * 16)' }}>
      <div className="absolute -top-5 left-0 right-0 text-center text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted-2">
        {ROUND_META[round]?.name}
      </div>
      {matches.map(m => (
        <MatchWrap key={m.m} match={m} sideKey={sideKey} picks={picks} mode={mode} resolve={resolve} correctness={correctness} onPickWinner={onPickWinner} />
      ))}
    </div>
  )
}

function MatchWrap({ match, sideKey, picks, mode, resolve, correctness, onPickWinner }: {
  match: typeof BRACKET[number]; sideKey: BracketSideId; picks: Picks; mode: BracketMode
  resolve: (ref: Parameters<typeof resolveRef>[0]) => string | null
  correctness: Record<number, boolean>
  onPickWinner?: (m: number, id: string) => void
}) {
  const isCorrect = correctness[match.m]
  const needsConn = match.round !== 'R32' && match.round !== 'F'
  return (
    <div className={cn('match-wrap relative flex-1 flex items-center min-h-[var(--match-h)]', isCorrect && 'correct')}>
      {needsConn && <div className="conn" />}
      <MatchCard match={match} picks={picks} mode={mode} resolve={resolve} onPickWinner={onPickWinner} />
    </div>
  )
}

function MatchCard({ match, picks, mode, resolve, onPickWinner }: {
  match: typeof BRACKET[number]; picks: Picks; mode: BracketMode
  resolve: (ref: Parameters<typeof resolveRef>[0]) => string | null
  onPickWinner?: (m: number, id: string) => void
}) {
  const winner = picks.results[match.m] ?? null
  const interactive = mode === 'edit' || mode === 'official'
  return (
    <div
      className={cn(
        'match-card w-[208px] relative z-[2] rounded-[12px] overflow-hidden border shadow-[0_10px_26px_-18px_rgba(0,0,0,0.9)]',
        'bg-[linear-gradient(180deg,#141d40,#101733)]',
        winner ? 'border-accent-2/45' : 'border-line',
      )}
      data-m={match.m}
    >
      <div className="match-num absolute top-[3px] right-[5px] text-[8.5px] text-muted-2/50 font-bold">
        #{match.m}
      </div>
      {[match.a, match.b].map((ref, i) => {
        const teamId = resolve(ref)
        return (
          <TeamSlot
            key={i}
            teamId={teamId}
            refLabel={refLabel(ref)}
            winner={winner}
            interactive={interactive}
            onPick={teamId && interactive ? () => onPickWinner?.(match.m, teamId) : undefined}
          />
        )
      })}
    </div>
  )
}

function TeamSlot({ teamId, refLabel: label, winner, interactive, onPick }: {
  teamId: string | null; refLabel: string; winner: string | null
  interactive: boolean; onPick?: () => void
}) {
  const [justWon, setJustWon] = useState(false)
  const t = teamId ? TEAMS[teamId] : null
  const isWinner = !!winner && winner === teamId
  const isLoser = !!winner && winner !== teamId && !!teamId

  const handleClick = () => {
    if (!onPick || !teamId) return
    onPick()
    setJustWon(true)
    setTimeout(() => setJustWon(false), 600)
  }

  return (
    <div
      data-team={teamId ?? undefined}
      className={cn(
        'slot flex items-center gap-[9px] px-[11px] py-2 border-l-[3px] border-l-transparent transition-[background] duration-150',
        '[&+&]:border-t [&+&]:border-t-line-soft',
        isWinner && 'slot-winner bg-[linear-gradient(90deg,rgba(123,92,255,0.26),rgba(25,216,216,0.08))] !border-l-accent-2',
        isLoser && 'opacity-40',
        !teamId && 'cursor-default text-muted-2',
        interactive && teamId && 'cursor-pointer hover:bg-accent-2/15',
        justWon && 'animate-won-flash',
      )}
      onClick={handleClick}
    >
      {t ? (
        <>
          <Flag teamId={teamId!} size="sm" />
          <span className={cn('flex-1 text-[13px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis', isWinner && 'text-white')}>
            {t.name}
          </span>
          <span className="text-[10px] text-muted-2 font-bold">{teamId}</span>
        </>
      ) : (
        <>
          <span className="w-[22px] h-[15px] rounded bg-card text-[8px] text-muted-2 grid place-items-center">—</span>
          <span className="flex-1 text-[12px] font-normal italic text-muted-2 truncate">{label}</span>
        </>
      )}
    </div>
  )
}

function FinalColumn({ picks, mode, resolve, correctness, onPickWinner }: {
  picks: Picks; mode: BracketMode
  resolve: (ref: Parameters<typeof resolveRef>[0]) => string | null
  correctness: Record<number, boolean>
  onPickWinner?: (m: number, id: string) => void
}) {
  const finalMatch = BRACKET.find(m => m.round === 'F')!
  const champ = picks.results[104] ?? null
  const isCorrect = correctness[104]

  return (
    <div className="col-final flex flex-col justify-center items-center px-[calc(var(--gap)/2)]">
      <div className="font-sora font-extrabold text-[12px] tracking-[0.14em] uppercase bg-brand-grad bg-clip-text text-transparent mb-2">
        The Final
      </div>
      <div className="text-[30px] mb-1 drop-shadow-[0_4px_10px_rgba(255,206,74,0.5)]">🏆</div>
      <div className={cn('match-wrap relative flex items-center', isCorrect && 'correct')}>
        <div
          className={cn(
            'match-card w-[230px] relative z-[2] rounded-[12px] overflow-hidden border shadow-[0_20px_50px_-20px_rgba(255,206,74,0.5),0_0_0_1px_rgba(255,206,74,0.3)]',
            'bg-[linear-gradient(180deg,#141d40,#101733)] border-gold/55',
          )}
          data-m={104}
        >
          {[finalMatch.a, finalMatch.b].map((ref, i) => {
            const teamId = resolve(ref)
            return (
              <TeamSlot
                key={i}
                teamId={teamId}
                refLabel={refLabel(ref)}
                winner={champ}
                interactive={mode === 'edit' || mode === 'official'}
                onPick={teamId && (mode === 'edit' || mode === 'official') ? () => onPickWinner?.(104, teamId) : undefined}
              />
            )
          })}
        </div>
      </div>
      {champ && (
        <div className="mt-3 flex items-center gap-2 px-[13px] py-[7px] rounded-full bg-[linear-gradient(90deg,rgba(255,206,74,0.22),rgba(255,206,74,0.05))] border border-gold/55">
          <Flag teamId={champ} size="sm" />
          <b className="text-[#ffe39a] text-[13.5px] font-[750]">
            {TEAMS[champ]?.name}{mode === 'official' ? ' — Champions' : ''}
          </b>
        </div>
      )}
    </div>
  )
}

function refLabel(ref: typeof BRACKET[number]['a']): string {
  if (ref.t === 'W') return `Winner Group ${ref.g}`
  if (ref.t === 'R') return `Runner-up ${ref.g}`
  if (ref.t === 'T') return '3rd place'
  return `Winner Match ${ref.m}`
}
