# DEPARTIVE-SITE — project context (read first, every session)

departive.com — David's photography/creative site (Deep Field AB /
personal). Static HTML/CSS, hand-built, dark palette (--dark2,
--onDark, warm off-whites), serif/mono pairing. Deployed via
Cloudflare (wrangler.jsonc). No frameworks, no build step — edit
files directly, keep everything self-contained.

## Map
- index.html — homepage. Sections: hero, about, Photography — I
  ("Field notes, on the move.", 6 img slots), Photography — II
  (self-portrait + 4 featured), links out to studies/stories.
- studies/ — case studies (Herta study planned: see Herta repo's
  DEPARTIVE_HERTA_STUDY_PROMPT.md). Hero videos autoplay MUTED;
  unmuted audio of commercial recordings is NOT allowed (sync/master
  licensing) — rights-cleared audio only.
- images/ — web-sized assets, lowercase-hyphen names (l1040688.jpg).
  Source photos live in ~/Documents/Departive Web Images/ (not in
  repo). Resize web copies to ~1600-2000px long edge, quality ~82.
- stories/, cambodia/, horizon/, light/, etc — photo essays.
- TASKS.md — open items. _to_delete/ — mount can't unlink; mv here.

## Rules
- Match the existing visual language; read the CSS before adding.
- Alt text: descriptive, human ("Two monks with an umbrella on a
  red bridge").
- Git: move .git/*.lock to _to_delete/ before/after ops; path-
  limited adds; commit as David.
- Nothing pushed without David's word.

## State (update each session)
20 Aug 2026: homepage photo refresh in progress — Romania-Houston
candidates proposed (P1: field notes swap, P2: considered frames);
awaiting DG picks, then image resize + index.html update.


Plausible snippet departive.com:
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-BUE1nzWvXcM16kslfLdc8.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>

