import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import type { GameType, Level, Player } from '../types'
import { uid } from '../lib/format'
import { AVATAR_TINTS } from '../lib/tints'
import { TintPicker, useToast } from '../components/ui'
import { Logo } from '../components/Logo'
import { createProfile } from '../backend/api'

/**
 * `photo` names a class in screens.css rather than an imported URL, so the
 * three shuttlecock shots are declared once in CSS and shared with the empty
 * states and the sign-in screen instead of being bundled per slide.
 */
const SLIDES = [
  {
    photo: null,
    title: 'Welcome to\nBadminton Boys',
    body: 'Play. Score. Compete. Climb.',
    brand: true,
  },
  {
    photo: 'band',
    title: 'Track your\nmatches',
    body: 'Every match, game and point kept in one place — with a scorecard you can pull up months later.',
  },
  {
    photo: 'mesh',
    title: 'Climb the\nleaderboard',
    body: 'A real rating that moves with every competitive match. See where you sit in your club, your city and beyond.',
  },
  {
    photo: 'feather',
    title: 'Watch live\nmatches',
    body: "Follow any match point by point, even the ones you're not playing in. Share a link and friends can watch too.",
  },
  {
    photo: 'band',
    title: 'Find your\ncommunity',
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
          <div className={`onb__photo onb__photo--${slide.photo}`} role="presentation" />
          <div className="onb__copy">
            <span className="onb__step num">
              {String(i).padStart(2, '0')} / {String(SLIDES.length - 1).padStart(2, '0')}
            </span>
            <h1 className="onb__title" style={{ whiteSpace: 'pre-line' }}>
              {slide.title}
            </h1>
            <p className="onb__body">{slide.body}</p>
          </div>
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

export function Register() {
  const { state, me, dispatch, cloud } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState(me?.name ?? '')
  const [tint, setTint] = useState<string>(me?.tint ?? AVATAR_TINTS[0])
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
      tint,
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
        toast('Welcome to Badminton Boys')
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
    toast('Welcome to Badminton Boys')
    nav('/')
  }

  const newAccount = cloud.enabled && cloud.status === 'needs_profile'

  return (
    <div className="onb" style={{ overflowY: 'auto' }}>
      <div>
        <h1 className="onb__title">Set up your player card</h1>
        <p className="onb__body">This is what other players see on the leaderboard.</p>
      </div>

      {newAccount && (
        <div className="card mt-16">
          <p className="small">
            {cloud.identity?.anonymous ? (
              <>
                You're browsing as a <strong>guest</strong>. A guest is a brand new account
                every time, so anything you set up here won't be waiting for you next time.
              </>
            ) : (
              <>
                You're signed in as <strong>{cloud.identity?.email ?? 'a new account'}</strong>,
                and that address doesn't have a player card yet.
              </>
            )}
          </p>
          <p className="small dim mt-8">
            If you've played here before, you used a different address or the guest button —
            sign out and come back with the same email as last time rather than making a
            second card.
          </p>
          <button className="btn btn--block mt-12" onClick={() => void cloud.signOut()}>
            Sign out and try another email
          </button>
        </div>
      )}

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
          <span className="field__label">Avatar colour</span>
          <TintPicker value={tint} onChange={setTint} name={name} />
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
        {saving ? 'Creating your profile…' : 'Start playing'}
      </button>
      <p className="micro center mt-12">You start at a 1,000 rating. Ten matches sets your true level.</p>
    </div>
  )
}
