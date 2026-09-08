import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { computeState, gamesList } from '../engine/scoring'
import type { Match, Side } from '../types'
import { clock, dayLabel, relative, signed, teamName } from '../lib/format'
import { Avatar, BackBar, LivePill, Sheet, useToast } from '../components/ui'
import { ShareSheet } from '../components/ShareSheet'
import { TimelineList } from './Scoring'

export function MatchDetail() {
  const { id } = useParams<{ id: string }>()
  const { state, me, dispatch, playerById } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [showShare, setShowShare] = useState(false)
  const [showDispute, setShowDispute] = useState(false)
  const [claim, setClaim] = useState('')

  const match = state.matches.find((m) => m.id === id)
  const s = useMemo(() => (match ? computeState(match) : null), [match])

  if (!match || !s) {
    return (
      <div className="page">
        <BackBar title="Match" />
        <p className="center dim mt-32">This match no longer exists.</p>
      </div>
    )
  }

  const mySide: Side | null = match.teamA.includes(me.id) ? 'A' : match.teamB.includes(me.id) ? 'B' : null
  const isPlayer = mySide !== null
  const canScore =
    isPlayer || me.role === 'scorer' || me.role === 'organizer' || me.role === 'admin'
  const live = match.status === 'live'
  const pending = match.status === 'awaiting_confirmation'
  const done = match.status === 'completed'
  const upcoming = ['created', 'confirmed', 'ready'].includes(match.status)
  const club = state.clubs.find((c) => c.id === match.clubId)
  const tournament = state.tournaments.find((t) => t.id === match.tournamentId)

  const iConfirmed = match.confirmations.includes(me.id)
  const confirmedSides = {
    A: match.teamA.some((p) => match.confirmations.includes(p)),
    B: match.teamB.some((p) => match.confirmations.includes(p)),
  }

  return (
    <div className="page">
      <BackBar
        title={live ? undefined : match.round ?? match.type}
        right={
          <button className="icon-btn" onClick={() => setShowShare(true)} aria-label="Share">
            ⇪
          </button>
        }
      />

      <div className="row gap-8 mb-12 wrap">
        {live && <LivePill />}
        {pending && <span className="pill pill--gold">Awaiting confirmation</span>}
        {match.status === 'disputed' && <span className="pill pill--loss">⚠ Disputed</span>}
        {done && <span className="pill pill--neon">Final</span>}
        {upcoming && <span className="pill">{dayLabel(match.scheduledAt)} · {clock(match.scheduledAt)}</span>}
        <span className="pill">{match.court}</span>
        <span className="pill">{match.competitive ? 'Competitive' : 'Casual'}</span>
      </div>

      <Scorecard match={match} />

      {(live || done || pending) && (
        <div className="row gap-8 mt-16">
          <div className="reactions grow">
            {(['fire', 'clap', 'wow'] as const).map((k) => (
              <button
                key={k}
                className="reaction"
                onClick={() => dispatch({ type: 'react', matchId: match.id, kind: k })}
              >
                {k === 'fire' ? '🔥' : k === 'clap' ? '👏' : '😮'} {match.reactions[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- primary action depends entirely on lifecycle stage --- */}
      {upcoming && canScore && (
        <button className="btn btn--primary btn--lg btn--block mt-16" onClick={() => nav(`/score/${match.id}`)}>
          🏸 Start match
        </button>
      )}

      {live && canScore && (
        <div className="row gap-8 mt-16">
          <button className="btn btn--live btn--lg grow" onClick={() => nav(`/score/${match.id}`)}>
            Continue scoring
          </button>
          <button className="btn btn--lg" onClick={() => nav(`/watch/${match.id}`)}>
            Watch
          </button>
        </div>
      )}

      {live && !canScore && (
        <button className="btn btn--live btn--lg btn--block mt-16" onClick={() => nav(`/watch/${match.id}`)}>
          🔴 Watch live scoreboard
        </button>
      )}

      {pending && (
        <div className="card card--neon mt-16">
          <p className="micro">Confirm result</p>
          <p className="h2 mt-8">
            {teamName(s.winner === 'A' ? match.teamA : match.teamB, playerById)} win
          </p>
          <p className="small dim mt-4 num">
            {gamesList(s).map((g) => `${g.a}–${g.b}`).join(', ')}
          </p>
          <p className="small dim mt-12">
            A result becomes official once one player from each side confirms it. Nobody can
            overwrite a score on their own.
          </p>
          <div className="row gap-8 mt-16">
            <span className={`pill ${confirmedSides.A ? 'pill--win' : ''}`}>
              {confirmedSides.A ? '✓' : '○'} {teamName(match.teamA, playerById)}
            </span>
            <span className={`pill ${confirmedSides.B ? 'pill--win' : ''}`}>
              {confirmedSides.B ? '✓' : '○'} {teamName(match.teamB, playerById)}
            </span>
          </div>
          {isPlayer && (
            <div className="row gap-8 mt-16">
              <button
                className="btn btn--primary grow"
                disabled={iConfirmed}
                onClick={() => {
                  dispatch({ type: 'confirmResult', matchId: match.id, playerId: me.id })
                  toast(iConfirmed ? 'Already confirmed' : 'Result confirmed')
                }}
              >
                {iConfirmed ? 'Confirmed ✓' : 'Confirm result'}
              </button>
              <button className="btn btn--danger" onClick={() => setShowDispute(true)}>
                Dispute
              </button>
            </div>
          )}
          {!isPlayer && (
            <p className="micro mt-16">Only the players in this match can confirm the result.</p>
          )}
        </div>
      )}

      {match.status === 'disputed' && (
        <div className="card mt-16" style={{ borderColor: 'rgba(255,90,95,0.3)' }}>
          <p className="micro loss">⚠ Result disputed</p>
          {match.disputes?.map((d, i) => (
            <p key={i} className="small mt-8">
              <b>{playerById(d.playerId).name}</b> says: “{d.claim}”
            </p>
          ))}
          <p className="small dim mt-12">
            An organiser or the assigned scorer reviews the timeline and resolves this. Scores can't
            be silently overwritten — every correction is logged below.
          </p>
          {(me.role === 'organizer' || me.role === 'admin') && (
            <button
              className="btn btn--block mt-16"
              onClick={() => {
                dispatch({ type: 'confirmResult', matchId: match.id, playerId: match.teamA[0] })
                dispatch({ type: 'confirmResult', matchId: match.id, playerId: match.teamB[0] })
                toast('Resolved — result marked official')
              }}
            >
              Resolve as organiser
            </button>
          )}
        </div>
      )}

      {done && match.ratingDelta && (
        <>
          <h3 className="section-head__title mt-24 mb-8">Rating movement</h3>
          <div className="card">
            {[...match.teamA, ...match.teamB].map((pid) => {
              const d = match.ratingDelta?.[pid] ?? 0
              return (
                <div key={pid} className="podium-row">
                  <Avatar player={playerById(pid)} size="sm" />
                  <span className="grow truncate h3">{playerById(pid).name}</span>
                  <span className={`podium-row__pts ${d >= 0 ? 'win' : 'loss'}`}>{signed(d)}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {match.rallies.length > 0 && (
        <>
          <h3 className="section-head__title mt-24 mb-8">Timeline</h3>
          <div className="card">
            <TimelineList match={match} limit={40} />
          </div>
        </>
      )}

      {match.corrections.length > 0 && (
        <>
          <h3 className="section-head__title mt-24 mb-8">Score corrections</h3>
          <div className="card">
            {match.corrections.map((c, i) => (
              <p key={i} className="small">
                <span className="num">{c.from}</span> → <span className="num neon">{c.to}</span>
                <span className="dim"> · corrected by {playerById(c.byPlayerId).name}, {relative(c.at)}</span>
              </p>
            ))}
          </div>
        </>
      )}

      <h3 className="section-head__title mt-24 mb-8">Details</h3>
      <div className="card">
        <Detail k="Format" v={`Best of ${match.format.bestOf} · to ${match.format.pointsToWin}, cap ${match.format.cap}`} />
        <Detail k="Type" v={match.type} />
        {club && <Detail k="Club" v={club.name} onClick={() => nav(`/club/${club.id}`)} />}
        {tournament && (
          <Detail k="Tournament" v={tournament.name} onClick={() => nav(`/tournament/${tournament.id}`)} />
        )}
        {match.round && <Detail k="Round" v={match.round} />}
        <Detail k="Scheduled" v={`${dayLabel(match.scheduledAt)} · ${clock(match.scheduledAt)}`} />
        {match.notes && <Detail k="Notes" v={match.notes} />}
      </div>

      {isPlayer && upcoming && (
        <button
          className="btn btn--danger btn--block mt-16"
          onClick={() => {
            dispatch({ type: 'declineInvite', matchId: match.id, playerId: me.id })
            nav('/')
          }}
        >
          Cancel match
        </button>
      )}

      <ShareSheet match={match} open={showShare} onClose={() => setShowShare(false)} />

      <Sheet
        open={showDispute}
        onClose={() => setShowDispute(false)}
        title="Dispute the result"
        subtitle="Say what you believe the score was. An organiser reviews it against the timeline."
      >
        <textarea
          className="input"
          rows={3}
          placeholder="e.g. The second game was 21–18, not 21–16."
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
        <button
          className="btn btn--primary btn--block mt-16"
          disabled={!claim.trim()}
          onClick={() => {
            dispatch({ type: 'disputeResult', matchId: match.id, playerId: me.id, claim: claim.trim() })
            setShowDispute(false)
            setClaim('')
            toast('Dispute raised')
          }}
        >
          Raise dispute
        </button>
      </Sheet>
    </div>
  )
}

const Detail = ({ k, v, onClick }: { k: string; v: string; onClick?: () => void }) => (
  <div className="row-between" style={{ padding: '9px 0' }} onClick={onClick}>
    <span className="micro">{k}</span>
    <span className="small" style={{ textAlign: 'right', color: onClick ? 'var(--neon)' : undefined }}>
      {v}
    </span>
  </div>
)

/** Broadcast-style boxscore: one row per team, one column per game. */
export function Scorecard({ match }: { match: Match }) {
  const { playerById } = useApp()
  const s = computeState(match)
  const games = gamesList(s)
  const cols = Math.max(games.length, 1)

  const Team = ({ side }: { side: Side }) => {
    const ids = side === 'A' ? match.teamA : match.teamB
    const isWinner = s.winner === side
    return (
      <div className={`scorecard__team${isWinner ? ' scorecard__team--winner' : ''}`}>
        <div className="scorecard__team-name">
          {ids.map((pid) => (
            <Avatar key={pid} player={playerById(pid)} size="xs" />
          ))}
          <span className="truncate">{teamName(ids, playerById)}</span>
          {isWinner && <span>🏆</span>}
        </div>
        {games.map((g, i) => {
          const v = side === 'A' ? g.a : g.b
          const o = side === 'A' ? g.b : g.a
          return (
            <span key={i} className={`scorecard__g${v > o ? ' scorecard__g--won' : ''}`}>
              {v}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <div className="scorecard" style={{ ['--games' as string]: cols }}>
      <div className="scorecard__head">
        <span>{match.type}</span>
        {games.map((_, i) => (
          <span key={i}>G{i + 1}</span>
        ))}
      </div>
      <Team side="A" />
      <Team side="B" />
    </div>
  )
}
