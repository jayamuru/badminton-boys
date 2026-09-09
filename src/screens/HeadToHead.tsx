import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import { headToHead, statsFor } from '../engine/stats'
import { tierFor } from '../engine/rating'
import { nf, pct } from '../lib/format'
import { Avatar, BackBar, Empty, Sheet } from '../components/ui'
import { ResultCard } from '../components/MatchCards'

/** Profile comparison — the historical record between two specific players. */
export function HeadToHead() {
  const { a, b } = useParams<{ a: string; b: string }>()
  const { state, me } = useApp()
  const nav = useNavigate()
  const [picking, setPicking] = useState(false)

  const pa = state.players.find((p) => p.id === a) ?? me
  const pb = state.players.find((p) => p.id === b)

  const h2h = useMemo(
    () => (pb ? headToHead(pa.id, pb.id, state.matches) : null),
    [pa.id, pb, state.matches],
  )
  const sa = useMemo(() => statsFor(pa.id, state.matches), [pa.id, state.matches])
  const sb = useMemo(() => (pb ? statsFor(pb.id, state.matches) : null), [pb, state.matches])

  if (!pb || !h2h || !sb) {
    return (
      <div className="page">
        <BackBar title="Head to head" />
        <Empty
            title="Pick someone to compare"
          body="See the full historical record between you and any other player."
          cta="Choose a player"
          onCta={() => setPicking(true)}
        />
        <PlayerPicker
          open={picking}
          onClose={() => setPicking(false)}
          exclude={[pa.id]}
          onPick={(id) => nav(`/h2h/${pa.id}/${id}`, { replace: true })}
        />
      </div>
    )
  }

  const total = h2h.aWins + h2h.bWins
  const Compare = ({
    label,
    left,
    right,
    higherWins = true,
  }: {
    label: string
    left: number | string
    right: number | string
    higherWins?: boolean
  }) => {
    const ln = typeof left === 'number' ? left : parseFloat(left)
    const rn = typeof right === 'number' ? right : parseFloat(right)
    const leftWins = higherWins ? ln > rn : ln < rn
    const rightWins = higherWins ? rn > ln : rn < ln
    return (
      <div className="h2h-stat">
        <span className={`h2h-stat__v h2h-stat__v--l${leftWins ? ' h2h-stat__v--win' : ''}`}>{left}</span>
        <span className="h2h-stat__label">{label}</span>
        <span className={`h2h-stat__v h2h-stat__v--r${rightWins ? ' h2h-stat__v--win' : ''}`}>{right}</span>
      </div>
    )
  }

  return (
    <div className="page">
      <BackBar
        title="Head to head"
        right={
          <button className="icon-btn" onClick={() => setPicking(true)} aria-label="Change opponent">
            ⇄
          </button>
        }
      />

      <div className="h2h-head mt-8">
        <button onClick={() => nav(`/player/${pa.id}`)}>
          <Avatar player={pa} size="lg" />
          <div className="h3 mt-8 truncate">{pa.name.split(' ')[0]}</div>
          <div className="micro mt-4" style={{ color: tierFor(pa.rating).color }}>
            {nf(pa.rating)}
          </div>
        </button>
        <span className="slate__vs">VS</span>
        <button onClick={() => nav(`/player/${pb.id}`)}>
          <Avatar player={pb} size="lg" />
          <div className="h3 mt-8 truncate">{pb.name.split(' ')[0]}</div>
          <div className="micro mt-4" style={{ color: tierFor(pb.rating).color }}>
            {nf(pb.rating)}
          </div>
        </button>
      </div>

      {total === 0 ? (
        <div className="card mt-24 center">
          <p className="h3">They've never played</p>
          <p className="small dim mt-8">
            No competitive history yet — someone has to throw down first.
          </p>
          <button
            className="btn btn--primary mt-16"
            onClick={() => nav(`/create?mode=challenge&opponent=${pb.id}`)}
          >
            Set up the first one
          </button>
        </div>
      ) : (
        <>
          <p className="micro center mt-24 mb-8">Matches won</p>
          <div className="h2h-bar">
            <span className="h2h-bar__a" style={{ flex: Math.max(h2h.aWins, 0.15) }}>
              {h2h.aWins}
            </span>
            <span className="h2h-bar__b" style={{ flex: Math.max(h2h.bWins, 0.15) }}>
              {h2h.bWins}
            </span>
          </div>
          <p className="micro center mt-8">
            {total} {total === 1 ? 'meeting' : 'meetings'} ·{' '}
            {h2h.aWins === h2h.bWins
              ? 'dead level'
              : `${(h2h.aWins > h2h.bWins ? pa : pb).name.split(' ')[0]} leads`}
          </p>

          <div className="card mt-16">
            <Compare label="H2H games" left={h2h.aGames} right={h2h.bGames} />
            <Compare label="H2H points" left={h2h.aPoints} right={h2h.bPoints} />
            <Compare label="Rating" left={nf(pa.rating)} right={nf(pb.rating)} />
            <Compare label="Career wins" left={sa.wins} right={sb.wins} />
            <Compare label="Win rate" left={pct(sa.winRate, 0)} right={pct(sb.winRate, 0)} />
            <Compare label="Best streak" left={sa.bestStreak} right={sb.bestStreak} />
            <Compare label="Point diff ratio" left={pct(sa.pointRatio, 1)} right={pct(sb.pointRatio, 1)} />
          </div>

          <h3 className="section-head__title mt-24 mb-8">Their meetings</h3>
          <div className="stack">
            {h2h.matches.slice(0, 8).map((m) => (
              <ResultCard key={m.id} match={m} perspectiveId={pa.id} />
            ))}
          </div>
        </>
      )}

      <PlayerPicker
        open={picking}
        onClose={() => setPicking(false)}
        exclude={[pa.id]}
        onPick={(id) => nav(`/h2h/${pa.id}/${id}`, { replace: true })}
      />
    </div>
  )
}

export function PlayerPicker({
  open,
  onClose,
  onPick,
  exclude = [],
}: {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
  exclude?: string[]
}) {
  const { state, stats } = useApp()
  const [q, setQ] = useState('')
  const results = state.players
    .filter((p) => !exclude.includes(p.id))
    .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 20)

  return (
    <Sheet open={open} onClose={onClose} title="Compare with">
      <div className="search mb-12">
        
        <input
          className="input"
          placeholder="Search players"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="stack">
        {results.map((p) => (
          <button
            key={p.id}
            className="presult"
            onClick={() => {
              onPick(p.id)
              onClose()
            }}
          >
            <Avatar player={p} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="h3 truncate" style={{ display: 'block' }}>
                {p.name}
              </span>
              <span className="mrow__meta">
                {p.rating} · {stats[p.id]?.wins ?? 0}W {stats[p.id]?.losses ?? 0}L
              </span>
            </span>
            <span className="action__chev">›</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
