/* THE COLUMN — rules.js
   The six rules, exactly as COLUMN_SYSTEM.md §1. Pure functions over a fit
   object; no DOM, no state. Dev-mode assertions run when ?dev is in the URL
   or under Node.

   A fit is: { outer:{form,tone,sheen}, mid:null|{...}, base:{...},
               bottoms:{...}, footwear:{...}, accent:null|{...} }
   where form is a catalog id, tone one of the 7-tone strip, sheen a boolean
   (only meaningful on forms whose catalog entry offers the sheen variant).

   Documented interpretation choices (also listed in PHASE0_REPORT):
   - §1.1 pass band is the SYSTEM's 70/30 ±10 → hard 60–80 inclusive.
     The corpus's bucket headings (68–78 / <58 / >88) do not tile against
     it; the SYSTEM band decides pass/fail, the corpus buckets only choose
     the line family (fail-low → soft-heavy, fail-high → hard-heavy,
     exactly 100 or 0 → total).
   - §1.2 the footwear side of bottoms/footwear agreement is judged by the
     footwear's MASS (per the build prompt: "footwear mass drives Volume
     Matching"), mapped l→LINEAR m→STANDARD h→VOLUME; agreement is exact.
     The top half is read at its outermost filled slot (outer, else mid,
     else base) — the silhouette that shows — and may deviate from the
     bottoms by at most one step.
   - §1.3 the strip is linear (no wrap): BLACK–COGNAC are not adjacent.
     Adjacent (distance 1) passes, and is voiced by its own corpus state.
   - §1.5 the Nocturnal Shield exception is decided by mode affinity alone
     (argmax of §1.6 scores), independent of the other rules' pass state —
     the only way to break the exception/attribution circularity.
   - §1.6 mode scoring is the sum of the filled forms' affinity weights;
     strict argmax wins; a shared maximum is a tie. */
