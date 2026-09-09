import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { MIN_RATE_MATCHES, leaderboard, type LeaderboardKey } from '../engine/stats'
import { tierFor } from '../engine/rating'
import type { Player } from '../types'
import { nf, pct, rankTone } from '../lib/format'
import { Avatar, Chips, FormDots, Segmented, SectionHead } from '../components/ui'
import { ExportSheet } from '../components/ExportSheet'

type Scope = 'global' | 'india' | 'city' | 'club' | 'friends'
type View = 'ranking' | 'table'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'global', label: 'Global' },
  { value: 'india', label: 'India' },
  { value: 'city', label: 'Bengaluru' },
  { value: 'club', label: 'My club' },
  { value: 'friends', label: 'Friends' },
]

const BOARDS: { value: LeaderboardKey; label: string }[] = [
  { value: 'rating', label: 'Overall' },
  { value: 'streak', label: 'Streaks' },
  { value: 'wins', label: 'Most wins' },
  { value: 'winRate', label: 'Win rate' },
  { value: 'pointRatio', label: 'Point diff' },
]

export function Leaderboard() {
  const { state, me, stats } = useApp()
  const nav = useNavigate()
  const [scope, setScope] = useState<Scope>('city')
  const [board, setBoard] = useState<LeaderboardKey>('rating')
  const [view, setView] = useState<View>('ranking')
  const [sortKey, setSortKey] = useState<LeaderboardKey>('wins')
  const [showExport, setShowExport] = useState(false)

  const pool = useMemo(() => {
    switch (scope) {
      case 'club':
        return state.players.filter((p) => p.clubId === me.clubId)
      case 'friends':
        return state.players.filter((p) => state.follows.includes(p.id) || p.id === me.id)
      case 'city':
        return state.players.filter((p) => p.city === me.city)
      default:
        return state.players
    }
  }, [scope, state.players, state.follows, me.clubId, me.city])

  const rows = useMemo(() => leaderboard(pool, stats, board), [pool, stats, board])
  const tableRows = useMemo(() => leaderboard(pool, stats, sortKey), [pool, stats, sortKey])
  const myRow = rows.find((r) => r.player.id === me.id)
  const top3 = rows.slice(0, 3)

  const valueFor = (key: LeaderboardKey, p: Player, s: (typeof rows)[number]['stats']) => {
    switch (key) {
      case 'rating':
        return { v: nf(p.rating), unit: 'rating' }
      case 'wins':
        return { v: String(s.wins), unit: 'wins' }
      case 'winRate':
        return { v: pct(s.winRate, 0), unit: `${s.matches} played` }
      case 'pointRatio':
        return { v: pct(s.pointRatio, 1), unit: 'pts won' }
      case 'streak':
        return { v: String(s.bestStreak), unit: 'best run' }
      case 'matches':
        return { v: String(s.matches), unit: 'matches' }
    }
  }

  return (
    <div className="page">
      <header className="topbar topbar--flush">
        <h1 className="h1 grow">Leaderboard</h1>
        <button className="text-btn" onClick={() => setShowExport(true)}>
          Export
        </button>
      </header>

      <Chips options={SCOPES} value={scope} onChange={setScope} />

      <div className="mt-12">
        <Segmented
          options={[
            { value: 'ranking', label: 'Rankings' },
            { value: 'table', label: 'Stat table' },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === 'ranking' ? (
        <>
          <div className="mt-12">
            <Chips options={BOARDS} value={board} onChange={setBoard} />
          </div>

          {board === 'rating' && top3.length === 3 && (
            <div className="podium">
              {[top3[1], top3[0], top3[2]].map((r, i) => (
                <button
                  key={r.player.id}
                  className={`podium__slot${i === 1 ? ' podium__slot--1' : ''}`}
                  onClick={() => nav(`/player/${r.player.id}`)}
                >
                  <span className={`podium__medal rank--${rankTone(r.rank)}`}>{r.rank}</span>
                  <Avatar player={r.player} size={i === 1 ? 'lg' : 'md'} />
                  <div className="podium__name truncate">{r.player.name.split(' ')[0]}</div>
                  <div className="podium__rating num">{nf(r.player.rating)}</div>
                </button>
              ))}
            </div>
          )}

          {(board === 'winRate' || board === 'pointRatio') && (
            <p className="micro mt-12">Minimum {MIN_RATE_MATCHES} matches to qualify</p>
          )}

          <div className="mt-12">
            {rows.map((r) => {
              const { v, unit } = valueFor(board, r.player, r.stats)
              const tier = tierFor(r.player.rating)
              return (
                <button
                  key={r.player.id}
                  className={`lb-row${r.player.id === me.id ? ' lb-row--me' : ''}`}
                  onClick={() => nav(`/player/${r.player.id}`)}
                >
                  <span
                    className={`lb-row__rank${rankTone(r.rank) ? ` lb-row__rank--medal rank--${rankTone(r.rank)}` : ''}`}
                  >
                    {r.rank}
                  </span>
                  <Avatar player={r.player} size="sm" />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="lb-row__name truncate" style={{ display: 'block' }}>
                      {r.player.name}
                      {r.player.id === me.id && <span className="dim"> · you</span>}
                    </span>
                    <span className="lb-row__sub row gap-6">
                      <span style={{ color: tier.color }}>
                        {tier.name}
                      </span>
                    </span>
                  </span>
                  {board === 'streak' ? (
                    <FormDots form={r.stats.form} max={5} />
                  ) : (
                    <span className="lb-row__value">
                      <b>{v}</b>
                      {/* The unit is the same all the way down the board, so it
                          only needs saying once at the top. */}
                      {r.rank === 1 && <span>{unit}</span>}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {myRow && myRow.rank > 12 && (
            <>
              <SectionHead title="Your position" />
              <button className="lb-row lb-row--me" onClick={() => nav('/profile')}>
                <span className="lb-row__rank">{myRow.rank}</span>
                <Avatar player={me} size="sm" />
                <span className="grow">
                  <span className="lb-row__name">{me.name}</span>
                  <span className="lb-row__sub">
                    {rows[myRow.rank - 2]
                      ? `${nf(rows[myRow.rank - 2].player.rating - me.rating)} points behind #${myRow.rank - 1}`
                      : ''}
                  </span>
                </span>
                <span className="lb-row__value">
                  <b>{nf(me.rating)}</b>
                  <span>rating</span>
                </span>
              </button>
            </>
          )}
        </>
      ) : (
        <StatTable rows={tableRows} sortKey={sortKey} onSort={setSortKey} meId={me.id} />
      )}

      <ExportSheet
        open={showExport}
        onClose={() => setShowExport(false)}
        rows={rows.slice(0, 10)}
        board={BOARDS.find((b) => b.value === board)?.label ?? 'Overall'}
        scope={SCOPES.find((s) => s.value === scope)?.label ?? ''}
        valueFor={(p, s) => valueFor(board, p, s).v}
      />
    </div>
  )
}

/** Sortable data table — tap a column header to re-sort. */
function StatTable({
  rows,
  sortKey,
  onSort,
  meId,
}: {
  rows: ReturnType<typeof leaderboard>
  sortKey: LeaderboardKey
  onSort: (k: LeaderboardKey) => void
  meId: string
}) {
  const nav = useNavigate()
  const cols: { key: LeaderboardKey; label: string }[] = [
    { key: 'matches', label: 'P' },
    { key: 'wins', label: 'W' },
    { key: 'winRate', label: 'Win %' },
    { key: 'pointRatio', label: 'PDR' },
    { key: 'rating', label: 'Rating' },
  ]

  return (
    <>
      <p className="micro mt-16 mb-8">
        Tap a column to sort · PDR = points won ÷ points played
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            {cols.map((c) => (
              <th
                key={c.key}
                aria-sort={sortKey === c.key ? 'descending' : undefined}
                onClick={() => onSort(c.key)}
              >
                {c.label}
                {sortKey === c.key ? ' ▾' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.player.id}
              className={r.player.id === meId ? 'is-me' : undefined}
              onClick={() => nav(`/player/${r.player.id}`)}
            >
              <td>
                <span className="table__name">
                  <Avatar player={r.player} size="xs" />
                  <span className="truncate">{r.player.name.split(' ')[0]}</span>
                </span>
              </td>
              <td>{r.stats.matches}</td>
              <td>{r.stats.wins}</td>
              <td>{r.stats.matches ? pct(r.stats.winRate, 0) : '—'}</td>
              <td>{r.stats.matches ? pct(r.stats.pointRatio, 1) : '—'}</td>
              <td className="neon">{nf(r.player.rating)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
