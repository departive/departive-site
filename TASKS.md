# departive.com — task brief

Working brief for the site. Round 1 (structure/perf) is done; Round 2 (copy) is
below. Same guardrails throughout — read before editing.

## Guardrails (unchanged)

- Do NOT edit `support.js` (generated) or break the `<x-dc>` / `<helmet>` /
  `<script type="text/x-dc">` runtime wrappers. All content is in `index.html`
  inside `[data-departive-root]`.
- Match house style: inline `style="…"` + `clamp()`, CSS custom properties
  (`--accent`, `--bone`, `--dark`, `--ink`, `--onDark`, `--muted`, `--mutedInk`,
  `--serif`, `--sans`, `--mono`). `data-reveal` for scroll-in, `style-hover="…"`
  for hover. Breakpoint rules live in the `<style>` block in `<helmet>`.
- `main` is production and deploys on push. Verify on a local preview first
  (`python3 -m http.server 8000`), then commit + push.

---

## ✅ Round 1 — DONE (for reference)

1. **Images + flicker** — `/images` optimised (~25 MB → ~6 MB); `width`/`height`
   added to the gallery `<img>`s to kill layout-shift flicker.
2. **Field Notes grid** — locked to 3 → 2 → 1 via `[data-gallery="travel"]`.
3. **Threads split** — Echo Frame removed; now a clean Invisible + Patents
   two-up; old Echo Frame tile removed from `#studio`.
4. **Studio/Apps section** — new `#apps` section with Echo Frame + ARCHIVE/D
   tiles; "Apps" added to the nav. (Intro + ARCHIVE/D copy were left as
   placeholders — finalised in Round 2 below.)

---

## Round 2 — COPY (do these)

All final copy below. Where a find/replace is given, match the existing text
exactly and keep the surrounding markup/styling. Remove the
`<!-- PLACEHOLDER COPY … -->` comment in the `#apps` section when done.

### 1. Meta / OG / Twitter descriptions (in `<helmet>`)
"photographer for Leica" overstated the relationship and "solo studio" is being
retired. Replace all three:

- `<meta name="description">` content →
  `David Gheorghita — Head of UX Design at Volvo Group, one of Leica's 100 Photographers, and the small studio behind Echo Frame. Design leadership at scale, and the light in between.`
- `<meta property="og:description">` content →
  `Head of UX Design at Volvo Group, one of Leica's 100 Photographers, and a small studio shipping iOS apps.`
- `<meta name="twitter:description">` content → (same as og:description)

### 2. Craft section (`#studio`) — closing paragraph
Replace the whole paragraph that currently begins "At Electrolux I led
interaction design…" with:

> At Electrolux I led interaction design across the connected portfolio — setting the Smart Home UX direction and building universal interaction models that held across product categories and brands. The goal was always to make complexity invisible; that work became four filed patents. But the urge never fully left: today I run a small studio, designing and shipping iOS apps end to end.

(This drops the old Echo Frame / occupational-therapist sentences — that content
now lives in the `#apps` section below.)

### 3. Work section editorial index — the "Solo studio" row
- Change the label **Solo studio** → **The studio**
- Change that row's `href` from `#studio` → `#apps`
(Find it by the unique label text "Solo studio".)

### 4. Apps section (`#apps`) — heading + intro
- Heading (currently "Small apps, built in the low light.") →
  **A small studio of my own.**
