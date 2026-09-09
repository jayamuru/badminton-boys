import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppStore'

/**
 * Words, not pictograms. Five destinations is few enough that the label alone
 * is unambiguous, and a set-in-Khand word bar reads faster than a row of emoji
 * that render differently on every handset. Play keeps its "+" because it's an
 * action rather than a place.
 */
const TABS = [
  { to: '/', label: 'Home', end: true },
  { to: '/live', label: 'Live', end: false },
  { to: '/play', label: 'Play', end: false, play: true },
  { to: '/leaderboard', label: 'Ranks', end: false },
  { to: '/profile', label: 'You', end: false },
]

/** Hide the bar on immersive screens (scoring, spectate, onboarding). */
const HIDDEN = [/^\/score\//, /^\/watch\//, /^\/welcome/, /^\/register/]

export function TabBar() {
  const { state, cloud } = useApp()
  const { pathname } = useLocation()
  if (HIDDEN.some((r) => r.test(pathname))) return null
  // Nothing to navigate to until you're signed in and in the community.
  if (cloud.enabled && (cloud.status !== 'ready' || cloud.spectator)) return null

  const liveCount = state.matches.filter((m) => m.status === 'live').length

  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `tab${isActive ? ' tab--active' : ''}${t.play ? ' tab--play' : ''}`
          }
        >
          {t.play && <span className="tab__plus">+</span>}
          <span className="tab__label">{t.label}</span>
          {t.to === '/live' && liveCount > 0 && <span className="tab__badge" />}
        </NavLink>
      ))}
    </nav>
  )
}
