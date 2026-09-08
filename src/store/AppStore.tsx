import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppNotification,
  Challenge,
  Club,
  Correction,
  Match,
  Player,
  Session,
  Side,
  Tournament,
} from '../types'
import { buildSeed, ME } from '../data/seed'
import { computeState } from '../engine/scoring'
import { ratingChanges } from '../engine/rating'
import { allStats, type PlayerStats } from '../engine/stats'
import { cloudEnabled, db } from '../backend/client'
import {
  loadPublicWorld,
  loadWorld,
  myProfile,
  pushAction,
  subscribe,
  subscribeToMatch,
} from '../backend/api'

const STORAGE_KEY = 'badminton-boys:v1'
const CHANNEL = 'badminton-boys:live'

export interface State {
  players: Player[]
  matches: Match[]
  clubs: Club[]
  tournaments: Tournament[]
  challenges: Challenge[]
  notifications: AppNotification[]
  follows: string[]
  session: Session
  /** Set while a celebration overlay should be showing. */
  celebrate: { matchId: string } | null
}

export type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'point'; matchId: string; side: Side }
  | { type: 'undo'; matchId: string }
  | { type: 'swapEnds'; matchId: string }
  | { type: 'startMatch'; matchId: string }
  | { type: 'finishMatch'; matchId: string }
  | { type: 'confirmResult'; matchId: string; playerId: string }
  | { type: 'disputeResult'; matchId: string; playerId: string; claim: string }
  | { type: 'correctScore'; matchId: string; correction: Correction; rallies: Match['rallies'] }
  | { type: 'createMatch'; match: Match }
  | { type: 'acceptInvite'; matchId: string; playerId: string }
  | { type: 'declineInvite'; matchId: string; playerId: string }
  | { type: 'react'; matchId: string; kind: 'fire' | 'clap' | 'wow' }
  | { type: 'follow'; playerId: string }
  | { type: 'createChallenge'; challenge: Challenge }
  | { type: 'answerChallenge'; id: string; accept: boolean }
  | { type: 'register'; player: Player }
  | { type: 'addPlayer'; player: Player }
  | { type: 'updatePlayer'; player: Partial<Player> & { id: string } }
  | { type: 'joinClub'; clubId: string }
  | { type: 'readNotifications' }
  | { type: 'notify'; notification: AppNotification }
  | { type: 'dismissCelebration' }
  | { type: 'setOnboarded' }
  | { type: 'reset' }
  | { type: 'clearAll' }

/** The simulated demo season — what a first-time visitor lands in. */
function freshState(): State {
  const seed = buildSeed()
  return {
    players: seed.players,
    matches: seed.matches,
    clubs: seed.clubs,
    tournaments: seed.tournaments,
    challenges: seed.challenges,
    notifications: seed.notifications,
    follows: ['p1', 'p2', 'p3', 'p5', 'p12'],
    session: { playerId: ME, onboarded: false, demo: true },
    celebrate: null,
  }
}

/**
 * A real, empty app. Keeps you — a rated profile with no history — and throws
 * away every simulated player, match, club and tournament. From here the roster
 * is whoever you add yourself.
 */
function emptyState(me?: Player): State {
  const you: Player = me
    ? { ...me, rating: 1000, clubId: undefined }
    : {
        id: 'me',
        name: 'You',
        handle: 'you',
        emoji: '🏸',
        tint: '#C8FF2E',
        level: 'Intermediate',
        rating: 1000,
        city: '',
        prefers: 'Both',
        role: 'organizer',
        joinedAt: Date.now(),
      }
  return {
    players: [you],
    matches: [],
    clubs: [],
    tournaments: [],
    challenges: [],
    notifications: [],
    follows: [],
    session: { playerId: you.id, onboarded: true, demo: false },
    celebrate: null,
  }
}

const mapMatch = (s: State, id: string, fn: (m: Match) => Match): State => ({
  ...s,
  matches: s.matches.map((m) => (m.id === id ? fn(m) : m)),
})

