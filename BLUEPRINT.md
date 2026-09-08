# Badminton Boys — Functional Blueprint

**Play. Score. Compete. Climb.**

A mobile-first badminton app that is not a scorekeeper. It is a live scoreboard, a
ranking platform, a community and a personal stats app that happens to also count
points. This document describes what was built, how it behaves and why it is put
together the way it is.

---

## 1. Design system

| Decision | Value | Reason |
| --- | --- | --- |
| Base | `#000000` true black | OLED pixels are off. A phone propped on a bench for a 40-minute session burns noticeably less battery. |
| Surfaces | `#0b0d10` → `#22262f`, four steps | Depth without shadows-on-black mush. |
| Accent | Neon green `#C8FF2E` | One accent, used only for *the thing you should touch* or *the thing that just changed*. |
| Live | `#FF2D46` | Reserved. Red means "happening right now" and nothing else. |
| Win / loss | `#22E58A` / `#FF5A5F` | Never used as a general accent, so a green number always means "you won". |
| Type | Inter Tight, 400–900 | Tight tracking holds up at 140px. Tabular numerals so scores don't jitter as they tick. |
| Score type | `clamp(76px, 27vw, 140px)`, weight 900 | Legible from the far tramline of the next court. |
| Radius | 18–28px | Rounded, generous, not pill-everything. |
| Gradients | Two, both barely visible | The brief called for restraint; colour does the work instead. |
| Motion | 120–260ms, one transform at a time | Fully disabled under `prefers-reduced-motion`. |
| Shell | 460px max, centred, `env(safe-area-inset-*)` | Phone-shaped on a desktop, notch-safe on a real device. |

Tokens live in `src/styles/tokens.css`. Nothing hard-codes a hex value outside that file.

---

## 2. Architecture

```
src/
  types.ts            domain model — Player, Match, Rally, Club, Tournament…
  engine/
    scoring.ts        BWF rules engine (pure, no React)
    scoring.test.ts   22 tests over the rules
    rating.ts         ELO + the five tiers
    stats.ts          every statistic, all derived
    achievements.ts   8 badges with progress
  store/AppStore.tsx  reducer + localStorage + BroadcastChannel
  data/seed.ts        150 days of simulated season
  components/         Avatar, cards, tab bar, share sheet, export sheet…
  screens/            the 20 routes
  styles/             tokens / base / components / screens
```

### The one idea everything rests on: **a match is a list of rallies**

```ts
interface Match { rallies: Rally[]; firstServe: Side; format: Format; … }
interface Rally  { by: Side; at: number }
```

No score is ever stored. Games won, the current score, who is serving, from which
service court, which player is serving in doubles, whether it is game point or match
point, and who won — all of it is *folded out of the rally list* by
`computeState(match)`.

That single decision buys:

- **Undo is `rallies.pop()`.** It cannot desync, because there is nothing to desync from.
- **The timeline is free.** Replaying the fold gives every point in order.
- **Corrections are auditable.** A fixed score is a new rally list plus a `Correction`
  record; the old one is still described in the log.
- **Statistics can never contradict the scoreboard**, because they read the same fold.

### State, persistence and the second screen

`AppProvider` is a `useReducer` over a 25-action union, persisted to
`localStorage['badminton-boys:v1']` on every change and broadcast on
`BroadcastChannel('badminton-boys:live')`. A spectator tab receives the state and
re-renders — which is how live spectating works with no backend at all. An echo guard
stops the two tabs from ping-ponging updates forever.

### The backend (`backend/`, `supabase/schema.sql`)

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and the same provider swaps its
persistence layer for Postgres. `useApp()` returns exactly the same shape either way, so
not one screen knows the difference.

```
dispatch(action) ──▶ reducer (instant, optimistic)
                └──▶ pushAction(action) ──▶ Postgres
                                             │
                     realtime subscription ◀─┘
                                             │
                            loadWorld() ◀────┘   (coalesced, 120ms)
```

Three decisions worth naming:

**The server owns the rules.** `supabase/schema.sql` carries a plpgsql mirror of
`engine/scoring.ts` and `engine/rating.ts`. Points are appended by `bb_add_point()`, not
written as a whole array, so two people scoring the same match on two phones interleave
instead of overwriting each other. Ratings move only inside `bb_settle_match()`; a trigger
reverts any other write to `profiles.rating`. The client's copy of the engine exists purely
for instant feedback — it is never trusted. Duplicating the logic in two languages is a
real cost, accepted because "anyone can edit the request and award themselves 400 points"
is not a rating system.

