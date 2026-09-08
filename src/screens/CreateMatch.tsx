import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../store/AppStore'
import type { Match, Player } from '../types'
import { DEFAULT_FORMAT } from '../engine/scoring'
import { firstName, teamName, uid } from '../lib/format'
import { Avatar, BackBar, Segmented, useToast } from '../components/ui'
import { AddPlayerSheet } from '../components/AddPlayer'

type Step = 0 | 1 | 2 | 3

const STEP_TITLES = ['Match type', 'Players', 'Format', 'Details']

export function CreateMatch() {
  const { me, dispatch, playerById } = useApp()
  const nav = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const challengeMode = params.get('mode') === 'challenge'

  const [step, setStep] = useState<Step>(0)
  const [type, setType] = useState<'Singles' | 'Doubles'>('Singles')
  const [partner, setPartner] = useState<string | null>(null)
  const [opponents, setOpponents] = useState<string[]>([])
  const [bestOf, setBestOf] = useState<1 | 3 | 5>(3)
  const [pointsToWin, setPointsToWin] = useState(21)
  const [court, setCourt] = useState('Court 1')
  const [competitive, setCompetitive] = useState(true)
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [at, setAt] = useState(() => {
    const d = new Date(Date.now() + 60 * 60_000)
    d.setMinutes(0, 0, 0)
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  })
  const [notes, setNotes] = useState('')

  const oppNeeded = type === 'Singles' ? 1 : 2
  const teamA = type === 'Singles' ? [me.id] : partner ? [me.id, partner] : [me.id]
  const ready =
    opponents.length === oppNeeded && (type === 'Singles' || partner !== null)

  const create = () => {
    const scheduledAt = when === 'now' ? Date.now() : new Date(at).getTime()
    const match: Match = {
      id: uid('m'),
      type,
      teamA,
      teamB: opponents,
      format: { ...DEFAULT_FORMAT, bestOf, pointsToWin, cap: pointsToWin === 21 ? 30 : pointsToWin + 9 },
      rallies: [],
      firstServe: 'A',
      // Everyone else still has to accept — nobody is dragged into a match.
      status: 'created',
      competitive,
      court,
      clubId: me.clubId,
      scheduledAt,
      endsSwapped: false,
      confirmations: [],
      corrections: [],
      reactions: { fire: 0, clap: 0, wow: 0 },
      invitesAccepted: teamA,
      notes: notes.trim() || undefined,
    }
    dispatch({ type: 'createMatch', match })
    dispatch({
      type: 'notify',
      notification: {
        id: uid('n'),
        icon: '🏸',
        text: `Invitation sent to ${teamName(opponents, playerById)}`,
        at: Date.now(),
        read: false,
        link: `/match/${match.id}`,
      },
    })
    toast(when === 'now' ? 'Match created' : 'Invitations sent')
    nav(when === 'now' ? `/score/${match.id}` : `/match/${match.id}`)
  }

  return (
    <div className="page">
      <BackBar title={challengeMode ? 'Challenge a player' : 'Create match'} />

      <div className="steps">
        {STEP_TITLES.map((_, i) => (
          <span key={i} className={`steps__s${i <= step ? ' steps__s--on' : ''}`} />
        ))}
      </div>
      <p className="micro mb-12">
        Step {step + 1} of 4 · {STEP_TITLES[step]}
      </p>

      {step === 0 && (
        <>
          <h2 className="h2 mb-12">What are you playing?</h2>
          <div className="stack">
            <TypeCard
              active={type === 'Singles'}
              title="Singles"
              sub="1 v 1"
              art="👤  vs  👤"
              onClick={() => setType('Singles')}
            />
            <TypeCard
              active={type === 'Doubles'}
              title="Doubles"
              sub="2 v 2"
              art="👥  vs  👥"
              onClick={() => setType('Doubles')}
            />
          </div>
        </>
      )}

      {step === 1 && (
        <PlayerStep
          type={type}
          partner={partner}
          setPartner={setPartner}
          opponents={opponents}
          setOpponents={setOpponents}
          oppNeeded={oppNeeded}
        />
      )}

      {step === 2 && (
        <>
          <h2 className="h2 mb-12">Format</h2>
          <label className="field mb-12">
            <span className="field__label">Games</span>
            <Segmented
              options={[
                { value: '1', label: '1 game' },
                { value: '3', label: 'Best of 3' },
                { value: '5', label: 'Best of 5' },
              ]}
              value={String(bestOf)}
              onChange={(v) => setBestOf(Number(v) as 1 | 3 | 5)}
            />
          </label>
          <label className="field">
            <span className="field__label">Points per game</span>
            <Segmented
              options={[
                { value: '11', label: '11' },
                { value: '15', label: '15' },
                { value: '21', label: '21 (BWF)' },
              ]}
              value={String(pointsToWin)}
              onChange={(v) => setPointsToWin(Number(v))}
            />
          </label>
          <div className="card card--flat mt-16">
            <p className="small">
              <b>{teamName(teamA, playerById)}</b> vs <b>{teamName(opponents, playerById) || '…'}</b>
            </p>
            <p className="small dim mt-4">
              First to {pointsToWin}, win by 2, capped at{' '}
              {pointsToWin === 21 ? 30 : pointsToWin + 9}. Best of {bestOf}.
            </p>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="h2 mb-12">Details</h2>
          <label className="field mb-12">
            <span className="field__label">When</span>
            <Segmented
              options={[
                { value: 'now', label: 'Play now' },
                { value: 'later', label: 'Schedule' },
              ]}
              value={when}
              onChange={setWhen}
            />
          </label>
          {when === 'later' && (
            <label className="field mb-12">
              <span className="field__label">Date & time</span>
              <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
          )}
          <label className="field mb-12">
            <span className="field__label">Court</span>
            <select className="input" value={court} onChange={(e) => setCourt(e.target.value)}>
              {['Court 1', 'Court 2', 'Court 3', 'Court 4', 'Court 5', 'Court 6'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field mb-12">
            <span className="field__label">Stakes</span>
            <Segmented
              options={[
                { value: 'yes', label: 'Competitive' },
                { value: 'no', label: 'Casual' },
              ]}
              value={competitive ? 'yes' : 'no'}
              onChange={(v) => setCompetitive(v === 'yes')}
            />
            <p className="micro mt-8">
              {competitive
                ? 'Counts towards rating and rankings.'
                : 'Recorded in history but leaves your rating alone.'}
            </p>
          </label>
          <label className="field">
            <span className="field__label">Notes (optional)</span>
            <textarea
              className="input"
              rows={2}
              placeholder="Anything the other players should know"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="card mt-16">
            <p className="micro mb-8">Summary</p>
            <div className="slate">
              <div>
                <div className="avatar-stack" style={{ justifyContent: 'center' }}>
                  {teamA.map((id) => (
                    <Avatar key={id} player={playerById(id)} size="sm" />
                  ))}
                </div>
                <div className="slate__name">{teamName(teamA, playerById)}</div>
              </div>
              <span className="slate__vs">VS</span>
              <div>
                <div className="avatar-stack" style={{ justifyContent: 'center' }}>
                  {opponents.map((id) => (
                    <Avatar key={id} player={playerById(id)} size="sm" />
                  ))}
                </div>
                <div className="slate__name">{teamName(opponents, playerById)}</div>
              </div>
            </div>
            <p className="micro center">
              {type} · Best of {bestOf} · {court} · {competitive ? 'Competitive' : 'Casual'}
            </p>
          </div>
        </>
      )}

      <div className="row gap-8 mt-24">
        {step > 0 && (
          <button className="btn grow" onClick={() => setStep((step - 1) as Step)}>
            Back
          </button>
        )}
        {step < 3 ? (
          <button
            className="btn btn--primary grow"
            disabled={step === 1 && !ready}
            onClick={() => setStep((step + 1) as Step)}
          >
            Continue
          </button>
        ) : (
          <button className="btn btn--primary grow" disabled={!ready} onClick={create}>
            {when === 'now' ? 'Create & start scoring' : 'Send invitations'}
          </button>
        )}
      </div>

      {step === 3 && (
        <p className="micro center mt-12">
          {when === 'now'
            ? 'Players confirm the result when the match ends.'
            : 'Nobody is added to a match without accepting first.'}
        </p>
      )}
    </div>
  )
}

const TypeCard = ({
  active,
  title,
  sub,
  art,
  onClick,
}: {
  active: boolean
  title: string
  sub: string
  art: string
  onClick: () => void
}) => (
  <button
    className={`card card--tap${active ? ' card--neon' : ''}`}
    onClick={onClick}
    aria-pressed={active}
  >
    <div className="court-lines" />
    <div className="row-between">
      <div>
        <div className="h2">{title}</div>
        <div className="small dim mt-4">{sub}</div>
      </div>
      <div style={{ fontSize: 20, letterSpacing: 2 }}>{art}</div>
    </div>
  </button>
)

function PlayerStep({
  type,
  partner,
  setPartner,
  opponents,
  setOpponents,
  oppNeeded,
}: {
  type: 'Singles' | 'Doubles'
  partner: string | null
  setPartner: (id: string | null) => void
  opponents: string[]
  setOpponents: (ids: string[]) => void
  oppNeeded: number
}) {
  const { state, me, stats } = useApp()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState<'partner' | 'opponents'>(
    type === 'Doubles' && !partner ? 'partner' : 'opponents',
  )

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const club = state.clubs.find((c) => c.id === me.clubId)
    return state.players
      .filter((p) => p.id !== me.id)
      .filter((p) =>
        !needle
          ? true
          : p.name.toLowerCase().includes(needle) ||
            p.handle.toLowerCase().includes(needle) ||
            p.level.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        // Clubmates and people you follow float to the top.
        const score = (p: Player) =>
          (club?.memberIds.includes(p.id) ? 2 : 0) + (state.follows.includes(p.id) ? 1 : 0)
        return score(b) - score(a) || b.rating - a.rating
      })
      .slice(0, 24)
  }, [q, state.players, state.clubs, state.follows, me.id, me.clubId])

  const toggle = (id: string) => {
    if (target === 'partner') {
      setPartner(partner === id ? null : id)
      if (partner !== id) setTarget('opponents')
      return
    }
    if (opponents.includes(id)) setOpponents(opponents.filter((x) => x !== id))
    else if (opponents.length < oppNeeded) setOpponents([...opponents, id])
    else setOpponents([...opponents.slice(1), id])
  }

  const selected = (id: string) => (target === 'partner' ? partner === id : opponents.includes(id))

  return (
    <>
      <h2 className="h2 mb-12">Who's playing?</h2>

      {type === 'Doubles' && (
        <div className="mb-12">
          <Segmented
            options={[
              { value: 'partner', label: partner ? `Partner: ${firstName(state.players.find((p) => p.id === partner)!)}` : 'Your partner' },
              { value: 'opponents', label: `Opponents ${opponents.length}/${oppNeeded}` },
            ]}
            value={target}
            onChange={setTarget}
            neon
          />
        </div>
      )}

      <div className="search mb-12">
        <span className="search__icon">🔍</span>
        <input
          className="input"
          placeholder="Search by name, @handle or level"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="stack">
        {results.map((p) => (
          <button
            key={p.id}
            className="presult"
            aria-pressed={selected(p.id)}
            onClick={() => toggle(p.id)}
          >
            <Avatar player={p} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}>
              <span className="h3 truncate" style={{ display: 'block' }}>
                {p.name}
              </span>
              <span className="mrow__meta">
                @{p.handle} · {p.level} · ⭐ {p.rating} · {stats[p.id]?.wins ?? 0}W
              </span>
            </span>
            <span className="presult__check">{selected(p.id) ? '✓' : ''}</span>
          </button>
        ))}
        {!results.length && (
          <p className="small dim center mt-16">
            {q ? `No players match “${q}”.` : 'Nobody to play against yet.'}
          </p>
        )}

        <button className="btn btn--block mt-8" onClick={() => setAdding(true)}>
          ＋ Add a new player
        </button>
      </div>

      <AddPlayerSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(p) => {
          setQ('')
          toggle(p.id)
        }}
      />
    </>
  )
}
