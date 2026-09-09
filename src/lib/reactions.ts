/**
 * What the three reaction buttons say. These were 🔥 👏 😮, which meant the
 * middle one was a pair of disembodied hands at 13px on half the phones that
 * render it. A word is unambiguous and sets in the same face as everything else.
 *
 * It lives here rather than beside the components that use it so that `ui.tsx`
 * exports components and nothing else — mixing the two breaks fast refresh.
 */
export const REACTION_LABEL = { fire: 'Fire', clap: 'Clap', wow: 'Wow' } as const