**A result still needs both sides.** `bb_settle_match` refuses to run without a
confirmation from each team — except when the other side consists only of *managed players*
(people added to the roster who have never signed in), who can't confirm anything and would
otherwise freeze the match forever.

**Spectators have no account.** `#/watch/:id` is served by a separate read-only path
(`loadPublicWorld` + a single-row subscription) behind an `anon` RLS policy that exposes
matches which are live or finished, and player names. Dispatch is inert in that mode and
the gate refuses every other route, so a shared link is a window into one match and nothing
more.

---

## 3. The rules engine (`engine/scoring.ts`)

Implements BWF rally-point scoring in full.

- **21 points, win by 2, hard cap at 30.** At 29–29 the next rally takes it. `isGameOver`
  is a three-line function and every branch is tested.
- **Best of 1 / 3 / 5.** Configurable per match; 3 is the default. Rallies played after
  the match is already decided are ignored rather than corrupting the result.
- **Service court.** Even score → serve from the **right**, odd → **left**. Shown as a
  live mini-court diagram, not as text.
- **Doubles rotation, correct.** The serving pair swaps courts and keeps serve when it
  wins a rally; the receiving pair never swaps when it gains serve. Service is diagonal,
  so a serve from the right court is received in the receiver's own right court. Four
  dedicated tests cover the four cases people get wrong.
- **First serve of the next game** goes to the winner of the previous one.
- **11-point interval** and **change of ends at 11 in the deciding game** are both surfaced.
- **Game point / match point** are derived, not flagged by hand.

`npx vitest run` — 43 tests, all green (22 engine, 19 route smoke, 2 scoring interaction).

---

## 4. Feature 1 — the live scoring screen (`screens/Scoring.tsx`)

The screen a sweaty person uses between rallies. Everything else was cut from it.

- **Two giant tap zones.** The screen is split in half; the whole half is the button.
  There are no small targets. Each half shows its team, its score at 140px, and — when
  it is serving — the server, the receiver and the service court.
- **No clock.** No date, no session timer, no notification badges. Per the brief,
  the active scoring screen has nothing on it that is not the match.
- **Undo is always visible**, in the centre strip, one tap, no confirmation. Undoing
  clears any result confirmations that were already given.
- **Swap ends** is a single tap. It flips the left/right *layout only* — it can never
  change the score, and there is a test asserting exactly that.
- **Wake lock** is requested on entry, so the screen doesn't sleep mid-game.
- **Haptics** on every point via `navigator.vibrate`, with a distinct pattern at match point.
- **Match point** takes over the screen with a banner. **Interval** and **change ends**
  get their own.
- **Share live match** opens a broadcast sheet with a **QR code** and a copyable link
  (`…#/watch/<matchId>`). Anyone who scans it gets the read-only spectator view.
- Exiting mid-match asks first. The rally list is saved either way.

### Roles on this screen

| Role | What they get |
| --- | --- |
| **Umpire / player** (scorer) | The tap zones, undo, swap ends, share. |
| **Spectator** | `/watch/:id` — the same score, live, with reactions and the point timeline, and no way to touch it. The footer says so plainly. |

---

## 5. Match lifecycle

```
created → confirmed → ready → live → match point → awaiting confirmation
   → completed → stats updated → history
                     ↘ disputed → organiser resolves → completed
```

- An invited player must **accept** before a match is confirmed.
- When the engine says the match is finished, it flips to `awaiting_confirmation`
  automatically and the celebration fires.
- **A result settles only when one player from *each* side confirms it.** One team
  cannot sign off its own win.
- Either side can **dispute** instead, with a written claim. A disputed match goes to
  an **organiser** — a player cannot silently rewrite a score.
- Every correction is written to `match.corrections` and shown in the match detail as a
  visible history. Nothing is edited invisibly.
- Ratings are applied at settlement, once, and the movement is shown on the scorecard.

Roles: **player**, **scorer**, **organiser**, **admin**.

---

## 6. Feature 2 — leaderboard and player stats

### Rating vs ranking — deliberately different objects

**Rating** is a number you own (ELO, starts at 1000). **Ranking** is a position you
hold relative to others. They are never drawn the same way: rating is a large tinted
number with a tier, ranking is a `#n` with a movement arrow.

**Tiers:**

| Tier | From |
| --- | --- |
| 🏸 Shuttle Rookie | 0 |
| 🎯 Rally Regular | 950 |
| ⚡ Smash Contender | 1100 |
| 👑 Court Elite | 1250 |
| 🔥 Legend | 1400 |

ELO details: placement K is 1.6× for a player's first ten matches so new players find
their level fast; K is 0.75× above 1300 so the top of the table is sticky; the point
spread weights the swing so a 21–5 moves more than a 22–20; doubles uses the team mean.
Casual matches never move a rating, and the app says so before you start one.

