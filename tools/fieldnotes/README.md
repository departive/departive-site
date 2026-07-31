# fieldnotes — photo-story build script

Turns `stories/<slug>/` (source images + `story.json`) into a finished,
site-native photo-story page: `stories/<slug>/index.html` plus optimized
renditions in `stories/<slug>/img/`. Deterministic, no AI. The editorial
layer (the story session, see `FIELD_NOTES_SYSTEM.md`) writes `story.json`;
this script does everything else.

## Usage

```
cd tools/fieldnotes && npm install     # once — sharp is the only dependency
node tools/fieldnotes/build.js stories/<slug>/ [--force]
```

- Renditions are skipped when they already exist; `--force` regenerates.
- The build prints: EXIF date range + gear, per-chapter palette (and any
  contrast fallbacks), HTML size, rendition count/bytes.

## story.json schema

```jsonc
{
  "slug": "cambodia",                    // folder name; used for canonical/OG URLs
  "title": "5 Days in Cambodia",         // cover H1
  "kicker": "Photo story · Cambodia · Dec 2018",   // cover eyebrow line
  "route": "Phnom Penh · Siem Reap · Angkor Wat",  // cover subtitle
  "byline": "David Gheorghita",
  "gear": "iPhone X",                    // OPTIONAL — overrides EXIF-derived gear
                                         // (byline reads "shot on <gear>")
  "standfirst": "Five days, three cities…",  // the lede; may contain inline HTML
  "cover": { "file": "cover.JPG", "alt": "…" },

  "chapters": [
    {
      "number": "One",                   // number word, per §3 sequencing
      "title": "Angkor Wat",
      "paragraph": "We came before the sun…",   // ONE paragraph; inline <em>/<a> ok
      "images": [                        // the chapter's flow, in order
        { "file": "original-16.JPG",     // filename inside stories/<slug>/
          "block": "full",               // "full" | "pair" | "triptych" | "inset"
          "alt": "…",                    // accessibility text (required in spirit)
          "caption": "Sunrise, across the reflecting pool.",  // optional
          "mode": "plate" },             // "plate" | "aside" (caption register, §2.10)
        { "quote": "Pull-quote text…" }  // optional pull-quote entry, may contain <a>
      ]
    }
  ],

  "end": {
    "tally": "Five days. One phone. No regrets…",   // the closing line
    "gearLine": "All photographs shot on an iPhone X",  // OPTIONAL full-sentence
                                         // override; default "All photographs
                                         // shot on <gear>" (gear from EXIF when
                                         // story.gear is absent)
    "place": "Cambodia",
    "date": "December 2018"              // editorial date; EXIF range is logged
  }
}
```

### Block grammar (§4)

- **full** — edge-to-edge bleed; the ONLY block with parallax (~0.85× scroll,
  transform-based, rAF, `prefers-reduced-motion`-gated). Landscape prefers full.
- **inset** — single contained image, centered, up to 1180px wide / 90vh tall.
- **pair** — two-up. Consecutive `"block":"pair"` entries collapse into one row.
  A row shares ONE caption: put it on any member (the last one wins).
- **triptych** — three-up, same grouping rule as pair.
- **quote** — `{ "quote": "…" }` entry anywhere in the flow; renders as the
  centered serif pull-quote with the accent rule.

Pair/triptych rows are laid out on the most-portrait member's aspect ratio so
the grid is stable before any image loads (no CLS); the other members crop via
`object-fit: cover`.

### Text fields

`standfirst`, `paragraph`, `caption`, `quote` are inserted as-is: write
typographic characters directly (— ’ ·) and use only inline `<em>` and
`<a href …>` when needed. No block HTML.

## What the build does

- **Renditions:** WebP (q75) + JPG fallback (q80, progressive) at widths
  480 / 960 / 1600 / 2400 (capped at the source width), written to `img/` as
  `<name>-<ext>-<width>.<fmt>` — the source extension stays in the name so
  `original-3.JPEG` and `original-3.jpg` never collide. `srcset`/`sizes` per
  block type; everything below the cover is `loading="lazy"`; every `<img>`
  carries `width`/`height`. EXIF orientation is baked in.
- **EXIF:** capture dates + device (Make/Model, DateTimeOriginal) via a
  built-in minimal TIFF reader — used for the gear line and logged as the
  shoot-date range. `story.json` overrides always win.
- **Palette:** each chapter's hero (first image) is sampled at build time →
  `--chTint` (background, bone mixed 16% toward the image average) and
  `--chInk` (captions, the dark-half average). Contrast guard: tint must keep
  ≥ 7:1 against body ink, caption ink ≥ 4.5:1 against the tint — failures
  fall back to `--bone` / `--mutedInk` and are reported in the build log.
- **Template:** §4 anatomy — cover (eager, `fetchpriority=high`), chapters,
  end plate, chapter spine with ticks, scroll reveals (`data-reveal` +
  IntersectionObserver, same pattern as the rest of the site), grain overlay,
  site chrome (logo + back link). All motion is `prefers-reduced-motion`-gated.
- Initial HTML stays well under 100KB; no base64 anywhere.
