/**
 * BWF rules engine.
 *
 * Everything here is a pure function of `Match.rallies` + `Match.format`.
 * Implemented rules:
 *  - Rally scoring to 21, must win by 2, hard cap at 30 (sudden death at 29-29).
 *  - Best of 1 / 3 / 5 games; first to ceil(bestOf / 2) games wins the match.
 *  - Winner of a game serves first in the next game.
 *  - Serving court: even score -> right court, odd score -> left court.
 *  - Doubles rotation: the serving pair swaps courts (and keeps the serve) after
 *    winning a rally; the receiving pair never swaps on gaining the serve — the
 *    player standing in the correct service court for their new score serves.
 *  - Interval at 11 points, and change of ends at 11 in the deciding game.
 */
import type { Court, Format, Match, Rally, Side } from '../types'

export const DEFAULT_FORMAT: Format = { bestOf: 3, pointsToWin: 21, winBy: 2, cap: 30 }

export interface GameScore {
  a: number
  b: number
  winner?: Side
}

export interface ServeState {
  /** Side holding serve. */
  side: Side
  /** Service court the server is standing in. */
  court: Court
  /** Index (0|1) into that team's player list. Doubles only; 0 for singles. */
  serverIndex: number
  /** Index (0|1) of the receiver on the other team. Doubles only. */
  receiverIndex: number
}

export interface MatchState {
  /** Completed games, in order. */
  completed: GameScore[]
  /** Live game (a/b), or the final game if the match is over. */
  current: GameScore
  /** 0-based index of the live game. */
  gameIndex: number
  gamesWon: { a: number; b: number }
  serve: ServeState
  /** Side that would win the current game with one more point, if any. */
  gamePoint: Side | null
  /** Side that would win the match with one more point, if any. */
  matchPoint: Side | null
  /** Set when the whole match is decided. */
  winner: Side | null
  finished: boolean
  /** True the moment a side first reaches 11 in the live game (60s interval). */
  atInterval: boolean
  /** Deciding game, someone just hit 11 -> players change ends. */
  changeEnds: boolean
  totalPoints: { a: number; b: number }
  rallyCount: number
}

const other = (s: Side): Side => (s === 'A' ? 'B' : 'A')

/** Is `me` vs `them` a completed game under this format? */
export function isGameOver(me: number, them: number, f: Format): boolean {
  if (me >= f.cap) return true
  return me >= f.pointsToWin && me - them >= f.winBy
}

/** Would one more point for `side` close out the current game? */
function wouldWinGame(me: number, them: number, f: Format): boolean {
  return isGameOver(me + 1, them, f)
}

const gamesNeeded = (f: Format) => Math.ceil(f.bestOf / 2)

/**
 * Doubles: which player of the serving pair is on the right court.
 * We track court occupancy per team as [rightPlayerIndex, leftPlayerIndex].
 */
type Positions = Record<Side, [number, number]>

const freshPositions = (): Positions => ({ A: [0, 1], B: [0, 1] })

function serveFrom(side: Side, score: number, pos: Positions, isDoubles: boolean): ServeState {
  const court: Court = score % 2 === 0 ? 'R' : 'L'
  if (!isDoubles) return { side, court, serverIndex: 0, receiverIndex: 0 }
  const serverIndex = court === 'R' ? pos[side][0] : pos[side][1]
  // Service is diagonal: a serve from the right court is received in the
  // receiver's own right court, so the receiver occupies the same-named court.
  const receiverIndex = court === 'R' ? pos[other(side)][0] : pos[other(side)][1]
  return { side, court, serverIndex, receiverIndex }
}

/**
 * Fold the rally list into a full scoreboard.
 * O(rallies) — cheap enough to recompute on every render.
 */
