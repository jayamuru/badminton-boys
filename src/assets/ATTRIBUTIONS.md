# Third-party assets

Everything bundled under `src/assets/` that we did not make ourselves, and what
each licence asks of us in return. Keep this current — the photo licences below
require attribution, so shipping the image without the credit is a breach.

## Photography

All three are Creative Commons Attribution 2.0 Generic (CC BY 2.0), via
Wikimedia Commons. Cropped and recompressed for the app; otherwise unaltered.

| File | Photographer | Licence | Source |
| --- | --- | --- | --- |
| `photos/shuttle-band.jpg` | Tim Reckmann | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Commons](https://commons.wikimedia.org/wiki/File:Badminton-Ball_(13550266595).jpg) |
| `photos/feather.jpg` | Tim Reckmann | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Commons](https://commons.wikimedia.org/wiki/File:Badminton_Ball_(12337125033).jpg) |
| `photos/mesh.jpg` | Kate Ter Haar | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | [Commons](https://commons.wikimedia.org/wiki/File:A_little_birdie_told_me,_let%27s_play_Badminton_-_Flickr_-_katerha.jpg) |

These credits are also shown in the app, under Profile → Settings → Credits, so
the attribution travels with the build rather than living only in the repo.

## Type

Both families are under the [SIL Open Font License 1.1](https://openfontlicense.org),
which asks for the licence to travel with the files and forbids selling the
fonts on their own. Neither constrains the app.

| File | Family | Designer |
| --- | --- | --- |
| `fonts/khand-*.woff2` | Khand | Indian Type Foundry, Jyotish Sonowal |
| `fonts/inter-latin-var.woff2` | Inter | Rasmus Andersson |

Both are subset to Latin and self-hosted rather than loaded from a CDN — the
Android build has no guarantee of network on first paint, and a webfont that
arrives late reflows the entire scoreboard.
