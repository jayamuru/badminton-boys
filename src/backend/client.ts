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