export function computeState(match: Pick<Match, 'rallies' | 'format' | 'firstServe' | 'type'>): MatchState {
  const f = match.format
  const isDoubles = match.type === 'Doubles'
  const need = gamesNeeded(f)

  const completed: GameScore[] = []
  let a = 0
  let b = 0
  let serving: Side = match.firstServe
  let pos = freshPositions()
  let wonA = 0
  let wonB = 0
  let totalA = 0
  let totalB = 0
  let finished = false
  let winner: Side | null = null
  let intervalTouched = false
  let changeEndsTouched = false

  for (const rally of match.rallies) {
    if (finished) break
    const scorer = rally.by
    if (scorer === serving) {
      // Serving side keeps the serve; the pair swaps service courts.
      if (isDoubles) pos = { ...pos, [scorer]: [pos[scorer][1], pos[scorer][0]] as [number, number] }
    } else {
      // Serve changes hands. No positional swap for the incoming servers.
      serving = scorer
    }
    if (scorer === 'A') {
      a += 1
      totalA += 1
    } else {
      b += 1
      totalB += 1
    }

    const me = scorer === 'A' ? a : b
    const them = scorer === 'A' ? b : a
    if (isGameOver(me, them, f)) {
      completed.push({ a, b, winner: scorer })
      if (scorer === 'A') wonA += 1
      else wonB += 1
      a = 0
      b = 0
      pos = freshPositions()
      serving = scorer // winner of the game serves first in the next
      intervalTouched = false
      changeEndsTouched = false
      if (wonA >= need || wonB >= need) {
        finished = true
        winner = wonA >= need ? 'A' : 'B'
      }
    }
  }

  const gameIndex = completed.length
  const isDecider = gameIndex === f.bestOf - 1 && f.bestOf > 1
  if (!finished) {
    if (a === 11 || b === 11) intervalTouched = true
    if (isDecider && (a === 11 || b === 11)) changeEndsTouched = true
  }

  const last = completed[completed.length - 1]
  const current: GameScore = finished && last ? last : { a, b }

  const serveScore = finished ? (serving === 'A' ? current.a : current.b) : serving === 'A' ? a : b
  const serve = serveFrom(serving, serveScore, pos, isDoubles)

  let gamePoint: Side | null = null
  let matchPoint: Side | null = null
  if (!finished) {
    if (wouldWinGame(a, b, f)) gamePoint = 'A'
    else if (wouldWinGame(b, a, f)) gamePoint = 'B'
    if (gamePoint) {
      const wouldHave = gamePoint === 'A' ? wonA + 1 : wonB + 1
      if (wouldHave >= need) matchPoint = gamePoint
    }
  }

  return {
    completed,
    current,
    gameIndex,
    gamesWon: { a: wonA, b: wonB },
    serve,
    gamePoint,
    matchPoint,
    winner,
    finished,
    atInterval: intervalTouched,
    changeEnds: changeEndsTouched,
    totalPoints: { a: totalA, b: totalB },
    rallyCount: match.rallies.length,
  }
}

/** Add a rally. Returns a new rally list; ignores input once the match is over. */
export function addPoint(match: Match, side: Side, at = Date.now()): Rally[] {
  if (computeState(match).finished) return match.rallies
  return [...match.rallies, { by: side, at }]
}

export function undoPoint(match: Match): Rally[] {
  return match.rallies.slice(0, -1)
}

/** Human-readable running timeline, newest first. */
export interface TimelineEntry {
  a: number
  b: number
  by: Side
  gameIndex: number
  tag?: 'GAME' | 'MATCH' | 'INTERVAL'
  at: number
}

export function timeline(match: Pick<Match, 'rallies' | 'format' | 'firstServe' | 'type'>): TimelineEntry[] {
  const f = match.format
  const need = gamesNeeded(f)
  const out: TimelineEntry[] = []
  let a = 0
  let b = 0
  let gi = 0
  let wonA = 0
  let wonB = 0
  for (const r of match.rallies) {
    if (r.by === 'A') a += 1
    else b += 1
    const me = r.by === 'A' ? a : b
    const them = r.by === 'A' ? b : a
    let tag: TimelineEntry['tag']
    if (isGameOver(me, them, f)) {
      if (r.by === 'A') wonA += 1
      else wonB += 1
      tag = wonA >= need || wonB >= need ? 'MATCH' : 'GAME'
    } else if (a === 11 || b === 11) {
      tag = 'INTERVAL'
    }
    out.push({ a, b, by: r.by, gameIndex: gi, tag, at: r.at })
    if (tag === 'GAME' || tag === 'MATCH') {
      a = 0
      b = 0
      gi += 1
    }
  }
  return out.reverse()
}

/** "21-18, 19-21, 21-16" */
export function scoreline(match: Pick<Match, 'rallies' | 'format' | 'firstServe' | 'type'>): string {
  const s = computeState(match)
  const games = s.finished ? s.completed : [...s.completed, s.current]
  return games.map((g) => `${g.a}-${g.b}`).join(', ')
}

export function gamesList(state: MatchState): GameScore[] {
  return state.finished ? state.completed : [...state.completed, state.current]
}
