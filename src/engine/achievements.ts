import type { Match, Player } from '../types'
import { computeState, isGameOver } from './scoring'
import { sideOf, type PlayerStats } from './stats'

export interface Achievement {
  id: string
  emoji: string
  title: string
  detail: string
  /** 0..1 */
  progress: (ctx: Ctx) => number
}

interface Ctx {
  player: Player
  stats: PlayerStats
  matches: Match[]
}

/** Won a game after trailing by 5+ points at some point in that game. */
function hadComeback(playerId: string, matches: Match[]): boolean {
  for (const m of matches) {
    const side = sideOf(m, playerId)
    if (!side || m.status !== 'completed') continue
    let a = 0
    let b = 0
    let worst = 0
    for (const r of m.rallies) {
      if (r.by === 'A') a += 1
      else b += 1
      const mine = side === 'A' ? a : b
      const theirs = side === 'A' ? b : a
      worst = Math.max(worst, theirs - mine)
      const scorerScore = r.by === 'A' ? a : b
      const otherScore = r.by === 'A' ? b : a
      if (isGameOver(scorerScore, otherScore, m.format)) {
        if (r.by === side && worst >= 5) return true
        a = 0
        b = 0
        worst = 0
      }
    }
  }
  return false
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-match',
    emoji: '🏸',
    title: 'First Match',
    detail: 'Played your first match',
    progress: (c) => clamp01(c.stats.matches / 1),
  },
  {
    id: 'on-fire',
    emoji: '🔥',
    title: 'On Fire',
    detail: 'Won 5 in a row',
    progress: (c) => clamp01(c.stats.bestStreak / 5),
  },
  {
    id: 'comeback-king',
    emoji: '💪',
    title: 'Comeback King',
    detail: 'Won a game after trailing by 5+',
    progress: (c) => (hadComeback(c.player.id, c.matches) ? 1 : 0),
  },
  {
    id: 'rating-1000',
    emoji: '🎯',
    title: '1000 Rating Club',
    detail: 'Reached a 1,000 rating',
    progress: (c) => clamp01(c.player.rating / 1000),
  },
  {
    id: 'top-10',
    emoji: '👑',
    title: 'Top 10',
    detail: 'Broke into the top 10',
    progress: (c) => (c.player.rating >= 1150 ? 1 : clamp01(c.player.rating / 1150)),
  },
  {
    id: 'fifty-matches',
    emoji: '🏆',
    title: '50 Matches',
    detail: 'Played 50 matches',
    progress: (c) => clamp01(c.stats.matches / 50),
  },
  {
    id: 'century',
    emoji: '💯',
    title: 'Point Machine',
    detail: 'Scored 1,000 career points',
    progress: (c) => clamp01(c.stats.pointsWon / 1000),
  },
  {
    id: 'champion',
    emoji: '🏅',
    title: 'Champion',
    detail: 'Won a tournament match',
    progress: (c) =>
      c.matches.some(
        (m) => m.tournamentId && m.status === 'completed' && computeState(m).winner === sideOf(m, c.player.id),
      )
        ? 1
        : 0,
  },
]

export interface UnlockedAchievement extends Achievement {
  unlocked: boolean
  pct: number
}

export function achievementsFor(player: Player, stats: PlayerStats, matches: Match[]): UnlockedAchievement[] {
  const ctx = { player, stats, matches }
  return ACHIEVEMENTS.map((a) => {
    const pct = a.progress(ctx)
    return { ...a, pct, unlocked: pct >= 1 }
  })
}
