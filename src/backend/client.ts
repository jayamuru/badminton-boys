import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * The app runs in one of two modes.
 *
 *  - **Local** (no env vars): everything lives in localStorage with the demo
 *    season. Clone the repo, `npm run dev`, and it works with zero setup.
 *  - **Cloud** (env vars present): Postgres on Supabase, shared by everyone who
 *    signs in, with live scores pushed over realtime.
 *
 * Nothing above this file knows which one is in use.
 */
export const cloudEnabled = Boolean(url && key)

/**
 * True inside the Capacitor Android/iOS shell.
 *
 * Capacitor serves the bundle from `https://localhost`, so anything that leaves
 * the app and tries to come back — an emailed magic link, an OAuth redirect —
 * lands in the system browser and can never hand the session over. Code paths
 * that depend on a round trip check this first.
 */
export const isNativeApp =
  typeof window !== 'undefined' &&
  (Boolean((window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    ?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:')

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Not the default, and load-bearing: the implicit flow hands the session
        // back in the URL hash (`#access_token=...`), which is exactly where a
        // HashRouter keeps the current route. PKCE returns `?code=...` in the
        // query string instead, so the two never fight over the fragment.
        flowType: 'pkce',
      },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : null

/** Narrowing helper — throws only if called in local mode, which is a bug. */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/**
 * A failed email link, read off the URL Supabase bounced us back to.
 *
 * Supabase reports these in the query string *and* the fragment, which is a
 * problem here twice over: the fragment is where HashRouter keeps the route, so
 * `#error=access_denied&...` parses as a nonsense path and the app renders a
 * blank screen instead of an explanation. Grab the message, put the URL back to
 * something the router understands, and let the sign-in screen say what went
 * wrong.
 *
 * Read at module load, before the router mounts. Deliberately never touches a
 * URL carrying `code=` — that one is a *successful* PKCE handshake that the
 * client above still needs to exchange.
 */
export const authRedirectError: string | null = (() => {
  if (typeof window === 'undefined') return null
  const { search, hash, origin, pathname } = window.location
  const fragment = hash.startsWith('#/') ? '' : hash.replace(/^#/, '')
  const params = new URLSearchParams(search.replace(/^\?/, ''))
  const fromHash = new URLSearchParams(fragment)
  const code = params.get('error_code') ?? fromHash.get('error_code')
  const description = params.get('error_description') ?? fromHash.get('error_description')
  if (!code && !description) return null

  // Expired *or* already used. A one-time link that fails on the first human
  // click has usually been opened by something else first — mail providers
  // routinely fetch links to scan them, which spends the token.
  const message =
    code === 'otp_expired'
      ? 'That sign-in link had already been used or had expired. Email links get consumed by spam scanners before you ever tap them, which is why the six digit code is the reliable way in.'
      : (description?.replace(/\+/g, ' ') ?? 'That sign-in link did not work.')

  window.history.replaceState(null, '', `${origin}${pathname}#/`)
  return message
})()
