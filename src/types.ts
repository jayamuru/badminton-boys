/**
 * Badminton Boys — domain model.
 * Matches are event-sourced: every rally is an event, and the whole scoreboard
 * (games, serve, court side, match point, winner) is derived from that list.
 * That makes UNDO a single pop and keeps the score impossible to desync.
 */

export type Level = 'Beginner' | 'Intermediate' | 'Advanced' | 'Competitive'
export type GameType = 'Singles' | 'Doubles' | 'Both'
export type Side = 'A' | 'B'
export type Court = 'R' | 'L'
export type Role = 'player' | 'scorer' | 'organizer' | 'admin'

export interface Player {
  id: string
  name: string
  handle: string
  /** Avatar colour, and the fallback avatar: the player's initials on it. */
  tint: string
  /**
   * A photo of the player, as a `data:` URL, or undefined for the initials.
   *
   * Stored inline rather than in a bucket because there isn't one to store it
   * in — the app talks to Postgres and nothing else, and asking someone to
   * provision object storage and its policies before their club can have
   * profile pictures is a worse trade than a few dozen KB in a text column.
   * `readImageAsDataUrl` shrinks whatever came off the camera to fit.
   */
  photo?: string
  level: Level
  rating: number
  city: string
  clubId?: string
  prefers: GameType
  bio?: string
  role: Role
  joinedAt: number
}

export interface Format {
  bestOf: 1 | 3 | 5
  pointsToWin: number
  winBy: number
  cap: number
}

/** One rally. `by` is the side that won it. */
export interface Rally {
  by: Side
  at: number
}

export interface Correction {
  at: number
  byPlayerId: string
  from: string
  to: string
  note?: string
}

export type MatchStatus =
  | 'created'
  | 'confirmed'
  | 'ready'
  | 'live'
  | 'awaiting_confirmation'
  | 'disputed'
  | 'completed'

export interface Match {
  id: string
  type: 'Singles' | 'Doubles'
  teamA: string[]
  teamB: string[]
  format: Format
  rallies: Rally[]
  /** Side that served the very first rally of game 1. */
  firstServe: Side
  status: MatchStatus
  competitive: boolean
  court?: string
  clubId?: string
  tournamentId?: string
  round?: string
  scheduledAt: number
  startedAt?: number
  completedAt?: number
  /** Left/right layout flip on the scoring screen (physical ends change). */
  endsSwapped: boolean
  confirmations: string[]
  corrections: Correction[]
  reactions: { fire: number; clap: number; wow: number }
  invitesAccepted: string[]
  notes?: string
  ratingDelta?: Record<string, number>
  disputes?: { playerId: string; claim: string }[]
}

export interface Club {
  id: string
  name: string
  area: string
  city: string
  courts: number
  memberIds: string[]
  adminIds: string[]
  announcement?: string
}

export interface Tournament {
  id: string
  name: string
  clubId: string
  category: string
  format: string
  courts: number
  startsAt: number
  playerIds: string[]
  stage: 'group' | 'quarter' | 'semi' | 'final' | 'done'
}

export interface Challenge {
  id: string
  fromId: string
  toId: string
  type: 'Singles' | 'Doubles'
  bestOf: 1 | 3 | 5
  at: number
  status: 'pending' | 'accepted' | 'declined'
}

export interface AppNotification {
  id: string
  text: string
  at: number
  read: boolean
  link?: string
}

export interface Session {
  playerId: string
  onboarded: boolean
  /** True while the app is showing the simulated demo season rather than real matches. */
  demo?: boolean
}
