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
```

## Files per app
| file | what | ratio · size (@2x) | notes |
|------|------|-----|-------|
| `hero@2x.png` **or** `hero.mp4` (+ `hero.webm`) | the hero band — one landscape still **or** a silent loop | **16:10 · 2880 × 1800** | full-bleed; ~88vh cap |
| `shot1@2x.png`, `shot2@2x.png` | the two supporting frames (landscape) | **16:10 · 2560 × 1600** | full-bleed 2-up diptych |

### Video heroes (supported)
Swap the hero `<img class="media">` for:
```html
<video class="media" autoplay muted loop playsinline poster="/assets/studies/APP/hero-poster.jpg">
  <source src="/assets/studies/APP/hero.webm" type="video/webm">
  <source src="/assets/studies/APP/hero.mp4"  type="video/mp4">
</video>
```
- Keep it **silent** and short (a 4–8 s loop). `prefers-reduced-motion` → the
  page shows the **poster only** (autoplay is stripped) — so always ship a good
  `hero-poster.jpg` (16:10).
- H.264 `.mp4` + VP9/AV1 `.webm`; target < ~3 MB.

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
