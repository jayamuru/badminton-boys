import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { computeState, timeline } from '../engine/scoring'
import type { Court, Match, Side } from '../types'
import { firstName, teamName } from '../lib/format'
import { Avatar, Sheet, useToast } from '../components/ui'
import { ShareSheet } from '../components/ShareSheet'

/**
 * The court-side screen.
 *
 * Design rules, in priority order:
 *  1. One tap adds a point. The tap target is half the screen.
 *  2. Undo is always one tap away and never behind a menu.
 *  3. Nothing on screen that doesn't help you score — no clock, no chrome.
 *  4. Score legible from the far tramline.
 */
export function Scoring() {
  const { id } = useParams<{ id: string }>()
  const { state, dispatch, playerById } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [showTimeline, setShowTimeline] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showExit, setShowExit] = useState(false)

  const match = state.matches.find((m) => m.id === id)
  const s = useMemo(() => (match ? computeState(match) : null), [match])

  // Keep the screen awake — a phone locking mid-rally is the classic failure.
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null
    const nav2 = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof sentinel> } }
    nav2.wakeLock
      ?.request('screen')
      .then((s2) => {
        sentinel = s2
      })
      .catch(() => {
        /* unsupported or denied — harmless */
      })
    return () => {
      sentinel?.release().catch(() => {})
    }
  }, [])

  const prev = useRef({ a: 0, b: 0 })
  useEffect(() => {
    if (s) prev.current = { a: s.current.a, b: s.current.b }
  }, [s])

  if (!match || !s) {
    return (
      <div className="page">
        <p className="mt-32 center dim">Match not found.</p>
      </div>
    )
  }

  const finished = s.finished || match.status === 'awaiting_confirmation'
  const point = (side: Side) => {
    if (finished) return
    if (navigator.vibrate) navigator.vibrate(12)
    dispatch({ type: 'point', matchId: match.id, side })
  }

  const undo = () => {
    if (!match.rallies.length) return
    if (navigator.vibrate) navigator.vibrate([8, 40, 8])
    dispatch({ type: 'undo', matchId: match.id })
    toast('Last point undone')
  }

  // `endsSwapped` only flips the on-screen layout — it never touches the score.
  const leftSide: Side = match.endsSwapped ? 'B' : 'A'
  const rightSide: Side = match.endsSwapped ? 'A' : 'B'

  const scoreOf = (side: Side) => (side === 'A' ? s.current.a : s.current.b)
  const idsOf = (side: Side) => (side === 'A' ? match.teamA : match.teamB)

  const games = s.finished ? s.completed : [...s.completed, s.current]

  const Zone = ({ side, pos }: { side: Side; pos: 'a' | 'b' }) => {
    const ids = idsOf(side)
    const players = ids.map(playerById)
    const score = scoreOf(side)
    const opp = scoreOf(side === 'A' ? 'B' : 'A')
    const serving = s.serve.side === side
    const serverId = ids[s.serve.serverIndex] ?? ids[0]

    return (
      <button
        className={`zone zone--${pos}${serving ? ' zone--serving' : ''}${score > opp ? ' zone--lead' : ''}`}
        style={{ ['--tint' as string]: players[0]?.tint }}
        onClick={() => point(side)}
        aria-label={`Point to ${teamName(ids, playerById)}`}
        disabled={finished}
      >
        <div className="zone__names">
          {players.map((p) => (
            <span key={p.id} className="row gap-6">
              <Avatar player={p} size="xs" />
              {firstName(p)}
            </span>
          ))}
        </div>

        <div className={`zone__score${score !== 0 ? ' score-pop' : ''}`} key={`${side}-${score}`}>
          {score}
        </div>

        {serving ? (
          <div className="row gap-8">
            <span className="serve-badge">
              
              {match.type === 'Doubles' ? firstName(playerById(serverId)) : 'Serving'}
            </span>
            <MiniCourt court={s.serve.court} />
          </div>
        ) : (
          <span className="zone__hint">Receiving</span>
        )}
      </button>
    )
  }

  const banner = s.matchPoint
    ? { text: `Match point — ${teamName(idsOf(s.matchPoint), playerById)}`, game: false }
    : s.gamePoint
      ? { text: `Game point — ${teamName(idsOf(s.gamePoint), playerById)}`, game: true }
      : null

  return (
    <div className="scoring">
      <div className="scoring__top">
        <button className="icon-btn" onClick={() => setShowExit(true)} aria-label="Exit scoring">
          ✕
        </button>
        <div className="scoring__games grow">
          <span className="live-pill">
            <i className="live-dot" />
            {match.court ?? 'Live'}
          </span>
          {games.map((g, i) => {
            const done = i < s.completed.length
            const won = g.winner
            return (
              <span
                key={i}
                className={`gamechip${done ? (won === 'A' ? ' gamechip--won' : ' gamechip--lost') : ' gamechip--now'}`}
              >
                {g.a}-{g.b}
              </span>
            )
          })}
        </div>
        <button className="text-btn" onClick={() => setShowShare(true)} aria-label="Share live match">
          Share
        </button>
      </div>

      {banner && (
        <div className={`matchpoint${banner.game ? ' matchpoint--game' : ''}`}>{banner.text}</div>
      )}
      {!banner && s.changeEnds && <div className="interval-banner">Change ends · deciding game</div>}
      {!banner && !s.changeEnds && s.atInterval && (
        <div className="interval-banner">60 second interval</div>
      )}

      <div className="zones">
        <Zone side={leftSide} pos="a" />

        <div className="scoring__mid">
          <button
            className="mini-btn mini-btn--undo"
            onClick={undo}
            disabled={!match.rallies.length}
            aria-label="Undo last point"
          >
            ↩ Undo
          </button>
          <button
            className="mini-btn"
            onClick={() => {
              dispatch({ type: 'swapEnds', matchId: match.id })
              toast('Ends swapped')
            }}
          >
            ⇄ Swap ends
          </button>
          <button className="mini-btn" onClick={() => setShowTimeline(true)}>
            {match.rallies.length} rallies
          </button>
        </div>

        <Zone side={rightSide} pos="b" />
      </div>

      {finished ? (
        <div className="scoring__bottom" style={{ gridTemplateColumns: '1fr' }}>
          <button className="btn btn--primary btn--lg" onClick={() => nav(`/match/${match.id}`)}>
            Confirm result →
          </button>
        </div>
      ) : (
        <div className="scoring__bottom">
          {[leftSide, rightSide].map((side) => (
            <button
              key={side}
              className={`plus${s.matchPoint === side ? ' plus--match' : ''}`}
              onClick={() => point(side)}
            >
              <span className="plus__label">{teamName(idsOf(side), playerById)}</span>
              <span className="plus__plus">+1</span>
            </button>
          ))}
        </div>
      )}

      <Sheet open={showTimeline} onClose={() => setShowTimeline(false)} title="Score timeline">
        <TimelineList match={match} />
      </Sheet>

      <ShareSheet match={match} open={showShare} onClose={() => setShowShare(false)} />

      <Sheet
        open={showExit}
        onClose={() => setShowExit(false)}
        title="Leave scoring?"
        subtitle="The match stays live and the score is saved. You can come back any time."
      >
        <div className="stack">
          <button className="btn btn--block" onClick={() => nav(`/match/${match.id}`)}>
            Leave — keep match live
          </button>
          <button className="btn btn--ghost btn--block" onClick={() => setShowExit(false)}>
            Keep scoring
          </button>
        </div>
      </Sheet>
    </div>
  )
}