/** Apply rating movement + flip the match to completed. */
function settle(state: State, matchId: string): State {
  const match = state.matches.find((m) => m.id === matchId)
  if (!match || match.status === 'completed') return state
  const byId = Object.fromEntries(state.players.map((p) => [p.id, p]))
  const playedCount: Record<string, number> = {}
  for (const m of state.matches) {
    if (m.status !== 'completed') continue
    for (const id of [...m.teamA, ...m.teamB]) playedCount[id] = (playedCount[id] ?? 0) + 1
  }
  const changes = ratingChanges(match, byId, playedCount)
  const delta = Object.fromEntries(changes.map((c) => [c.playerId, c.delta]))
  return {
    ...state,
    players: state.players.map((p) =>
      delta[p.id] === undefined ? p : { ...p, rating: Math.max(100, p.rating + delta[p.id]) },
    ),
    matches: state.matches.map((m) =>
      m.id === matchId
        ? { ...m, status: 'completed', completedAt: Date.now(), ratingDelta: delta }
        : m,
    ),
  }
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state

    case 'point': {
      const match = state.matches.find((m) => m.id === action.matchId)
      if (!match || computeState(match).finished) return state
      const next = mapMatch(state, action.matchId, (m) => ({
        ...m,
        status: m.status === 'live' ? 'live' : 'live',
        startedAt: m.startedAt ?? Date.now(),
        rallies: [...m.rallies, { by: action.side, at: Date.now() }],
      }))
      const after = next.matches.find((m) => m.id === action.matchId)!
      const st = computeState(after)
      if (st.finished) {
        return {
          ...mapMatch(next, action.matchId, (m) => ({ ...m, status: 'awaiting_confirmation' })),
          celebrate: { matchId: action.matchId },
        }
      }
      return next
    }

    case 'undo': {
      const match = state.matches.find((m) => m.id === action.matchId)
      if (!match || !match.rallies.length) return state
      return {
        ...mapMatch(state, action.matchId, (m) => ({
          ...m,
          rallies: m.rallies.slice(0, -1),
          status: m.status === 'awaiting_confirmation' ? 'live' : m.status,
          confirmations: [],
        })),
        celebrate: null,
      }
    }

    case 'swapEnds':
      return mapMatch(state, action.matchId, (m) => ({ ...m, endsSwapped: !m.endsSwapped }))

    case 'startMatch':
      return mapMatch(state, action.matchId, (m) => ({ ...m, status: 'live', startedAt: Date.now() }))

    case 'finishMatch':
      return settle(state, action.matchId)

    case 'confirmResult': {
      const withConfirm = mapMatch(state, action.matchId, (m) => ({
        ...m,
        confirmations: m.confirmations.includes(action.playerId)
          ? m.confirmations
          : [...m.confirmations, action.playerId],
      }))
      const m = withConfirm.matches.find((x) => x.id === action.matchId)!
      // One confirmation from each side is enough to make the result official.
      const aOk = m.teamA.some((id) => m.confirmations.includes(id))
      const bOk = m.teamB.some((id) => m.confirmations.includes(id))
      return aOk && bOk ? settle(withConfirm, action.matchId) : withConfirm
    }

    case 'disputeResult':
      return mapMatch(state, action.matchId, (m) => ({
        ...m,
        status: 'disputed',
        disputes: [...(m.disputes ?? []), { playerId: action.playerId, claim: action.claim }],
      }))

    case 'correctScore':
      return mapMatch(state, action.matchId, (m) => ({
        ...m,
        rallies: action.rallies,
        corrections: [...m.corrections, action.correction],
        status: m.status === 'disputed' ? 'awaiting_confirmation' : m.status,
        confirmations: [],
      }))

    case 'createMatch':
      return { ...state, matches: [action.match, ...state.matches] }

    case 'acceptInvite':
      return mapMatch(state, action.matchId, (m) => {
        const accepted = m.invitesAccepted.includes(action.playerId)
          ? m.invitesAccepted
          : [...m.invitesAccepted, action.playerId]
        const everyone = [...m.teamA, ...m.teamB]
        const all = everyone.every((id) => accepted.includes(id))
        return { ...m, invitesAccepted: accepted, status: all ? 'ready' : 'confirmed' }
      })

    case 'declineInvite':
      return { ...state, matches: state.matches.filter((m) => m.id !== action.matchId) }

    case 'react':
      return mapMatch(state, action.matchId, (m) => ({
        ...m,
        reactions: { ...m.reactions, [action.kind]: m.reactions[action.kind] + 1 },
      }))

    case 'follow':
      return {
        ...state,
        follows: state.follows.includes(action.playerId)
          ? state.follows.filter((id) => id !== action.playerId)
          : [...state.follows, action.playerId],
      }

    case 'createChallenge':
      return { ...state, challenges: [action.challenge, ...state.challenges] }

    case 'answerChallenge':
      return {
        ...state,
        challenges: state.challenges.map((c) =>
          c.id === action.id ? { ...c, status: action.accept ? 'accepted' : 'declined' } : c,
        ),
      }

    case 'register':
      return {
        ...state,
        players: [action.player, ...state.players.filter((p) => p.id !== action.player.id)],
        session: { ...state.session, playerId: action.player.id, onboarded: true },
      }

    case 'addPlayer':
      return { ...state, players: [...state.players, action.player] }

    case 'updatePlayer':
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.player.id ? { ...p, ...action.player } : p)),
      }

    case 'joinClub':
      return {
        ...state,
        clubs: state.clubs.map((c) =>
          c.id === action.clubId && !c.memberIds.includes(state.session.playerId)
            ? { ...c, memberIds: [...c.memberIds, state.session.playerId] }
            : c,
        ),
        players: state.players.map((p) =>
          p.id === state.session.playerId ? { ...p, clubId: action.clubId } : p,
        ),
      }

    case 'readNotifications':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) }

    case 'notify':
      return { ...state, notifications: [action.notification, ...state.notifications] }

    case 'dismissCelebration':
      return { ...state, celebrate: null }

    case 'setOnboarded':
      return { ...state, session: { ...state.session, onboarded: true } }

    case 'reset':
      return freshState()

    case 'clearAll':
      return emptyState(state.players.find((p) => p.id === state.session.playerId))

    default:
      return state
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as State
    // A cleared app legitimately has zero matches, so only a missing roster
    // counts as corrupt — otherwise the demo season would resurrect itself.
    if (!parsed.players?.length || !parsed.session?.playerId) return freshState()
    return { ...parsed, matches: parsed.matches ?? [], celebrate: null }
  } catch {
    return freshState()
  }
}

