/* THE COLUMN — verdict.js
   CORPUS_VERDICTS.md transcribed VERBATIM (the corpus is authored — do not
   improve it). Fixed assembly order RATIO → VOLUME → ANCHOR → DEVIATION →
   LIGHT → (MODE, if all pass). Seeded draw from the fit's attribute hash:
   same composition → same verdict. 3–5 line cap with the suppression rule
   (LIGHT-clean, then DEVIATION-zero, suppressed only when the card
   overfills; failures always print). */
(function (root, factory) {
  var deps = (typeof module === 'object' && module.exports)
    ? { forms: require('./forms.js'), rules: require('./rules.js') }
    : { forms: root.COLUMN.forms, rules: root.COLUMN.rules };
  var api = factory(deps.forms, deps.rules);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COLUMN = root.COLUMN || {};
  root.COLUMN.verdict = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (forms, rules) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* CORPUS — verbatim from CORPUS_VERDICTS.md                          */
  /* ------------------------------------------------------------------ */
  var CORPUS = {
    ratio_on_target: [
      "The ratio holds. Structure carrying warmth, as intended.",
      "Seventy-thirty, near enough. The frame is doing its job.",
      "Hard where it counts, soft where it's felt. Correct.",
      "The split is right. Nothing here is negotiating."
    ],
    ratio_soft_heavy: [
      "Too much drape, not enough frame. The fit asks for one structured piece.",
      "Comfort is winning. Give it a spine.",
      "All texture, no architecture. Swap one soft piece for something that holds a line.",
      "The column has gone to fabric. It needs a load-bearing element."
    ],
    ratio_hard_heavy: [
      "All armor. One tactile piece would let it breathe.",
      "Structure on structure. Somewhere, add a surface a hand would want.",
      "The frame is complete; the humanity is missing. One knit fixes this.",
      "Rigid throughout. Even a column carries something soft."
    ],
    ratio_total: [
      "Uniform, not an outfit. The system requires tension.",
      "One material philosophy, six slots. That is a costume."
    ],
    volume_matched: [
      "The volumes agree. The line runs clean from shoulder to floor.",
      "One silhouette, committed. The plumb hangs straight.",
      "Nothing is arguing about width. Good."
    ],
    volume_clash: [
      "Wide legs, whisper shoes. The base can't carry the width — go heavier underfoot.",
      "The footwear is underbuilt for those bottoms. Mass answers mass.",
      "Linear trouser, heavy shoe. One of them is in the wrong fit."
    ],
    volume_fighting: [
      "The top half and the bottom half are dressed for different days.",
      "Two silhouettes arguing. Pick one and commit.",
      "Volume up top, a blade below. Choose the story."
    ],
    anchor_held: [
      "Anchored. The shoe answers the trouser, and the fit sits down.",
      "Footwear and bottoms in the same tonal family. The base is quiet and certain.",
      "The anchor holds — the eye lands and rests."
    ],
    anchor_adjacent: [
      "Near-anchored. The tones are cousins, not twins — it reads, barely.",
      "The base is one shade adrift. Acceptable. Noticed."
    ],
    anchor_broken: [
      "The shoe belongs to a different outfit. Anchor it to the trouser's family.",
      "Unanchored — the fit ends at the ankle instead of the floor.",
      "The base is split. The eye keeps landing on the seam."
    ],
    deviation_zero: [
      "No deviation. Pure system — severe, and it knows it.",
      "Restraint throughout. The fit whispers, deliberately."
    ],
    deviation_one: [
      "One deviation, placed where it can speak. That's the whole trick.",
      "A single loud element against a quiet field. Controlled, as prescribed.",
      "The statement has the room to itself. Correct."
    ],
    deviation_two_plus: [
      "Two statements. They are now interrupting each other.",
      "Loud twice is noise. Keep the stronger one.",
      "Deviations compete; conviction doesn't. One must go."
    ],
    light_clean: [
      "Matte field, one glint at most. The Light Protocol holds.",
      "Surfaces under control."
    ],
    light_violated: [
      "Two reflective surfaces in daylight. This fit is signaling ships.",
      "Too much shine for the hour. Matte one of them."
    ],
    incomplete: [
      "The column is missing a segment. It cannot be judged half-built.",
      "Compose the base four first. The system doesn't grade sketches."
    ],
    mode_TA: [
      "Utility carried with intent. Every element is load-bearing.",
      "Built, not styled. The hardware is the point.",
      "A fit that could be issued. It chose to be worn instead."
    ],
    mode_TS: [
      "Material depth over overt structure. The hand reads it before the eye does.",
      "Warmth, shaped. The volumes are doing the talking quietly.",
      "Texture as architecture. Nothing shouts; everything holds."
    ],
    mode_SM: [
      "Reduction as a stance. What remains is exact.",
      "Nothing to remove. That was the work.",
      "A fit in one breath. The discipline shows."
    ],
    mode_NS: [
      "Black-dominant, sheen permitted, mass forward. Built for after dark.",
      "The exception to the Light Protocol, earned. It moves like a shadow with a budget.",
      "Armor for evenings. The glint is the argument."
    ],
    mode_tie: [
      "It passes every rule and belongs to no mode. Interesting. Keep it.",
      "Between modes — the system notes it, and lets it through."
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Seeded draw — FNV-1a over the fit's canonical attribute string     */
  /* ------------------------------------------------------------------ */
  function fnv1a(str, seed) {
    var h = seed === undefined ? 0x811c9dc5 : seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  function canonical(fit) {
    return forms.SLOTS.map(function (slot) {
      var p = fit[slot];
      if (!p || !p.form) return slot + ':—';
      return slot + ':' + p.form + ':' + (p.tone || 'GREY') + (p.sheen ? ':~' : '');
    }).join('|');
  }

  function hashFit(fit) { return fnv1a(canonical(fit)); }

  function draw(stateKey, hash, avoid) {
    var lines = CORPUS[stateKey];
    var idx = ((hash ^ fnv1a(stateKey)) >>> 0) % lines.length;
    if (avoid && lines.length > 1) {
      // "No line reuse within a session's last 2 verdicts where avoidable":
      // step deterministically past recently used lines.
      for (var i = 0; i < lines.length - 1 && avoid.indexOf(lines[idx]) >= 0; i++) {
        idx = (idx + 1) % lines.length;
      }
    }
    return lines[idx];
  }

  /* ------------------------------------------------------------------ */
  /* Assembly — fixed order, cap 3–5 with the suppression rule          */
  /* ------------------------------------------------------------------ */
  var MAX_LINES = 5;

  /* compose(fit, evaluation, history)
     history: array of previous verdict objects (the page passes its last
     two). Determinism is primary: if this exact fit hash was just judged,
     the identical verdict is returned; the reuse-avoidance only shifts
     lines between DIFFERENT fits. */
  function compose(fit, ev, history) {
    var hash = hashFit(fit);
    history = history || [];

    var repeat = null;
    history.forEach(function (h) { if (h && h.hash === hash) repeat = h; });
    if (repeat) return repeat;

    var avoid = [];
    history.slice(-2).forEach(function (h) {
      if (h && h.lines) h.lines.forEach(function (l) { avoid.push(l.text); });
    });

    if (!ev.complete) {
      return { hash: hash, headline: null, mode: null,
               lines: [{ state: 'incomplete', text: draw('incomplete', hash, avoid) }],
               incomplete: true };
    }

    var lines = [];
    function push(state, key) { lines.push({ state: state, text: draw(key, hash, avoid) }); }

    // RATIO
    push('ratio_' + ev.ratio.state, 'ratio_' + ev.ratio.state);
    // VOLUME
    push('volume_' + ev.volume.state, 'volume_' + ev.volume.state);
    // ANCHOR
    push('anchor_' + ev.anchor.state, 'anchor_' + ev.anchor.state);
    // DEVIATION
    push('deviation_' + ev.deviation.state, 'deviation_' + ev.deviation.state);
    // LIGHT — the shield exemption has no authored line; the NS mode line
    // speaks to sheen, so the state prints nothing (listed in the report).
    if (ev.light.state !== 'shield_exempt') {
      push('light_' + ev.light.state, 'light_' + ev.light.state);
    }

    var headline = null, mode = null;
    if (ev.allPass) {
      if (ev.mode.tie) {
        headline = 'TIE / AMBIGUOUS MODE'; // the corpus's own heading; see report
        mode = 'TIE';
        lines.push({ state: 'mode_tie', text: draw('mode_tie', hash, avoid) });
      } else {
        mode = ev.mode.winner;
        headline = forms.MODE_NAMES[mode];
        lines.push({ state: 'mode_' + mode, text: draw('mode_' + mode, hash, avoid) });
      }
    }

    // Cap 3–5: suppress LIGHT-clean first, then DEVIATION-zero — passes
    // only; failures always print.
    function suppress(state) {
      if (lines.length <= MAX_LINES) return;
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].state === state) { lines.splice(i, 1); return; }
      }
    }
    suppress('light_clean');
    suppress('deviation_zero');

    if (rules.DEV && lines.length > MAX_LINES) {
      throw new Error('COLUMN verdict assertion: line cap exceeded (' + lines.length + ')');
    }

    return { hash: hash, headline: headline, mode: mode, lines: lines,
             allPass: ev.allPass, incomplete: false };
  }

  return { CORPUS: CORPUS, fnv1a: fnv1a, canonical: canonical,
           hashFit: hashFit, draw: draw, compose: compose, MAX_LINES: MAX_LINES };
});