(function (root, factory) {
  var forms = (typeof module === 'object' && module.exports)
    ? require('./forms.js')
    : root.COLUMN.forms;
  var api = factory(forms);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COLUMN = root.COLUMN || {};
  root.COLUMN.rules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (forms) {
  'use strict';

  var DEV = (typeof process !== 'undefined' && process.versions && process.versions.node) ||
            (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search));

  function assert(cond, msg) {
    if (DEV && !cond) throw new Error('COLUMN rules assertion: ' + msg);
  }
  if (DEV) forms.assertCatalog();

  var VOL_STEP = { L: 0, S: 1, V: 2 };
  var MASS_AS_VOL = { l: 'L', m: 'S', h: 'V' };  // footwear mass → effective volume
  var SLOT_WEIGHT = { outer: 1.5, mid: 1, base: 1, bottoms: 1, footwear: 1, accent: 0.5 };

  function resolve(fit) {
    // → [{slot, form(catalog entry), tone, sheen}] for filled slots, in column order
    var out = [];
    forms.SLOTS.forEach(function (slot) {
      var pick = fit[slot];
      if (!pick || !pick.form) return;
      var fm = forms.getForm(slot, pick.form);
      assert(fm, 'unknown form "' + pick.form + '" in ' + slot);
      if (!fm) return;
      var tone = pick.tone && forms.TONES.indexOf(pick.tone) >= 0 ? pick.tone : 'GREY';
      var sheen = !!pick.sheen && fm.sheen; // sheen only exists where ~ marks it
      out.push({ slot: slot, form: fm, tone: tone, sheen: sheen });
    });
    return out;
  }

  function isComplete(fit) {
    return forms.REQUIRED.every(function (s) { return fit[s] && fit[s].form; });
  }

  /* §1.1 HARD/SOFT 70/30 ±10, slot-weighted (outer ×1.5, accent ×0.5) */
  function ratio(entries) {
    var hard = 0, total = 0;
    entries.forEach(function (e) {
      var w = SLOT_WEIGHT[e.slot];
      total += w;
      if (e.form.hs === 'H') hard += w;
    });
    var pct = total > 0 ? (hard / total) * 100 : 0;
    var pass = pct >= 60 && pct <= 80;
    var state;
    if (pass) state = 'on_target';
    else if (pct === 100 || pct === 0) state = 'total';
    else if (pct < 60) state = 'soft_heavy';
    else state = 'hard_heavy';
    return { hardPct: pct, pass: pass, state: state };
  }

  /* §1.2 VOLUME MATCHING */
  function volume(entries) {
    var by = {};
    entries.forEach(function (e) { by[e.slot] = e; });
    var bottomsV = by.bottoms.form.vol;
    var footwearV = MASS_AS_VOL[by.footwear.form.mass];
    var anchorAgree = footwearV === bottomsV;

    var topEntry = by.outer || by.mid || by.base;
    var topV = topEntry.form.vol;
    var topDelta = Math.abs(VOL_STEP[topV] - VOL_STEP[bottomsV]);
    var topOk = topDelta <= 1;

    var state = 'matched';
    if (!anchorAgree) state = 'clash';           // bottoms/footwear first —
    else if (!topOk) state = 'fighting';         // the rule's own emphasis
    return { pass: anchorAgree && topOk, state: state,
             bottomsV: bottomsV, footwearV: footwearV, topV: topV, topDelta: topDelta };
  }

  /* §1.3 TONAL ANCHOR — footwear vs bottoms on the linear 7-tone strip */
  function anchor(entries) {
    var by = {};
    entries.forEach(function (e) { by[e.slot] = e; });
    var a = forms.TONES.indexOf(by.footwear.tone);
    var b = forms.TONES.indexOf(by.bottoms.tone);
    var dist = Math.abs(a - b);
    var state = dist === 0 ? 'held' : dist === 1 ? 'adjacent' : 'broken';
    return { pass: dist <= 1, state: state, distance: dist,
             footwearTone: by.footwear.tone, bottomsTone: by.bottoms.tone };
  }

  /* §1.4 CONTROLLED DEVIATION — at most one statement form */
  function deviation(entries) {
    var n = entries.filter(function (e) { return e.form.statement; }).length;
    return { pass: n <= 1, count: n, state: n === 0 ? 'zero' : n === 1 ? 'one' : 'two_plus' };
  }

  /* §1.6 MODE ATTRIBUTION — affinity sums; strict argmax, else tie */
  function modeScores(entries) {
    var scores = { TA: 0, TS: 0, SM: 0, NS: 0 };
    entries.forEach(function (e) {
      forms.MODES.forEach(function (m) { scores[m] += e.form.modes[m]; });
    });
    var best = null, bestScore = -1, tie = false;
    forms.MODES.forEach(function (m) {
      if (scores[m] > bestScore) { bestScore = scores[m]; best = m; tie = false; }
      else if (scores[m] === bestScore) tie = true;
    });
    return { scores: scores, winner: tie ? null : best, tie: tie };
  }

  /* §1.5 LIGHT PROTOCOL — ≤1 non-matte, unless the fit attributes NS */
  function light(entries, mode) {
    var n = entries.filter(function (e) { return e.sheen; }).length;
    var shield = mode.winner === 'NS';
    var state, pass;
    if (n <= 1) { state = 'clean'; pass = true; }
    else if (shield) { state = 'shield_exempt'; pass = true; }
    else { state = 'violated'; pass = false; }
    return { pass: pass, count: n, state: state, shieldExempt: state === 'shield_exempt' };
  }

  /* Full evaluation. Deterministic, pure. */
  function evaluate(fit) {
    if (!isComplete(fit)) {
      return { complete: false, entries: resolve(fit) };
    }
    var entries = resolve(fit);
    var r = ratio(entries);
    var v = volume(entries);
    var a = anchor(entries);
    var d = deviation(entries);
    var m = modeScores(entries);
    var l = light(entries, m);
    var allPass = r.pass && v.pass && a.pass && d.pass && l.pass;

    assert(r.hardPct >= 0 && r.hardPct <= 100, 'ratio out of range');
    assert(!(r.pass && (r.state === 'soft_heavy' || r.state === 'hard_heavy' || r.state === 'total')), 'ratio state/pass mismatch');
    assert(entries.length >= 4, 'complete fit resolves at least four forms');

    return {
      complete: true, entries: entries,
      ratio: r, volume: v, anchor: a, deviation: d, light: l,
      mode: m, allPass: allPass,
      attributed: allPass ? (m.tie ? 'TIE' : m.winner) : null
    };
  }

  /* ALIGNMENT — derived display only (no rule logic): how many of the six
     rules currently hold. Rules 1–5 count by pass; rule 6 (MODE
     ATTRIBUTION) counts when the affinity argmax is unambiguous. */
  function alignment(ev) {
    if (!ev || !ev.complete) return { n: null, of: 6 };
    var n = 0;
    [ev.ratio, ev.volume, ev.anchor, ev.deviation, ev.light].forEach(function (r) {
      if (r.pass) n++;
    });
    if (ev.mode.winner !== null) n++;
    assert(n >= 0 && n <= 6, 'alignment out of range');
    return { n: n, of: 6 };
  }

  /* PLUMB geometry helper (pure, shared by page + export): per-slot lateral
     offsets relative to the bottoms' volume — straight when matched. */
  function plumbOffsets(fit) {
    var entries = resolve(fit), by = {};
    entries.forEach(function (e) { by[e.slot] = e; });
    var ref = by.bottoms ? VOL_STEP[by.bottoms.form.vol] : 1;
    var last = 0;
    return forms.SLOTS.map(function (slot) {
      var e = by[slot];
      if (!e) return last; // empty slot: no kink
      var v = slot === 'footwear' ? VOL_STEP[MASS_AS_VOL[e.form.mass]] : VOL_STEP[e.form.vol];
      last = v - ref;
      return last;
    });
  }

  return {
    DEV: DEV, resolve: resolve, isComplete: isComplete,
    ratio: ratio, volume: volume, anchor: anchor, deviation: deviation,
    light: light, modeScores: modeScores, evaluate: evaluate,
    alignment: alignment,
    plumbOffsets: plumbOffsets,
    VOL_STEP: VOL_STEP, MASS_AS_VOL: MASS_AS_VOL, SLOT_WEIGHT: SLOT_WEIGHT
  };
});
