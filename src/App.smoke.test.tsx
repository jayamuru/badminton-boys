import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import App from './App'
import { buildSeed, ME } from './data/seed'

/**
 * Every screen gets mounted once. This is a crash test, not a snapshot test —
 * it catches the class of bug you only find by actually running the app
 * (bad destructures, missing params, undefined lookups) without a browser.
 */

const seed = buildSeed()

// jsdom has no layout engine; the app's scroll reset is a no-op here.
window.scrollTo = () => {}

function seedStorage(onboarded = true) {
  localStorage.setItem(
    'badminton-boys:v1',
    JSON.stringify({
      ...seed,
      follows: ['p1', 'p2'],
      session: { playerId: ME, onboarded },
      celebrate: null,
    }),
  )
}

const liveMatch = seed.matches.find((m) => m.status === 'live')!
const doneMatch = seed.matches.find((m) => m.status === 'completed')!

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
  `/club/${seed.clubs[0].id}`,
  `/tournament/${seed.tournaments[0].id}`,
  `/player/p3`,
  `/h2h/${ME}/p3`,
  `/match/${doneMatch.id}`,
  `/match/${liveMatch.id}`,
  `/score/${liveMatch.id}`,
  `/watch/${liveMatch.id}`,
]

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it.each(ROUTES)('renders %s without crashing', (route) => {
  seedStorage()
  window.location.hash = `#${route}`
  const { container } = render(<App />)
  expect(container.querySelector('.shell')?.textContent?.trim().length ?? 0).toBeGreaterThan(0)
})

it('sends a brand-new user to onboarding', () => {
  seedStorage(false)
  window.location.hash = '#/'
  render(<App />)
  expect(screen.getByText(/PLAY · SCORE · COMPETE · CLIMB/)).toBeTruthy()
})

it('lets a spectator open a shared link without onboarding', () => {
  seedStorage(false)
  window.location.hash = `#/watch/${liveMatch.id}`
  const { container } = render(<App />)
  expect(container.querySelector('.tabbar')).toBeNull()
  // The pill reads "Live" in the DOM and renders uppercase via CSS.
  expect(container.textContent).toContain('Live')
  expect(container.textContent).toContain('only the scorer can change the score')
})
