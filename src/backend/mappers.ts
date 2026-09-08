import type {
  AppNotification,
  Challenge,
  Club,
  Correction,
  Format,
  Match,
  Player,
  Rally,
  Tournament,
} from '../types'

/* Rows as they come back from Postgres. snake_case in, camelCase out. */

export interface ProfileRow {
  id: string
  user_id: string | null
  name: string
  handle: string
  emoji: string
  tint: string
  level: Player['level']
  rating: number
  city: string
  club_id: string | null
  prefers: Player['prefers']
  bio: string | null
  role: Player['role']
  created_by: string | null
  joined_at: string
}

export interface MatchRow {
  id: string
  type: Match['type']
  team_a: string[]
  team_b: string[]
  format: Format
  rallies: Rally[]
  first_serve: Match['firstServe']
  status: Match['status']
  competitive: boolean
  court: string | null
  club_id: string | null
  tournament_id: string | null
  round: string | null
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  ends_swapped: boolean
  confirmations: string[]
  corrections: Correction[]
  reactions: Match['reactions']
  invites_accepted: string[]
  notes: string | null
  rating_delta: Record<string, number> | null
  disputes: Match['disputes']
  scorer_id: string | null
  created_by: string | null
}

export interface ClubRow {
  id: string
  name: string
  area: string
  city: string
  courts: number
  admin_ids: string[]
  announcement: string | null
}

export interface TournamentRow {
  id: string
  name: string
  club_id: string | null
  category: Tournament['category']
  format: string
  courts: number
  starts_at: string
  player_ids: string[]
  stage: Tournament['stage']
}

export interface ChallengeRow {
  id: string
  from_id: string
  to_id: string
  type: Challenge['type']
  best_of: Challenge['bestOf']
  at: string
  status: Challenge['status']
}

export interface NotificationRow {
  id: string
  icon: string
  text: string
  link: string | null
  read: boolean
  at: string
}

const ms = (t: string | null | undefined): number | undefined =>
  t ? new Date(t).getTime() : undefined

const iso = (t: number | undefined | null): string | null =>
  t === undefined || t === null ? null : new Date(t).toISOString()

/* --- row → domain --------------------------------------------------------- */

export const toPlayer = (r: ProfileRow): Player => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  emoji: r.emoji,
  tint: r.tint,
  level: r.level,
  rating: r.rating,
  city: r.city,
  clubId: r.club_id ?? undefined,
  prefers: r.prefers,
  bio: r.bio ?? undefined,
  role: r.role,
  joinedAt: ms(r.joined_at) ?? Date.now(),
})

export const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  type: r.type,
  teamA: r.team_a,
  teamB: r.team_b,
  format: r.format,
  rallies: r.rallies ?? [],
  firstServe: r.first_serve,
  status: r.status,
  competitive: r.competitive,
  court: r.court ?? undefined,
  clubId: r.club_id ?? undefined,
  tournamentId: r.tournament_id ?? undefined,
  round: r.round ?? undefined,
  scheduledAt: ms(r.scheduled_at) ?? Date.now(),
  startedAt: ms(r.started_at),
  completedAt: ms(r.completed_at),
  endsSwapped: r.ends_swapped,
  confirmations: r.confirmations ?? [],
  corrections: r.corrections ?? [],
  reactions: r.reactions ?? { fire: 0, clap: 0, wow: 0 },
  invitesAccepted: r.invites_accepted ?? [],
  notes: r.notes ?? undefined,
  ratingDelta: r.rating_delta ?? undefined,
  disputes: r.disputes ?? [],
})

export const toClub = (r: ClubRow, memberIds: string[]): Club => ({
  id: r.id,
  name: r.name,
  area: r.area,
  city: r.city,
  courts: r.courts,
  memberIds,
  adminIds: r.admin_ids ?? [],
  announcement: r.announcement ?? undefined,
})

export const toTournament = (r: TournamentRow): Tournament => ({
  id: r.id,
  name: r.name,
  clubId: r.club_id ?? '',
  category: r.category,
  format: r.format,
  courts: r.courts,
  startsAt: ms(r.starts_at) ?? Date.now(),
  playerIds: r.player_ids ?? [],
  stage: r.stage,
})

export const toChallenge = (r: ChallengeRow): Challenge => ({
  id: r.id,
  fromId: r.from_id,
  toId: r.to_id,
  type: r.type,
  bestOf: r.best_of,
  at: ms(r.at) ?? Date.now(),
  status: r.status,
})

export const toNotification = (r: NotificationRow): AppNotification => ({
  id: r.id,
  icon: r.icon,
  text: r.text,
  link: r.link ?? undefined,
  read: r.read,
  at: ms(r.at) ?? Date.now(),
})

/* --- domain → row --------------------------------------------------------- */

export const fromPlayer = (p: Player, userId?: string | null, createdBy?: string | null) => ({
  id: p.id,
  user_id: userId ?? null,
  name: p.name,
  handle: p.handle,
  emoji: p.emoji,
  tint: p.tint,
  level: p.level,
  city: p.city,
  club_id: p.clubId ?? null,
  prefers: p.prefers,
  bio: p.bio ?? null,
  role: p.role,
  created_by: createdBy ?? null,
})

export const fromMatch = (m: Match, createdBy: string | null) => ({
  id: m.id,
  type: m.type,
  team_a: m.teamA,
  team_b: m.teamB,
  format: m.format,
  rallies: m.rallies,
  first_serve: m.firstServe,
  status: m.status,
  competitive: m.competitive,
  court: m.court ?? null,
  club_id: m.clubId ?? null,
  tournament_id: m.tournamentId ?? null,
  round: m.round ?? null,
  scheduled_at: iso(m.scheduledAt),
  started_at: iso(m.startedAt),
  completed_at: iso(m.completedAt),
  ends_swapped: m.endsSwapped,
  confirmations: m.confirmations,
  corrections: m.corrections,
  reactions: m.reactions,
  invites_accepted: m.invitesAccepted,
  notes: m.notes ?? null,
  disputes: m.disputes ?? [],
  scorer_id: createdBy,
  created_by: createdBy,
})
