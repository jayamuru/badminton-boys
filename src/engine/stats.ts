/**
 * Derived player + partnership statistics. Everything is computed from the
 * completed match list so there is exactly one source of truth.
 */
import type { Match, Player, Side } from '../types'
import { computeState } from './scoring'

export interface PlayerStats {
  playerId: string
  matches: number
  wins: number
  losses: number
  winRate: number
  gamesWon: number
  gamesLost: number
  pointsWon: number
  pointsLost: number
  pointDiff: number
  /** Points won / points played — the "point difference ratio". */
  pointRatio: number
  streak: number // positive = winning streak, negative = losing streak
  bestStreak: number
  /** Most recent first: true = win. */
  form: boolean[]
}

export const emptyStats = (playerId: string): PlayerStats => ({
  playerId,
  matches: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  gamesWon: 0,
  gamesLost: 0,
  pointsWon: 0,
  pointsLost: 0,
  pointDiff: 0,
  pointRatio: 0,
  streak: 0,
  bestStreak: 0,
  form: [],
})

export const sideOf = (m: Match, playerId: string): Side | null =>
  m.teamA.includes(playerId) ? 'A' : m.teamB.includes(playerId) ? 'B' : null

export const completedMatches = (matches: Match[]) =>
  matches.filter((m) => m.status === 'completed').sort((x, y) => (y.completedAt ?? 0) - (x.completedAt ?? 0))

export function statsFor(playerId: string, matches: Match[]): PlayerStats {
  const s = emptyStats(playerId)
  const mine = completedMatches(matches).filter((m) => sideOf(m, playerId))
  // Oldest -> newest for streak bookkeeping.
  const chrono = [...mine].reverse()
  let run = 0
  for (const m of chrono) {
    const side = sideOf(m, playerId)!
    const st = computeState(m)
    if (!st.winner) continue
    const won = st.winner === side
    s.matches += 1
    if (won) {
      s.wins += 1
      run = run > 0 ? run + 1 : 1
    } else {
      s.losses += 1
      run = run < 0 ? run - 1 : -1
    }
    s.bestStreak = Math.max(s.bestStreak, run)
    s.streak = run
    for (const g of st.completed) {
      const mineG = side === 'A' ? g.a : g.b
      const theirsG = side === 'A' ? g.b : g.a
      if (g.winner === side) s.gamesWon += 1
      else s.gamesLost += 1
      s.pointsWon += mineG
      s.pointsLost += theirsG
    }
  }
  s.winRate = s.matches ? s.wins / s.matches : 0
  s.pointDiff = s.pointsWon - s.pointsLost
  const played = s.pointsWon + s.pointsLost
  s.pointRatio = played ? s.pointsWon / played : 0
  s.form = mine
    .slice(0, 10)
    .map((m) => computeState(m).winner === sideOf(m, playerId))
  return s
}

export function allStats(players: Player[], matches: Match[]): Record<string, PlayerStats> {
  const out: Record<string, PlayerStats> = {}
  for (const p of players) out[p.id] = statsFor(p.id, matches)
  return out
}

export interface HeadToHead {
  matches: Match[]
  aWins: number
  bWins: number
  aGames: number
  bGames: number
  aPoints: number
  bPoints: number
  lastMeeting?: Match
}

/** Historical record between two players (counts any match they were on opposite sides of). */
export function headToHead(aId: string, bId: string, matches: Match[]): HeadToHead {
  const rel = completedMatches(matches).filter((m) => {
    const sa = sideOf(m, aId)
    const sb = sideOf(m, bId)
    return sa && sb && sa !== sb
  })
  const h: HeadToHead = { matches: rel, aWins: 0, bWins: 0, aGames: 0, bGames: 0, aPoints: 0, bPoints: 0 }
  for (const m of rel) {
    const sa = sideOf(m, aId)!
    const st = computeState(m)
    if (st.winner === sa) h.aWins += 1
    else h.bWins += 1
    for (const g of st.completed) {
      const ap = sa === 'A' ? g.a : g.b
      const bp = sa === 'A' ? g.b : g.a
      h.aPoints += ap
      h.bPoints += bp
      if (g.winner === sa) h.aGames += 1
      else h.bGames += 1
    }
  }
  h.lastMeeting = rel[0]
  return h
}

export interface Partnership {
  partnerId: string
  matches: number
  wins: number
  losses: number
  winRate: number
}

export function partnerships(playerId: string, matches: Match[]): Partnership[] {
  const map = new Map<string, Partnership>()
  for (const m of completedMatches(matches)) {
    if (m.type !== 'Doubles') continue
    const side = sideOf(m, playerId)
    if (!side) continue
    const team = side === 'A' ? m.teamA : m.teamB
    const partnerId = team.find((id) => id !== playerId)
    if (!partnerId) continue
    const p = map.get(partnerId) ?? { partnerId, matches: 0, wins: 0, losses: 0, winRate: 0 }
    p.matches += 1
    if (computeState(m).winner === side) p.wins += 1
    else p.losses += 1
    p.winRate = p.wins / p.matches
    map.set(partnerId, p)
  }
  return [...map.values()].sort((a, b) => b.matches - a.matches)
}

export type LeaderboardKey = 'rating' | 'wins' | 'winRate' | 'pointRatio' | 'streak' | 'matches'

export interface LeaderRow {
  player: Player
  stats: PlayerStats
  rank: number
}

const MIN_MATCHES_FOR_RATE = 20

export function leaderboard(
  players: Player[],
  stats: Record<string, PlayerStats>,
  key: LeaderboardKey,
): LeaderRow[] {
  let pool = players
  if (key === 'winRate' || key === 'pointRatio') {
    const qualified = players.filter((p) => (stats[p.id]?.matches ?? 0) >= MIN_MATCHES_FOR_RATE)
    // Don't show an empty board on a fresh install — fall back to everyone who has played.
    pool = qualified.length ? qualified : players.filter((p) => (stats[p.id]?.matches ?? 0) > 0)
  }
  const value = (p: Player) => {
    const s = stats[p.id] ?? emptyStats(p.id)
    switch (key) {
      case 'rating':
        return p.rating
      case 'wins':
        return s.wins
      case 'winRate':
        return s.winRate
      case 'pointRatio':
        return s.pointRatio
      case 'streak':
        return Math.max(s.bestStreak, 0)
      case 'matches':
        return s.matches
    }
  }
  return [...pool]
    .sort((a, b) => value(b) - value(a) || b.rating - a.rating)
    .map((player, i) => ({ player, stats: stats[player.id] ?? emptyStats(player.id), rank: i + 1 }))
}

export const MIN_RATE_MATCHES = MIN_MATCHES_FOR_RATE
