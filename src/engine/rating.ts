/**
 * ELO-style rating. Doubles uses the team mean as the effective rating so a
 * strong player carrying a beginner still gains little for an expected win.
 */
import type { Match, Player, Side } from '../types'
import { computeState } from './scoring'

const BASE_K = 32

function kFor(rating: number, matchesPlayed: number): number {
  if (matchesPlayed < 10) return BASE_K * 1.6 // placement games move fast
  if (rating > 1300) return BASE_K * 0.75 // top of the ladder is stickier
  return BASE_K
}

const expected = (mine: number, theirs: number) => 1 / (1 + 10 ** ((theirs - mine) / 400))

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)

export interface RatingChange {
  playerId: string
  delta: number
}

/**
 * Rating movement for a completed match. Casual matches return no movement.
 * A dominant scoreline is worth slightly more than a three-game squeaker.
 */
export function ratingChanges(
  match: Match,
  players: Record<string, Player>,
  matchesPlayed: Record<string, number> = {},
): RatingChange[] {
  const state = computeState(match)
  if (!state.finished || !state.winner || !match.competitive) return []

  const ratingOf = (ids: string[]) => mean(ids.map((id) => players[id]?.rating ?? 1000))
  const ra = ratingOf(match.teamA)
  const rb = ratingOf(match.teamB)

  const totals = state.totalPoints
  const spread = Math.abs(totals.a - totals.b) / Math.max(1, totals.a + totals.b)
  const margin = 0.85 + spread * 0.9 // ~0.85 (nail-biter) .. ~1.3 (whitewash)

  const out: RatingChange[] = []
  const apply = (ids: string[], side: Side, mineR: number, theirsR: number) => {
    const score = state.winner === side ? 1 : 0
    const exp = expected(mineR, theirsR)
    for (const id of ids) {
      const k = kFor(players[id]?.rating ?? 1000, matchesPlayed[id] ?? 0)
      const delta = Math.round(k * (score - exp) * margin)
      out.push({ playerId: id, delta })
    }
  }
  apply(match.teamA, 'A', ra, rb)
  apply(match.teamB, 'B', rb, ra)
  return out
}

export interface Tier {
  name: string
  min: number
  color: string
  emoji: string
}

/** Visible ladder tiers — the thing people screenshot. */
export const TIERS: Tier[] = [
  { name: 'Shuttle Rookie', min: 0, color: '#8A94A6', emoji: '🏸' },
  { name: 'Rally Regular', min: 950, color: '#5AC8FA', emoji: '🎯' },
  { name: 'Smash Contender', min: 1100, color: '#C8FF2E', emoji: '⚡' },
  { name: 'Court Elite', min: 1250, color: '#FFC83D', emoji: '👑' },
  { name: 'Legend', min: 1400, color: '#FF6B9D', emoji: '🔥' },
]

export function tierFor(rating: number): Tier {
  let t = TIERS[0]
  for (const tier of TIERS) if (rating >= tier.min) t = tier
  return t
}

export function nextTier(rating: number): Tier | null {
  return TIERS.find((t) => t.min > rating) ?? null
}
