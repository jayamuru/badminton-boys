import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useTick } from '../store/AppStore'
import { Chips, Empty, LivePill } from '../components/ui'
import { LiveMatchCard, isTight } from '../components/MatchCards'

type Filter = 'all' | 'singles' | 'doubles' | 'club' | 'friends' | 'tournament'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'club', label: 'My club' },
  { value: 'friends', label: 'Friends' },
  { value: 'tournament', label: 'Tournaments' },
]

export function Live() {
  const { state, me } = useApp()
  const nav = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  useTick(15_000)

  const live = useMemo(() => state.matches.filter((m) => m.status === 'live'), [state.matches])

  const shown = useMemo(() => {
    const f = live.filter((m) => {
      switch (filter) {
        case 'singles':
          return m.type === 'Singles'
        case 'doubles':
          return m.type === 'Doubles'
        case 'club':
          return m.clubId === me.clubId
        case 'friends':
          return [...m.teamA, ...m.teamB].some((id) => state.follows.includes(id))
        case 'tournament':
          return Boolean(m.tournamentId)
        default:
          return true
      }
    })
    // Close matches climb to the top — that's the reason to open this tab.
    return f.sort((a, b) => Number(isTight(b)) - Number(isTight(a)))
  }, [live, filter, me.clubId, state.follows])

  return (
    <>
      <header className="topbar topbar--flush">
        <div className="grow">
          <div className="row gap-8">
            <LivePill />
            <h1 className="h1">Live now</h1>
          </div>
          <p className="small dim mt-4">
            {live.length} {live.length === 1 ? 'match' : 'matches'} happening across{' '}
            {new Set(live.map((m) => m.clubId)).size} clubs
          </p>
        </div>
      </header>

      <div className="mt-8">
        <Chips options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="stack mt-16">
        {shown.map((m) => (
          <LiveMatchCard key={m.id} match={m} />
        ))}
      </div>

      {shown.length === 0 && (
        <Empty
          glyph="🏸"
          title="Nothing live here yet"
          body={
            filter === 'all'
              ? 'When someone starts scoring a match it shows up here instantly.'
              : 'No live matches match this filter right now.'
          }
          cta={filter === 'all' ? 'Start a match' : 'Show all'}
          onCta={() => (filter === 'all' ? nav('/play') : setFilter('all'))}
        />
      )}
    </>
  )
}
