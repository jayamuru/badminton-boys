import { useEffect } from 'react'
import { useApp } from '../store/AppStore'
import { computeState, gamesList } from '../engine/scoring'
import { teamName } from '../lib/format'

/**
 * Shown the instant a match is decided. Deliberately restrained: one word, the
 * winner, the scoreline, one sweep of light. No confetti, no cartoon sounds —
 * this has to look right on a club's tournament screen.
 */
export function Celebration() {
  const { state, dispatch, playerById } = useApp()
  const celebrate = state.celebrate
  const match = celebrate ? state.matches.find((m) => m.id === celebrate.matchId) : null

  useEffect(() => {
    if (!celebrate) return
    if (navigator.vibrate) navigator.vibrate([18, 60, 18, 60, 40])
    const t = setTimeout(() => dispatch({ type: 'dismissCelebration' }), 4200)
    return () => clearTimeout(t)
  }, [celebrate, dispatch])

  if (!celebrate || !match) return null
  const s = computeState(match)
  if (!s.winner) return null

  const winners = s.winner === 'A' ? match.teamA : match.teamB
  const games = gamesList(s)

  return (
    <div className="celebrate" onClick={() => dispatch({ type: 'dismissCelebration' })}>
      {/* The trophy emoji that used to sit here said nothing the word doesn't.
          "WINNER" also makes the old "WINS" line below the name redundant. */}
      <span className="celebrate__trophy">WINNER</span>
      <div className="celebrate__winner">{teamName(winners, playerById, true).toUpperCase()}</div>
      <div className="celebrate__line num mt-12">
        {/* A run of spaces collapses to one in HTML, which ran the games together. */}
        {games.map((g) => `${g.a}–${g.b}`).join(' · ')}
      </div>
      <p className="small dim mt-24">Tap to continue</p>
    </div>
  )
}
