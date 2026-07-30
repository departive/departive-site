# /studies — mockup asset contract

The `/studies` page renders **styled placeholder frames** at final dimensions
until real assets land here. Drop a correctly-named PNG in and it replaces the
placeholder automatically (each `<img>` has an `onerror` fallback — no HTML edit
needed). Filenames and folders are exact and case-sensitive.

## Folders (one per study, catalog order)
```
assets/studies/echo-frame/
assets/studies/sightline/
assets/studies/solplats/
assets/studies/archived/     ← ARCHIVE/D
```

## Files per app
| file | what | size (@2x) | display | notes |
|------|------|-----------|---------|-------|
| `hero@2x.png`  | one device, **flat straight-on**, on the app's ground colour, **no perspective** | **2400 × 1600** (3:2) | 1200 × 800 | the chapter hero |
| `shot1@2x.png` … `shot4@2x.png` | portrait phone screenshots | **1206 × 2622** (iPhone 15 Pro) | 603 × 1311 | the screenshot strip (3–4) |

## Echo Frame only — additional
| file | what | size (@2x) | notes |
|------|------|-----------|-------|
| `echo-tv@2x.png` | the app on a 16:9 television frame | **2560 × 1440** (16:9) | the "For Apple TV" subsection |

## Currently migrated (real, already wired)
Echo Frame's chapter uses the two renders migrated from the old landing:
- **hero** → `/images/echo-frame-mockup.jpg` (iPhone Echoes render)
- **Apple TV** → `/images/echo-frame-tv.jpg` (16:9 living-room TV)

When you ship the flat `assets/studies/echo-frame/hero@2x.png` /
`echo-tv@2x.png`, either drop them in and repoint those two `<img src>` in
`studies/index.html`, or keep the current renders — both are real.

## Format
- PNG (or JPG — just match the filename extension in the `<img src>`), sRGB.
- Ground colour = each app's own (Echo warm, Sightline gold, Solplats sun,
  ARCHIVE/D restrained stone). The page tints the placeholder with a nearby
  accent; the real render defines the true ground.
- Keep files reasonably optimised (heroes < ~500 KB, shots < ~300 KB).

## Out of scope (future)
Per-study deep-dive routes (`/studies/sightline`, etc.) — add when a launch
needs a full marketing page. Not built here.
