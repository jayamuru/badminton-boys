import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Match } from '../types'
import { useApp } from '../store/AppStore'
import { computeState, gamesList } from '../engine/scoring'
import { teamName } from '../lib/format'
import { Sheet, useToast } from './ui'
import { isNativeApp } from '../backend/client'

/**
 * Where a spectator's browser should go.
 *
 * Normally that's just where we already are. But the Android app is served from
 * `https://localhost`, so deriving the link from the current location would mint
 * QR codes pointing at the scanner's own device — the share feature would look
 * like it worked and silently reach nobody. `VITE_PUBLIC_URL` is the web deploy's
 * address, baked in at build time, and it wins whenever it's set.
 */
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.replace(/\/+$/, '')

/** True when we're in the packaged app with no web address to point people at. */
export const shareLinkUnusable = isNativeApp && !PUBLIC_URL

/** Public spectator link for a match — what the QR code encodes. */
export const watchUrl = (matchId: string) =>
  PUBLIC_URL
    ? `${PUBLIC_URL}/#/watch/${matchId}`
    : `${window.location.origin}${window.location.pathname}#/watch/${matchId}`

function useQr(text: string) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(text, {
      margin: 0,
      width: 400,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(''))
    return () => {
      alive = false
    }
  }, [text])
  return src
}

/**
 * "Share live match" — the broadcast entry point. Spectators scan the QR or open
 * the link and land on a read-only scoreboard that follows the match.
 */
export function ShareSheet({
  match,
  open,
  onClose,
}: {
  match: Match
  open: boolean
  onClose: () => void
}) {
  const { playerById } = useApp()
  const toast = useToast()
  const url = watchUrl(match.id)
  const qr = useQr(url)
  const s = computeState(match)
  const live = match.status === 'live'
  const games = gamesList(s)

  const share = async () => {
    const title = `${teamName(match.teamA, playerById)} vs ${teamName(match.teamB, playerById)}`
    const text = live
      ? `🔴 LIVE — ${title}  ${s.current.a}–${s.current.b}\nWatch the live scoreboard:`
      : `🏸 ${title}\n${games.map((g) => `${g.a}–${g.b}`).join(', ')}\nFull scorecard:`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Badminton Boys', text, url })
        return
      }
      await navigator.clipboard.writeText(`${text} ${url}`)
      toast('Link copied')
    } catch {
      /* user dismissed the share sheet */
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast('Link copied')
    } catch {
      toast('Could not copy')
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={live ? 'Share live match' : 'Share result'}>
      <div className="share-card mb-12">
        <div className="court-lines" />
        <div className="row gap-8 mb-12">
          {live ? (
            <span className="live-pill">
              <i className="live-dot" />
              Live now
            </span>
          ) : (
            <span className="pill pill--neon">Final</span>
          )}
          <span className="court-tag">{match.court}</span>
        </div>

        <div className="row-between">
          <span className="h3 truncate">{teamName(match.teamA, playerById)}</span>
          <span className="score score--lg">{s.current.a}</span>
        </div>
        <div className="row-between mt-4">
          <span className="h3 truncate dim">{teamName(match.teamB, playerById)}</span>
          <span className="score score--lg dim">{s.current.b}</span>
        </div>

        {s.completed.length > 0 && (
          <p className="small dim mt-8 num">
            {s.completed.map((g) => `${g.a}–${g.b}`).join('  ·  ')}
          </p>
        )}

        {!shareLinkUnusable && (
          <>
            {qr && <img className="qr mt-16" src={qr} alt={`QR code linking to ${url}`} />}
            <p className="micro center mt-8">Scan to follow the score</p>
          </>
        )}

        <div className="share-card__brand">
          <span>🏸 BADMINTON BOYS</span>
          <span>PLAY · SCORE · COMPETE · CLIMB</span>
        </div>
      </div>

      {shareLinkUnusable ? (
        <p className="small dim center">
          This copy of the app has no web address to send people to, so there's no link to
          share. Deploy the site and rebuild with <code>VITE_PUBLIC_URL</code> set, and the
          QR code comes back.
        </p>
      ) : (
        <>
          <div className="row gap-8">
            <button className="btn btn--primary grow" onClick={share}>
              Share
            </button>
            <button className="btn grow" onClick={copy}>
              Copy link
            </button>
          </div>
          <p className="micro center mt-12">
            Anyone with this link can watch — no account needed.
          </p>
        </>
      )}
    </Sheet>
  )
}
