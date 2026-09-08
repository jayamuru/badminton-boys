import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { computeState } from '../engine/scoring'
import { leaderboard } from '../engine/stats'
import { tierFor } from '../engine/rating'
import type { Level } from '../types'
import { clock, dayLabel, firstName, nf, pct, rankMedal } from '../lib/format'
import { Avatar, BackBar, Chips, Empty, SectionHead, useToast } from '../components/ui'
import { LiveMatchCard, UpcomingCard } from '../components/MatchCards'
import { AddPlayerSheet } from '../components/AddPlayer'

/* --- find players --------------------------------------------------------- */

type LevelFilter = 'all' | Level

export function FindPlayers() {
  const { state, me, stats, dispatch } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const [adding, setAdding] = useState(false)

  // Distances are part of the demo fiction. Once you're on your own roster they
  // are dropped rather than invented.
  const demo = state.session.demo !== false
  const distance = (id: string) => {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return ((h % 90) / 10 + 0.4).toFixed(1)
  }

  const results = useMemo(
    () =>
      state.players
        .filter((p) => p.id !== me.id)
        .filter((p) => (level === 'all' ? true : p.level === level))
        .filter((p) => {
          const n = q.trim().toLowerCase()
          return !n || p.name.toLowerCase().includes(n) || p.handle.toLowerCase().includes(n)
        })
        .sort((a, b) =>
          demo ? Number(distance(a.id)) - Number(distance(b.id)) : a.name.localeCompare(b.name),
        ),
    [state.players, me.id, level, q, demo],
  )

  return (
    <div className="page">
      <BackBar
        title="Find players"
        right={
          <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Add a player">
            ＋
          </button>
        }
      />
      <div className="search mb-12">
        <span className="search__icon">🔍</span>
        <input
          className="input"
          placeholder="Search by name or @handle"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <Chips
        options={[
          { value: 'all' as LevelFilter, label: 'All levels' },
          { value: 'Beginner' as LevelFilter, label: 'Beginner' },
          { value: 'Intermediate' as LevelFilter, label: 'Intermediate' },
          { value: 'Advanced' as LevelFilter, label: 'Advanced' },
          { value: 'Competitive' as LevelFilter, label: 'Competitive' },
        ]}
        value={level}
        onChange={setLevel}
      />

      <SectionHead
        title={demo ? `Players near you · ${results.length}` : `Your players · ${results.length}`}
        action="Add player"
        onAction={() => setAdding(true)}
      />
      <div className="stack">
        {results.map((p) => {
          const s = stats[p.id]
          const tier = tierFor(p.rating)
          return (
            <div key={p.id} className="card">
              <div className="row gap-8">
                <button onClick={() => nav(`/player/${p.id}`)}>
                  <Avatar player={p} size="lg" />
                </button>
                <div className="grow" style={{ minWidth: 0 }}>
                  <button
                    className="h3 truncate"
                    style={{ display: 'block', textAlign: 'left' }}
                    onClick={() => nav(`/player/${p.id}`)}
                  >
                    {p.name}
                  </button>
                  <div className="mrow__meta">
                    ⭐ {nf(p.rating)} · {p.level}
                    {demo && ` · ${distance(p.id)} km away`}
                  </div>
                  <div className="micro mt-4" style={{ color: tier.color }}>
                    {tier.emoji} {tier.name} · {s?.wins ?? 0}W {s?.losses ?? 0}L
                  </div>
                </div>
              </div>
              <div className="row gap-8 mt-12">
                <button
                  className="btn btn--sm btn--primary grow"
                  onClick={() => {
                    dispatch({
                      type: 'createChallenge',
                      challenge: {
                        id: `ch${Math.random().toString(36).slice(2, 8)}`,
                        fromId: me.id,
                        toId: p.id,
                        type: 'Singles',
                        bestOf: 3,
                        at: Date.now() + 2 * 86_400_000,
                        status: 'pending',
                      },
                    })
                    toast(`Challenge sent to ${firstName(p)}`)
                  }}
                >
                  ⚔️ Challenge
                </button>
                <button className="btn btn--sm grow" onClick={() => nav(`/h2h/${me.id}/${p.id}`)}>
                  Head to head
                </button>
              </div>
            </div>
          )
        })}
        {!results.length && (
          <Empty
            glyph={q || level !== 'all' ? '🔍' : '👥'}
            title={q || level !== 'all' ? 'No players found' : 'No players yet'}
            body={
              q || level !== 'all'
                ? 'Try a different level or search.'
                : "Add the people you play with and they'll be pickable in every match."
            }
            cta="＋ Add a player"
            onCta={() => setAdding(true)}
          />
        )}
      </div>

      <AddPlayerSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

/* --- find clubs ----------------------------------------------------------- */

export function FindClubs() {
  const { state, me, dispatch } = useApp()
  const nav = useNavigate()
  const toast = useToast()

  return (
    <div className="page">
      <BackBar title="Find clubs" />
      <p className="small dim mb-12">Badminton communities near {me.city}.</p>
      <div className="stack">
        {state.clubs.map((c) => {
          const live = state.matches.filter((m) => m.clubId === c.id && m.status === 'live').length
          const joined = c.memberIds.includes(me.id)
          return (
            <div key={c.id} className="card">
              <div className="court-lines" />
              <div className="row-between">
                <div style={{ minWidth: 0 }}>
                  <h3 className="h3 truncate">{c.name}</h3>
                  <p className="small dim mt-4">
                    {c.area} · {c.courts} courts
                  </p>
                </div>
                {live > 0 && <span className="live-pill">{live} live</span>}
              </div>
              <div className="row gap-8 mt-12">
                <span className="pill">{c.memberIds.length} players</span>
                <span className="pill">
                  {state.matches.filter((m) => m.clubId === c.id).length} matches
                </span>
              </div>
              <div className="row gap-8 mt-12">
                <button className="btn btn--sm grow" onClick={() => nav(`/club/${c.id}`)}>
                  View club
                </button>
                <button
                  className={`btn btn--sm grow${joined ? '' : ' btn--primary'}`}
                  disabled={joined}
                  onClick={() => {
                    dispatch({ type: 'joinClub', clubId: c.id })
                    toast(`Joined ${c.name}`)
                  }}
                >
                  {joined ? 'Joined ✓' : 'Join'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* --- club detail (with the admin dashboard) ------------------------------- */

export function ClubDetail() {
  const { id } = useParams<{ id: string }>()
  const { state, me, stats } = useApp()
  const nav = useNavigate()

  const club = state.clubs.find((c) => c.id === id)
  const matches = useMemo(() => state.matches.filter((m) => m.clubId === id), [state.matches, id])
  const members = useMemo(
    () => state.players.filter((p) => club?.memberIds.includes(p.id)),
    [state.players, club],
  )
  const board = useMemo(() => leaderboard(members, stats, 'rating'), [members, stats])

  if (!club) {
    return (
      <div className="page">
        <BackBar title="Club" />
        <Empty glyph="🏸" title="Club not found" body="This community no longer exists." />
      </div>
    )
  }

  const live = matches.filter((m) => m.status === 'live')
  const upcoming = matches
    .filter((m) => ['created', 'confirmed', 'ready'].includes(m.status))
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
  const monthAgo = Date.now() - 30 * 86_400_000
  const thisMonth = matches.filter((m) => (m.completedAt ?? 0) > monthAgo).length
  const activePlayers = new Set(
    matches.filter((m) => (m.completedAt ?? 0) > monthAgo).flatMap((m) => [...m.teamA, ...m.teamB]),
  ).size
  const isAdmin = club.adminIds.includes(me.id) || me.role === 'admin'

  const mostActive = members
    .map((p) => ({ p, n: stats[p.id]?.matches ?? 0 }))
    .sort((a, b) => b.n - a.n)[0]

  return (
    <div className="page">
      <BackBar title={club.name} />
      <p className="small dim">
        {club.area} · {club.courts} courts · {members.length} players
      </p>

      {club.announcement && (
        <div className="card card--neon mt-16">
          <p className="micro">📣 Announcement</p>
          <p className="small mt-8">{club.announcement}</p>
        </div>
      )}

      {isAdmin && (
        <>
          <SectionHead title="Club dashboard" />
          <div className="stat-grid">
            <Stat3 v={members.length} l="Members" />
            <Stat3 v={thisMonth} l="This month" />
            <Stat3 v={activePlayers} l="Active" />
          </div>
          <div className="stat-grid mt-8">
            <Stat3 v={live.length} l="Live now" tone="var(--live)" />
            <Stat3 v={board[0] ? firstName(board[0].player) : '—'} l="Top player" tone="var(--gold)" />
            <Stat3 v={mostActive ? firstName(mostActive.p) : '—'} l="Most active" />
          </div>
          <div className="row gap-8 mt-12 wrap">
            <button className="btn btn--sm" onClick={() => nav('/create')}>
              Create match
            </button>
            <button className="btn btn--sm" onClick={() => nav(`/tournament/${state.tournaments[0]?.id}`)}>
              Tournaments
            </button>
            <button className="btn btn--sm" onClick={() => nav('/players')}>
              Manage players
            </button>
          </div>
        </>
      )}

      {live.length > 0 && (
        <>
          <SectionHead title={`Live · ${live.length}`} />
          <div className="stack">
            {live.map((m) => (
              <LiveMatchCard key={m.id} match={m} />
            ))}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionHead title={`Upcoming · ${upcoming.length}`} />
          <div className="stack">
            {upcoming.slice(0, 4).map((m) => (
              <UpcomingCard key={m.id} match={m} />
            ))}
          </div>
        </>
      )}

      <SectionHead title="Club leaderboard" action="Full board" onAction={() => nav('/leaderboard')} />
      <div>
        {board.slice(0, 10).map((r) => (
          <button key={r.player.id} className="lb-row" onClick={() => nav(`/player/${r.player.id}`)}>
            <span className="lb-row__rank">{rankMedal(r.rank) ?? r.rank}</span>
            <Avatar player={r.player} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="lb-row__name truncate" style={{ display: 'block' }}>
                {r.player.name}
              </span>
              <span className="lb-row__sub">
                {r.stats.wins}W {r.stats.losses}L · {r.stats.matches ? pct(r.stats.winRate, 0) : '—'}
              </span>
            </span>
            <span className="lb-row__value">
              <b>{nf(r.player.rating)}</b>
              <span>rating</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const Stat3 = ({ v, l, tone }: { v: string | number; l: string; tone?: string }) => (
  <div className="stat">
    <div className="stat__value" style={tone ? { color: tone } : undefined}>
      {v}
    </div>
    <div className="stat__label">{l}</div>
  </div>
)

/* --- notifications -------------------------------------------------------- */

export function Notifications() {
  const { state, dispatch } = useApp()
  const nav = useNavigate()
  return (
    <div className="page">
      <BackBar
        title="Notifications"
        right={
          <button className="btn btn--sm" onClick={() => dispatch({ type: 'readNotifications' })}>
            Mark read
          </button>
        }
      />
      <div className="stack">
        {state.notifications.map((n) => (
          <button
            key={n.id}
            className={`card card--tap${n.read ? '' : ' card--neon'}`}
            onClick={() => n.link && nav(n.link)}
          >
            <div className="row gap-8">
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              <span className="grow">
                <span className="small" style={{ color: n.read ? 'var(--text-2)' : 'var(--text)' }}>
                  {n.text}
                </span>
                <div className="mrow__meta">
                  {dayLabel(n.at)} · {clock(n.at)}
                </div>
              </span>
            </div>
          </button>
        ))}
        {!state.notifications.length && (
          <Empty glyph="🔔" title="Nothing yet" body="Match reminders, challenges and ranking moves land here." />
        )}
      </div>
    </div>
  )
}

/* --- tournament ----------------------------------------------------------- */

export function TournamentScreen() {
  const { id } = useParams<{ id: string }>()
  const { state, playerById } = useApp()
  const nav = useNavigate()

  const t = state.tournaments.find((x) => x.id === id)
  const matches = useMemo(() => state.matches.filter((m) => m.tournamentId === id), [state.matches, id])

  if (!t) {
    return (
      <div className="page">
        <BackBar title="Tournament" />
        <Empty glyph="🏆" title="No tournament here" body="It may have finished or been removed." />
      </div>
    )
  }

  const live = matches.filter((m) => m.status === 'live')
  const rounds = ['Group A', 'Group B', 'Quarter Final', 'Semi Final', 'Final']
  const byRound = (r: string) => matches.filter((m) => m.round === r)
  const courts = Array.from({ length: t.courts }, (_, i) => `Court ${i + 1}`)

  return (
    <div className="page">
      <BackBar title={t.name} />
      <div className="row gap-8 wrap">
        <span className="pill pill--gold">🏆 {t.stage.toUpperCase()} STAGE</span>
        <span className="pill">{t.playerIds.length} players</span>
        <span className="pill">{t.courts} courts</span>
        <span className="pill">{t.format}</span>
      </div>

      <SectionHead title="Live dashboard" />
      <div className="stack">
        {courts.map((court) => {
          const m = live.find((x) => x.court === court)
          if (!m) {
            const nextUp = matches.find(
              (x) => x.court === court && ['ready', 'confirmed', 'created'].includes(x.status),
            )
            return (
              <div key={court} className="court-strip">
                <span className="court-strip__n">{court.replace('Court ', '')}</span>
                <span className="grow">
                  <span className="h3">{court}</span>
                  <div className="mrow__meta">
                    {nextUp ? `${nextUp.round ?? 'Match'} · ${clock(nextUp.scheduledAt)}` : 'Free'}
                  </div>
                </span>
                <span className="pill">{nextUp ? 'Starting soon' : 'Idle'}</span>
              </div>
            )
          }
          const s = computeState(m)
          return (
            <button key={court} className="court-strip" onClick={() => nav(`/match/${m.id}`)}>
              <span className="court-strip__n" style={{ background: 'rgba(255,45,70,0.16)', color: 'var(--live)' }}>
                {court.replace('Court ', '')}
              </span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="h3 truncate">{m.round ?? 'Match'}</span>
                <div className="mrow__meta truncate">
                  {playerById(m.teamA[0]).name.split(' ')[0]} v {playerById(m.teamB[0]).name.split(' ')[0]}
                </div>
              </span>
              <span className="num" style={{ fontWeight: 800, fontSize: 20 }}>
                {s.current.a}–{s.current.b}
              </span>
              <span className="live-dot" />
            </button>
          )
        })}
      </div>

      <SectionHead title="Bracket" />
      <div className="bracket">
        {rounds.map((r) => {
          const ms = byRound(r)
          if (!ms.length) return null
          return (
            <div key={r} className="bracket__col">
              <div className="bracket__title">{r}</div>
              {ms.map((m) => {
                const s = computeState(m)
                const games = s.finished ? s.completed : [...s.completed, s.current]
                return (
                  <button
                    key={m.id}
                    className={`bracket__match${m.status === 'live' ? ' bracket__match--live' : ''}`}
                    onClick={() => nav(`/match/${m.id}`)}
                  >
                    {(['A', 'B'] as const).map((side) => {
                      const ids = side === 'A' ? m.teamA : m.teamB
                      const won = s.winner === side
                      return (
                        <div key={side} className={`bracket__slot${won ? ' bracket__slot--won' : ''}`}>
                          <Avatar player={playerById(ids[0])} size="xs" />
                          <span className="truncate">{playerById(ids[0]).name.split(' ')[0]}</span>
                          <b>{games.filter((g) => (side === 'A' ? g.a > g.b : g.b > g.a)).length}</b>
                        </div>
                      )
                    })}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <SectionHead title="All tournament matches" />
      <div className="stack">
        {matches
          .filter((m) => m.status === 'completed')
          .slice(0, 8)
          .map((m) => (
            <button key={m.id} className="card card--tap" onClick={() => nav(`/match/${m.id}`)}>
              <div className="card__strip">
                <span className="pill">{m.round}</span>
                <span className="court-tag">{dayLabel(m.completedAt ?? m.scheduledAt)}</span>
              </div>
              <div className="row-between">
                <span className="h3 truncate">{playerById(m.teamA[0]).name}</span>
                <span className="num" style={{ fontWeight: 800 }}>
                  {computeState(m).completed.map((g) => `${g.a}-${g.b}`).join(' ')}
                </span>
              </div>
              <div className="row-between mt-4">
                <span className="h3 truncate dim">{playerById(m.teamB[0]).name}</span>
              </div>
            </button>
          ))}
      </div>
    </div>
  )
}
