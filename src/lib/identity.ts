import type { MemberIdentity } from '../types'

const key = (id: string) => `wc.pool.${id}`
const LAST_KEY = 'wc.lastPool'

export const Identity = {
  save(id: string, member: MemberIdentity) {
    try {
      localStorage.setItem(key(id), JSON.stringify(member))
      localStorage.setItem(LAST_KEY, id)
    } catch { /* storage full */ }
  },
  get(id: string): MemberIdentity | null {
    try { return JSON.parse(localStorage.getItem(key(id)) ?? 'null') } catch { return null }
  },
  last(): string | null {
    return localStorage.getItem(LAST_KEY)
  },
  forget(id: string) {
    localStorage.removeItem(key(id))
    if (this.last() === id) localStorage.removeItem(LAST_KEY)
  },
  list(): Array<{ id: string; member: MemberIdentity }> {
    const out: Array<{ id: string; member: MemberIdentity }> = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('wc.pool.')) {
        const id = k.slice(8)
        const m = Identity.get(id)
        if (m) out.push({ id, member: m })
      }
    }
    return out
  },
}
