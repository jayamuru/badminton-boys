import { useState } from 'react'
import { useApp } from '../store/AppStore'
import type { Level, Player } from '../types'
import { uid } from '../lib/format'
import { Sheet, useToast } from './ui'

const EMOJIS = ['🦅', '🐅', '🐺', '⚡', '🦊', '🐋', '🦁', '🐻', '🦈', '🐬', '🦉', '🐘', '🦋', '🌸', '🔥', '🌊', '🚀', '🎯']
const TINTS = ['#C8FF2E', '#5AC8FA', '#FF6B9D', '#FFC83D', '#8B7CFF', '#2BE08A']
const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced', 'Competitive']

/** Starting ratings, so a new roster isn't dead flat on day one. */
const SEED_RATING: Record<Level, number> = {
  Beginner: 900,
  Intermediate: 1000,
  Advanced: 1120,
  Competitive: 1220,
}

/**
 * Add someone you actually play with. This is what makes the app usable once
 * the demo season has been cleared out.
 */
export function AddPlayerSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded?: (player: Player) => void
}) {
  const { state, me, dispatch } = useApp()
  const toast = useToast()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [level, setLevel] = useState<Level>('Intermediate')

  const reset = () => {
    setName('')
    setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])
    setLevel('Intermediate')
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const base = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'player'
    const taken = new Set(state.players.map((p) => p.handle))
    let handle = base
    let n = 2
    while (taken.has(handle)) handle = `${base}${n++}`

    const player: Player = {
      id: uid('p'),
      name: trimmed,
      handle,
      emoji,
      tint: TINTS[EMOJIS.indexOf(emoji) % TINTS.length],
      level,
      rating: SEED_RATING[level],
      city: me?.city ?? '',
      clubId: me?.clubId,
      prefers: 'Both',
      role: 'player',
      joinedAt: Date.now(),
    }
    dispatch({ type: 'addPlayer', player })
    toast(`${trimmed} added`)
    onAdded?.(player)
    reset()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a player"
      subtitle="Someone you actually play with. They'll be pickable in every match from now on."
    >
      <div className="stack-lg">
        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="input"
            placeholder="e.g. Rahul Menon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>

        <div className="field">
          <span className="field__label">Avatar</span>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Starting level</span>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            {LEVELS.map((l) => (
              <button
                key={l}
                className="chip"
                aria-pressed={level === l}
                onClick={() => setLevel(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="micro mt-8">
            Sets their starting rating to {SEED_RATING[level]}. Their first ten matches move it fast,
            so a rough guess sorts itself out.
          </p>
        </div>
      </div>

      <button className="btn btn--primary btn--block mt-16" disabled={!name.trim()} onClick={save}>
        Add player
      </button>
    </Sheet>
  )
}
