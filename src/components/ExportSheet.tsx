import { useRef, useState } from 'react'
import type { Player } from '../types'
import type { PlayerStats } from '../engine/stats'
import { Avatar, Sheet, useToast } from './ui'

/** True inside the packaged Android app, where anchor downloads are a no-op. */
const isWebView = () =>
  typeof window !== 'undefined' &&
  ((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ??
    /\bwv\b/.test(navigator.userAgent))

interface Row {
  player: Player
  stats: PlayerStats
  rank: number
}

/**
 * "Weekly Top 10" — a clean, branded graphic sized for a WhatsApp forward.
 * Rendered to a canvas so what you share is a real image, not a screenshot of
 * a UI with a status bar in it.
 */
export function ExportSheet({
  open,
  onClose,
  rows,
  board,
  scope,
  valueFor,
}: {
  open: boolean
  onClose: () => void
  rows: Row[]
  board: string
  scope: string
  valueFor: (p: Player, s: PlayerStats) => string
}) {
  const toast = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [rendered, setRendered] = useState<string | null>(null)

  const draw = (): HTMLCanvasElement => {
    const W = 1080
    const H = 1350
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')!

    g.fillStyle = '#000000'
    g.fillRect(0, 0, W, H)

    const glow = g.createRadialGradient(W, 0, 0, W, 0, W * 1.1)
    glow.addColorStop(0, 'rgba(200,255,46,0.20)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = glow
    g.fillRect(0, 0, W, H)

    const font = (w: number, s: number) =>
      `${w} ${s}px "Inter Tight", -apple-system, "Segoe UI", Roboto, sans-serif`

    g.fillStyle = '#C8FF2E'
    g.font = font(800, 30)
    g.letterSpacing = '6px'
    g.fillText('🏸 BADMINTON BOYS', 72, 116)

    g.fillStyle = '#FFFFFF'
    g.font = font(800, 84)
    g.letterSpacing = '-2px'
    g.fillText('WEEKLY TOP 10', 72, 226)

    g.fillStyle = '#7E8794'
    g.font = font(600, 32)
    g.letterSpacing = '0px'
    g.fillText(`${scope.replace(/^\S+\s/, '')} · ${board}`, 72, 280)

    let y = 372
    rows.slice(0, 10).forEach((r, i) => {
      const medal = i === 0 ? '#FFC83D' : i === 1 ? '#CBD5E1' : i === 2 ? '#E0854B' : '#464E5A'

      if (i === 0) {
        g.fillStyle = 'rgba(255,200,61,0.08)'
        g.beginPath()
        g.roundRect(56, y - 46, W - 112, 84, 20)
        g.fill()
      }

      g.fillStyle = medal
      g.font = font(800, 40)
      g.textAlign = 'center'
      g.fillText(String(i + 1), 96, y + 12)

      g.textAlign = 'left'
      g.font = font(400, 42)
      g.fillText(r.player.emoji, 148, y + 14)

      g.fillStyle = '#FFFFFF'
      g.font = font(700, 40)
      g.fillText(r.player.name, 216, y + 12)

      g.fillStyle = '#C8FF2E'
      g.font = font(800, 42)
      g.textAlign = 'right'
      g.fillText(valueFor(r.player, r.stats), W - 72, y + 12)
      g.textAlign = 'left'

      g.strokeStyle = 'rgba(255,255,255,0.07)'
      g.beginPath()
      g.moveTo(72, y + 46)
      g.lineTo(W - 72, y + 46)
      g.stroke()

      y += 92
    })

    g.fillStyle = '#464E5A'
    g.font = font(700, 26)
    g.letterSpacing = '4px'
    g.fillText('PLAY. SCORE. COMPETE. CLIMB.', 72, H - 76)

    return c
  }

  const shareImage = async () => {
    setBusy(true)
    try {
      const canvas = draw()
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('render failed')
      const file = new File([blob], 'badminton-boys-top10.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Badminton Boys — Weekly Top 10' })
        return
      }

      // Anchor downloads don't work in an Android web view, so hand the image
      // back on screen instead — long-press is the native way to save or send it.
      if (isWebView()) {
        setRendered(canvas.toDataURL('image/png'))
        toast('Long-press the image to save or send it')
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'badminton-boys-top10.png'
      a.click()
      URL.revokeObjectURL(url)
      toast('Image downloaded')
    } catch {
      toast('Could not create the image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share the table"
      subtitle="A clean graphic sized for WhatsApp and stories."
    >
      <div className="share-card" ref={cardRef}>
        <div className="court-lines" />
        <p className="micro" style={{ color: 'var(--neon)', letterSpacing: '0.24em' }}>
          🏸 BADMINTON BOYS
        </p>
        <h2 className="h1 mt-8">Weekly Top 10</h2>
        <p className="small dim">
          {scope.replace(/^\S+\s/, '')} · {board}
        </p>

        <div className="mt-16">
          {rows.slice(0, 10).map((r, i) => (
            <div className="top10-row" key={r.player.id}>
              <span className="top10-row__n">{i + 1}</span>
              <Avatar player={r.player} size="xs" />
              <span className="top10-row__name truncate">{r.player.name}</span>
              <span className="top10-row__v">{valueFor(r.player, r.stats)}</span>
            </div>
          ))}
        </div>

        <div className="share-card__brand">
          <span>PLAY · SCORE · COMPETE · CLIMB</span>
        </div>
      </div>

      {rendered && (
        <div className="mt-16">
          <img
            src={rendered}
            alt="Weekly Top 10"
            style={{ width: '100%', borderRadius: 18, display: 'block' }}
          />
          <p className="micro center mt-8">Long-press to save it or send it straight to WhatsApp.</p>
        </div>
      )}

      <button className="btn btn--primary btn--block mt-16" onClick={shareImage} disabled={busy}>
        {busy ? 'Rendering…' : rendered ? 'Render again' : 'Share as image'}
      </button>
    </Sheet>
  )
}
