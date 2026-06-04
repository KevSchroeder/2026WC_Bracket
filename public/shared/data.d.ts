export declare const TEAMS: Record<string, { name: string; iso: string }>
export declare const GROUPS: Record<string, string[]>
export declare const GROUP_LETTERS: string[]
export declare const HOSTS: string[]
export declare const BRACKET: Array<{
  m: number
  round: string
  side: string
  a: { t: string; g?: string; slot?: number; m?: number }
  b: { t: string; g?: string; slot?: number; m?: number }
  next: number | null
}>
export declare const THIRD_SLOTS: Array<{ slot: number; m: number; group: string }>
export declare const ROUND_META: Record<string, { name: string; short: string }>
