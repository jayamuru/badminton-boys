import { afterEach, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import App from './App'
import type { Player } from './types'

/**
 * The state you're left in after "clear demo data": one player, no matches, no
 * clubs. Every screen has to survive it — this is where index-into-empty-array
 * bugs live.
 */

window.scrollTo = () => {}

const you: Player = {
  id: 'me',
  name: 'You',
  handle: 'you',
  emoji: '🏸',
  tint: '#C8FF2E',
  level: 'Intermediate',
  rating: 1000,
  city: '',
  prefers: 'Both',
  role: 'organizer',
  joinedAt: Date.now(),
}

const ROUTES = [
  '/',
  '/live',
  '/play',
  '/create',
  '/leaderboard',
  '/profile',
  '/players',
  '/clubs',
  '/notifications',
  '/player/me',
  '/h2h/me',
  '/match/nope',
  '/score/nope',
  '/watch/nope',
  '/club/nope',
  '/tournament/nope',
]

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it.each(ROUTES)('renders %s with no data at all', (route) => {
  localStorage.setItem(
    'badminton-boys:v1',
    JSON.stringify({
      players: [you],
      matches: [],
      clubs: [],
      tournaments: [],
      challenges: [],
      notifications: [],
      follows: [],
      session: { playerId: 'me', onboarded: true, demo: false },
      celebrate: null,
    }),
  )
  window.location.hash = `#${route}`
  const { container } = render(<App />)
  expect((container.querySelector('.shell')?.textContent ?? '').trim().length).toBeGreaterThan(0)
})
