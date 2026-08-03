# /studies — imagery asset contract (landscape, edge-to-edge)

The `/studies` page renders **styled placeholder frames** at final dimensions
until real assets land here. Drop a correctly-named file in and it replaces the
placeholder automatically (each media element self-promotes on load — no HTML
edit). Filenames and folders are exact and case-sensitive.

Every chapter's imagery is **full-viewport-width, edge-to-edge, and landscape**:
a hero band, then a two-up landscape diptych. Chapter text (masthead, spec,
CTAs, signature) sits in the centred content column between the bands.

## Folders (one per study, catalog order)
```
assets/studies/echo-frame/
assets/studies/sightline/
assets/studies/solplats/
assets/studies/archived/     ← ARCHIVE/D
assets/studies/studio/       ← the opener overture (not an app)
```

## Studio overture (the `/studies` opener)
The full-bleed opening hero. **App-agnostic** — it is an overture, not any app's
hero: **no app name, caption, attribution, or app UI in frame.** Scene only.

| file | what | ratio · size (@2x) | notes |
|------|------|-----|-------|
| `overture-wide.jpg` | desktop/tablet crop | **16:10 · 2880 × 1800** | subject right of centre; **left 45% must stay quiet** (carries the masthead) |
| `overture-tall.jpg` | phone crop (a portrait window on the *same* scene, not a scaled copy) | **~9:19.5 · 780 × 1688** | art-directed via `<picture>` at the 700px breakpoint |
| `overture.mp4` + `.webm` + `overture-poster.jpg` | optional silent loop | 16:10 · 4–8 s · < 3 MB | reduced-motion → poster only |

**Current files are soft placeholder stand-ins** (upscaled crops of a Sightline
screenshot that still carry app UI). **Do not ship them** — replace with real
exports at the same paths (the `<img>`/`<source>` self-upgrade on load).

## Files per app
| file | what | ratio · size (@2x) | notes |
|------|------|-----|-------|
| `hero.mp4` | hero band — silent loop, **desktop** | **16:9 · 1920 × 1080** | plays with tilt; cover-fit so any landscape ratio works |
| `hero-vertical.mp4` | hero band — silent loop, **mobile** (≤700px) | **9:16 · 1080 × 1920** | art-directed portrait crop |
| `shot1@2x.png`, `shot2@2x.png` | the two supporting frames (landscape stills) | **16:9 · 2560 × 1440** (@2x) | 2-up diptych; subtle pointer tilt (4°); optimise < ~500 KB — drop the file, no markup change |

### Swap-ready hero (tilt video) — how to drop one in
The hero slot markup already carries the pattern (see `studies/index.html`; Sightline
is wired as the live reference). **To finalize an app's hero you only drop files** —
no HTML edits needed if the block is present:

1. Export a **16:9** loop → `assets/studies/APP/hero.mp4`.
2. Export a **9:16** loop → `assets/studies/APP/hero-vertical.mp4`.
3. Reload. The wide clip plays on desktop with a pointer **tilt**
   (`assets/tilt.js`, via `data-tilt` on the slot); the tall clip plays on mobile.
   Until a file exists the slot shows its styled placeholder (`onerror` removes the
   missing `<video>`); reduced-motion / no-JS also fall back to the placeholder.

The slot block (already in place per app):
```html
<div class="band slot hero-band" data-reveal data-tilt data-tilt-max="5" data-tilt-scale="1.16">
  <video class="media m-wide" autoplay muted loop playsinline preload="metadata"
         onloadeddata="this.closest('.slot').classList.add('has-img')" onerror="this.remove()">
    <source src="/assets/studies/APP/hero.mp4" type="video/mp4"></video>
  <video class="media m-tall" autoplay muted loop playsinline preload="metadata"
         onloadeddata="this.closest('.slot').classList.add('has-img')" onerror="this.remove()">
    <source src="/assets/studies/APP/hero-vertical.mp4" type="video/mp4"></video>
  <span class="ph">…placeholder…</span>
</div>
```
- **Silent**, short (4–8 s), **H.264 .mp4**, Web-Optimized, target < ~3 MB each
  (HandBrake `Fast 1080p30`, RF ~20, audio track removed).
- `data-tilt-scale` overscans the media so the tilt never exposes an edge — it's
  immune to the slot's grid centering (don't size the media past 100%). Tilt is
  inert on touch and reduced-motion; mobile just plays the vertical clip flat.
- Optional stills fallback: add `poster="…jpg"` to each `<video>` **only once the
  poster file exists** (the page hides the placeholder as soon as a poster is set).

## Echo Frame only — additional
| file | what | ratio · size (@2x) | notes |
|------|------|-----|-------|
| `echo-tv@2x.png` | the app on a television frame | **16:9 · 2560 × 1440** | the "For Apple TV" band |

## Currently migrated (real, already wired)
Echo Frame uses the two renders migrated from the old landing:
- **hero band** → `/images/echo-frame-mockup.jpg` (cover-cropped to 16:10)
- **Apple TV band** → `/images/echo-frame-tv.jpg` (16:9)

Replace with the flat/landscape `assets/studies/echo-frame/` exports when ready
(and repoint those two `<img src>` in `studies/index.html`), or keep them.

## Format
- PNG/JPG stills (sRGB) or MP4/WebM loops. Match the filename extension in the
  `<img>/<source>` src.
- Ground colour = each app's own (Echo warm · Sightline gold · Solplats sun ·
  ARCHIVE/D restrained stone). The page tints the placeholder with a nearby
  accent; the real export defines the true ground.
- Optimise: stills < ~500 KB, video < ~3 MB.

## Out of scope (future)
Per-study deep-dive routes (`/studies/sightline`, etc.) — add when a launch
needs a full marketing page. Not built here.
