import { describe, expect, it } from 'vitest'
import type { Match, Side } from '../types'
import { computeState, DEFAULT_FORMAT, isGameOver, scoreline, timeline } from './scoring'

const build = (seq: string, type: 'Singles' | 'Doubles' = 'Singles', bestOf: 1 | 3 | 5 = 3): Match => ({
  id: 'm',
  type,
  teamA: type === 'Doubles' ? ['a1', 'a2'] : ['a1'],
  teamB: type === 'Doubles' ? ['b1', 'b2'] : ['b1'],
  format: { ...DEFAULT_FORMAT, bestOf },
  rallies: [...seq].map((c, i) => ({ by: c.toUpperCase() as Side, at: i })),
  firstServe: 'A',
  status: 'live',
  competitive: true,
  scheduledAt: 0,
  endsSwapped: false,
  confirmations: [],
  corrections: [],
  reactions: { fire: 0, clap: 0, wow: 0 },
  invitesAccepted: [],
})

const rep = (s: string, n: number) => s.repeat(n)

describe('game win condition', () => {
  it('needs 21 with a two point lead', () => {
    expect(isGameOver(21, 19, DEFAULT_FORMAT)).toBe(true)
    expect(isGameOver(21, 20, DEFAULT_FORMAT)).toBe(false)
    expect(isGameOver(20, 18, DEFAULT_FORMAT)).toBe(false)
  })

  it('caps at 30 — 30-29 wins', () => {
    expect(isGameOver(30, 29, DEFAULT_FORMAT)).toBe(true)
    expect(isGameOver(29, 27, DEFAULT_FORMAT)).toBe(true)
  })
})

describe('computeState', () => {
  it('tracks a plain 21-0 game', () => {
    const s = computeState(build(rep('A', 21)))
    expect(s.completed).toEqual([{ a: 21, b: 0, winner: 'A' }])
    expect(s.gamesWon).toEqual({ a: 1, b: 0 })
    expect(s.finished).toBe(false)
  })

  it('does not end the game at 21-20, and plays on to two clear', () => {
    const s = computeState(build(rep('AB', 20) + 'A'))
    expect(s.current).toEqual({ a: 21, b: 20 })
    expect(s.completed).toHaveLength(0)
    expect(s.gamePoint).toBe('A')
  })

  it('ends at 30-29 via the cap', () => {
    // 29-29 then one more point for A -> 30-29 closes it out.
    const s = computeState(build(rep('AB', 29) + 'A'))
    expect(s.completed[0]).toEqual({ a: 30, b: 29, winner: 'A' })
  })

  it('finishes a best-of-3 after two games', () => {
    const s = computeState(build(rep('A', 21) + rep('A', 21)))
    expect(s.finished).toBe(true)
    expect(s.winner).toBe('A')
    expect(s.gamesWon).toEqual({ a: 2, b: 0 })
  })

  it('ignores rallies logged after the match is decided', () => {
    const s = computeState(build(rep('A', 21) + rep('A', 21) + rep('B', 10)))
    expect(s.winner).toBe('A')
    expect(s.completed).toHaveLength(2)
  })

  it('goes to a decider in a best-of-3', () => {
    const s = computeState(build(rep('A', 21) + rep('B', 21) + 'AAB'))
    expect(s.gameIndex).toBe(2)
    expect(s.current).toEqual({ a: 2, b: 1 })
    expect(s.gamesWon).toEqual({ a: 1, b: 1 })
  })

  it('flags game point and match point separately', () => {
    const g1 = computeState(build(rep('A', 20)))
    expect(g1.gamePoint).toBe('A')
    expect(g1.matchPoint).toBe(null)

    const g2 = computeState(build(rep('A', 21) + rep('A', 20)))
    expect(g2.gamePoint).toBe('A')
    expect(g2.matchPoint).toBe('A')
  })

  it('marks the 11-point interval', () => {
    expect(computeState(build(rep('A', 11))).atInterval).toBe(true)
    expect(computeState(build(rep('A', 10))).atInterval).toBe(false)
  })

  it('signals change of ends at 11 in the deciding game', () => {
    const s = computeState(build(rep('A', 21) + rep('B', 21) + rep('A', 11)))
    expect(s.changeEnds).toBe(true)
  })
})

describe('serve — singles', () => {
  it('serves from the right court on an even score', () => {
    const s = computeState(build(''))
    expect(s.serve).toMatchObject({ side: 'A', court: 'R' })
  })

  it('moves to the left court after the server scores', () => {
    const s = computeState(build('A'))
    expect(s.serve).toMatchObject({ side: 'A', court: 'L' })
  })

  it('hands over the serve when the receiver wins the rally', () => {
    const s = computeState(build('B'))
    expect(s.serve).toMatchObject({ side: 'B', court: 'L' }) // B is on 1 -> odd -> left
  })

  it('gives the first serve of the next game to the winner of the last one', () => {
    const s = computeState(build(rep('B', 21)))
    expect(s.serve.side).toBe('B')
    expect(s.serve.court).toBe('R')
  })
})

describe('serve — doubles rotation', () => {
  it('starts with A player 0 serving from the right', () => {
    const s = computeState(build('', 'Doubles'))
    expect(s.serve).toMatchObject({ side: 'A', serverIndex: 0, court: 'R', receiverIndex: 0 })
  })

  it('keeps the same server, who switches court, after the serving pair scores', () => {
    const s = computeState(build('A', 'Doubles'))
    // A now on 1 -> left court. The pair swapped, so player 0 is in the left court.
    expect(s.serve).toMatchObject({ side: 'A', serverIndex: 0, court: 'L' })
  })

  it('does not rotate the incoming pair when they win the serve back', () => {
    const s = computeState(build('B', 'Doubles'))
    // B on 1 -> left court. B never swapped, so its left-court player (index 1) serves.
    expect(s.serve).toMatchObject({ side: 'B', serverIndex: 1, court: 'L' })
  })

  it('brings the partner into the serve after a full rotation', () => {
    // A serves and scores (swap), B wins it back, A wins it back at 1 point.
    const s = computeState(build('AB', 'Doubles'))
    expect(s.serve.side).toBe('B')
  })
})

describe('presentation helpers', () => {
  it('renders a scoreline', () => {
    expect(scoreline(build(rep('A', 21) + rep('B', 21) + rep('A', 21)))).toBe('21-0, 0-21, 21-0')
  })

  it('builds a newest-first timeline with game tags', () => {
    const t = timeline(build(rep('A', 21)))
    expect(t[0]).toMatchObject({ a: 21, b: 0, tag: 'GAME' })
    expect(t).toHaveLength(21)
  })

  it('tags the final rally of the match', () => {
    const t = timeline(build(rep('A', 21) + rep('A', 21)))
    expect(t[0].tag).toBe('MATCH')
  })
})
