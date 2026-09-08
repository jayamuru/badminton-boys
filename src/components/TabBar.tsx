import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../store/AppStore'

const TABS = [
  { to: '/', icon: '🏠', label: 'Home', end: true },
  { to: '/live', icon: '📡', label: 'Live', end: false },
  { to: '/play', icon: '+', label: 'Play', end: false, play: true },
  { to: '/leaderboard', icon: '📊', label: 'Ranks', end: false },
  { to: '/profile', icon: '👤', label: 'Profile', end: false },
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
          <span className="tab__icon">{t.icon}</span>
          <span className="tab__label">{t.label}</span>
          {t.to === '/live' && liveCount > 0 && <span className="tab__badge" />}
        </NavLink>
      ))}
    </nav>
  )
}