/**
 * Where the app is in its connection to the cloud.
 * `off` means local mode — no backend configured, demo data, one device.
 */
export type CloudStatus =
  | 'off'
  | 'connecting'
  | 'signed_out'
  | 'needs_profile'
  | 'ready'
  | 'error'

interface Ctx {
  state: State
  dispatch: (a: Action) => void
  me: Player
  playerById: (id: string) => Player
  stats: Record<string, PlayerStats>
  cloud: {
    enabled: boolean
    status: CloudStatus
    error: string | null
    /** True when this device is watching a shared link without an account. */
    spectator: boolean
    /** Pull the whole world down again. */
    refresh: () => Promise<void>
    signOut: () => Promise<void>
  }
}

const AppContext = createContext<Ctx | null>(null)

/** Stand-in `me` while signing in, so screens always have a Player to render. */
const PENDING_ME: Player = {
  id: 'pending',
  name: '',
  handle: 'you',
  emoji: '🏸',
  tint: '#C8FF2E',
  level: 'Intermediate',
  rating: 1000,
  city: '',
  prefers: 'Both',
  role: 'player',
  joinedAt: Date.now(),
}

/**
 * The match id in a shared `#/watch/:id` link, read straight off the URL.
 *
 * Boot happens before the router mounts, so we can't ask react-router for this
 * yet — and we need to know before deciding whether to demand a sign-in.
 */
