// Side-effect CSS imports (Vite bundles them; TS just needs to know they exist)
declare module '*.css' {}

// Ambient declarations for the UMD JS shared modules.
// The Node server require()s these directly; we never touch those files.
// Vite resolves the CJS module.exports path and the types here give React full type safety.

import type {
  Team, BracketMatch, ThirdSlot, RoundMeta, RoundId, Picks, ScoreResult, PointsConfig,
} from '../types'

declare module '*/shared/data.js' {
  const TEAMS: Record<string, Team>
  const GROUPS: Record<string, string[]>
  const GROUP_LETTERS: string[]
  const HOSTS: string[]
  const BRACKET: BracketMatch[]
  const THIRD_SLOTS: ThirdSlot[]
  const ROUND_META: Record<RoundId, RoundMeta>
  export { TEAMS, GROUPS, GROUP_LETTERS, HOSTS, BRACKET, THIRD_SLOTS, ROUND_META }
}

declare module '*/shared/engine.js' {
  import type { BracketRef } from '../types'
  export const POINTS: PointsConfig
  export const TEAM_GROUP: Record<string, string>
  export const BY_NUM: Record<number, BracketMatch>
  export function matchesOf(round: string): number[]
  export function thirdAssignment(thirdsIds: string[]): Record<number, string>
  export function resolveRef(ref: BracketRef, state: Picks, assign: Record<number, string>): string | null
  export function prune(state: Picks): Picks
  export function reachSets(state: Picks): {
    reachedR16: Set<string>; reachedQF: Set<string>; reachedSF: Set<string>
    reachedF: Set<string>; champ: string | null
  }
  export function scoreBracket(picks: Picks, official: Picks): ScoreResult
  export function matchCorrectness(picks: Picks, official: Picks): Record<number, boolean>
  export function isComplete(official: Picks): boolean
  export function knockoutDecided(state: Picks): number
  export function cheekyMessage(stat: { name: string; rank: number; total: number; max: number; championRight: boolean; accuracyPct: number }, field: { members: number }): string
}
