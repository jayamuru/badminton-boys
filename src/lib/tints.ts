/**
 * Avatar tints — the one place the palette lives, so the seeded roster, the
 * add-a-player sheet and onboarding can't drift apart.
 *
 * Every colour here is deliberately clear of the four that carry meaning
 * elsewhere in the app: lime (you / tap me), red (live), green (won) and red
 * again (lost). An avatar is a solid block of its tint behind the player's
 * initials, so a lime one would read as a button and a green one as a result.
 */
export const AVATAR_TINTS = [
  '#5AC8FA',
  '#8B7CFF',
  '#FF6B9D',
  '#FFC83D',
  '#4DD8C0',
  '#F97E5B',
  '#A78BFA',
  '#38BDF8',
  '#E879C9',
  '#C99A5B',
] as const

/** A stable tint for someone who arrived without one — same name, same colour. */
export function tintFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]
}
