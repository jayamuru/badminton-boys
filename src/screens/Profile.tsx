import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { PhotoError, readImageAsDataUrl } from '../lib/photo'
import { leaderboard, partnerships, sideOf, statsFor } from '../engine/stats'
import { achievementsFor } from '../engine/achievements'
import { nextTier, tierFor } from '../engine/rating'
import type { Player } from '../types'
import { dayLabel, firstName, nf, pct, signed } from '../lib/format'
import { Avatar, BackBar, Bar, Empty, FormDots, SectionHead, Segmented, Sheet, Stat, useToast } from '../components/ui'
import { ResultCard } from '../components/MatchCards'

/** Your own profile (tab). */
export function Profile() {
  const { me } = useApp()
  return <PlayerView player={me} isMe />
}

/** Someone else's profile (route). */
export function PlayerProfile() {
  const { id } = useParams<{ id: string }>()
  const { state, me } = useApp()
  const player = state.players.find((p) => p.id === id)
  if (!player) {
    return (
      <div className="page">
        <BackBar title="Player" />
        <Empty title="Player not found" body="This profile no longer exists." />
      </div>
    )
  }
  return <PlayerView player={player} isMe={player.id === me.id} />
}

type Tab = 'overview' | 'matches' | 'badges'

function PlayerView({ player, isMe }: { player: Player; isMe: boolean }) {
  const { state, me, dispatch, playerById, stats: allPlayerStats, cloud } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('overview')
  const [showSettings, setShowSettings] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickPhoto = async (file: File) => {
    try {
      const photo = await readImageAsDataUrl(file)
      dispatch({ type: 'updatePlayer', player: { id: me.id, photo } })
      toast('Photo updated')
    } catch (e) {
      // Every one of these is something the reader can act on — the wrong file,
      // a picture the browser can't decode — so say which, rather than failing
      // silently and leaving the old photo in place with no explanation.
      toast(e instanceof PhotoError ? e.message : "That photo couldn't be used.")
    }
  }

  const removePhoto = () => {
    // Empty string, not undefined: `updatePlayer` merges, so a missing key
    // would leave the old photo exactly where it was.
    dispatch({ type: 'updatePlayer', player: { id: me.id, photo: '' } })
    toast('Photo removed')
  }

  const stats = useMemo(() => statsFor(player.id, state.matches), [player.id, state.matches])
  const cityRank = useMemo(() => {
    const city = state.players.filter((p) => p.city === player.city)
    return leaderboard(city, allPlayerStats, 'rating').findIndex((r) => r.player.id === player.id) + 1
  }, [state.players, allPlayerStats, player.id, player.city])
  const tier = tierFor(player.rating)
  const next = nextTier(player.rating)
  const following = state.follows.includes(player.id)

  const myMatches = useMemo(
    () =>
      state.matches
        .filter((m) => m.status === 'completed' && sideOf(m, player.id))
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [state.matches, player.id],
  )

  const pairs = useMemo(() => partnerships(player.id, state.matches), [player.id, state.matches])
  const badges = useMemo(
    () => achievementsFor(player, stats, state.matches),
    [player, stats, state.matches],
  )
  const unlocked = badges.filter((b) => b.unlocked).length

  // Rank a week ago: replay ratings backwards over the last week's movement.
  const rankLastWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000
    const rewind = (p: Player) => {
      const delta = state.matches
        .filter((m) => m.status === 'completed' && (m.completedAt ?? 0) >= weekAgo)
        .reduce((sum, m) => sum + (m.ratingDelta?.[p.id] ?? 0), 0)
      return { ...p, rating: p.rating - delta }
    }
    const then = state.players.map(rewind).sort((a, b) => b.rating - a.rating)
    return then.findIndex((p) => p.id === player.id) + 1
  }, [state.players, state.matches, player.id])

  const movement = rankLastWeek - cityRank

  const grouped = useMemo(() => {
    const out: { label: string; matches: typeof myMatches }[] = []
    for (const m of myMatches.slice(0, 30)) {
      const label = dayLabel(m.completedAt ?? m.scheduledAt)
      const bucket = out.find((g) => g.label === label)
      if (bucket) bucket.matches.push(m)
      else out.push({ label, matches: [m] })
    }
    return out
  }, [myMatches])

  return (
    <div className="page">
      {isMe ? (
        <header className="topbar topbar--flush">
          <h1 className="h1 grow">Profile</h1>
          <button className="text-btn" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </header>
      ) : (
        <BackBar />
      )}

      <div className="profile-hero">
        {isMe ? (
          <>
            {/*
              Tapping your own avatar is the whole affordance. A separate "Edit
              photo" row would be another thing to find, and the picture is
              already the obvious thing to press.
            */}
            <button
              className="photo-btn"
              onClick={() => fileRef.current?.click()}
              aria-label={player.photo ? 'Change your photo' : 'Add a photo'}
            >
              <Avatar player={player} size="xl" />
              <span className="photo-btn__hint">{player.photo ? 'Change' : 'Add photo'}</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                // Clear it straight away, or picking the same file twice in a
                // row fires no change event and looks like the app ignored you.
                e.target.value = ''
                if (file) void pickPhoto(file)
              }}
            />
            {player.photo && (
              <button className="link link--quiet mt-8" onClick={removePhoto}>
                Remove photo
              </button>
            )}
          </>
        ) : (
          <Avatar player={player} size="xl" />
        )}
        <h1 className="profile-hero__name">{player.name}</h1>
        <p className="small dim mt-4">@{player.handle}</p>
        <div className="profile-hero__meta">
          <span className="pill">{player.level}</span>
          <span className="pill">{player.city}</span>
          {stats.streak > 0 && <span className="pill pill--win">{stats.streak} in a row</span>}
        </div>
        {player.bio && <p className="small muted mt-12">{player.bio}</p>}
      </div>

      {!isMe && (
        <div className="row gap-8 mt-16">
          <button
            className="btn btn--primary grow"
            onClick={() => nav(`/create?mode=challenge&opponent=${player.id}`)}
          >
            Challenge
          </button>
          <button
            className={`btn grow${following ? '' : ' btn--ghost'}`}
            onClick={() => {
              dispatch({ type: 'follow', playerId: player.id })
              toast(following ? `Unfollowed ${firstName(player)}` : `Following ${firstName(player)}`)
            }}
          >
            {following ? 'Following ✓' : 'Follow'}
          </button>
          <button className="btn" onClick={() => nav(`/h2h/${me.id}/${player.id}`)}>
            Head to head
          </button>
        </div>
      )}

      {/* Rating and ranking are different things — keep them visually separate. */}
      <div className="rating-block">
        <div>
          <div className="rating-block__k">Rating</div>
          <div className="rating-block__v num">{nf(player.rating)}</div>
          <div className="micro mt-4" style={{ color: tier.color }}>
            {tier.name}
          </div>
        </div>
        <div className="rating-block__div" />
        <div>
          <div className="rating-block__k">Ranking</div>
          <div className="rating-block__v num">#{cityRank}</div>
          <div className="micro mt-4">{player.city}</div>
        </div>
      </div>

      {next && (
        <div className="mt-12">
          <div className="row-between mb-8">
            <span className="micro">Next tier · {next.name}</span>
            <span className="micro">{next.min - player.rating} to go</span>
          </div>
          <Bar value={(player.rating - tier.min) / (next.min - tier.min)} color={next.color} />
        </div>
      )}

      <div className="mt-16">
        <Segmented
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'matches', label: `Matches ${stats.matches}` },
            { value: 'badges', label: `Badges ${unlocked}` },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'overview' && (
        <>
          <SectionHead title="Current form" />
          <div className="card">
            {stats.form.length ? (
              <>
                <FormDots form={stats.form} />
                <p className="small dim mt-12">
                  Last {stats.form.length} matches · {stats.form.filter(Boolean).length} won
                </p>
              </>
            ) : (
              <p className="small dim">No matches played yet.</p>
            )}
          </div>

          <SectionHead title="Season stats" />
          <div className="stat-grid">
            <Stat value={stats.matches} label="Matches" />
            <Stat value={stats.wins} label="Wins" tone="win" />
            <Stat value={stats.losses} label="Losses" tone="loss" />
          </div>
          <div className="stat-grid mt-8">
            {/* Only won/lost earns a colour here — tinting win rate and best
                streak too put five hues in one nine-cell grid and made none of
                them mean anything. */}
            <Stat value={stats.matches ? pct(stats.winRate, 1) : '—'} label="Win rate" />
            <Stat value={`${stats.gamesWon}/${stats.gamesWon + stats.gamesLost}`} label="Games" />
            <Stat value={stats.bestStreak} label="Best streak" />
          </div>
          <div className="stat-grid mt-8">
            <Stat value={nf(stats.pointsWon)} label="Points won" />
            <Stat value={signed(stats.pointDiff)} label="Point diff" tone={stats.pointDiff >= 0 ? 'win' : 'loss'} />
            <Stat value={stats.matches ? pct(stats.pointRatio, 1) : '—'} label="PDR" />
          </div>

          <SectionHead title="Ranking movement" />
          <div className="card">
            <div className="movement">
              <div className="movement__cell">
                <div className="movement__val dim">#{rankLastWeek}</div>
                <div className="micro mt-4">Last week</div>
              </div>
              <div className={`movement__arrow${movement < 0 ? ' movement__arrow--down' : ''}`}>
                {movement > 0 ? '↑' : movement < 0 ? '↓' : '—'} {Math.abs(movement)}
              </div>
              <div className="movement__cell">
                <div className="movement__val neon">#{cityRank}</div>
                <div className="micro mt-4">Today</div>
              </div>
            </div>
            <p className="micro center">
              {movement > 0
                ? `Up ${movement} ${movement === 1 ? 'position' : 'positions'} this week`
                : movement < 0
                  ? `Down ${Math.abs(movement)} this week — time to book a court`
                  : 'Holding position'}
            </p>
          </div>

          {pairs.length > 0 && (
            <>
              <SectionHead title="Best partnerships" />
              <div className="card">
                {pairs.slice(0, 4).map((p) => {
                  const partner = playerById(p.partnerId)
                  return (
                    <button
                      key={p.partnerId}
                      className="podium-row"
                      style={{ width: '100%', textAlign: 'left' }}
                      onClick={() => nav(`/player/${p.partnerId}`)}
                    >
                      <Avatar player={partner} size="sm" />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="h3 truncate" style={{ display: 'block' }}>
                          {firstName(player)} + {firstName(partner)}
                        </span>
                        <span className="mrow__meta">
                          {p.matches} played · {p.wins}W {p.losses}L
                        </span>
                      </span>
                      {/* Not lime: a 40% partnership rendered in the "tap me"
                          colour reads as a good number and as a control. */}
                      <span className="podium-row__pts">{pct(p.winRate, 0)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <SectionHead title="Recent matches" action="See all" onAction={() => setTab('matches')} />
          <div className="stack">
            {myMatches.slice(0, 3).map((m) => (
              <ResultCard key={m.id} match={m} perspectiveId={player.id} />
            ))}
            {!myMatches.length && (
              <Empty
                title="Your first match starts here"
                body="Create a match and start tracking your badminton journey."
                cta="Create match"
                onCta={() => nav('/create')}
              />
            )}
          </div>
        </>
      )}

      {tab === 'matches' && (
        <div className="mt-8">
          {grouped.map((g) => (
            <div key={g.label}>
              <SectionHead title={g.label} />
              <div className="stack">
                {g.matches.map((m) => (
                  <ResultCard key={m.id} match={m} perspectiveId={player.id} />
                ))}
              </div>
            </div>
          ))}
          {!myMatches.length && (
            <Empty
              title="No matches yet"
              body="Every match played is kept here permanently, with the full scorecard."
              cta="Create match"
              onCta={() => nav('/create')}
            />
          )}
        </div>
      )}

      {tab === 'badges' && (
        <>
          <SectionHead title={`Achievements · ${unlocked}/${badges.length}`} />
          <div className="badges">
            {badges.map((b) => (
              <div key={b.id} className={`badge${b.unlocked ? ' badge--on' : ''}`} title={b.detail}>
                <span className="badge__name">{b.title}</span>
                {!b.unlocked && b.pct > 0 && (
                  <span className="badge__progress" style={{ width: `${b.pct * 100}%` }} />
                )}
              </div>
            ))}
          </div>
          {/* Nothing left to chase once every badge is unlocked — an empty card
              here just reads as a rendering fault. */}
          {unlocked < badges.length && (
            <div className="card mt-16">
              {badges
                .filter((b) => !b.unlocked)
                .slice(0, 3)
                .map((b) => (
                  <div key={b.id} style={{ padding: '8px 0' }}>
                    <div className="row-between mb-8">
                      <span className="small">{b.detail}</span>
                      <span className="micro">{Math.round(b.pct * 100)}%</span>
                    </div>
                    <Bar value={b.pct} />
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title="Settings">
        <div className="stack">
          {cloud.enabled && (
            <div className="card card--flat">
              <p className="micro">Account</p>
              <p className="h3 mt-4">
                {cloud.status === 'ready' ? 'Signed in · synced' : 'Reconnecting…'}
              </p>
              <p className="small dim mt-8">
                Your matches live on a shared server, so everyone you play with sees the same
                scores and the same leaderboard from their own phone.
              </p>
            </div>
          )}

          <div className="card card--flat">
            <p className="micro">Role</p>
            <p className="h3 mt-4" style={{ textTransform: 'capitalize' }}>
              {me.role}
            </p>
            <p className="small dim mt-8">
              {me.role === 'player' && 'Score your own matches, request corrections, confirm results.'}
              {me.role === 'scorer' && 'Update and correct scores on matches assigned to you.'}
              {me.role === 'organizer' &&
                'Create tournaments and matches, assign scorers, resolve disputed results.'}
              {me.role === 'admin' && 'Full control across the app.'}
            </p>
          </div>
          <button className="btn btn--block" onClick={() => nav('/players')}>
            Find players
          </button>
          <button className="btn btn--block" onClick={() => nav('/clubs')}>
            Find clubs
          </button>
          <button className="btn btn--block" onClick={() => nav('/welcome')}>
            Replay onboarding
          </button>

          {cloud.enabled ? (
            <button
              className="btn btn--danger btn--block mt-8"
              onClick={() => {
                if (!confirm('Sign out of Badminton Boys on this device?')) return
                void cloud.signOut()
              }}
            >
              Sign out
            </button>
          ) : (
            <div className="card card--flat mt-8">
              <p className="micro">Data</p>
              <p className="small dim mt-8">
                {state.session.demo === false
                  ? 'This is your own data. Every player and match here was added by you.'
                  : 'You are looking at a simulated demo season — 24 invented players and a few hundred matches, there so the app has something to show. Clearing it leaves just you.'}
              </p>
            </div>
          )}

          {!cloud.enabled && state.session.demo !== false && (
            <button
              className="btn btn--primary btn--block"
              onClick={() => {
                if (!confirm('Delete the demo players, matches, clubs and tournaments? Your profile stays.')) return
                dispatch({ type: 'clearAll' })
                setShowSettings(false)
                toast('Cleared — add your own players to begin')
                nav('/players')
              }}
            >
              Clear demo data & start fresh
            </button>
          )}

          {!cloud.enabled && (
            <button
              className="btn btn--danger btn--block"
              onClick={() => {
                if (!confirm('Wipe everything and reload the demo season? Any real matches you have recorded will be lost.')) return
                dispatch({ type: 'reset' })
                setShowSettings(false)
                toast('Demo season reloaded')
              }}
            >
              Reload demo data
            </button>
          )}
        </div>
      </Sheet>

      {/*
        The photographs are Creative Commons Attribution, which is only
        satisfied if the credit ships with them — so this link has to exist
        somewhere a reader can reach. At the foot of your own profile it's out
        of the way of the settings a person actually opens the sheet for.
      */}
      {isMe && (
        <p className="center mt-24">
          <button className="link link--quiet" onClick={() => nav('/credits')}>
            Photography and type credits
          </button>
        </p>
      )}
    </div>
  )
}
