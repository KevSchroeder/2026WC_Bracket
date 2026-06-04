import type { PoolView, Picks } from '../types'

async function req<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const opt: RequestInit = { method, headers: {} as Record<string, string> }
  if (body) {
    ;(opt.headers as Record<string, string>)['Content-Type'] = 'application/json'
    opt.body = JSON.stringify(body)
  }
  if (token) (opt.headers as Record<string, string>)['x-token'] = token
  const r = await fetch('/api' + path, opt)
  let data: unknown = null
  try { data = await r.json() } catch { /* empty */ }
  if (!r.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${r.status})`)
  return data as T
}

export interface CreatePoolResponse {
  poolId: string; inviteCode: string; lockAt: string
  member: { id: string; name: string; token: string; isAdmin: boolean }
}
export interface JoinPoolResponse {
  poolId: string; poolName: string; lockAt: string
  member: { id: string; name: string; token: string; isAdmin: boolean }
}

export const createPool = (b: { poolName: string; displayName: string }) =>
  req<CreatePoolResponse>('POST', '/pools', b)

export const joinPool = (id: string, b: { inviteCode: string; displayName: string }) =>
  req<JoinPoolResponse>('POST', `/pools/${id}/join`, b)

export const getPool = (id: string, token: string) =>
  req<PoolView>('GET', `/pools/${id}`, undefined, token)

export const savePicks = (id: string, token: string, picks: Picks) =>
  req<{ ok: boolean; picks: Picks }>('PUT', `/pools/${id}/picks`, { picks }, token)

export const submitBracket = (id: string, token: string, picks: Picks) =>
  req<{ ok: boolean }>('POST', `/pools/${id}/submit`, { picks }, token)

export const setOfficial = (id: string, token: string, official: Picks, finalGoals?: number) =>
  req<{ ok: boolean; official: Picks }>('POST', `/pools/${id}/official`, { official, finalGoals }, token)

export const setSettings = (id: string, token: string, body: { lockAt?: string }) =>
  req<{ ok: boolean; lockAt: string }>('POST', `/pools/${id}/settings`, body, token)
