import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useTick } from '../store/AppStore'
import { computeState } from '../engine/scoring'
import { leaderboard } from '../engine/stats'
import { firstName, greeting, nf, rankTone } from '../lib/format'
import { Avatar, LivePill, SectionHead } from '../components/ui'
import { LiveMatchCard, NextMatchHero, ResultCard, isTight } from '../components/MatchCards'

export function Home() {
  const { state, me, playerById, stats, dispatch } = useApp()
  const nav = useNavigate()
  useTick(20_000)

  const live = state.matches.filter((m) => m.status === 'live')
  const unread = state.notifications.filter((n) => !n.read).length

  const nextMatch = useMemo(
    () =>
      state.matches
        .filter(
          (m) =>
            ['created', 'confirmed', 'ready'].includes(m.status) &&
            [...m.teamA, ...m.teamB].includes(me.id),
        )
        .sort((a, b) => a.scheduledAt - b.scheduledAt)[0],
    [state.matches, me.id],
  )

  const invitation = state.matches.find(
    (m) =>
      m.status === 'created' &&
      [...m.teamA, ...m.teamB].includes(me.id) &&
      !m.invitesAccepted.includes(me.id),
  )

  const top = useMemo(
    () => leaderboard(state.players, stats, 'rating').slice(0, 3),
    [state.players, stats],
  )

  const myRank = useMemo(
    () => leaderboard(state.players, stats, 'rating').findIndex((r) => r.player.id === me.id) + 1,
    [state.players, stats, me.id],
  )

  const recent = useMemo(
    () =>
      state.matches
        .filter((m) => m.status === 'completed' && [...m.teamA, ...m.teamB].includes(me.id))
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .slice(0, 3),
    [state.matches, me.id],
  )

  const myStats = stats[me.id]
  const deciders = live.filter((m) => computeState(m).gameIndex >= 1).length
  const tightCount = live.filter(isTight).length
  const leader = top[0]?.player

  /*
   * Each line used to lead with an emoji. It now leads with a one-word category
   * set in small caps — the same cue, but it says which part of the app the row
   * will take you to instead of leaving you to infer it from a pictogram.
   */
  const pulse: { tag: string; tone?: string; text: React.ReactNode; go: string }[] = []
  if (live.length) pulse.push({ tag: 'Live', tone: 'live', text: <><b>{live.length} matches</b> live right now</>, go: '/live' })
  if (tightCount) pulse.push({ tag: 'Tight', tone: 'live', text: <><b>{tightCount}</b> {tightCount === 1 ? 'match is' : 'matches are'} on a knife edge</>, go: '/live' })
  if (deciders) pulse.push({ tag: 'Deciders', text: <><b>{deciders}</b> {deciders === 1 ? 'match has' : 'matches have'} gone past game one</>, go: '/live' })
  const cupLive = live.find((m) => m.tournamentId)
  if (cupLive) pulse.push({ tag: 'Cup', tone: 'gold', text: <>Cup <b>{cupLive.round?.toLowerCase() ?? 'match'}</b> is live on {cupLive.court}</>, go: `/match/${cupLive.id}` })
  if (leader) pulse.push({ tag: 'Ranks', text: <><b>{firstName(leader)}</b> is holding #1 with {nf(leader.rating)}</>, go: '/leaderboard' })
  if (myStats?.streak >= 3) pulse.push({ tag: 'You', tone: 'neon', text: <>You're on a <b>{myStats.streak}-match winning streak</b></>, go: '/profile' })
  else if (myStats?.streak <= -3) pulse.push({ tag: 'You', tone: 'neon', text: <>Time to break a <b>{Math.abs(myStats.streak)}-match slide</b></>, go: '/play' })

  return (
    <div className="page">
      <header className="topbar topbar--flush">
        <span className="wordmark">
          <span className="wordmark__bb">
            BADMINTON <span>BOYS</span>
          </span>
        </span>
        <span className="grow" />
        <button className="text-btn" onClick={() => nav('/notifications')}>
          Alerts
          {unread > 0 && <i className="icon-btn__dot" />}
        </button>
        <button
          className="avatar-btn"
          onClick={() => nav('/profile')}
          aria-label="Your profile"
        >
          <Avatar player={me} size="sm" />
        </button>
      </header>

      {/*
        A full-bleed photograph behind the greeting. It's the one place on the
        home screen with room for an image, and it gives the app a subject —
        without it the whole screen is text on black.
      */}
      <div className="home-hero">
        <span className="home-hero__photo" role="presentation" />
        <div className="home-hero__copy">
          <div className="greeting__hello">{greeting()}</div>
          <h1 className="greeting__name">{firstName(me)}</h1>
        </div>
      </div>

      {/*
        The three numbers that answer "how am I doing" — flat, big, and side by
        side, rather than three pills you have to read left to right.
      */}
      <div className="statband">
        <div className="statband__cell">
          <div className="statband__v num">{nf(me.rating)}</div>
          <div className="statband__k">Rating</div>
        </div>
        <div className="statband__cell">
          <div className="statband__v num">{myRank > 0 ? `#${myRank}` : '—'}</div>
          <div className="statband__k">Bengaluru</div>
        </div>
        <div className="statband__cell">
          <div className={`statband__v num${myStats?.streak > 0 ? ' win' : ''}`}>
            {myStats?.streak > 0 ? `${myStats.streak}` : '—'}
          </div>
          <div className="statband__k">In a row</div>
        </div>
      </div>

      {invitation && (
        <div className="card card--neon mt-16">
          <div className="row gap-8 mb-12">
            <span className="pill pill--neon">Match invitation</span>
          </div>
          <p className="h3">
            {firstName(playerById(invitation.teamB[0]))} invited you to play
          </p>
          <p className="small dim mt-4">
            Best of {invitation.format.bestOf} · {invitation.court}
          </p>
          <div className="row gap-8 mt-16">
            <button
              className="btn btn--primary grow"
              onClick={() => dispatch({ type: 'acceptInvite', matchId: invitation.id, playerId: me.id })}
            >
              Accept
            </button>
            <button
              className="btn grow"
              onClick={() => dispatch({ type: 'declineInvite', matchId: invitation.id, playerId: me.id })}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {live.length > 0 && (
        <>
          <div className="section-head">
            <h2 className="section-head__title">
              <LivePill label={`Live now · ${live.length}`} />
            </h2>
            <button className="section-head__link" onClick={() => nav('/live')}>
              See all →
            </button>
          </div>
          <div className="stack">
            {live.slice(0, 2).map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </div>
        </>
      )}

      {nextMatch && (
        <>
          <SectionHead title="Your next match" />
          <NextMatchHero match={nextMatch} />
        </>
      )}

      <SectionHead title="Top players" action="Leaderboard" onAction={() => nav('/leaderboard')} />
      <div className="card">
        {top.map((row) => (
          <button
            key={row.player.id}
            className="podium-row"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => nav(`/player/${row.player.id}`)}
          >
            <span className={`podium-row__rank${rankTone(row.rank) ? ` rank--${rankTone(row.rank)}` : ''}`}>
              {row.rank}
            </span>
            <Avatar player={row.player} size="sm" />
            <span className="grow truncate">
              <span className="h3 truncate">{row.player.name}</span>
              <div className="mrow__meta">
                {row.stats.wins}W · {row.stats.losses}L
              </div>
            </span>
            <span className="podium-row__pts">{nf(row.player.rating)}</span>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <SectionHead title="Your recent results" action="History" onAction={() => nav('/profile')} />
          <div className="stack">
            {recent.map((m) => (
              <ResultCard key={m.id} match={m} perspectiveId={me.id} />
            ))}
          </div>
        </>
      )}

      <SectionHead title="What's happening" />
      <div className="card card--flat pulse-list">
        {pulse.map((p, i) => (
          <button key={i} className="pulse" onClick={() => nav(p.go)}>
            <span className={`pulse__tag${p.tone ? ` pulse__tag--${p.tone}` : ''}`}>{p.tag}</span>
            <span className="pulse__text">{p.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
