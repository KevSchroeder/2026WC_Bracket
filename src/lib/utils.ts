import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o ?? {})) as T

export function avatarStyle(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 40) % 360} 70% 45%))`
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const l = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return l.toISOString().slice(0, 16)
}

export function medal(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)
}

export async function copyText(text: string, onToast: (msg: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    onToast('Invite link copied 📋')
  } catch {
    const result = window.prompt('Copy your invite link:', text)
    if (result !== null) onToast('Copied!')
  }
}
