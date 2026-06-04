// All shared TypeScript interfaces for the bracket pool app

export interface Team {
  name: string
  iso: string
}

export type RoundId = 'R32' | 'R16' | 'QF' | 'SF' | 'F'
export type BracketSideId = 'L' | 'R' | 'F'

export interface BracketRef {
  t: 'W' | 'R' | 'T' | 'M'
  g?: string    // group letter (W/R)
  slot?: number // third-place slot 1-8 (T)
  m?: number    // match number (M)
}

export interface BracketMatch {
  m: number
  round: RoundId
  side: BracketSideId
  a: BracketRef
  b: BracketRef
  next: number | null
}

export interface ThirdSlot {
  slot: number
  m: number
  group: string
}

export interface RoundMeta {
  name: string
  short: string
}

export interface Picks {
  groups: Record<string, string[]>   // group letter -> [1st, 2nd, 3rd]
  thirds: string[]                    // up to 8 team IDs
  results: Record<number, string>     // matchNum -> winning team ID
  tiebreakerGoals: number | null
  finalGoals?: number                 // official only
}

export interface ScoreBreakdown {
  group: number
  thirds: number
  R32: number
  R16: number
  QF: number
  SF: number
  F: number
  champ: number
}

export interface ScoreResult {
  total: number
  breakdown: ScoreBreakdown
  championRight: boolean
}

export interface PointsConfig {
  groupAdvancer: number
  bestThird: number
  knockout: Record<RoundId, number>
  championBonus: number
  max: number
}

export interface MemberIdentity {
  id: string
  name: string
  token: string
  isAdmin: boolean
  poolName: string
}

export interface Member {
  id: string
  name: string
  submitted: boolean
  isAdmin: boolean
  picks?: Picks
  total?: number
  breakdown?: ScoreBreakdown
  rank?: number
  championRight?: boolean
  accuracyPct?: number
  tiebreakerGoals?: number | null
}

export interface LeaderboardRow {
  id: string
  name: string
  picks?: Picks
  total: number
  breakdown: ScoreBreakdown
  championRight: boolean
  accuracyPct: number
  tiebreakerGoals: number | null
  tbDiff: number | null
  submitted: boolean
  submittedAt: string | null
  rank: number
}

export interface RoastMessage {
  id: string
  name: string
  rank: number
  total: number
  championRight: boolean
  message: string
}

export interface InviteInfo {
  code: string
  path: string
}

export interface PoolView {
  poolId: string
  poolName: string
  lockAt: string
  now: string
  revealed: boolean
  complete: boolean
  maxScore: number
  points: PointsConfig
  isAdmin: boolean
  invite: InviteInfo | null
  you: {
    id: string
    name: string
    submitted: boolean
    isAdmin: boolean
    picks: Picks
  }
  members: Member[]
  leaderboard: LeaderboardRow[] | null
  official: Picks | null
  finale: {
    winner: LeaderboardRow
    finalGoals: number | null
    messages: RoastMessage[]
  } | null
}

export type Screen = 'landing' | 'join' | 'edit' | 'locked' | 'revealed'
export type EditStep = 'groups' | 'thirds' | 'knockout'
export type RevealTab = 'mybracket' | 'leaderboard' | 'everyone' | 'official'

export const emptyPicks = (): Picks => ({
  groups: {},
  thirds: [],
  results: {},
  tiebreakerGoals: null,
})
