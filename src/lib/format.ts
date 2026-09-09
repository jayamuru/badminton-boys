import type { Match, Player } from '../types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const firstName = (p: Player) => p.name.split(' ')[0]

export const shortName = (p: Player) => {
  const [first, ...rest] = p.name.split(' ')
  return rest.length ? `${first} ${rest[rest.length - 1][0]}` : first
}

/** "Rahul & Karthik" / "Jayanth" */
export const teamName = (ids: string[], get: (id: string) => Player, long = false) =>
  ids.map((id) => (long ? get(id).name : firstName(get(id)))).join(' & ')

export const clock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase()

export function dayLabel(ts: number, now = Date.now()): string {
  const a = new Date(ts)
  const b = new Date(now)
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((startOf(a) - startOf(b)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return a.toLocaleDateString([], { weekday: 'long' })
  return a.toLocaleDateString([], { month: 'long', day: 'numeric' }).toUpperCase()
}

export function relative(ts: number, now = Date.now()): string {
  const d = now - ts
  if (d < MIN) return 'just now'
  if (d < HOUR) return `${Math.floor(d / MIN)}m ago`
  if (d < DAY) return `${Math.floor(d / HOUR)}h ago`
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d ago`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** "in 32 min" / "in 2h 10m" — used for the countdown on the next match. */
export function countdown(ts: number, now = Date.now()): string {
  const d = ts - now
  if (d <= 0) return 'starting now'
  const mins = Math.round(d / MIN)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`
  return `${Math.round(h / 24)}d`
}

export const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`
export const nf = (n: number) => n.toLocaleString('en-IN')
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

export function greeting(now = Date.now()): string {
  const h = new Date(now).getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export const matchTitle = (m: Match, get: (id: string) => Player) =>
  `${teamName(m.teamA, get)} vs ${teamName(m.teamB, get)}`

/**
 * A UUID, so the same id is valid as a Postgres primary key in cloud mode and
 * as a plain key in local mode. The prefix is kept only for readability in
 * logs when crypto.randomUUID isn't available.
 */
export const uid = (prefix: string) =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${prefix}${Math.random().toString(36).slice(2, 9)}`

/** Ordinal rank: 1st, 2nd, 3rd... */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/**
 * The top three used to be medal emoji. They're now the rank number in gold,
 * silver or bronze — same information, one less thing to render at 11px on a
 * device whose emoji font you don't control.
 */
export const rankTone = (rank: number): 'gold' | 'silver' | 'bronze' | null =>
  rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null

/**
 * The one-word category shown against a notification, derived from where the
 * notification takes you. It replaces the stored icon emoji — the destination
 * already knows what kind of thing this is, so there's nothing to persist.
 */
export function notificationTag(link?: string): string {
  if (!link) return 'News'
  if (link.startsWith('/live')) return 'Live'
  if (link.startsWith('/leaderboard')) return 'Ranks'
  if (link.startsWith('/tournament')) return 'Cup'
  if (link.startsWith('/match')) return 'Match'
  if (link.startsWith('/play')) return 'Challenge'
  if (link.startsWith('/player')) return 'Player'
  return 'News'
}

/**
 * Avatar lettering: one initial from the first name, one from the last.
 * Falls back to the first two characters for mononyms, and to '?' for a name
 * that is somehow empty — an avatar with nothing in it reads as a broken image.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
