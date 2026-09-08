import type { Player } from '../types'
import { db } from './client'
import {
  fromMatch,
  fromPlayer,
  toChallenge,
  toClub,
  toMatch,
  toNotification,
  toPlayer,
  toTournament,
  type ChallengeRow,
  type ClubRow,
  type MatchRow,
  type NotificationRow,
  type ProfileRow,
  type TournamentRow,
} from './mappers'
import type { Action, State } from '../store/AppStore'

/** Everything the app needs, in one round trip's worth of queries. */
export interface World {
  players: State['players']
  matches: State['matches']
  clubs: State['clubs']
  tournaments: State['tournaments']
  challenges: State['challenges']
  notifications: State['notifications']
  follows: string[]
}

/** How many past matches to pull. The season, not all of history. */
const MATCH_LIMIT = 400

export async function loadWorld(myId: string | null): Promise<World> {
  const s = db()
  const [profiles, matches, clubs, members, tournaments, challenges, notifications, follows] =
    await Promise.all([
      s.from('profiles').select('*').order('rating', { ascending: false }),
      s.from('matches').select('*').order('scheduled_at', { ascending: false }).limit(MATCH_LIMIT),
      s.from('clubs').select('*'),
      s.from('club_members').select('club_id, profile_id'),
      s.from('tournaments').select('*'),
      s.from('challenges').select('*').order('at', { ascending: false }),
      myId
        ? s.from('notifications').select('*').eq('profile_id', myId).order('at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [], error: null }),
      myId
        ? s.from('follows').select('followee_id').eq('follower_id', myId)
        : Promise.resolve({ data: [], error: null }),
    ])

  const firstError = [profiles, matches, clubs, members, tournaments, challenges].find((r) => r.error)
  if (firstError?.error) throw firstError.error

  const memberRows = (members.data ?? []) as { club_id: string; profile_id: string }[]

  return {
    players: ((profiles.data ?? []) as ProfileRow[]).map(toPlayer),
    matches: ((matches.data ?? []) as MatchRow[]).map(toMatch),
    clubs: ((clubs.data ?? []) as ClubRow[]).map((c) =>
      toClub(
        c,
        memberRows.filter((m) => m.club_id === c.id).map((m) => m.profile_id),
      ),
    ),
    tournaments: ((tournaments.data ?? []) as TournamentRow[]).map(toTournament),
    challenges: ((challenges.data ?? []) as ChallengeRow[]).map(toChallenge),
    notifications: ((notifications.data ?? []) as NotificationRow[]).map(toNotification),
    follows: ((follows.data ?? []) as { followee_id: string }[]).map((f) => f.followee_id),
  }
}

/**
 * What a spectator with a shared link — and no account — is allowed to see:
 * the match itself and the names of the people playing it.
 */
export async function loadPublicWorld(matchId: string): Promise<World> {
  const s = db()
  const [match, profiles] = await Promise.all([
    s.from('matches').select('*').eq('id', matchId).maybeSingle(),
    s.from('profiles').select('*'),
  ])
  if (match.error) throw match.error
  if (profiles.error) throw profiles.error

  return {
    players: ((profiles.data ?? []) as ProfileRow[]).map(toPlayer),
    matches: match.data ? [toMatch(match.data as MatchRow)] : [],
    clubs: [],
    tournaments: [],
    challenges: [],
    notifications: [],
    follows: [],
  }
}

/** Live updates for one match only — the spectator's subscription. */
export function subscribeToMatch(matchId: string, onChange: () => void): () => void {
  const s = db()
  const channel = s
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      onChange,
    )
    .subscribe()
  return () => {
    s.removeChannel(channel)
  }
}

/** The signed-in user's player profile, or null if they haven't made one. */
export async function myProfile(): Promise<Player | null> {
  const s = db()
  const { data: auth } = await s.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await s.from('profiles').select('*').eq('user_id', auth.user.id).maybeSingle()
  if (error) throw error
  return data ? toPlayer(data as ProfileRow) : null
}

export async function createProfile(player: Player): Promise<Player> {
  const s = db()
  const { data: auth } = await s.auth.getUser()
  if (!auth.user) throw new Error('not signed in')

  // Handles are unique across the community; nudge until one sticks.
  let handle = player.handle
  for (let n = 2; n < 40; n++) {
    const { data } = await s.from('profiles').select('id').eq('handle', handle).maybeSingle()
    if (!data) break
    handle = `${player.handle}${n}`
  }

  const { data, error } = await s
    .from('profiles')
    .insert(fromPlayer({ ...player, handle }, auth.user.id))
    .select()
    .single()
  if (error) throw error
  return toPlayer(data as ProfileRow)
}

/**
 * Translate a dispatched action into database writes.
 *
 * The reducer has already run locally, so `after` is what the user can see.
 * This function makes the server agree. Anything it doesn't recognise is
 * device-local (celebrations, the onboarding flag) and is deliberately skipped.
 */
