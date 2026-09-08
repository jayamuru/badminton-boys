import { useState } from 'react'
import { authRedirectError, db, isNativeApp } from '../backend/client'
import { useApp } from '../store/AppStore'
import { Logo } from '../components/Logo'

/**
 * Cloud mode only. A badminton group shouldn't need a password ceremony, so
 * this is a one-time email code plus a one-tap guest option.
 *
 * The code matters more than it looks. Inside the Android app the page is
 * served from `https://localhost`, and a magic link tapped in Gmail opens the
 * *browser* — which has no way to hand the session back to the app. A six digit
 * code is typed into whichever copy of the app asked for it, so it works
 * everywhere without deep-link plumbing.
 */
export function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(authRedirectError)

  const sendCode = async () => {
    const address = email.trim()
    if (!address) return
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
      setErr(e instanceof Error ? e.message : 'Could not send the code')
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    const token = code.replace(/\D/g, '')
    if (token.length < 6) return
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

  const guest = async () => {
    setBusy(true)
    setErr(null)
    try {
      const { error } = await db().auth.signInAnonymously()
      if (error) throw error
    } catch (e) {
      setErr(
        e instanceof Error && /anonymous/i.test(e.message)
          ? 'Guest sign-in is switched off for this app. Use your email instead.'
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
        <div className="onb__art">📬</div>
        <h1 className="onb__title">Check your email</h1>
        <p className="onb__body">
          We sent a six digit code to <strong>{email.trim()}</strong>. Type it in below.
        </p>
        <p className="micro dim mt-8">
          Only a link in that email and no code? The Supabase <em>Magic Link</em> template
          is missing <code>{'{{ .Token }}'}</code> — see DEPLOY.md §1. Don't tap the link:
          it's one-time, and mail scanners usually spend it before you can.
        </p>

        <label className="field mt-24">
          <span className="field__label">Your code</span>
          <input
            className="input input--code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && void verify()}
            autoFocus
          />
        </label>

        {err && <p className="small mt-8" style={{ color: 'var(--loss)' }}>{err}</p>}

        <button
          className="btn btn--primary btn--lg btn--block mt-16"
          disabled={busy || code.length < 6}
          onClick={() => void verify()}
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <button
          className="btn btn--block mt-8"
          disabled={busy}
          onClick={() => {
            setSent(false)
            setCode('')
            setErr(null)
          }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div className="onb">
      <div className="onb__art">
        <div className="brand-lockup">
          <Logo size={140} />
          <div className="brand-lockup__tag">PLAY · SCORE · COMPETE · CLIMB</div>
        </div>
      </div>

      <div className="stack-lg">
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

        {err && <p className="small" style={{ color: 'var(--loss)' }}>{err}</p>}

        <button
          className="btn btn--primary btn--lg btn--block"
          disabled={busy || !email.trim()}
          onClick={() => void sendCode()}
        >
          {busy ? 'Sending…' : 'Email me a sign-in code'}
        </button>

        <div className="or-line">
          <span>or</span>
        </div>

        <button className="btn btn--block" disabled={busy} onClick={guest}>
          👀 Have a look around as a guest
        </button>
        <p className="micro center">
          A guest is a fresh throwaway account every time. Use your email if you want the
          same player card and rating to be here next time.
        </p>
      </div>

      <p className="micro center mt-16">
        Everyone who signs in here shares the same players, matches and leaderboards.
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
      <div className="onb__art">📡</div>
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
