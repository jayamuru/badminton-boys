import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Player } from '../types'
import { initials } from '../lib/format'
import { AVATAR_TINTS } from '../lib/tints'

/* --- avatar --------------------------------------------------------------- */

/**
 * The player's photo if they've added one, their initials on their tint if not.
 *
 * The initials aren't a placeholder to be embarrassed about — most people never
 * upload anything, this is the state the app is usually in, and it identifies
 * someone at 26px better than a cropped face does. The photo is the option, not
 * the goal.
 */
export function Avatar({
  player,
  size = 'md',
  className = '',
}: {
  player: Player
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const mod = size === 'md' ? '' : ` avatar--${size}`
  return (
    <div
      className={`avatar${mod} ${className}`}
      style={{ ['--tint' as string]: player.tint }}
      aria-label={player.name}
    >
      {player.photo ? (
        <img className="avatar__photo" src={player.photo} alt="" />
      ) : (
        <span className="avatar__glyph">{initials(player.name)}</span>
      )}
    </div>
  )
}

/**
 * Pick your avatar colour. It replaces the old grid of animal emoji: there's
 * only one thing to choose now, and each swatch previews the initials you'll
 * actually be wearing rather than a mascot you have to squint at.
 */
export function TintPicker({
  value,
  onChange,
  name,
}: {
  value: string
  onChange: (tint: string) => void
  name: string
}) {
  const mark = initials(name || '?')
  return (
    <div className="tint-grid">
      {AVATAR_TINTS.map((t) => (
        <button
          key={t}
          type="button"
          className="tint-swatch"
          style={{ ['--tint' as string]: t }}
          aria-pressed={value === t}
          aria-label={`Avatar colour ${t}`}
          onClick={() => onChange(t)}
        >
          {mark}
        </button>
      ))}
    </div>
  )
}

export function AvatarStack({ players, size = 'sm' }: { players: Player[]; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <div className="avatar-stack">
      {players.map((p) => (
        <Avatar key={p.id} player={p} size={size} />
      ))}
    </div>
  )
}

/* --- live indicator ------------------------------------------------------- */

export const LivePill = ({ label = 'Live' }: { label?: string }) => (
  <span className="live-pill">
    <i className="live-dot" />
    {label}
  </span>
)

/* --- section header ------------------------------------------------------- */

export function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="section-head">
      <h2 className="section-head__title">{title}</h2>
      {action && (
        <button className="section-head__link" onClick={onAction}>
          {action} →
        </button>
      )}
    </div>
  )
}

/* --- segmented control ---------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  neon = false,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  neon?: boolean
}) {
  return (
    <div className={`segmented${neon ? ' segmented--neon' : ''}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          className="segmented__item"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* --- filter chips --------------------------------------------------------- */

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button
          key={o.value}
          className="chip"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* --- form guide ----------------------------------------------------------- */

export function FormDots({ form, max = 10 }: { form: boolean[]; max?: number }) {
  const shown = form.slice(0, max)
  const pad = Math.max(0, max - shown.length)
  return (
    <div className="form-dots" aria-label="Recent form, most recent first">
      {shown.map((w, i) => (
        <i key={i} className={`form-dot form-dot--${w ? 'w' : 'l'}`} />
      ))}
      {Array.from({ length: pad }, (_, i) => (
        <i key={`p${i}`} className="form-dot form-dot--none" />
      ))}
    </div>
  )
}

/* --- stat tile ------------------------------------------------------------ */

export const Stat = ({
  value,
  label,
  tone,
}: {
  value: ReactNode
  label: string
  tone?: 'neon' | 'win' | 'loss' | 'gold'
}) => (
  <div className="stat">
    <div className="stat__value" style={tone ? { color: `var(--${tone})` } : undefined}>
      {value}
    </div>
    <div className="stat__label">{label}</div>
  </div>
)

/* --- bottom sheet --------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  // Rendered on `body` rather than in place: a sheet is a full-screen overlay,
  // and anything that makes an ancestor a stacking context (a transform on the
  // page, a filter on a card) would otherwise slide it under the tab bar.
  return createPortal(
    <div className="scrim" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grab" />
        {title && <h2 className="sheet__title">{title}</h2>}
        {subtitle && <p className="small dim mb-12">{subtitle}</p>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/* --- action row ----------------------------------------------------------- */

/**
 * A row you tap. The icon tile it used to carry is now a slim colour rule —
 * it does the same job of telling one row from the next at a glance, without
 * asking you to decode a pictogram.
 */
export const ActionRow = ({
  title,
  sub,
  onClick,
  tint,
}: {
  title: string
  sub?: string
  onClick?: () => void
  tint?: string
}) => (
  <button className="action" onClick={onClick}>
    <span className="action__rule" style={tint ? { background: tint } : undefined} />
    <span className="grow">
      <span className="action__title">{title}</span>
      {sub && <span className="action__sub">{sub}</span>}
    </span>
    <span className="action__chev">›</span>
  </button>
)

/* --- empty state ---------------------------------------------------------- */

/**
 * Nothing-here state. The photograph carries the mood so the copy doesn't have
 * to apologise; `art={false}` drops it for the handful of places that sit
 * inside an already-tight card.
 */
export const Empty = ({
  title,
  body,
  cta,
  onCta,
  art = true,
}: {
  title: string
  body: string
  cta?: string
  onCta?: () => void
  art?: boolean
}) => (
  <div className="empty">
    {art && <span className="empty__art" role="presentation" />}
    <h3 className="empty__title">{title}</h3>
    <p className="empty__body">{body}</p>
    {cta && (
      <button className="btn btn--primary" onClick={onCta}>
        {cta}
      </button>
    )}
  </div>
)

/* --- back bar ------------------------------------------------------------- */

export function BackBar({ title, right, to }: { title?: string; right?: ReactNode; to?: string }) {
  const nav = useNavigate()
  return (
    <div className="back-bar">
      <button className="icon-btn" onClick={() => (to ? nav(to) : nav(-1))} aria-label="Back">
        ‹
      </button>
      {title && <h1 className="h3 grow truncate">{title}</h1>}
      {!title && <span className="grow" />}
      {right}
    </div>
  )
}

/* --- toast ---------------------------------------------------------------- */

const ToastCtx = createContext<(msg: string) => void>(() => {})

export function ToastHost({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)

  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout((show as unknown as { t?: number }).t)
    ;(show as unknown as { t?: number }).t = window.setTimeout(() => setMsg(null), 2200)
  }, [])

  const value = useMemo(() => show, [show])
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

/* --- progress bar --------------------------------------------------------- */

export const Bar = ({ value, color = 'var(--neon)' }: { value: number; color?: string }) => (
  <div className="bar">
    <div className="bar__fill" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: color }} />
  </div>
)
