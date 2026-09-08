import { afterEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import App from '../App'
import { buildSeed, ME } from '../data/seed'
import { computeState } from '../engine/scoring'

/** The core loop: tap a half, the score moves; undo, it moves back. */

window.scrollTo = () => {}

const seed = buildSeed()

/**
 * A live match with room left in the current game.
 *
 * Not just the first live one: if the seed happens to leave that match on game
 * point, the tap below finishes the game and `current` rolls over to the next
 * one at 0–0, so asserting `a + 1` fails for a reason that has nothing to do
 * with the behaviour under test.
 */
const live = seed.matches.find((m) => {
  if (m.status !== 'live') return false
  const { a, b } = computeState(m).current
  return a < 19 && b < 19
})!
const before = computeState(live).current

function boot() {
  localStorage.setItem(
    'badminton-boys:v1',
    JSON.stringify({
      ...seed,
      follows: [],
      session: { playerId: ME, onboarded: true },
      celebrate: null,
    }),
  )
  window.location.hash = `#/score/${live.id}`
  return render(<App />)
}

const stored = () => {
  const s = JSON.parse(localStorage.getItem('badminton-boys:v1')!)
  return computeState(s.matches.find((m: { id: string }) => m.id === live.id)).current
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('awards a point when a tap zone is pressed, and takes it back on undo', () => {
  boot()

  const zones = screen.getAllByRole('button', { name: /^Point to / })
  expect(zones).toHaveLength(2)

  act(() => {
    fireEvent.click(zones[0])
  })
  expect(stored().a).toBe(before.a + 1)

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: 'Undo last point' }))
  })
  expect(stored()).toEqual(before)
})

it('flips the left/right layout without touching the score', () => {
  boot()
  const namesBefore = screen.getAllByRole('button', { name: /^Point to / }).map((b) => b.getAttribute('aria-label'))

  act(() => {
    fireEvent.click(screen.getByRole('button', { name: /Swap ends/i }))
  })

  const namesAfter = screen.getAllByRole('button', { name: /^Point to / }).map((b) => b.getAttribute('aria-label'))
  expect(namesAfter).toEqual([namesBefore[1], namesBefore[0]])
  expect(stored()).toEqual(before)
})