function watchedMatchId(): string | null {
  if (typeof window === 'undefined') return null
  return window.location.hash.match(/^#\/watch\/([^/?#]+)/)?.[1] ?? null
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, () =>
    cloudEnabled ? emptyState(PENDING_ME) : load(),
  )
  const [status, setStatus] = useState<CloudStatus>(cloudEnabled ? 'connecting' : 'off')
  const [error, setError] = useState<string | null>(null)
  /** Match id when this device is an account-less spectator on a shared link. */
  const [spectating, setSpectating] = useState<string | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const echoRef = useRef(false)
  const meIdRef = useRef<string | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  /* --- local mode: other tabs on this device ----------------------------- */

  useEffect(() => {
    if (cloudEnabled) return // realtime handles this instead
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(CHANNEL)
    channelRef.current = ch
    ch.onmessage = (e) => {
      if (e.data?.type === 'state') {
        echoRef.current = true
        rawDispatch({ type: 'hydrate', state: { ...(e.data.state as State), celebrate: null } })
      }
    }
    return () => ch.close()
  }, [])

  useEffect(() => {
    if (cloudEnabled) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* quota — the demo still works in memory */
    }
    if (echoRef.current) {
      echoRef.current = false
      return
    }
    channelRef.current?.postMessage({ type: 'state', state })
  }, [state])

  /* --- cloud mode: Postgres + realtime ------------------------------------ */

  const pull = useCallback(async (playerId: string) => {
    const world = await loadWorld(playerId)
    rawDispatch({
      type: 'hydrate',
      state: {
        ...world,
        session: { playerId, onboarded: true, demo: false },
        celebrate: stateRef.current.celebrate,
      },
    })
  }, [])

  const boot = useCallback(async () => {
    if (!cloudEnabled) return
    setError(null)
    setStatus('connecting')
    try {
      const profile = await myProfile()
      if (!profile) {
        const { data } = await db().auth.getSession()

        // Someone opened a shared "watch this match" link without an account.
        // Give them the match, read only, and don't ask them to sign up.
        const watching = watchedMatchId()
        if (!data.session && watching) {
          const world = await loadPublicWorld(watching)
          rawDispatch({
            type: 'hydrate',
            state: {
              ...world,
              session: { playerId: '', onboarded: true, demo: false },
              celebrate: null,
            },
          })
          setSpectating(watching)
          setStatus('ready')
          return
        }

        // Signed in but no player card yet — or not signed in at all.
        setStatus(data.session ? 'needs_profile' : 'signed_out')
        return
      }
      setSpectating(null)
      meIdRef.current = profile.id
      await pull(profile.id)
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server')
      setStatus('error')
    }
  }, [pull])

  useEffect(() => {
    if (!cloudEnabled) return
    void boot()
    const { data } = db().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') void boot()
    })
    return () => data.subscription.unsubscribe()
  }, [boot])

  // Anyone's change, on any device, pulls a fresh world. Coalesced so a fast
  // rally of taps doesn't turn into a fetch per point.
  useEffect(() => {
    if (!cloudEnabled || status !== 'ready' || spectating) return
    let timer: number | undefined
    const stop = subscribe(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (meIdRef.current) void pull(meIdRef.current).catch(() => {})
      }, 120)
    })
    return () => {
      window.clearTimeout(timer)
      stop()
    }
  }, [status, pull, spectating])

  // A spectator only ever watches one match, so they subscribe to one row.
  useEffect(() => {
    if (!cloudEnabled || !spectating) return
    let timer: number | undefined
    const stop = subscribeToMatch(spectating, () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void loadPublicWorld(spectating)
          .then((world) =>
            rawDispatch({
              type: 'hydrate',
              state: {
                ...world,
                session: { playerId: '', onboarded: true, demo: false },
                celebrate: null,
              },
            }),
          )
          .catch(() => {})
      }, 120)
    })
    return () => {
      window.clearTimeout(timer)
      stop()
    }
  }, [spectating])

  const dispatchRemote = useCallback(
    (a: Action) => {
      rawDispatch(a)
      const myId = meIdRef.current
      if (!myId) return
      void pushAction(a, reducer(stateRef.current, a), myId).catch(async (e) => {
        setError(e instanceof Error ? e.message : 'That change did not save')
        // Snap back to whatever the server actually thinks is true.
        await pull(myId).catch(() => {})
      })
    },
    [pull],
  )

  const dispatch = useCallback(
    (a: Action) => {
      // A link-only spectator has no account and no write access; let them
      // navigate and react locally but never pretend an edit stuck.
      if (spectating) return
      if (cloudEnabled && status === 'ready') return dispatchRemote(a)
      rawDispatch(a)
    },
    [dispatchRemote, status, spectating],
  )

  const cloud = useMemo(
    () => ({
      enabled: cloudEnabled,
      status,
      error,
      spectator: Boolean(spectating),
      refresh: async () => {
        if (meIdRef.current) await pull(meIdRef.current)
      },
      signOut: async () => {
        if (!cloudEnabled) return
        await db().auth.signOut()
        meIdRef.current = null
        setStatus('signed_out')
      },
    }),
    [status, error, pull, spectating],
  )

  const value = useMemo<Ctx>(() => {
    const map = new Map(state.players.map((p) => [p.id, p]))
    const fallback: Player = {
      id: 'unknown',
      name: 'Unknown player',
      handle: 'unknown',
      emoji: '🏸',
      tint: '#7E8794',
      level: 'Beginner',
      rating: 1000,
      city: '',
      prefers: 'Both',
      role: 'player',
      joinedAt: 0,
    }
    return {
      state,
      dispatch,
      // A spectator isn't anybody in this community — don't hand them the
      // first player on the roster and call it "you".
      me: spectating
        ? { ...fallback, name: 'Guest', handle: 'guest' }
        : (map.get(state.session.playerId) ?? state.players[0] ?? fallback),
      playerById: (id: string) => map.get(id) ?? fallback,
      stats: allStats(state.players, state.matches),
      cloud,
    }
  }, [state, dispatch, cloud, spectating])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Re-render on an interval so relative timestamps stay honest. */
export function useTick(ms = 30_000) {
  const [, force] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const t = setInterval(force, ms)
    return () => clearInterval(t)
  }, [ms])
}
