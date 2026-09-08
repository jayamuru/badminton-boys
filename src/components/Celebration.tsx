import { useEffect } from 'react'
import { useApp } from '../store/AppStore'
import { computeState, gamesList } from '../engine/scoring'
import { teamName } from '../lib/format'

/**
 * Shown the instant a match is decided. Deliberately restrained: a trophy, the
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
      <span className="celebrate__trophy">🏆</span>
      <div className="celebrate__winner">{teamName(winners, playerById, true).toUpperCase()}</div>
      <div className="micro" style={{ letterSpacing: '0.3em' }}>
        WINS
      </div>
      <div className="celebrate__line num mt-12">
        {games.map((g) => `${g.a}–${g.b}`).join('   ')}
      </div>
      <p className="small dim mt-24">Tap to continue</p>
    </div>
  )
}
