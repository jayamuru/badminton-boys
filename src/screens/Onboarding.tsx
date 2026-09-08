import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import type { GameType, Level, Player } from '../types'
import { uid } from '../lib/format'
import { useToast } from '../components/ui'
import { Logo } from '../components/Logo'
import { createProfile } from '../backend/api'

const SLIDES = [
  {
    art: '🏸',
    title: 'Welcome to\nBadminton Boys',
    body: 'Play. Score. Compete. Climb.',
    brand: true,
  },
  {
    art: '📋',
    title: 'Track your matches',
    body: 'Every match, game and point kept in one place — with a scorecard you can pull up months later.',
  },
  {
    art: '📈',
    title: 'Climb the leaderboard',
    body: 'A real rating that moves with every competitive match. See where you sit in your club, your city and beyond.',
  },
  {
    art: '📡',
    title: 'Watch live matches',
    body: "Follow any match point by point, even the ones you're not playing in. Share a link and friends can watch too.",
  },
  {
    art: '🏆',
    title: 'Find your community',
    body: 'Join clubs, challenge players and compete in tournaments with proper brackets.',
  },
]

export function Onboarding() {
  const { dispatch } = useApp()
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const slide = SLIDES[i]
  const last = i === SLIDES.length - 1

  const finish = () => {
    dispatch({ type: 'setOnboarded' })
    nav('/register')
  }

  return (
    <div className="onb">
      {slide.brand ? (
        <div className="onb__art">
          <div className="brand-lockup">
            <Logo size={168} />
            <div className="brand-lockup__tag">PLAY · SCORE · COMPETE · CLIMB</div>
          </div>
        </div>
      ) : (
        <>
          <div className="onb__art">{slide.art}</div>
          <h1 className="onb__title" style={{ whiteSpace: 'pre-line' }}>
            {slide.title}
          </h1>
          <p className="onb__body">{slide.body}</p>
        </>
      )}

      <div className="onb__dots">
        {SLIDES.map((_, n) => (
          <span key={n} className={`onb__dot${n === i ? ' onb__dot--on' : ''}`} />
        ))}
      </div>

      <div className="row gap-8">
        {!last && (
          <button className="btn btn--ghost" onClick={finish}>
            Skip
          </button>
        )}
        <button
          className="btn btn--primary btn--lg grow"
          onClick={() => (last ? finish() : setI(i + 1))}
        >
          {last ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  )
}

const LEVELS: { value: Level; sub: string }[] = [
  { value: 'Beginner', sub: 'Just picked up a racquet' },
  { value: 'Intermediate', sub: 'Play regularly, know the rules' },
  { value: 'Advanced', sub: 'Club-level, competitive rallies' },
  { value: 'Competitive', sub: 'Tournaments and league play' },
]

const EMOJIS = ['🦅', '🐅', '🐺', '⚡', '🦊', '🐋', '🦁', '🐻', '🦈', '🐬', '🦉', '🐘', '🦋', '🌸', '🔥', '🌊', '🚀', '🎯']
const TINTS = ['#C8FF2E', '#5AC8FA', '#FF6B9D', '#FFC83D', '#8B7CFF', '#2BE08A']

export function Register() {
  const { state, me, dispatch, cloud } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState(me?.name ?? '')
  const [emoji, setEmoji] = useState(me?.emoji ?? '🦅')
  const [level, setLevel] = useState<Level>(me?.level ?? 'Intermediate')
  const [prefers, setPrefers] = useState<GameType>(me?.prefers ?? 'Both')
  const [clubId, setClubId] = useState(me?.clubId ?? state.clubs[0]?.id ?? '')
  const [bio, setBio] = useState(me?.bio ?? '')
  const [start, setStart] = useState<'demo' | 'fresh'>('demo')

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const existing = state.players.find((p) => p.id === me?.id)
    const handle = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'player'
    const player: Player = {
      id: existing?.id ?? uid('p'),
      name: trimmed,
      handle,
      emoji,
      tint: TINTS[EMOJIS.indexOf(emoji) % TINTS.length],
      level,
      rating: existing?.rating ?? 1000,
      city: 'Bengaluru',
      clubId: clubId || undefined,
      prefers,
      bio: bio.trim() || undefined,
      role: existing?.role ?? 'player',
      joinedAt: existing?.joinedAt ?? Date.now(),
    }

    // In cloud mode the player card is a real row owned by your login, so it
    // has to be created before anything else can reference it.
    if (cloud.enabled && cloud.status === 'needs_profile') {
      setSaving(true)
      setErr(null)
      try {
        await createProfile({ ...player, id: uid('p') })
        await cloud.refresh()
        toast('Welcome to Badminton Boys 🏸')
        nav('/')
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not create your profile')
      } finally {
        setSaving(false)
      }
      return
    }

    dispatch({ type: 'register', player })
    if (start === 'fresh') {
      dispatch({ type: 'clearAll' })
      toast('Ready — add the players you play with')
      nav('/players')
      return
    }
    toast('Welcome to Badminton Boys 🏸')
    nav('/')
  }

  return (
    <div className="onb" style={{ overflowY: 'auto' }}>
      <div>
        <h1 className="onb__title">Set up your player card</h1>
        <p className="onb__body">This is what other players see on the leaderboard.</p>
      </div>

      <div className="stack-lg mt-24">
        <label className="field">
          <span className="field__label">Your name</span>
          <input
            className="input"
            placeholder="e.g. Jayanth T"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>

        <div className="field">
          <span className="field__label">Pick an avatar</span>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Playing level</span>
          <div className="picker">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                className="picker__item"
                aria-pressed={level === l.value}
                onClick={() => setLevel(l.value)}
              >
                <div className="picker__title">{l.value}</div>
                <div className="picker__sub">{l.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Preferred game</span>
          <div className="picker">
            {(['Singles', 'Doubles', 'Both'] as GameType[]).map((g) => (
              <button
                key={g}
                className="picker__item"
                aria-pressed={prefers === g}
                onClick={() => setPrefers(g)}
              >
                <div className="picker__title">{g}</div>
              </button>
            ))}
          </div>
        </div>

        {state.clubs.length > 0 && (
          <label className="field">
            <span className="field__label">Community</span>
            <select className="input" value={clubId} onChange={(e) => setClubId(e.target.value)}>
              {state.clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="field" hidden={cloud.enabled}>
          <span className="field__label">How do you want to start?</span>
          <div className="picker">
            <button
              className="picker__item"
              aria-pressed={start === 'demo'}
              onClick={() => setStart('demo')}
            >
              <div className="picker__title">Explore a demo season</div>
              <div className="picker__sub">
                24 invented players and a few hundred simulated matches, so every screen has
                something in it. You can clear it any time from Settings.
              </div>
            </button>
            <button
              className="picker__item"
              aria-pressed={start === 'fresh'}
              onClick={() => setStart('fresh')}
            >
              <div className="picker__title">Start empty — real matches only</div>
              <div className="picker__sub">
                Just you. Add the people you actually play with and every stat from there is real.
              </div>
            </button>
          </div>
        </div>

        <label className="field">
          <span className="field__label">Bio (optional)</span>
          <textarea
            className="input"
            rows={2}
            placeholder="Backhand still a work in progress…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
      </div>

      {err && <p className="small mt-16" style={{ color: 'var(--loss)' }}>{err}</p>}

      <button
        className="btn btn--primary btn--lg btn--block mt-24"
        disabled={!name.trim() || saving}
        onClick={() => void save()}
      >
        {saving ? 'Creating your profile…' : 'Start playing 🏸'}
      </button>
      <p className="micro center mt-12">You start at a 1,000 rating. Ten matches sets your true level.</p>
    </div>
  )
}
