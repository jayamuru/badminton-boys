# 🏸 Badminton Boys

**Play. Score. Compete. Climb.**

A dark-mode, mobile-first badminton app: live scoring with a complete BWF rules engine,
spectator broadcasts over a QR code, ELO ratings with tiers, leaderboards, head-to-head
comparisons, clubs and tournaments.

**▶ Live: https://jayamuru.github.io/badminton-boys/**

Deployed from `main` by GitHub Actions on every push — no APK needed. Add it to your home
screen and it behaves like an installed app.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Use your browser's device toolbar (⌘⇧M in Chrome) — it is
designed for a phone and the shell is capped at 460px on desktop.

```bash
npm run test    # 62 tests — rules engine, every route, empty state, reset behaviour
npm run build   # typecheck + production build
npm run lint    # oxlint
```

That gives you the **local demo** — a simulated season on this device, no setup. To turn it
into a real multi-user app with a shared database, see
**[Making it real](#making-it-real-a-shared-database)** below.

## Try this first

1. You land on the **5-slide onboarding**, then set up your player card.
2. **Home** shows live matches, your next match and the community pulse.
3. Tap a **🔴 LIVE** match → **Continue scoring**.
4. On the scoring screen, tap either half of the screen to award a point. Try **↩ Undo**
   and **⇄ Swap ends**. Watch the serve indicator move between the right and left service
   courts as the score goes even → odd.
5. Tap **share** in the top right → you get a **QR code and a link**. Open that link in a
   second tab and put the two windows side by side: score in one, and the spectator view
   updates live in the other.
6. Play a match out. At 20-something you get the **match point** takeover, then the win
   celebration, then the result waits for confirmation from **both sides**.
7. **Leaderboard** → switch scopes and boards, flip to the **table** view to sort by wins,
   win rate or point difference ratio, then hit **export** for the shareable
   **Weekly Top 10** image.
8. **Profile** → **compare** against anyone for the full head-to-head record.

Everything is seeded with a simulated 150-day season, so the stats, ratings, form and
scorecards all agree with each other.

## How it works

State lives in one reducer over a serialisable object. A match stores only its **list of
rallies**; the score, serve, service court, game/match point and winner are all derived
from that list, so undo is exact and the stats can never disagree with the scoreboard.

That reducer has two persistence layers and the screens can't tell which is in use:

- **Local** — `localStorage`, fanned out over `BroadcastChannel` so a spectator tab follows
  the scoring tab with no server at all.
- **Cloud** — Postgres on Supabase, fanned out over realtime subscriptions so a spectator's
  *phone* follows the scoring phone.

Full design decisions, the rules engine, the match lifecycle and the rating model are in
**[BLUEPRINT.md](./BLUEPRINT.md)**.

## Making it real: a shared database

Set two environment variables and the same app becomes multi-user — real accounts, one
shared leaderboard, live scores on everyone's phone.

```bash
cp .env.example .env.local     # then fill in the two values
```

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](./supabase/schema.sql) → **Run**.
3. **Authentication → Providers** → Email is on by default; enable *Anonymous sign-ins* if
   you want a guest button.
4. **Authentication → Emails → Magic Link** → add `{{ .Token }}` to the template. Sign-in
   is a typed six digit code, not a tapped link, because a link opens the system browser
   and the Android app can't get the session back from there. The stock template has no
   token in it, so skipping this makes sign-in look broken.
5. **Project Settings → API Keys** → copy the Project URL and the **publishable** key into
   `.env.local`. Never the `sb_secret_…` one — that bypasses every security policy.
6. `npm run dev` — you now get a sign-in screen instead of the demo.

The schema isn't just tables. It carries a **server-side copy of the rules engine and the
rating maths**, so points are appended by the database (two phones can score the same match
without clobbering each other), a result needs sign-off from both sides, and a trigger
reverts any attempt to write a rating from the client. Deploy anywhere static —
**Vercel is the easy answer** — and remember to set the same two variables there.

Step by step, including auth redirect URLs and how to keep the community private:
**[DEPLOY.md](./DEPLOY.md)**.

## Stack

Vite 8 · React 19 · TypeScript · React Router (HashRouter) · Vitest · `qrcode` ·
Supabase (Postgres + RLS + realtime) · Capacitor for Android.
No UI framework — the design system is hand-written CSS tokens.

## The demo data

With no database configured, everything you see on first launch is a **simulated season** —
24 invented players and a few hundred matches, there so no screen is ever empty. (In cloud
mode there is none: the database starts empty.) To get rid of it:

**Profile → ⚙︎ Settings → 🧹 Clear demo data & start fresh**

That leaves just your profile, and it stays cleared across reloads. Then
**Find players → ＋ Add player** to build your own roster. You can also choose
"Start empty" on the registration screen instead.

## Hosting and Android

Deploy it (Netlify / Vercel / GitHub Pages) or package it as an Android app with the
Capacitor project in `android/`:

```bash
npm run android:open   # build, sync, open Android Studio
npm run android:apk    # build a debug APK (needs a JDK)
```

Full instructions — including clearing data, hosting options, signing a release build, and
what changes when it runs natively — are in **[DEPLOY.md](./DEPLOY.md)**.
