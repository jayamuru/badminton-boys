/**
 * Deterministic demo season.
 *
 * Rather than hand-writing fake stats (which never add up), we simulate a real
 * season rally by rally: every match below is played out through the same BWF
 * engine the live scoring screen uses, and ratings move through the same ELO
 * function. So the leaderboard, form guides, head-to-heads and point-difference
 * ratios are all genuinely derived from match data.
 */
import type { AppNotification, Challenge, Club, Match, Player, Tournament } from '../types'
import { DEFAULT_FORMAT, computeState, isGameOver } from '../engine/scoring'
import type { Format, Rally, Side } from '../types'

/** mulberry32 — small, fast, deterministic. */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher–Yates, drawing from `rand`.
 *
 * Deliberately not `sort(() => rand() - 0.5)`. That idiom is biased, but the
 * bigger problem here is that the spec leaves the *number* of comparator calls
 * up to the engine — so a different V8 version consumes a different number of
 * values from the generator and every subsequent draw diverges. The whole seed
 * downstream of the first shuffle would then differ between your laptop and CI,
 * which is exactly the kind of bug that only ever reproduces somewhere else.
 */
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const TINTS = [
  '#C8FF2E',
  '#5AC8FA',
  '#FF6B9D',
  '#FFC83D',
  '#8B7CFF',
  '#2BE08A',
  '#FF8A3D',
  '#4DD8C0',
  '#FF5A5F',
  '#9BE15D',
]

interface Sketch {
  name: string
  handle: string
  emoji: string
  skill: number
  level: Player['level']
  city: string
  club: number
  bio?: string
}

const SKETCHES: Sketch[] = [
  { name: 'Jayanth T', handle: 'jayanth', emoji: '🦅', skill: 0.6, level: 'Intermediate', city: 'Bengaluru', club: 0, bio: 'Backhand still a work in progress. Cross-court drop is not.' },
  { name: 'Rahul Menon', handle: 'rahulm', emoji: '🐅', skill: 0.82, level: 'Competitive', city: 'Bengaluru', club: 0, bio: 'Left-handed. Plays every single evening.' },
  { name: 'Karthik R', handle: 'karthik', emoji: '🐺', skill: 0.78, level: 'Competitive', city: 'Bengaluru', club: 0 },
  { name: 'Arjun Nair', handle: 'arjun', emoji: '⚡', skill: 0.75, level: 'Advanced', city: 'Bengaluru', club: 0, bio: 'Doubles specialist. Front court is home.' },
  { name: 'Vijay Kumar', handle: 'vijay', emoji: '🦊', skill: 0.64, level: 'Advanced', city: 'Bengaluru', club: 0 },
  { name: 'Arun Prasad', handle: 'arunp', emoji: '🐋', skill: 0.62, level: 'Intermediate', city: 'Bengaluru', club: 0, bio: "Jayanth's regular doubles partner." },
  { name: 'Suresh Babu', handle: 'suresh', emoji: '🦁', skill: 0.55, level: 'Intermediate', city: 'Bengaluru', club: 0 },
  { name: 'Anil Joseph', handle: 'anil', emoji: '🐻', skill: 0.58, level: 'Intermediate', city: 'Bengaluru', club: 1 },
  { name: 'Raj Shetty', handle: 'rajs', emoji: '🦈', skill: 0.6, level: 'Advanced', city: 'Bengaluru', club: 1 },
  { name: 'Vivek Iyer', handle: 'vivek', emoji: '🐬', skill: 0.53, level: 'Intermediate', city: 'Bengaluru', club: 1 },
  { name: 'Manoj Pillai', handle: 'manoj', emoji: '🦉', skill: 0.5, level: 'Intermediate', city: 'Bengaluru', club: 1 },
  { name: 'Deepak Rao', handle: 'deepak', emoji: '🐘', skill: 0.68, level: 'Advanced', city: 'Bengaluru', club: 0 },
  { name: 'Meera Krishnan', handle: 'meerak', emoji: '🦋', skill: 0.79, level: 'Competitive', city: 'Bengaluru', club: 0, bio: 'State level. Mixed doubles > everything.' },
  { name: 'Divya S', handle: 'divya', emoji: '🌸', skill: 0.71, level: 'Advanced', city: 'Bengaluru', club: 0 },
  { name: 'Priya Ramesh', handle: 'priyar', emoji: '🔥', skill: 0.66, level: 'Advanced', city: 'Bengaluru', club: 1 },
  { name: 'Ananya Gowda', handle: 'ananya', emoji: '🌊', skill: 0.57, level: 'Intermediate', city: 'Bengaluru', club: 1 },
  { name: 'Nikhil Verma', handle: 'nikhil', emoji: '🚀', skill: 0.45, level: 'Beginner', city: 'Bengaluru', club: 0, bio: 'Started in March. Improving fast.' },
  { name: 'Praveen Kumar', handle: 'praveen', emoji: '🎯', skill: 0.49, level: 'Beginner', city: 'Bengaluru', club: 2 },
  { name: 'Harish M', handle: 'harish', emoji: '🐆', skill: 0.63, level: 'Advanced', city: 'Bengaluru', club: 2 },
  { name: 'Kiran Bhat', handle: 'kiran', emoji: '🦌', skill: 0.52, level: 'Intermediate', city: 'Bengaluru', club: 2 },
  { name: 'Aditya Sharma', handle: 'aditya', emoji: '🌟', skill: 0.7, level: 'Advanced', city: 'Bengaluru', club: 2 },
  { name: 'Rohit Desai', handle: 'rohit', emoji: '🐂', skill: 0.47, level: 'Beginner', city: 'Bengaluru', club: 2 },
  { name: 'Sanjay Hegde', handle: 'sanjay', emoji: '🦅', skill: 0.56, level: 'Intermediate', city: 'Bengaluru', club: 1 },
  { name: 'Naveen Reddy', handle: 'naveen', emoji: '⚔️', skill: 0.61, level: 'Advanced', city: 'Bengaluru', club: 0 },
]

