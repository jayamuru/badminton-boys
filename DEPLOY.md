# Deploying Badminton Boys

How to give the app a real database, put it on the internet so a group of people can
share it, clear the demo data, and package it for Android.

---

## 0. The two modes

The app runs in one of two modes, decided entirely by whether two environment variables
are set.

| | **Local mode** (no env vars) | **Cloud mode** (env vars set) |
| --- | --- | --- |
| Where data lives | `localStorage`, this device only | Postgres, shared by everyone |
| Accounts | none | six digit email code, or guest sign-in |
| Other people | can't see your matches | see the same players, matches and leaderboard |
| Live spectating | other tabs on the same device | anyone's phone, anywhere |
| Setup needed | none — `npm run dev` | ~10 minutes, below |
| Cost | free | free |

Local mode is the demo. **Cloud mode is what you want if you're sharing the app.**
No screen code differs between them; the store swaps its persistence layer underneath.

---

## 1. The database — Supabase

**Recommendation: Supabase.** It is hosted Postgres with authentication, row-level
security and realtime subscriptions in one product, and the free tier comfortably covers a
badminton club. The three things this app needs are exactly the three things it does well:

- The data is **relational** — players, matches, clubs, tournaments, ratings. This is a
  SQL shape, not a document shape.
- Live scoring needs **realtime**. Supabase streams Postgres changes over a websocket, so
  a spectator's phone updates on the scorer's tap without polling.
- Ratings must be **server-authoritative**, or anyone can edit the request and hand
  themselves 400 points. Postgres functions and RLS let the rules live next to the data.

(Firebase would also work, but the leaderboard, head-to-head and point-difference queries
are all joins and aggregates — awkward in Firestore, one line each in SQL.)

### Set it up

1. Create a free project at **https://supabase.com** — pick a region near your players.

2. **SQL Editor → New query** → paste the whole of **`supabase/schema.sql`** → **Run**.
   It's idempotent, so re-running it later to pick up changes is safe.

   That creates the tables, the indexes, the row-level security policies, and a
   server-side copy of the badminton rules engine and the rating maths.

3. **Authentication → Providers**:
   - **Email** — on by default. Sign-in is a one-time six digit code; no passwords anywhere.
   - **Anonymous sign-ins** — turn on if you want a "continue as guest" button that works
     without an email address. Optional; the app hides it gracefully if it's off.

4. **Authentication → Emails → Magic Link** → make sure the template contains
   **`{{ .Token }}`**. This step is not optional and it is the single most common reason
   sign-in appears broken.

   Supabase's stock template only has a link in it. A link is fine in a browser, but the
   Android app is served from `https://localhost` — a link tapped in Gmail opens the
   *browser*, which has no way to hand the session back to the app. The app therefore asks
   for a typed code, and the code has to actually be in the email. Replace the body with
   something like:

   ```html
   <h2>Your Badminton Boys code</h2>
   <p style="font-size:32px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you're signing in on a computer, this link works too:
     <a href="{{ .ConfirmationURL }}">open Badminton Boys</a>.</p>
   ```

   Do the same to the **Confirm signup** template. Supabase picks the template by whether
   the address already exists, so leaving that one stock means every *returning* player
   gets a code and every *new* one gets a link — the failure only shows up for the people
   you're trying to onboard.

5. **Set up your own SMTP before you share the link.** Supabase's built-in email service is
   for development only and is rate limited to a **couple of messages an hour** for the
   whole project. It is not a setting you can raise; the ceiling exists because you're
   borrowing Supabase's sending reputation. With ten players trying to sign in on a
   Saturday morning, the third one onwards gets *"email rate limit exceeded"* and simply
   cannot get in.

   **Authentication → Emails → SMTP Settings** → enable custom SMTP. Any provider works;
   the free tiers that comfortably cover a badminton group:

   | Provider | Free tier | Notes |
   | --- | --- | --- |
   | **Resend** | 3,000/month, 100/day | Simplest setup; Supabase documents it directly |
   | **Brevo** | 300/day | No custom domain required to start |
   | **SendGrid** | 100/day | Ubiquitous, more setup |
   | **Amazon SES** | $0.10 per 1,000 | Cheapest at scale, most setup — see below |

   Then **Authentication → Rate Limits** → raise *"Rate limit for sending emails"* from the
   default to something like 30 per hour. That field is ignored until custom SMTP is on.

   Sender address: use one at a domain you control (`noreply@badmintonboys.in`) and verify
   it with the provider, or codes will land in spam.

