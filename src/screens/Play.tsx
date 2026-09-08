import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { clock, dayLabel, firstName, uid } from '../lib/format'
import { ActionRow, Avatar, SectionHead, Sheet, useToast } from '../components/ui'
import { UpcomingCard } from '../components/MatchCards'
import { DEFAULT_FORMAT } from '../engine/scoring'

export function Play() {
  const { state, me, dispatch, playerById } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [quick, setQuick] = useState(false)

  const mine = state.matches
    .filter(
      (m) => ['created', 'confirmed', 'ready'].includes(m.status) && [...m.teamA, ...m.teamB].includes(me.id),
    )
    .sort((a, b) => a.scheduledAt - b.scheduledAt)

  const incoming = state.challenges.filter((c) => c.toId === me.id && c.status === 'pending')
  const outgoing = state.challenges.filter((c) => c.fromId === me.id && c.status === 'pending')

  /** Quick match: two taps to a live scoreboard, no scheduling, no invites. */
  const startQuick = (type: 'Singles' | 'Doubles') => {
    const pool = state.players.filter((p) => p.id !== me.id).slice(0, 3)
    const match = {
      id: uid('m'),
      type,
      teamA: type === 'Singles' ? [me.id] : [me.id, pool[0].id],
      teamB: type === 'Singles' ? [pool[0].id] : [pool[1].id, pool[2].id],
      format: { ...DEFAULT_FORMAT },
      rallies: [],
      firstServe: 'A' as const,
      status: 'live' as const,
      competitive: false,
      court: 'Court 1',
      clubId: me.clubId,
      scheduledAt: Date.now(),
      startedAt: Date.now(),
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 0, clap: 0, wow: 0 },
      invitesAccepted: type === 'Singles' ? [me.id, pool[0].id] : [me.id, pool[0].id, pool[1].id, pool[2].id],
      notes: 'Quick match',
    }
    dispatch({ type: 'createMatch', match })
    nav(`/score/${match.id}`)
  }

  return (
    <>
      <header className="topbar topbar--flush">
        <h1 className="h1 grow">Play</h1>
      </header>

      <div className="stack">
        <ActionRow
          icon="⚡"
          title="Quick match"
          sub="Skip the setup — start scoring right now"
          onClick={() => setQuick(true)}
          tint="var(--neon)"
        />
        <ActionRow
          icon="🏸"
          title="Create match"
          sub="Pick players, format, court and time"
          onClick={() => nav('/create')}
        />
        <ActionRow
          icon="⚔️"
          title="Challenge a player"
          sub="Call someone out for a best of 3"
          onClick={() => nav('/create?mode=challenge')}
        />
        <ActionRow
          icon="👥"
          title="Find players"
          sub="Discover players near you by level and rating"
          onClick={() => nav('/players')}
        />
        <ActionRow
          icon="🏆"
          title="Tournaments"
          sub="Brackets, group stages and live dashboards"
          onClick={() => nav(`/tournament/${state.tournaments[0]?.id ?? ''}`)}
        />
      </div>

      {incoming.length > 0 && (
        <>
          <SectionHead title="Challenges for you" />
          <div className="stack">
            {incoming.map((c) => (
              <div key={c.id} className="card card--neon">
                <div className="row gap-8 mb-12">
                  <span className="pill pill--neon">⚔️ Challenge</span>
                  <span className="court-tag">
                    {dayLabel(c.at)} · {clock(c.at)}
                  </span>
                </div>
                <div className="row gap-8">
                  <Avatar player={playerById(c.fromId)} size="sm" />
                  <span className="h3 grow">{playerById(c.fromId).name} challenged you</span>
                </div>
                <p className="small dim mt-8">
                  {c.type} · Best of {c.bestOf}
                </p>
                <div className="row gap-8 mt-16">
                  <button
                    className="btn btn--primary grow"
                    onClick={() => {
                      dispatch({ type: 'answerChallenge', id: c.id, accept: true })
                      const match = {
                        id: uid('m'),
                        type: c.type,
                        teamA: [me.id],
                        teamB: [c.fromId],
                        format: { ...DEFAULT_FORMAT, bestOf: c.bestOf },
                        rallies: [],
                        firstServe: 'A' as const,
                        status: 'ready' as const,
                        competitive: true,
                        court: 'Court 1',
                        clubId: me.clubId,
                        scheduledAt: c.at,
                        endsSwapped: false,
                        confirmations: [],
                        corrections: [],
                        reactions: { fire: 0, clap: 0, wow: 0 },
                        invitesAccepted: [me.id, c.fromId],
                      }
                      dispatch({ type: 'createMatch', match })
                      toast('Match confirmed 🏸')
                    }}
                  >
                    Accept
                  </button>
                  <button
                    className="btn grow"
                    onClick={() => dispatch({ type: 'answerChallenge', id: c.id, accept: false })}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <SectionHead title="Waiting on them" />
          <div className="stack">
            {outgoing.map((c) => (
              <div key={c.id} className="card card--flat row gap-8">
                <Avatar player={playerById(c.toId)} size="sm" />
                <span className="grow">
                  <span className="h3">{firstName(playerById(c.toId))}</span>
                  <div className="mrow__meta">
                    {dayLabel(c.at)} · {clock(c.at)} · Best of {c.bestOf}
                  </div>
                </span>
                <span className="pill">Pending</span>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionHead title="Your upcoming matches" />
      {mine.length ? (
        <div className="stack">
          {mine.map((m) => (
            <UpcomingCard key={m.id} match={m} />
          ))}
        </div>
      ) : (
        <div className="card center">
          <p className="small dim">No matches lined up. Create one and it appears here.</p>
        </div>
      )}

      <Sheet open={quick} onClose={() => setQuick(false)} title="Quick match" subtitle="Straight to the scoreboard. Casual — it won't affect your rating.">
        <div className="stack">
          <ActionRow icon="👤" title="Singles" sub="1 v 1" onClick={() => startQuick('Singles')} />
          <ActionRow icon="👥" title="Doubles" sub="2 v 2" onClick={() => startQuick('Doubles')} />
        </div>
      </Sheet>
    </>
  )
}
