# departive.com — working brief

Single-page editorial portfolio. dc-runtime export: all content lives in
`index.html` inside `[data-departive-root]`; `support.js` is generated.
This file is the map for any session touching the site — read before editing.

## Guardrails

- Do NOT edit `support.js` (generated) or break the `<x-dc>` / `<helmet>` /
  `<script type="text/x-dc">` runtime wrappers.
- Match house style: inline `style="…"` + `clamp()`, CSS custom properties
  (`--accent`, `--bone`, `--dark`, `--dark2`, `--ink`, `--onDark`, `--muted`,
  `--mutedInk`, `--serif`, `--sans`, `--mono`). `data-reveal` for scroll-in,
  `style-hover="…"` for hover. Breakpoint rules live in the `<style>` block
  in `<helmet>`.
- **Runtime double-mount (critical):** the dc-runtime re-mounts the page
  content after load, so raw-HTML DOM nodes are replaced. Any script that
  reads or writes content nodes MUST use the visible-instance pattern:
  `isVis(el){ return el.getClientRects().length > 0; }` + rAF retry loop
  (~300 tries), and re-query on every update rather than caching nodes.
  Writing to the first `querySelector` match hits the doomed template copy
  and gets wiped (symptom: content flickers once, then reverts). The reveal
  system's `data-revealed` attribute exists for the same reason.
- `main` is production and auto-deploys on push. Verify on a local preview
  first (`python3 -m http.server 8000`), then commit + push.
  Note: GoatCounter filters localhost — pageviews/events only register on
  the live domain. Local silence is not breakage.

## Hosting & deploy

- **Cloudflare Workers static assets.** Worker name: `departive-site`,
  serving `departive.com` (+ www redirect). Git integration: push to `main`
  → Workers Builds deploys automatically. (Migrated from GitHub Pages, then
  from classic Cloudflare Pages.)
- `wrangler.jsonc` — `not_found_handling: "404-page"` serves `404.html`
  (custom page: "Not every frame makes the edit."). The `name` field must
  stay exactly `departive-site` or deploys create a second Worker.
- `.assetsignore` — keeps `TASKS.md`, `.claude`, `wrangler.jsonc` out of the
  publicly served assets.
- GitHub Pages is retired. If "pages build and deployment" failure emails
  appear, the old Pages workflow is still enabled on the repo:
  Settings → Pages → Unpublish / Source: None. (Pending — David to click.)

## Analytics — GoatCounter

- Dashboard: `departive.goatcounter.com`. Script tag is the last line before
  `</body>`. No cookies, no consent banner needed. Do NOT reintroduce
  Cloudflare Web Analytics: its beacon 404s on this hosting (RUM can't run
  over the Workers serving path) — two days were spent proving this.
- A delegated click listener (body-end script) tracks every outbound
  `<a href>` automatically as `out-<host>` (full URL in the event title).
  New links need zero wiring. In-page anchors are ignored; `mailto:` logs
  as `email`.
- `data-ev="name"` on any element overrides with a friendly event name.
  Current named events:
  - `refresh-echoes` / `refresh-rotation` / `refresh-fits` /
    `refresh-objects` — Lately shuffle buttons
  - `beta-iphone` / `beta-appletv` — TestFlight links
  - `app-echo-frame` — App Store (tile + Echoes-header link)
  - `archived-beta` — ARCHIVE/D beta mailto
  - `leica-100` — Leica Threads feature link

## Footer — "The light today · Stockholm"

- Live light ledger in `#contact`, right of "Say hello.": sun-arc SVG
  (elevation curve, daylight area fill, sunrise/sunset ticks, breathing
  now-dot) + day band (night → astro → nautical → civil → daylight segments;
  widths = the day's light/dark proportions) + three mono text lines
  (sunrise/sunset/duration · current state + elevation · tomorrow's delta).
  Near midsummer a fourth line appears: "The sky never fully darkens tonight".
- All computed client-side (NOAA-style solar approximation) for
  59.3293° N, 18.0686° E; times formatted in Europe/Stockholm regardless of
  visitor timezone. Re-renders every minute. No API, works offline.
- Elements: `[data-light-ledger]`, `[data-sun-arc]`, `[data-sun-note]`.
  Tuning knobs live in `renderArc()` (size, opacities, dot radius).
- Design rule (David): never tint or overlay the photographs themselves —
  the hero stays exactly as graded. Ambient/light concepts are expressed
  typographically or as separate graphics only.

## Delight features

- **G** toggles a grid overlay: 12 columns on the real content margins,
  24px baseline, live viewport/breakpoint label. Built lazily on first press.
- Console note (wordmark + coordinates + "Press G to see the grid").
- EXIF hover mechanism: any gallery `<img data-exif="f/2 · 1/500 · ISO 400">`
  gets a mono line appended to its figcaption, revealed on figure hover.
  Mechanism is live but dormant — no `data-exif` attributes set yet.

## Open threads

1. **EXIF values** — David to pull exposure data from Lightroom for the
   Photography I/II frames; then add `data-exif` attributes (one edit).
2. **Unpublish GitHub Pages** — stops the failing-workflow emails (see
   Hosting above).
3. **Now/Lately content rotation** (future, unscheduled) — tiers mapped:
   by hand → split content into `now.json` → auto-feeds (Last.fm for
   On rotation, Echo Frame Worker for the echoes).
