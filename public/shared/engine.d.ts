import type { Picks, ScoreResult, PointsConfig, ScoreBreakdown } from '../../src/types'

export declare const POINTS: PointsConfig
export declare const TEAM_GROUP: Record<string, string>
export declare const BY_NUM: Record<number, {
  m: number; round: string; side: string
  a: { t: string; g?: string; slot?: number; m?: number }
  b: { t: string; g?: string; slot?: number; m?: number }
  next: number | null
}>
export declare function matchesOf(round: string): number[]
export declare function thirdAssignment(thirdIds: string[]): Record<number, string>
export declare function resolveRef(
  ref: { t: string; g?: string; slot?: number; m?: number },
  state: Picks,
  assign: Record<number, string>,
): string | null
export declare function prune(state: Picks): void
export declare function reachSets(state: Picks): {
  reachedR16: Set<string>; reachedQF: Set<string>; reachedSF: Set<string>
  reachedF: Set<string>; champ: string | null
}
export declare function scoreBracket(picks: Picks, official: Picks): ScoreResult
export declare function matchCorrectness(picks: Picks, official: Picks): Record<number, boolean>
export declare function isComplete(official: Picks): boolean
export declare function knockoutDecided(state: Picks): number
export declare function cheekyMessage(
  stat: { name: string; rank: number; total: number; max: number; championRight: boolean; accuracyPct: number },
  field: { members: number },
): string
