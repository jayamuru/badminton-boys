import { useNavigate } from 'react-router-dom'
import type { Match, Side } from '../types'
import { useApp } from '../store/AppStore'
import { computeState, gamesList } from '../engine/scoring'
import { clock, countdown, dayLabel, relative, signed, teamName } from '../lib/format'
import { AvatarStack, LivePill } from './ui'

/** A game is "on a knife edge" when it's tight and late — worth surfacing. */
export function isTight(m: Match): boolean {
  const s = computeState(m)
  if (s.finished) return false
  const { a, b } = s.current
  const top = Math.max(a, b)
  return top >= 15 && Math.abs(a - b) <= 2
}

/* --- live ----------------------------------------------------------------- */

export function LiveMatchCard({ match }: { match: Match }) {
  const { playerById } = useApp()
  const nav = useNavigate()
  const s = computeState(match)
  const tight = isTight(match)
  const teamA = match.teamA.map(playerById)
  const teamB = match.teamB.map(playerById)

  const Row = ({ side }: { side: Side }) => {
    const ids = side === 'A' ? match.teamA : match.teamB
    const score = side === 'A' ? s.current.a : s.current.b
    const opp = side === 'A' ? s.current.b : s.current.a
    const serving = s.serve.side === side
    return (
      <div className={`mrow${score > opp ? ' mrow--lead' : ''}${score < opp ? ' mrow--dim' : ''}`}>
        <AvatarStack players={side === 'A' ? teamA : teamB} size="xs" />
        <span className="mrow__names truncate grow">{teamName(ids, playerById)}</span>
        <i
          className={`mrow__serve${serving ? '' : ' mrow__serve--off'}`}
          aria-label={serving ? 'Serving' : undefined}
        />
        <span className="mrow__score">{score}</span>
      </div>
    )
  }

  return (
    <button
      className={`card card--live card--tap${tight ? ' card--tight' : ''}`}
      onClick={() => nav(`/match/${match.id}`)}
    >
      <div className="card__strip">
        <LivePill />
        <span className="court-tag">{match.court ?? 'Court'}</span>
        <span className="grow" />
        {tight && <span className="pill pill--gold">Knife edge</span>}
        {match.round && <span className="pill">{match.round}</span>}
      </div>

      <Row side="A" />
      <Row side="B" />

      <div className="card__foot">
        <span>GAME {s.gameIndex + 1}</span>
        {s.completed.length > 0 && <span>· {s.completed.map((g) => `${g.a}-${g.b}`).join('  ')}</span>}
        <span className="grow" />
        <span>{match.reactions.fire} reactions</span>
        <span>Watch →</span>
      </div>
    </button>
  )
}

/* --- completed ------------------------------------------------------------ */

export function ResultCard({ match, perspectiveId }: { match: Match; perspectiveId?: string }) {
  const { playerById } = useApp()
  const nav = useNavigate()
  const s = computeState(match)
  const games = gamesList(s)
  const mySide: Side | null = perspectiveId
    ? match.teamA.includes(perspectiveId)
      ? 'A'
      : match.teamB.includes(perspectiveId)
        ? 'B'
        : null
    : null
  const won = mySide ? s.winner === mySide : null
  const delta = perspectiveId ? match.ratingDelta?.[perspectiveId] : undefined

  const Row = ({ side }: { side: Side }) => {
    const ids = side === 'A' ? match.teamA : match.teamB
    const isWinner = s.winner === side
    return (
      <div className={`mrow${isWinner ? '' : ' mrow--dim'}`}>
        <AvatarStack players={ids.map(playerById)} size="xs" />
        <span className="mrow__names truncate grow">{teamName(ids, playerById)}</span>
        <span className="games">
          {games.map((g, i) => {
            const v = side === 'A' ? g.a : g.b
            const other = side === 'A' ? g.b : g.a
            return (
              <span key={i} className={`games__g${v > other ? ' games__g--won' : ''}`}>
                {v}
              </span>
            )
          })}
        </span>
      </div>
    )
  }

  return (
    <button className="card card--tap" onClick={() => nav(`/match/${match.id}`)}>
      <div className="card__strip">
        {won === null ? (
          <span className="pill">{match.type}</span>
        ) : (
          <span className={`pill ${won ? 'pill--win' : 'pill--loss'}`}>{won ? 'Won' : 'Lost'}</span>
        )}
        <span className="court-tag">
          {match.completedAt ? relative(match.completedAt) : dayLabel(match.scheduledAt)}
        </span>
        <span className="grow" />
        {!match.competitive && <span className="pill">Casual</span>}
        {delta !== undefined && delta !== 0 && (
          <span className={`pill ${delta > 0 ? 'pill--win' : 'pill--loss'}`}>{signed(delta)}</span>
        )}
      </div>
      <Row side="A" />
      <Row side="B" />
    </button>
  )
}

/* --- upcoming ------------------------------------------------------------- */

export function UpcomingCard({ match }: { match: Match }) {
  const { playerById } = useApp()
  const nav = useNavigate()
  return (
    <button className="card card--tap" onClick={() => nav(`/match/${match.id}`)}>
      <div className="card__strip">
        <span className="pill">{dayLabel(match.scheduledAt)}</span>
        <span className="court-tag">{clock(match.scheduledAt)}</span>
        <span className="grow" />
        <span className="court-tag">{match.court}</span>
      </div>
      <div className="mrow">
        <AvatarStack players={match.teamA.map(playerById)} size="xs" />
        <span className="mrow__names truncate grow">{teamName(match.teamA, playerById)}</span>
      </div>
      <div className="mrow">
        <AvatarStack players={match.teamB.map(playerById)} size="xs" />
        <span className="mrow__names truncate grow">{teamName(match.teamB, playerById)}</span>
      </div>
      <div className="card__foot">
        <span>Best of {match.format.bestOf}</span>
        <span>· {match.competitive ? 'Competitive' : 'Casual'}</span>
        <span className="grow" />
        <span>in {countdown(match.scheduledAt)}</span>
      </div>
    </button>
  )
}

/* --- hero: your next match ------------------------------------------------ */

export function NextMatchHero({ match }: { match: Match }) {
  const { playerById } = useApp()
  const nav = useNavigate()
  const teamA = match.teamA.map(playerById)
  const teamB = match.teamB.map(playerById)

  return (
    <div className="next">
      <div className="court-lines" />
      <div className="next__when">
        <span>{dayLabel(match.scheduledAt)}</span>
        <span className="dim">·</span>
        <span>{clock(match.scheduledAt)}</span>
        <span className="grow" />
        <span className="pill pill--neon">{match.court}</span>
      </div>

      <div className="next__vs">
        <div className="next__side">
          <AvatarStack players={teamA} size="md" />
          <div className="next__side-name">{teamName(match.teamA, playerById)}</div>
        </div>
        <div className="next__divider">VS</div>
        <div className="next__side">
          <AvatarStack players={teamB} size="md" />
          <div className="next__side-name">{teamName(match.teamB, playerById)}</div>
        </div>
      </div>

      <div className="next__countdown">
        
        <span>Starts in {countdown(match.scheduledAt)}</span>
      </div>

      <div className="row gap-8">
        <button className="btn btn--primary grow" onClick={() => nav(`/score/${match.id}`)}>
          Start scoring
        </button>
        <button className="btn grow" onClick={() => nav(`/match/${match.id}`)}>
          Details
        </button>
      </div>
    </div>
  )
}