### Using Amazon SES

Note the service name: **SES**, not SNS. SNS delivers to subscribers who have confirmed a
subscription, so it structurally cannot email a sign-in code to a new player — it's the
wrong tool, not a harder one.

Pick the region closest to your players and use the **same one throughout**; an identity
verified in `ap-south-1` does not exist in `us-east-1`, and the mismatch surfaces as an
opaque auth failure rather than "wrong region".

1. **Verify the sending domain.** SES console → **Identities → Create identity → Domain** →
   `badmintonboys.in`, leave **Easy DKIM** on. SES gives you three `CNAME` records; add them
   at your DNS host. Status goes to *Verified* in anywhere from minutes to a few hours.

   Verifying a single address instead is quicker, but then codes arrive from a Gmail address
   with no DKIM alignment and spam filters treat them accordingly. Domain is worth the wait.

2. **Leave the sandbox.** Every new SES account is sandboxed: **200 emails per 24 hours**,
   one per second, and — the part that matters — *only to addresses you have separately
   verified*. Your players' addresses aren't verified, so in the sandbox sign-in works for
   you and silently fails for everyone else.

   SES console → **Account dashboard → Request production access**. Say it's transactional
   email — one-time sign-in codes to members of a badminton club, no marketing, recipients
   are people who typed their own address into the app. Approval is usually within 24 hours.
   Do this first; it's the long pole.

3. **Create SMTP credentials.** SES console → **SMTP settings → Create SMTP credentials**.
   That creates an IAM user with `ses:SendRawEmail` and shows a username and password
   **once** — download the CSV.

   These are *not* your AWS access key and secret. The SMTP password is derived from the
   secret key by a signing algorithm, so pasting the IAM secret directly will fail to
   authenticate. If you lose the password, generate new credentials; it can't be re-shown.

4. **Point Supabase at it.** **Authentication → Emails → SMTP Settings**:

   | Field | Value |
   | --- | --- |
   | Sender email | `noreply@badmintonboys.in` (must be under the verified domain) |
   | Sender name | `Badminton Boys` |
   | Host | `email-smtp.ap-south-1.amazonaws.com` (your region) |
   | Port | `587` |
   | Username | SMTP username from the CSV |
   | Password | SMTP password from the CSV |

5. **Raise the auth rate limit** as above, then send yourself a code to confirm it arrives
   from your own domain rather than Supabase's sender.

**Where SNS does belong.** SES suspends accounts whose bounce rate passes ~5% or complaint
rate ~0.1%, and a mistyped address at sign-up is a hard bounce. Under **Identities → your
domain → Notifications**, publish Bounce and Complaint feedback to an SNS topic and
subscribe your own email to it, so you find out from a notification rather than from SES
pausing your sending. The app also catches common domain typos before sending, which keeps
the bounce rate down at the source.

6. **Authentication → URL Configuration** → set **Site URL** to wherever you'll host it
   (e.g. `https://badminton-boys.vercel.app`), and add it to **Redirect URLs**. This only
   affects the browser build — the Android app never uses a redirect. While you're
   developing locally, `http://localhost:5173` is the right value.

7. **Project Settings → API Keys** → copy the **Project URL** and the **publishable**
   (anon) key into a `.env.local` file (copy `.env.example` as a starting point):

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

   Both are safe to ship in the browser bundle — the publishable key is public by design.
   RLS is what protects the data, not key secrecy. **Never** put the `sb_secret_…` /
   `service_role` key in `.env.local`, in the app, or anywhere a browser can reach: it
   bypasses every policy in the schema. If one ever leaks, revoke it under
   **API Keys → Secret keys**.