function MiniCourt({ court }: { court: Court }) {
  return (
    <span className="mini-court" aria-label={`Serving from the ${court === 'R' ? 'right' : 'left'} court`}>
      <span className={`mini-court__box${court === 'L' ? ' mini-court__box--on' : ''}`} />
      <span className={`mini-court__box${court === 'R' ? ' mini-court__box--on' : ''}`} />
    </span>
  )
}

export function TimelineList({ match, limit }: { match: Match; limit?: number }) {
  const { playerById } = useApp()
  const rows = timeline(match)
  const shown = limit ? rows.slice(0, limit) : rows

  /*
   * The list scrolls past six or so rallies, and a row sliced through the middle
   * of its text reads as a rendering fault. `.timeline--more` fades the bottom
   * edge to say "there's more below" — but only when there actually is, or a
   * three-point match would have its last row dimmed for no reason.
   */
  const listRef = useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = useState(false)
  useEffect(() => {
    const el = listRef.current
    if (el) setScrolls(el.scrollHeight > el.clientHeight + 1)
  }, [shown.length])

  if (!shown.length) return <p className="small dim center mt-16">No points yet.</p>
  return (
    <div className={`timeline${scrolls ? ' timeline--more' : ''}`} ref={listRef}>
      {shown.map((r, i) => (
        <div className="tl-row" key={i}>
          <span className="tl-row__score">
            {r.a}–{r.b}
          </span>
          <span className="tl-row__who truncate">
            {teamName(r.by === 'A' ? match.teamA : match.teamB, playerById)}
          </span>
          {r.tag && (
            <span
              className={`tl-row__tag${r.tag === 'GAME' ? ' tl-row__tag--game' : ''}${
                r.tag === 'MATCH' ? ' tl-row__tag--match' : ''
              }`}
            >
              {r.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
