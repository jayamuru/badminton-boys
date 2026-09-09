import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp, useTick } from '../store/AppStore'
import { computeState } from '../engine/scoring'
import type { Side } from '../types'
import { firstName, teamName } from '../lib/format'
import { Avatar, LivePill } from '../components/ui'
import { REACTION_LABEL } from '../lib/reactions'
import { TimelineList } from './Scoring'

/**
 * Read-only broadcast view — the thing behind the shared link / QR code.
 * No scoring controls at all, so a spectator can't touch the match. Updates
 * arrive over the same BroadcastChannel the scorer writes to.
 */
export function Spectate() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch, playerById } = useApp()
  const nav = useNavigate()
  useTick(5_000)

  const match = state.matches.find((m) => m.id === id)
  const s = useMemo(() => (match ? computeState(match) : null), [match])

  if (!match || !s) {
    return (
      <div className="page center">
        <p className="mt-32 dim">This match link is no longer valid.</p>
        <button className="btn mt-16" onClick={() => nav('/live')}>
          See live matches
        </button>
      </div>
    )
  }

  const live = match.status === 'live'
  const tournament = state.tournaments.find((t) => t.id === match.tournamentId)

  const Team = ({ side }: { side: Side }) => {
    const ids = side === 'A' ? match.teamA : match.teamB
    const score = side === 'A' ? s.current.a : s.current.b
    const opp = side === 'A' ? s.current.b : s.current.a
    const serving = s.serve.side === side && live
    return (
      <div className={`steam${score < opp ? ' steam--behind' : ''}`}>
        <div className="avatar-stack">
          {ids.map((pid) => (
            <Avatar key={pid} player={playerById(pid)} size="sm" />
          ))}
        </div>
        <div className="steam__who">
          <div className="steam__name">{teamName(ids, playerById)}</div>
          {serving && (
            <span className="serve-badge mt-8">
              {match.type === 'Doubles'
                ? `${firstName(playerById(ids[s.serve.serverIndex] ?? ids[0]))} serving`
                : 'Serving'}
              {' · '}
              {s.serve.court === 'R' ? 'right' : 'left'}
            </span>
          )}
        </div>
        <div
          className={`steam__score${score > opp ? ' neon' : ''}`}
          key={`${side}-${score}`}
          style={{ animation: 'score-pop 380ms var(--spring)' }}
        >
          {score}
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
      <div className="row gap-8">
        <button className="icon-btn" onClick={() => nav('/live')} aria-label="Back">
          ‹
        </button>
        <span className="wordmark grow">
          
          <span className="wordmark__bb">
            BADMINTON <span>BOYS</span>
          </span>
        </span>
        {live && <LivePill />}
      </div>

      <div className="row gap-8 mt-16 wrap">
        <span className="pill">{match.court}</span>
        <span className="pill">Game {s.gameIndex + 1}</span>
        {tournament && <span className="pill pill--gold">{tournament.name}</span>}
        {match.round && <span className="pill">{match.round}</span>}
      </div>

      <div className="card mt-16" style={{ padding: '4px 16px' }}>
        <div className="court-lines" />
        <Team side="A" />
        <div className="divider" style={{ margin: 0 }} />
        <Team side="B" />
      </div>

      {s.matchPoint && (
        <div className="matchpoint mt-16" style={{ borderRadius: 'var(--r)' }}>
          Match point — {teamName(s.matchPoint === 'A' ? match.teamA : match.teamB, playerById)}
        </div>
      )}

      {s.finished && (
        <div className="card card--neon mt-16 center">
          
          <p className="h2 mt-8">
            {teamName(s.winner === 'A' ? match.teamA : match.teamB, playerById)} win
          </p>
        </div>
      )}

      {s.completed.length > 0 && (
        <>
          <h3 className="section-head__title mt-24 mb-8">Games</h3>
          <div className="card row gap-8 wrap">
            {s.completed.map((g, i) => (
              <span key={i} className="pill">
                G{i + 1} · {g.a}–{g.b}
              </span>
            ))}
            {!s.finished && (
              <span className="pill pill--neon">
                G{s.gameIndex + 1} · {s.current.a}–{s.current.b}
              </span>
            )}
          </div>
        </>
      )}

      <h3 className="section-head__title mt-24 mb-8">Live timeline</h3>
      <div className="card">
        <TimelineList match={match} limit={25} />
      </div>

      <div className="row gap-8 mt-16">
        <div className="reactions grow">
          {(['fire', 'clap', 'wow'] as const).map((k) => (
            <button
              key={k}
              className="reaction"
              onClick={() => dispatch({ type: 'react', matchId: match.id, kind: k })}
            >
              {REACTION_LABEL[k]} {match.reactions[k]}
            </button>
          ))}
        </div>
      </div>

      <p className="micro center mt-24">You're watching — only the scorer can change the score.</p>
    </div>
  )
}