8. `npm run dev`. You should now get a sign-in screen instead of the demo season.

### What the server enforces

The client keeps its own copy of the rules engine for instant feedback, but it isn't
trusted:

- **Points are added by the server** (`bb_add_point`), so two people scoring the same match
  on two phones can't overwrite each other's rallies.
- **Only a participant, an assigned scorer, the match creator or an organiser can score a
  match.** Anyone else gets an error.
- **A result needs sign-off from both sides** before it settles. One team can't ratify its
  own win. (Exception: if the opposing side is entirely made up of *managed players* —
  friends you added who've never signed in — your confirmation settles it, since otherwise
  the rating could never move.)
- **Ratings can only be changed by the settlement function.** A trigger silently reverts
  any other write to `profiles.rating`, so a crafted request that sets your rating to 9999
  simply doesn't take.

These are tested — the schema was applied to a real Postgres 16 and exercised end to end.

---

## 2. Hosting

### What's actually deployed

**https://badmintonboys.in/** — GitHub Pages, built from
`jayamuru/badminton-boys` by `.github/workflows/deploy.yml` on every push to `main`.
Free with no limits that matter at this scale, HTTPS included.

The three build inputs live on the repo, not in the code:

| Where | Name | Why there |
| --- | --- | --- |
| Settings → Secrets and variables → Actions → **Secrets** | `VITE_SUPABASE_URL` | |
| ″ | `VITE_SUPABASE_ANON_KEY` | public by design, but no reason to put it in git |
| ″ → **Variables** | `VITE_PUBLIC_URL` | `https://badmintonboys.in` |

Set them from a checkout with:

```bash
set -a; . ./.env.local; set +a
gh secret set VITE_SUPABASE_URL      --body "$VITE_SUPABASE_URL"
gh secret set VITE_SUPABASE_ANON_KEY --body "$VITE_SUPABASE_ANON_KEY"
gh variable set VITE_PUBLIC_URL      --body "https://badmintonboys.in"
gh workflow run "Deploy to GitHub Pages"    # secrets only apply to the next build
```

**Until those secrets exist the deployed site runs in demo mode.** Vite inlines env vars
at build time, so it isn't a runtime misconfiguration you can spot from the outside — the
site just quietly serves the on-device simulated season to everyone. Check with:

```bash
curl -s https://badmintonboys.in/ | grep -o 'assets/index-[^"]*\.js' |
  head -1 | xargs -I{} curl -s https://badmintonboys.in/{} |
  grep -c supabase.co        # 0 = demo mode, 1 = cloud mode
```

Because the repo is public, **remember Actions logs are public too.** Never `echo` a
secret in a workflow step.

### The custom domain

`badmintonboys.in` is set as the Pages custom domain, and `public/CNAME` carries it into
every build. The file is the belt to the settings' braces: the domain lives in repo
settings, but keeping it in the published artifact too means a redeploy can't quietly drop
you back to `jayamuru.github.io`.

If you ever change the domain, change it in three places or share links will point at the
old one: Pages settings, `public/CNAME`, and the `VITE_PUBLIC_URL` variable.

### Alternative: Vercel

If you'd rather keep the source private, Vercel's free tier does that and gives a shorter
URL.

```bash
npm i -g vercel
vercel --prod
```

Framework preset **Vite**, build `npm run build`, output `dist`. Then the important bit:

> **Project → Settings → Environment Variables**, add `VITE_SUPABASE_URL` and
> `VITE_SUPABASE_ANON_KEY`, then **redeploy**. Vite inlines env vars at build time, so a
> deploy made before you added them will be a local-mode build no matter what.

Once you know the final URL, come back and set a third variable, `VITE_PUBLIC_URL`, to it
— on Vercel *and* in your local `.env.local` before you build the APK. That's what share
links and QR codes point at (see §5).

