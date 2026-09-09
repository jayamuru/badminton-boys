import { BackBar } from '../components/ui'

/**
 * The photographs are Creative Commons Attribution — the licence is only
 * satisfied if the credit ships with the image, so it has to be reachable from
 * inside the app and not just from `src/assets/ATTRIBUTIONS.md` in the repo.
 * Keep the two in step when an asset is added or dropped.
 */
const PHOTOS = [
  {
    what: 'Shuttlecock on black — home screen, onboarding',
    who: 'Tim Reckmann',
    href: 'https://commons.wikimedia.org/wiki/File:Badminton-Ball_(13550266595).jpg',
  },
  {
    what: 'Shuttlecock on charcoal — empty states, onboarding',
    who: 'Tim Reckmann',
    href: 'https://commons.wikimedia.org/wiki/File:Badminton_Ball_(12337125033).jpg',
  },
  {
    what: 'Feather mesh close-up — onboarding',
    who: 'Kate Ter Haar',
    href: 'https://commons.wikimedia.org/wiki/File:A_little_birdie_told_me,_let%27s_play_Badminton_-_Flickr_-_katerha.jpg',
  },
]

const FONTS = [
  { family: 'Khand', who: 'Indian Type Foundry, Jyotish Sonowal', use: 'Headings and labels' },
  { family: 'Inter', who: 'Rasmus Andersson', use: 'Body text and every number' },
]

export function Credits() {
  return (
    <div className="page">
      <BackBar title="Credits" />

      <p className="small dim">
        Badminton Boys is built on work other people gave away. These are the terms
        they asked for in return.
      </p>

      <h2 className="section-head__title mt-24">Photography</h2>
      <p className="small dim mt-4">
        All three photographs are licensed{' '}
        <a
          className="link"
          href="https://creativecommons.org/licenses/by/2.0"
          target="_blank"
          rel="noreferrer"
        >
          CC BY 2.0
        </a>{' '}
        via Wikimedia Commons. Cropped and recompressed for this app; otherwise unaltered.
      </p>
      <div className="card card--flat mt-12">
        {PHOTOS.map((p) => (
          <div key={p.href} className="credit">
            <span className="credit__who">{p.who}</span>
            <span className="credit__what">{p.what}</span>
            <a className="credit__src link" href={p.href} target="_blank" rel="noreferrer">
              Source →
            </a>
          </div>
        ))}
      </div>

      <h2 className="section-head__title mt-24">Type</h2>
      <p className="small dim mt-4">
        Both families are under the{' '}
        <a className="link" href="https://openfontlicense.org" target="_blank" rel="noreferrer">
          SIL Open Font License 1.1
        </a>
        , and are bundled with the app rather than fetched from a CDN.
      </p>
      <div className="card card--flat mt-12">
        {FONTS.map((f) => (
          <div key={f.family} className="credit">
            <span className="credit__who">{f.family}</span>
            <span className="credit__what">
              {f.who} · {f.use}
            </span>
          </div>
        ))}
      </div>

      {/* `.micro` uppercases, which would mangle the path — this one stays cased. */}
      <p className="small dim center mt-24 mb-24">
        The full list, with licence text, is in src/assets/ATTRIBUTIONS.md
      </p>
    </div>
  )
}
