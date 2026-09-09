import { useState } from 'react'
import { authRedirectError, db, isNativeApp } from '../backend/client'
import { useApp } from '../store/AppStore'
import { Logo } from '../components/Logo'

/**
 * Near-misses of the big providers, which silently swallow a sign-in.
 *
 * A mistyped domain isn't an error anywhere: the address is well-formed, so
 * Supabase accepts it and reports success, and the app cheerfully asks for a
 * code that was posted into the void. Worth catching, because the failure is
 * indistinguishable from every other reason an email doesn't arrive.
 */
const DOMAIN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
}

/**
 * How long a sign-in code can be.
 *
 * Six is the Supabase default, but the length is a project setting that goes up
 * to ten — and a field capped at six *silently truncates* a longer code, so the
 * paste looks right, the sign-in fails, and nothing anywhere says why. Accept
 * the widest the server can issue and let it decide what's valid.
 */
const CODE_MAX = 10
const CODE_MIN = 6

/** The address they probably meant, or null if this one looks fine. */
function suggestAddress(input: string): string | null {
  const [name, domain] = input.trim().toLowerCase().split('@')
  if (!name || !domain) return null
  const fixed = DOMAIN_TYPOS[domain]
  return fixed ? `${name}@${fixed}` : null
}

/**
 * Cloud mode only. A badminton group shouldn't need a password ceremony, so
 * this is a one-time code sent to an email address and nothing else.
 *
 * There was a guest option beside it, signing in anonymously. It's gone: a
 * guest is a fresh throwaway player every time, so anyone who used it turned up
 * on the leaderboard as a stranger with no history and no way back into the
 * account they'd just been given.
 *
 * The code matters more than it looks. Inside the Android app the page is
 * served from `https://localhost`, and a magic link tapped in Gmail opens the
 * *browser* — which has no way to hand the session back to the app. A code is
 * typed into whichever copy of the app asked for it, so it works everywhere
 * without deep-link plumbing.
 */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(authRedirectError)
  const suggestion = suggestAddress(email)

  const sendCode = async () => {
    const address = email.trim()
    if (!address) {
      // Say why rather than sitting there dead: a greyed-out primary with no
      // explanation is the least helpful thing this screen could do.
      setErr('Enter your email address first.')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const { error } = await db().auth.signInWithOtp({
        email: address,
        options: {
          shouldCreateUser: true,
          // Only meaningful in a browser; harmless in the packaged app.
          emailRedirectTo: isNativeApp
            ? undefined
            : window.location.origin + window.location.pathname,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (e) {
      // Both of these are the app's problem, not the reader's, and the raw
      // strings ("Error sending magic link email") invite them to retype a
      // perfectly good address forever. Say who has to fix it instead.
      //
      // Rate limits: the sender is capped per hour for the whole project, so
      // this fires on the third person to sign in rather than on anything they
      // did. Send failures: a rejected or misconfigured SMTP relay. Both are
      // settings on the server — see DEPLOY.md §1.
      const message = e instanceof Error ? e.message : ''
      setErr(
        /rate limit/i.test(message)
          ? "Too many sign-in emails have gone out from this app in the last hour, so the server won't send another one yet. Wait a few minutes and try again."
          : /sending|smtp|magic link/i.test(message)
            ? "The app couldn't send that email. Nothing's wrong with your address — this is the app's email setup, so tell whoever runs it."
            : message || 'Could not send the code',
      )
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setNote(null)
    await sendCode()
    setNote('Sent again. Check your spam folder too — and use the newest code, older ones stop working.')
  }

  const verify = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < CODE_MIN) return
    setBusy(true)
    setErr(null)
    try {
      const { error } = await db().auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      })
      if (error) throw error
      // A successful verify fires onAuthStateChange, which reboots the store.
    } catch (e) {
      setErr(
        e instanceof Error && /expired|invalid/i.test(e.message)
          ? 'That code is wrong or has expired. Send yourself a new one.'
          : e instanceof Error
            ? e.message
            : 'Could not sign in',
      )
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="onb">
        <div className="onb__photo onb__photo--feather" role="presentation" />
        <h1 className="onb__title">Check your email</h1>
        <p className="onb__body">
          We sent a sign-in code to <strong>{email.trim()}</strong>. Type it in below.
        </p>
        <p className="micro dim mt-8">
          It can take a minute, and it sometimes lands in spam. If the email has a link in
          it, ignore the link and type the code — links get opened by spam filters before
          they reach you, which uses them up.
        </p>

        <label className="field mt-24">
          <span className="field__label">Your code</span>
          <input
            className="input input--code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_MAX}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_MAX))}
            onKeyDown={(e) => e.key === 'Enter' && void verify()}
            autoFocus
          />
        </label>

        {err && <p className="small mt-8" style={{ color: 'var(--loss)' }}>{err}</p>}
        {!err && note && <p className="small dim mt-8">{note}</p>}

        <button
          className="btn btn--primary btn--lg btn--block mt-16"
          disabled={busy || code.length < CODE_MIN}
          onClick={() => void verify()}
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <button className="btn btn--block mt-8" disabled={busy} onClick={() => void resend()}>
          {busy ? 'Sending…' : 'Send a new code'}
        </button>

        <button
          className="btn btn--ghost btn--block mt-8"
          disabled={busy}
          onClick={() => {
            setSent(false)
            setCode('')
            setErr(null)
            setNote(null)
          }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="onb signin">
      {/*
        Logo and form as one centred block. There is exactly one thing to do on
        this screen, so it belongs in the middle of it — the form used to sit at
        the bottom with a hundred-odd pixels of nothing above it, which read as
        a page that hadn't finished loading.
      */}
      <div className="signin__mid">
        <div className="brand-lockup">
          <Logo size={132} />
          <div className="brand-lockup__tag">PLAY · SCORE · COMPETE · CLIMB</div>
        </div>

        <div className="stack-lg mt-32">
          <label className="field">
            <span className="field__label">Sign in with your email</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void sendCode()}
            />
          </label>

          {suggestion && (
            <p className="small">
              Did you mean{' '}
              <button className="link" onClick={() => setEmail(suggestion)}>
                {suggestion}
              </button>
              ? Nothing will arrive if the address is wrong.
            </p>
          )}

          {err && <p className="small" style={{ color: 'var(--loss)' }}>{err}</p>}

          <button
            className="btn btn--primary btn--lg btn--block"
            disabled={busy}
            onClick={() => void sendCode()}
          >
            {busy ? 'Sending…' : 'Email me a sign-in code'}
          </button>
        </div>
      </div>

      {/* Sentence case, not `.micro` — that's an all-caps label style, and a
          sentence set in it is a chore to read. */}
      <p className="small dim center">
        copyrights reserved
      </p>
    </div>
  )
}

/** Shown while the first load is in flight. */
export function CloudSplash() {
  return (
    <div className="onb center">
      <div className="brand-lockup">
        <Logo size={140} />
      </div>
      <p className="small dim mt-24">Loading the season…</p>
    </div>
  )
}

export function CloudError() {
  const { cloud } = useApp()
  return (
    <div className="onb center">
      <div className="onb__photo onb__photo--mesh" role="presentation" />
      <h1 className="onb__title">Can't reach the server</h1>
      <p className="onb__body">{cloud.error ?? 'Something went wrong on the way to the database.'}</p>
      <button className="btn btn--primary btn--block mt-24" onClick={() => location.reload()}>
        Try again
      </button>
      <button className="btn btn--block mt-8" onClick={() => void cloud.signOut()}>
        Sign out
      </button>
    </div>
  )
}
