import logo from '../assets/logo.png'

/**
 * The brand mark. The artwork already carries the wordmark, so this replaces
 * the old emoji-plus-text lockup rather than sitting above it.
 */
export function Logo({ size = 132, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <img
      className={`logo${glow ? ' logo--glow' : ''}`}
      src={logo}
      width={size}
      height={size}
      alt="Badminton Boys"
      draggable={false}
    />
  )
}