export async function pushAction(action: Action, after: State, myId: string): Promise<void> {
  const s = db()
  const match = (id: string) => after.matches.find((m) => m.id === id)

  switch (action.type) {
    /* --- scoring: server side, so two devices can't clobber each other ----- */
    case 'point': {
      const { error } = await s.rpc('bb_add_point', { p_match: action.matchId, p_side: action.side })
      if (error) throw error
      return
    }
    case 'undo': {
      const { error } = await s.rpc('bb_undo_point', { p_match: action.matchId })
      if (error) throw error
      return
    }
    case 'confirmResult': {
      const { error } = await s.rpc('bb_confirm_result', { p_match: action.matchId })
      if (error) throw error
      return
    }

    /* --- ordinary row updates -------------------------------------------- */
    case 'swapEnds': {
      const m = match(action.matchId)
      if (m) await s.from('matches').update({ ends_swapped: m.endsSwapped }).eq('id', m.id)
      return
    }
    case 'startMatch': {
      const m = match(action.matchId)
      if (m)
        await s
          .from('matches')
          .update({ status: 'live', started_at: new Date(m.startedAt ?? Date.now()).toISOString() })
          .eq('id', m.id)
      return
    }
    case 'disputeResult': {
      const m = match(action.matchId)
      if (m) await s.from('matches').update({ status: 'disputed', disputes: m.disputes ?? [] }).eq('id', m.id)
      return
    }
    case 'correctScore': {
      const m = match(action.matchId)
      if (m)
        await s
          .from('matches')
          .update({
            rallies: m.rallies,
            corrections: m.corrections,
            status: m.status,
            confirmations: [],
          })
          .eq('id', m.id)
      return
    }
    case 'createMatch': {
      const { error } = await s.from('matches').insert(fromMatch(action.match, myId))
      if (error) throw error
      return
    }
    case 'acceptInvite': {
      const m = match(action.matchId)
      if (m)
        await s
          .from('matches')
          .update({ invites_accepted: m.invitesAccepted, status: m.status })
          .eq('id', m.id)
      return
    }
    case 'declineInvite':
      await s.from('matches').delete().eq('id', action.matchId)
      return

    case 'react': {
      const m = after.matches.find((x) => x.id === action.matchId)
      if (m) await s.from('matches').update({ reactions: m.reactions }).eq('id', m.id)
      return
    }

    /* --- people ----------------------------------------------------------- */
    case 'follow': {
      if (after.follows.includes(action.playerId)) {
        await s.from('follows').insert({ follower_id: myId, followee_id: action.playerId })
      } else {
        await s.from('follows').delete().eq('follower_id', myId).eq('followee_id', action.playerId)
      }
      return
    }
    case 'addPlayer': {
      const { error } = await s.from('profiles').insert(fromPlayer(action.player, null, myId))
      if (error) throw error
      return
    }
    case 'register':
    case 'updatePlayer': {
      const p = after.players.find((x) => x.id === (action.player.id ?? myId))
      if (!p) return
      const { rating: _rating, ...row } = fromPlayer(p) as Record<string, unknown> & { rating?: number }
      delete row.user_id // never reassign ownership from the client
      delete row.created_by
      await s.from('profiles').update(row).eq('id', p.id)
      return
    }
    case 'joinClub': {
      await s.from('club_members').insert({ club_id: action.clubId, profile_id: myId })
      await s.from('profiles').update({ club_id: action.clubId }).eq('id', myId)
      return
    }

    /* --- challenges & notifications --------------------------------------- */
    case 'createChallenge': {
      const c = action.challenge
      const { error } = await s.from('challenges').insert({
        id: c.id,
        from_id: c.fromId,
        to_id: c.toId,
        type: c.type,
        best_of: c.bestOf,
        at: new Date(c.at).toISOString(),
        status: c.status,
      })
      if (error) throw error
      return
    }
    case 'answerChallenge':
      await s
        .from('challenges')
        .update({ status: action.accept ? 'accepted' : 'declined' })
        .eq('id', action.id)
      return

    case 'readNotifications':
      await s.from('notifications').update({ read: true }).eq('profile_id', myId).eq('read', false)
      return

    case 'notify': {
      const n = action.notification
      await s.from('notifications').insert({
        id: n.id,
        profile_id: myId,
        icon: n.icon,
        text: n.text,
        link: n.link ?? null,
        read: n.read,
        at: new Date(n.at).toISOString(),
      })
      return
    }

    default:
      // hydrate / celebrate / onboarding / demo-data actions are local only.
      return
  }
}

/** Fires `onChange` whenever anyone, on any device, changes shared data. */
export function subscribe(onChange: () => void): () => void {
  const s = db()
  const channel = s
    .channel('badminton-boys')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, onChange)
    .subscribe()

  return () => {
    s.removeChannel(channel)
  }
}