### Boards and scopes

Five boards — **Overall rating**, **Form** (last 10), **Most wins**, **Best win rate**,
**Longest streak** — across five scopes: **Global / India / City / Club / Friends**.

Win-rate and point-difference boards require a **20-match minimum** to qualify, so nobody
tops the table at 3–0.

### The sortable table

A toggle switches the leaderboard between the card view and a dense data table sortable
by **Total Wins**, **Win-Rate %** and **Point Difference Ratio** (points won ÷ points
played — the stat that separates "won a lot of close ones" from "actually dominant").

### Head-to-head (`/h2h/:a/:b`)

Two players side by side: the meetings bar, games and points won against each other, and
a row-by-row comparison of rating, career wins, win rate, best streak and PDR, with the
better value highlighted on each row. Below it, every match they have played. If they
have never met, the screen offers to set the first one up.

### Weekly Top 10 export

A button renders a **1080×1350 PNG on a canvas** — black, branded, gold-highlighted first
place, the current board and scope in the subtitle, `PLAY. SCORE. COMPETE. CLIMB.` along
the bottom. It shares through `navigator.share({files})` where that exists and downloads
where it doesn't. It is a real image, not a screenshot with someone's battery icon in it.

---

## 7. Screens

| Route | What it is |
| --- | --- |
| `/` | Home — a live community feed: Live Now, Your Next Match, Top Players, Recent Results, the "What's Happening" pulse |
| `/live` | Every live match, filterable, with tight games surfaced first |
| `/play` | The `+ PLAY` hub: Quick Match, Create, Join, Challenge, Tournament |
| `/create` | 4-step match creation: type → players → format → details |
| `/leaderboard` | Boards, scopes, podium, table toggle, export |
| `/profile`, `/player/:id` | Stats, form dots, rating movement, achievements, doubles partnerships, history |
| `/match/:id` | Scorecard, timeline, reactions, confirmation / dispute, correction log |
| `/score/:id` | The scoring screen |
| `/watch/:id` | The spectator broadcast view |
| `/h2h/:a/:b` | Head-to-head comparison |
| `/players`, `/clubs`, `/club/:id` | Find players, find clubs, club page + admin dashboard |
| `/tournament/:id` | Live court dashboard, group stage, knockout bracket |
| `/notifications` | Invites, results, challenges, ranking changes |
| `/welcome`, `/register` | 5-slide onboarding, then the player card |

Every list has a written empty state that tells you what to do next, not "No data".

---

## 8. Demo data

`data/seed.ts` does not contain hand-written statistics. It **simulates a 150-day season**:
24 players with skill profiles play rally-by-rally through the real engine, with real ELO
applied as the season progresses. A seeded PRNG (mulberry32) makes it deterministic.

The consequence is that everything reconciles — a player's win rate, their PDR, their form
dots, their rating, their head-to-head record and the individual scorecards all agree,
because they came from the same 30,000 simulated rallies. It also ships a tournament in
progress, six live matches (one at 20–20), pending invitations and open challenges.

---

## 9. Scope

**Built (MVP + most of phase 2):** registration and profiles, match creation and
invitations, the full lifecycle, live scoring with the complete BWF engine, spectating,
result confirmation and disputes, corrections with history, match history, all five
leaderboards across five scopes, ratings and tiers, head-to-head, doubles partnership
stats, achievements, challenges, following, clubs with an admin dashboard, tournaments
with brackets and a court dashboard, notifications, sharing, and the Weekly Top 10 export.

Plus a **real backend**: Postgres on Supabase with row-level security, email and guest
accounts, realtime multi-device scoring and spectating, and server-authoritative ratings.

**Not built (phase 3):** push notifications, seasons with resets, player-of-the-week
automation, monthly challenges, and video/photo attachments. Tournament brackets are stored
and rendered but not yet advanced by the server.

---

## 10. Verification

```
npm run test     # 62 passing: rules engine, every route mounts, empty state, reset
npm run build    # typecheck + production build, clean
npm run lint     # oxlint, 0 errors
```

The database half was checked the same way: `supabase/schema.sql` was applied twice to a
clean Postgres 16 (it is idempotent) and then exercised end to end — a 21-0 game, a 30-29
cap finish, a best-of-3, undo removing exactly the last rally, a one-sided confirmation
correctly *not* settling, a two-sided one settling at ±45 to match `engine/rating.ts`, a
managed-player match settling on one confirmation, a direct `update profiles set rating`
being reverted by the guard trigger, and a non-participant being refused the ability to
score someone else's match.