Netlify (`netlify.toml` is in the repo) and Cloudflare Pages work identically — same
build, same three variables.

The app is a static bundle with `base: './'` and a **HashRouter**, so it runs at a domain
root, in a subfolder (which is why the Pages URL's `/badminton-boys/` suffix needs no
configuration), or inside the Android WebView with no rewrite rules.

### Tell Supabase about the new address

**Authentication → URL Configuration** → set **Site URL** to
`https://badmintonboys.in/` and add it under **Redirect URLs**. This is
only used by the emailed link in the browser build; the six digit code and the Android app
don't need it. Leave `http://localhost:5173` in Redirect URLs so local development keeps
working.

---

## 3. Sharing it with your group

Once it's deployed in cloud mode:

**Everyone who plays** opens the link, signs in with their email, and fills in a player
card. From that moment they're on the same leaderboard as everyone else — one deployment
is one community.

**People who don't want an account** can still be in matches. Add them with
**Find players → ＋ Add player**. They're pickable in any match and they have a real
rating; they just can't log in. If they sign up later, they get their own card.

**Spectators need nothing at all.** The **Share live match** button on the scoring screen
gives you a QR code and a link (`.../#/watch/<id>`). Anyone who opens it — no account, no
install — gets the live score, point by point, and nothing else. They can't navigate into
the rest of the community, and they can't change anything.

Two people can score the same match from two phones at once; points are appended in the
database, so they interleave instead of clobbering.

### If you'd rather the community be private

Delete the two `..._public_read ... to anon` policies at the bottom of the RLS section in
`supabase/schema.sql`. Shared watch links will then require sign-in.

---

## 4. The demo data (local mode only)

Without env vars the app ships a **simulated 150-day season** — 24 invented players, a few
hundred matches, three clubs and a tournament — so no screen is ever blank. None of it is
real, and none of it is ever uploaded.

- **Profile → ⚙︎ Settings → 🧹 Clear demo data & start fresh** keeps your profile (reset to
  a 1000 rating) and deletes everything else. It survives a reload.
- Or choose **"Start empty — real matches only"** on the registration screen up front.
- **Settings → Reload demo data** puts the season back.
- Nuclear option, in the browser console:
  `localStorage.removeItem('badminton-boys:v1'); location.reload()`

In cloud mode there is no demo data — the database starts empty and those buttons are
replaced by **Sign out**.

Starting ratings by level: Beginner 900, Intermediate 1000, Advanced 1120,
Competitive 1220. Everyone's first ten matches move their rating at 1.6× speed, so a rough
guess corrects itself quickly.

---

## 5. Building the Android app

Capacitor is already set up: `capacitor.config.ts` and a generated `android/` project,
themed black so it doesn't flash white on launch. The Android build wraps the same `dist/`
bundle.

> **The APK bakes in whatever was in `.env.local` at build time.** There is no runtime
> config — Vite substitutes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` into the
> bundle during `npm run build`. Build with the file present and you get the shared cloud
> app; build without it and you ship a single-player demo. Changing the Supabase project
> later means rebuilding and redistributing the APK.

### Set `VITE_PUBLIC_URL` before you build

Deploy the website first (§2), then put its address in `.env.local`:

```
VITE_PUBLIC_URL=https://badminton-boys.vercel.app
```

Without it, **"Share live match" produces links nobody can open.** The packaged app is
served from `https://localhost`, so a link derived from the current page points at the
scanner's own phone. Rather than hand out a broken QR code, the app detects this and says
there's nothing to share yet — which is honest, but not what you want at a court.

In the browser build the variable is optional; the current address is already correct.

### What you need first