- Intro (currently "Solo-studio iOS work — released when it's ready, not before.
  One is live; one is close.") →
  **I design, build, and ship iOS apps end to end — released when they're ready, not before. One is live; one is close.**

(Note for David: CC's original "Small apps, built in the low light." is also nice
and on-brand — keep it instead if you prefer; both remove "solo.")

### 5. Echo Frame tile — add its one-line description
The Echo Frame tile is currently image-only; ARCHIVE/D has a description, so the
two are asymmetric. Add David's line to the Echo Frame tile so both carry a
one-liner:

> Bridging the still frame and the moving sound.

Place it as a **serif** line (~20–26px) in the tile's lower overlay, above the
existing mono "Echo Frame · Tonal Resonance" caption, legible over the scrim
(deepen the bottom gradient slightly if needed). Preview to confirm it doesn't
crowd the caption.
(Alt wording on file if the above reads oddly: "Between the still frame and the
sound that moves it." — David's call.)

### 6. ARCHIVE/D tile — final description
Replace the tile paragraph text ("A wardrobe that thinks in outfits — photograph
what you own, get looks worth wearing. In private beta soon.") with:

> Your wardrobe, archived, and composed into outfits worth wearing.

(Drop "In private beta soon." — the "Coming soon" badge already carries status.)

### 7. Apps section — add the OT note
Add a subtle text block **after** the `[data-apps-grid]` closing `</div>`, still
inside `#apps`, understated so it doesn't compete with the two product tiles:

```html
<p data-reveal style="margin:clamp(40px,6vh,72px) 0 0; max-width:620px; font-family:var(--sans); font-size:clamp(14px,1.1vw,16px); line-height:1.7; color:var(--mutedInk);">A quieter thread, built with an occupational therapist — a small family of apps grounded in that field: helping people through the texture of everyday life, from managing energy and routine to making the spaces they live in safer and easier to be in. Still taking shape; more when they're ready.</p>
```

---

## Confirmed (resolved)

- **Headcount "70+":** CONFIRMED correct — keep as-is (scoped to the UX Design
  team). No change.
- **"rail passenger" example:** CONFIRMED correct — real experience (Bombardier,
  consultancy). Keep as-is. No change.

### 8. Field Notes caption — iPhone → Leica
In the Riddarfjärden figcaption, change the label `iPhone 14 Pro` → the Leica
label. Use `Leica Q3 43 · 43mm` to match every other caption in that gallery,
UNLESS the frame was shot at a different focal length (David to confirm the
focal length if not 43mm).

---

## Round 3 — MOBILE POLISH (do these)

All from mobile screenshots. Same guardrails. Add breakpoint rules to the
`<style>` block in `<helmet>`; hook them with data-attributes on the elements.
Verify each at 390px and 430px portrait before committing.

### 9. Hero image — mobile crop
The hero (`leicafeature4.jpg`, `object-position:center 45%`) is a landscape
frame; on portrait screens `cover` centre-crops and the subject (the figure on
the cliff edge, toward the right of the frame) is cut off.
- First try: add mobile `object-position` overrides on `[data-hero-kb]` so the
  cliff-and-figure stay in frame, e.g.
  `@media (max-width:768px){ [data-hero-kb]{ object-position:72% 42%; } }`
  and a tighter value at `<=480px` if needed. Tune against the live preview
  until the subject reads clearly. (The `heroKen` animation transform is
  independent of `object-position`, so this is safe.)
- If positioning alone can't hold both the subject and a decent composition,
  switch to `<picture>` art direction: a portrait crop (~4:5 or 3:4) as the
  mobile `source`, landscape as default. Keep `width`/`height` on the img to
  preserve the no-flicker fix. (David may supply a purpose-composed vertical
  frame — if a new file lands in /images, use it; otherwise crop from source.)
Verify: subject clearly visible at 390 / 430px portrait.

### 10. Editorial index — mobile overlap
The `#work` index rows use `grid-template-columns:minmax(0,1fr) auto auto`
(name / role / year on one line); on mobile the serif name overlaps the role.
Add `data-idx-row` to each of the four `<a>` rows, and:
```css
@media (max-width: 640px) {
  [data-idx-row] { grid-template-columns: 1fr; gap: 6px; }
  [data-idx-row] > span:last-child { text-align: left; }
}
```
Name / role / year then stack left-aligned. Keep the hover padding-shift.

### 11. Craft section (`#studio`) — cut threads, rework patents
(a) DELETE the entire `<!-- threads -->` grid (both the "Invisible" and
"Patents" cards). Invisible repeats the opening statement; patents move into the
paragraph.
(b) REPLACE the single craft paragraph with these two paragraphs (same styling;
give the 2nd `<p>` a top margin ~1em):

> At Electrolux I led interaction design across the connected portfolio — setting the Smart Home UX direction and building universal interaction models that held across product categories and brands. The principle was “learn one, know all”: consistent mental models and interactions everywhere, so a new product never meant relearning how to use it — and hardware and software components could be reused across the range instead of rebuilt each time.
>
> Patents were an adjacent result — several filed so far, with more on the way as they roll out across markets. Four are public: a proximity-aware adaptive display, user recognition with personalised preferences, a safety mode that flags unauthorised users, and an appliance interface. But the urge to build never fully left: today I run a small studio, designing and shipping iOS apps end to end.

Keep the heading "Leadership never cured the urge to build."
(c) In the `#work` index, update the Patents row detail `4 filed` → `4 public`
(more are filed; four are public).

### 12. Footer colophon — mobile alignment
The "Made in Stockholm… / Set in Instrument…" mono block is `text-align:right`;
on mobile it wraps under the name and the right-alignment looks ragged. Add
`data-colophon-meta` to that span and:
```css
@media (max-width: 640px) { [data-colophon-meta] { text-align: left; } }
```
(Alternatives if preferred: centre it, or drop the coordinates line on mobile —
left-aligned is cleanest.)

---

## Deploy

After verifying on a local preview:

```
git add -A
git commit -m "finalise copy: studio/apps, meta, OT note"
git push
```

GitHub Pages redeploys `main` automatically (~1 min).