export const ME = 'p0'

const DAY = 86_400_000
const HOUR = 3_600_000

/** Play out a whole match rally by rally at a given per-rally win probability. */
function simulate(pWinRally: number, format: Format, rand: () => number, startAt: number): Rally[] {
  const rallies: Rally[] = []
  const need = Math.ceil(format.bestOf / 2)
  let wonA = 0
  let wonB = 0
  let a = 0
  let b = 0
  let t = startAt
  let guard = 0
  while (wonA < need && wonB < need && guard++ < 500) {
    // Momentum: trailing side lifts slightly, which produces realistic swings.
    const trail = (b - a) * 0.012
    const p = Math.min(0.92, Math.max(0.08, pWinRally + trail))
    const by: Side = rand() < p ? 'A' : 'B'
    if (by === 'A') a += 1
    else b += 1
    t += 18_000 + Math.floor(rand() * 30_000)
    rallies.push({ by, at: t })
    const me = by === 'A' ? a : b
    const them = by === 'A' ? b : a
    if (isGameOver(me, them, format)) {
      if (by === 'A') wonA += 1
      else wonB += 1
      a = 0
      b = 0
      t += 120_000
    }
  }
  return rallies
}

/** Convert a rating gap into a plausible per-rally edge. */
const rallyProb = (mine: number, theirs: number) => 0.5 + Math.max(-0.24, Math.min(0.24, (mine - theirs) / 1600))

const K = 30
const expected = (mine: number, theirs: number) => 1 / (1 + 10 ** ((theirs - mine) / 400))
const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

export interface SeedData {
  players: Player[]
  matches: Match[]
  clubs: Club[]
  tournaments: Tournament[]
  challenges: Challenge[]
  notifications: AppNotification[]
}