- **Android Studio** — https://developer.android.com/studio. The SDK lives at
  `~/Library/Android/sdk`, and Android Studio bundles the JDK. There is **no `java` on the
  PATH** on this machine, so command-line builds need `JAVA_HOME` pointed at the bundled
  one:

  ```bash
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  ```

  Put that line in `~/.zshrc` and you won't have to think about it again.
  (`brew install --cask temurin` is the alternative if you'd rather not depend on the IDE.)

### Build an APK from the command line

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk   (~7 MB)

~/Library/Android/sdk/platform-tools/adb install -r \
  android/app/build/outputs/apk/debug/app-debug.apk
```

### Or open it in Android Studio

```bash
npm run android:open
```

Builds the web app, copies it into the Android project, opens Android Studio. Let the
Gradle sync finish (a few minutes the first time), then press ▶ with a device or emulator
selected.

That APK can be sent to your group over WhatsApp and side-loaded — they'll need to allow
"install from unknown sources" once.

### After any change

```bash
npm run android:sync    # rebuild the web app and copy it into android/
```

You never need to re-run `npx cap add android`.

### A signed release for the Play Store

```bash
keytool -genkey -v -keystore badminton-boys.keystore \
  -alias badmintonboys -keyalg RSA -keysize 2048 -validity 10000
```

Keep that file safe and out of git (`.gitignore` already excludes `*.keystore`). Then
**Build → Generate Signed Bundle / APK → Android App Bundle**, pick the keystore, choose
`release`, upload the `.aab` to the Play Console.

Before publishing, change `appId` in `capacitor.config.ts` from `com.badmintonboys.app` to
something you own.

### The launcher icon

The icon is an adaptive icon, which Android composites from two layers:

| Resource | What it is |
| --- | --- |
| `res/mipmap-*/ic_launcher_foreground.png` | the artwork, on a transparent 108dp canvas |
| `res/values/ic_launcher_background.xml` | `#0C1322`, sampled from the artwork's own corners |
| `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml` | glues the two together |
| `res/mipmap-*/ic_launcher{,_round}.png` | the flat fallback for Android 7 and older |

The one rule that matters when you swap the art: the launcher may crop the 108dp canvas to
any shape it likes — circle, squircle, rounded square — and only the **middle 72dp is
guaranteed visible**. So the artwork is scaled to 66.7% and centred, with transparent
padding around it. Fill the whole canvas and the logo's edges get shaved off on Samsung
and Pixel launchers alike.

### Screen edges

Android 15 (API 35) made edge-to-edge mandatory, and this app targets 36. That means the
web view draws *underneath* the status bar and the gesture handle, and Capacitor does not
map Android's window insets onto CSS `env(safe-area-inset-*)` — so every safe-area rule in
the stylesheet silently evaluates to `0` and the layout sits flush against the bezel.

`MainActivity.java` fixes this at the source: it reads the real system-bar and
display-cutout insets and applies them as padding on the content view. The window
background is black, so the reclaimed strips read as part of the app. On the CSS side
`--pad: 20px` (`src/styles/tokens.css`) is the side gutter, folded together with any
reported inset via `--gut-l` / `--gut-r`.

### What behaves differently in the packaged app

| | Browser | Android app |
| --- | --- | --- |
| Scoring, rules engine, stats, leaderboards | ✅ | ✅ |
| Screen wake lock during a match | ✅ | ✅ |
| Haptics on each point | Android Chrome only | ✅ |
| Share live match (link + QR) | ✅ | ✅ (copy to clipboard) |
| Weekly Top 10 export | Native share sheet or download | Renders in-app — long-press the image to save or send it |
| Sign-in | six digit code, or the emailed link | six digit code (a link would open the browser, which can't hand the session back) |

The export falls back automatically; anchor downloads are a no-op inside an Android
WebView, so the image is handed back on screen instead.

### iOS

Not set up, but two commands on a Mac with Xcode:

```bash
npm i @capacitor/ios && npx cap add ios && npx cap open ios
```

---

## Checks before you ship

```bash
npm run test    # 62 tests: rules engine, every route, empty state, reset behaviour
npm run build   # typecheck + production build
npm run lint    # oxlint
```
