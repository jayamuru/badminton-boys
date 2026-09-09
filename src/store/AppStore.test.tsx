import { afterEach, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { AppProvider, useApp } from './AppStore'
import { uid } from '../lib/format'
import type { Player } from '../types'

/** Clearing the demo has to survive a reload — that's the whole point of it. */

let api: ReturnType<typeof useApp>

function Probe() {
  api = useApp()
  return null
}

const mount = () => render(<AppProvider><Probe /></AppProvider>)

afterEach(() => {
  cleanup()
  localStorage.clear()
})

it('clears the demo season down to just you, and it stays cleared', () => {
  mount()
  expect(api.state.players.length).toBeGreaterThan(10)
  expect(api.state.matches.length).toBeGreaterThan(10)
  const meBefore = api.me

  act(() => api.dispatch({ type: 'clearAll' }))

  expect(api.state.players).toHaveLength(1)
  expect(api.state.players[0].id).toBe(meBefore.id)
  expect(api.state.matches).toEqual([])
  expect(api.state.clubs).toEqual([])
  expect(api.state.tournaments).toEqual([])
  expect(api.state.notifications).toEqual([])
  expect(api.state.session.demo).toBe(false)
  expect(api.state.session.onboarded).toBe(true)

  // Reload from localStorage: the demo must not come back.
  cleanup()
  mount()
  expect(api.state.players).toHaveLength(1)
  expect(api.state.matches).toEqual([])
})

it('adds a player to your own roster', () => {
  mount()
  act(() => api.dispatch({ type: 'clearAll' }))

  const p: Player = {
    id: uid('p'),
    name: 'Rahul Menon',
    handle: 'rahulmenon',
    tint: '#C8FF2E',
    level: 'Advanced',
    rating: 1120,
    city: '',
    prefers: 'Both',
    role: 'player',
    joinedAt: Date.now(),
  }
  act(() => api.dispatch({ type: 'addPlayer', player: p }))

  expect(api.state.players).toHaveLength(2)
  expect(api.playerById(p.id).name).toBe('Rahul Menon')
  // Adding somebody must not hijack the session.
  expect(api.state.session.playerId).not.toBe(p.id)
})

it('reloads the demo season on demand', () => {
  mount()
  act(() => api.dispatch({ type: 'clearAll' }))
  expect(api.state.matches).toEqual([])

  act(() => api.dispatch({ type: 'reset' }))
  expect(api.state.players.length).toBeGreaterThan(10)
  expect(api.state.session.demo).toBe(true)
})