export function buildSeed(now = Date.now()): SeedData {
  const rand = rng(20260906)

  const clubs: Club[] = [
    { id: 'c0', name: 'Badminton Boys — Koramangala', area: 'Koramangala 5th Block', city: 'Bengaluru', courts: 4, memberIds: [], adminIds: ['p1'], announcement: 'Cup quarter-finals move to Court 1 & 2 this Saturday. Be there by 6:45 PM.' },
    { id: 'c1', name: 'HSR Smashers', area: 'HSR Layout Sector 2', city: 'Bengaluru', courts: 3, memberIds: [], adminIds: ['p8'] },
    { id: 'c2', name: 'Indiranagar Racquet Club', area: '12th Main, Indiranagar', city: 'Bengaluru', courts: 6, memberIds: [], adminIds: ['p20'] },
  ]

  const players: Player[] = SKETCHES.map((s, i) => ({
    id: `p${i}`,
    name: s.name,
    handle: s.handle,
    emoji: s.emoji,
    tint: TINTS[i % TINTS.length],
    level: s.level,
    rating: Math.round(880 + s.skill * 320),
    city: s.city,
    clubId: clubs[s.club].id,
    prefers: i % 3 === 0 ? 'Both' : i % 3 === 1 ? 'Doubles' : 'Singles',
    bio: s.bio,
    role: i === 1 ? 'organizer' : i === 0 ? 'player' : 'player',
    joinedAt: now - (200 - i * 4) * DAY,
  }))
  players[0].role = 'organizer' // the demo user can run a tournament
  for (const p of players) clubs.find((c) => c.id === p.clubId)!.memberIds.push(p.id)

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const played: Record<string, number> = {}
  const matches: Match[] = []
  let mid = 0

  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

  const record = (
    teamA: string[],
    teamB: string[],
    type: 'Singles' | 'Doubles',
    at: number,
    opts: Partial<Match> = {},
  ) => {
    const format: Format = { ...DEFAULT_FORMAT, bestOf: opts.format?.bestOf ?? 3 }
    const ra = avg(teamA.map((id) => byId[id].rating))
    const rb = avg(teamB.map((id) => byId[id].rating))
    const rallies = simulate(rallyProb(ra, rb), format, rand, at)
    const m: Match = {
      id: `m${mid++}`,
      type,
      teamA,
      teamB,
      format,
      rallies,
      firstServe: rand() < 0.5 ? 'A' : 'B',
      status: 'completed',
      competitive: opts.competitive ?? rand() > 0.25,
      court: opts.court ?? `Court ${1 + Math.floor(rand() * 4)}`,
      clubId: opts.clubId ?? byId[teamA[0]].clubId,
      tournamentId: opts.tournamentId,
      round: opts.round,
      scheduledAt: at,
      startedAt: at,
      completedAt: rallies.length ? rallies[rallies.length - 1].at + 60_000 : at,
      endsSwapped: false,
      confirmations: [...teamA, ...teamB],
      corrections: [],
      reactions: {
        fire: Math.floor(rand() * 14),
        clap: Math.floor(rand() * 9),
        wow: Math.floor(rand() * 5),
      },
      invitesAccepted: [...teamA, ...teamB],
      ...opts,
    }
    const st = computeState(m)
    if (m.competitive && st.winner) {
      const totals = st.totalPoints
      const spread = Math.abs(totals.a - totals.b) / Math.max(1, totals.a + totals.b)
      const margin = 0.85 + spread * 0.9
      const delta: Record<string, number> = {}
      for (const [ids, mineR, theirsR, side] of [
        [teamA, ra, rb, 'A'],
        [teamB, rb, ra, 'B'],
      ] as [string[], number, number, Side][]) {
        const sc = st.winner === side ? 1 : 0
        const e = expected(mineR, theirsR)
        for (const id of ids) {
          const kk = (played[id] ?? 0) < 10 ? K * 1.6 : byId[id].rating > 1300 ? K * 0.75 : K
          const d = Math.round(kk * (sc - e) * margin)
          delta[id] = d
          byId[id].rating += d
          played[id] = (played[id] ?? 0) + 1
        }
      }
      m.ratingDelta = delta
    } else {
      for (const id of [...teamA, ...teamB]) played[id] = (played[id] ?? 0) + 1
    }
    matches.push(m)
    return m
  }

  // ---- 5 months of club play, oldest first so ratings evolve realistically ----
  const clubRosters = clubs.map((c) => c.memberIds)
  for (let day = 150; day >= 2; day--) {
    const sessions = day % 2 === 0 ? 4 : 3
    for (let s = 0; s < sessions; s++) {
      const roster = pick(clubRosters)
      if (roster.length < 4) continue
      const at = now - day * DAY + 18 * HOUR + s * 40 * 60_000
      const roll = shuffled(roster, rand)
      if (rand() < 0.45) {
        record([roll[0]], [roll[1]], 'Singles', at)
      } else {
        record([roll[0], roll[1]], [roll[2], roll[3]], 'Doubles', at)
      }
    }
    // Make sure the demo user plays often enough to have a rich profile.
    if (day % 3 === 0) {
      const at = now - day * DAY + 19 * HOUR
      const mates = shuffled(clubs[0].memberIds.filter((id) => id !== ME), rand)
      if (rand() < 0.55) record([ME, 'p5'], [mates[0], mates[1]], 'Doubles', at, { clubId: 'c0' })
      else record([ME], [mates[0]], 'Singles', at, { clubId: 'c0' })
    }
  }

  // ---- Tournament: group stage + quarters already played ----
  const tournament: Tournament = {
    id: 't0',
    name: 'Badminton Boys Cup 2026',
    clubId: 'c0',
    category: "Men's & Women's Singles + Doubles",
    format: 'League + Knockout',
    courts: 4,
    startsAt: now - 9 * DAY,
    playerIds: clubs[0].memberIds,
    stage: 'semi',
  }
  const cupField = ['p1', 'p2', 'p3', 'p12', 'p0', 'p11', 'p13', 'p23']
  const groups = [cupField.slice(0, 4), cupField.slice(4)]
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.length; i++)
      for (let j = i + 1; j < g.length; j++)
        record([g[i]], [g[j]], 'Singles', now - (8 - gi) * DAY + (i + j) * HOUR, {
          tournamentId: 't0',
          clubId: 'c0',
          competitive: true,
          round: `Group ${String.fromCharCode(65 + gi)}`,
          format: { ...DEFAULT_FORMAT, bestOf: 3 },
        })
  })
  const quarters: [string, string][] = [
    ['p1', 'p23'],
    ['p2', 'p11'],
    ['p12', 'p13'],
    ['p3', 'p0'],
  ]
  quarters.forEach(([x, y], i) =>
    record([x], [y], 'Singles', now - 3 * DAY + i * HOUR, {
      tournamentId: 't0',
      clubId: 'c0',
      competitive: true,
      round: 'Quarter Final',
      court: `Court ${i + 1}`,
    }),
  )

  // ---- Matches happening right now ----
  const liveSpecs: {
    a: string[]
    b: string[]
    type: 'Singles' | 'Doubles'
    court: string
    rallies: number
    round?: string
    tournamentId?: string
  }[] = [
    { a: ['p1', 'p2'], b: ['p4', 'p3'], type: 'Doubles', court: 'Court 1', rallies: 34 },
    { a: ['p12'], b: ['p13'], type: 'Singles', court: 'Court 2', rallies: 26, round: 'Semi Final', tournamentId: 't0' },
    { a: ['p8', 'p9'], b: ['p10', 'p22'], type: 'Doubles', court: 'Court 3', rallies: 40 },
    { a: ['p18'], b: ['p20'], type: 'Singles', court: 'Court 4', rallies: 47 },
    { a: ['p6'], b: ['p16'], type: 'Singles', court: 'Court 2', rallies: 18 },
    { a: ['p11', 'p23'], b: ['p14', 'p19'], type: 'Doubles', court: 'Court 5', rallies: 31 },
  ]
  for (const spec of liveSpecs) {
    const startedAt = now - (spec.rallies * 32_000 + 4 * 60_000)
    const format = { ...DEFAULT_FORMAT, bestOf: 3 as const }
    const ra = avg(spec.a.map((id) => byId[id].rating))
    const rb = avg(spec.b.map((id) => byId[id].rating))
    const full = simulate(rallyProb(ra, rb), format, rand, startedAt)
    matches.push({
      id: `m${mid++}`,
      type: spec.type,
      teamA: spec.a,
      teamB: spec.b,
      format,
      rallies: full.slice(0, spec.rallies),
      firstServe: 'A',
      status: 'live',
      competitive: true,
      court: spec.court,
      clubId: byId[spec.a[0]].clubId,
      tournamentId: spec.tournamentId,
      round: spec.round,
      scheduledAt: startedAt,
      startedAt,
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 3 + Math.floor(rand() * 20), clap: Math.floor(rand() * 10), wow: Math.floor(rand() * 6) },
      invitesAccepted: [...spec.a, ...spec.b],
    })
  }
  // A live match sitting on 20-20 makes the LIVE tab feel urgent.
  const nailBiter = matches[matches.length - 3]
  nailBiter.rallies = [
    ...Array.from({ length: 20 }, (_, i) => ({ by: (i % 2 === 0 ? 'A' : 'B') as Side, at: now - (40 - i) * 60_000 })),
    ...Array.from({ length: 20 }, (_, i) => ({ by: (i % 2 === 0 ? 'B' : 'A') as Side, at: now - (20 - i) * 60_000 })),
  ]

  // ---- Upcoming ----
  const upcoming: Match[] = [
    {
      id: `m${mid++}`,
      type: 'Doubles',
      teamA: [ME, 'p5'],
      teamB: ['p1', 'p2'],
      format: { ...DEFAULT_FORMAT, bestOf: 3 },
      rallies: [],
      firstServe: 'A',
      status: 'ready',
      competitive: true,
      court: 'Court 3',
      clubId: 'c0',
      scheduledAt: now + 32 * 60_000,
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 0, clap: 0, wow: 0 },
      invitesAccepted: [ME, 'p5', 'p1', 'p2'],
      notes: 'Winner takes the top of the club table.',
    },
    {
      id: `m${mid++}`,
      type: 'Singles',
      teamA: [ME],
      teamB: ['p3'],
      format: { ...DEFAULT_FORMAT, bestOf: 3 },
      rallies: [],
      firstServe: 'A',
      status: 'created',
      competitive: true,
      court: 'Court 1',
      clubId: 'c0',
      scheduledAt: now + 2 * DAY + 3 * HOUR,
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 0, clap: 0, wow: 0 },
      invitesAccepted: ['p3'], // waiting on the demo user to accept
    },
    {
      id: `m${mid++}`,
      type: 'Doubles',
      teamA: ['p12', 'p13'],
      teamB: ['p14', 'p15'],
      format: { ...DEFAULT_FORMAT, bestOf: 3 },
      rallies: [],
      firstServe: 'A',
      status: 'ready',
      competitive: true,
      court: 'Court 2',
      clubId: 'c0',
      tournamentId: 't0',
      round: 'Semi Final',
      scheduledAt: now + 90 * 60_000,
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 0, clap: 0, wow: 0 },
      invitesAccepted: ['p12', 'p13', 'p14', 'p15'],
    },
  ]
  matches.push(...upcoming)

  const challenges: Challenge[] = [
    { id: 'ch0', fromId: 'p3', toId: ME, type: 'Singles', bestOf: 3, at: now + 3 * DAY + 19 * HOUR, status: 'pending' },
    { id: 'ch1', fromId: ME, toId: 'p11', type: 'Singles', bestOf: 3, at: now + 4 * DAY + 19.5 * HOUR, status: 'pending' },
  ]

  const notifications: AppNotification[] = [
    { id: 'n0', icon: '🔔', text: 'Your match starts in 32 minutes — Court 3', at: now - 60_000, read: false, link: `/match/${upcoming[0].id}` },
    { id: 'n1', icon: '👤', text: 'Arjun Nair challenged you to a best of 3', at: now - 40 * 60_000, read: false, link: '/play' },
    { id: 'n2', icon: '🔴', text: "Rahul Menon's match is LIVE on Court 1", at: now - 55 * 60_000, read: false, link: '/live' },
    { id: 'n3', icon: '🏆', text: 'You moved up to #12 in Bengaluru', at: now - 5 * HOUR, read: true, link: '/leaderboard' },
    { id: 'n4', icon: '🔥', text: 'Badminton Boys Cup semi-finals start tonight', at: now - 9 * HOUR, read: true, link: '/tournament/t0' },
  ]

  players.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  return { players, matches, clubs, tournaments: [tournament], challenges, notifications }
}
