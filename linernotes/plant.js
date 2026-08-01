/* LINER NOTES — plant.js
   The pressing plant. Engine version: "pressing plant v1".
   Pure function: generateRecord(features, k) → Record. No DOM, no state.

   ============================================================
   DRAW ORDER (FIXED — SEED_MAPPING §3; changing it is a breaking change)
   ============================================================
   Two PRNG streams, both mulberry32:

   COORDINATE STREAM — seeded with the base feature seed, so coordinates
   are identical across pressings ("Next pressing: different record, SAME
   coordinates"):
     C1  era roulette (seeded roulette over the five era weights)
     C2  temperament tiebreak (one draw is ALWAYS consumed, tie or no tie,
         to keep the stream stable)
     (density is deterministic from E — no draw)

   RECORD STREAM — seeded with fnv1a(seed bytes ‖ k bytes) (the diegetic
   pressing counter; k=0 is the first pressing):
     R1  year (within era span)
     R2  label pick (+ catalog number; era-span × temperament filter)
     R3  format (era table + label locks; documented insertion between
         label and artist — see PHASE0_REPORT) + STEREO/MONO + reissue frame
     R4  artist grammar → name draws
     R5  album title grammar → title
     R6  track count
     R7  track titles (pool-mix draws + vetoes)
     R8  timings (+ side split, longest-track title enforcement,
         Hourglass 44:00 policy)
     R9  personnel (studio, credit names, ≤1 session player)
     R10 prose slots (OPENING → BODY(×n) → ODDITY → CLOSE + word governor)
     R11 pressing line
   Vetoed draws re-draw from the same stream (bounded attempts, then a
   documented relaxation) — still deterministic.
   ============================================================
*/
(function (root) {
  'use strict';

  var CORPUS = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./corpus.js') : root.LN_CORPUS;
  var FEAT = (typeof module !== 'undefined' && typeof require === 'function')
    ? require('./features.js') : root.LN_FEATURES;

  var ENGINE_VERSION = 'pressing plant v1';

  /* ---------------- PRNG ---------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mixSeed(seed, k) {
    return FEAT.fnv1a([
      seed & 0xff, (seed >>> 8) & 0xff, (seed >>> 16) & 0xff, (seed >>> 24) & 0xff,
      k & 0xff, (k >>> 8) & 0xff
    ]);
  }

  /* ---------------- draw helpers ---------------- */
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
  function weightedPick(rng, items, weightFn) {
    var total = 0, i;
    var ws = items.map(function (it) { var w = weightFn(it); total += w; return w; });
    var r = rng() * total;
    for (i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  function pickPass(rng, arr, okFn, tries) {
    tries = tries || 24;
    for (var i = 0; i < tries; i++) {
      var c = pick(rng, arr);
      if (okFn(c)) return c;
    }
    // deterministic fallback: first passing element
    for (i = 0; i < arr.length; i++) if (okFn(arr[i])) return arr[i];
    return null;
  }
  function pad(n, width) { var s = String(n); while (s.length < width) s = '0' + s; return s; }
  function mmss(sec) { var m = Math.floor(sec / 60), s = Math.round(sec % 60); if (s === 60) { m++; s = 0; } return m + ':' + pad(s, 2); }
  function words(s) { return s.trim().split(/\s+/).length; }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ---------------- eras ---------------- */
  var ERAS = [
    { id: '1971–1979', span: [1971, 1979], bucket: '70s' },
    { id: '1980–1989', span: [1980, 1989], bucket: '80s' },
    { id: '1990–1999', span: [1990, 1999], bucket: '90s' },
    { id: '2000–2012', span: [2000, 2012], bucket: '2000s' },
    { id: '2013–now', span: [2013, 2026], bucket: '2010s' }
  ];
  /* INVARIANT: BODY_POLE_W is index-aligned with CORPUS.prose.BODY (same length/order). */
  if (typeof CORPUS !== 'undefined' && CORPUS.prose && CORPUS.prose.BODY.length !== BODY_POLE_W.length) {
    console.warn('LN: BODY_POLE_W(' + BODY_POLE_W.length + ') != BODY(' + CORPUS.prose.BODY.length + ')');
  }

  /* ============================================================
     COORDINATES — SEED_MAPPING §2 (+ §4 guard)
     ============================================================ */
  function temperamentScores(f) {
    var greenish = (f.Hdom === 1 || f.Hdom === 2 || f.Hdom === 3) ||
      (f.Hdom === 0 && f.S < 0.4); // brown = desaturated orange family (documented)
    return {
      STARK: (1 - f.L) * 0.45 + f.C * 0.35 + (1 - f.S) * 0.20,
      TERRAIN: (greenish ? 0.35 : 0) + (1 - Math.abs(f.T)) * 0.25 + f.E * 0.25 +
        ((f.L > 0.35 && f.L < 0.7) ? 0.15 : 0),
      INTERIOR: (1 - f.E) * 0.4 + Math.max(0, f.T) * 0.3 + (1 - f.C) * 0.3,
      CIRCUIT: f.S * 0.35 + Math.max(0, -f.T) * 0.3 +
        ((f.E > 0.22 && !greenish) ? 0.35 : 0)
    };
  }

  function eraWeights(f) {
    // thresholds documented in PHASE0_REPORT (spec gives bands, not numbers)
    var lowC = f.C < 0.08, veryLowC = f.C < 0.06, highC = f.C > 0.16;
    var warm = f.T > 0.08, cool = f.T < -0.04;
    var lowS = f.S < 0.25, highS = f.S > 0.45;
    var midL = f.L >= 0.35 && f.L <= 0.65, highL = f.L > 0.7;
    var midC = f.C >= 0.08 && f.C <= 0.16, midS = f.S >= 0.2 && f.S <= 0.45;
    var base = 0.12;
    return [
      base + ((veryLowC && warm) ? 0.3 : 0),          // 1971–79
      base + ((highC && lowS) ? 0.3 : 0),             // 1980–89
      base + ((midL && midC && midS) ? 0.3 : 0),      // 1990–99
      base + ((highS && cool) ? 0.3 : 0),             // 2000–12
      base + ((highL && lowC) ? 0.3 : 0)              // 2013–now
    ];
  }

  function computeCoordinates(features, seed) {
    var rngC = mulberry32(seed);

    // §4 guard: near-black/near-white → the "silence record" path
    if (features.C < 0.02) {
      rngC(); rngC(); // keep parity with the two coordinate draws
      return {
        era: ERAS[4], blend: [{ pole: 'INTERIOR', pct: 70 }, { pole: 'STARK', pct: 30 }],
        density: 'solo', silence: true
      };
    }

    // C1 — era roulette
    var ws = eraWeights(features);
    var total = ws.reduce(function (a, b) { return a + b; }, 0);
    var r = rngC() * total, eraIdx = ERAS.length - 1;
    for (var i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { eraIdx = i; break; } }

    // C2 — temperament top-two + tiebreak (draw always consumed)
    var scores = temperamentScores(features);
    var tiebreak = rngC();
    var poles = Object.keys(scores).sort(function (a, b) {
      var d = scores[b] - scores[a];
      if (Math.abs(d) > 1e-9) return d;
      return tiebreak < 0.5 ? -1 : 1; // seed-broken tie
    });
    var s1 = Math.max(0, scores[poles[0]]), s2 = Math.max(0, scores[poles[1]]);
    var p1 = Math.round(100 * (s1 / (s1 + s2 || 1)));
    p1 = Math.max(55, Math.min(90, p1)); // keep a real blend, not 100/0
    var blend = [{ pole: poles[0], pct: p1 }, { pole: poles[1], pct: 100 - p1 }];

    var density = features.E < 0.10 ? 'solo' : features.E <= 0.22 ? 'small ensemble' : 'full band';
    return { era: ERAS[eraIdx], blend: blend, density: density, silence: false };
  }

  /* ============================================================
     RECORD ASSEMBLY
     ============================================================ */

  function labelCatalog(rng, label) {
    var c = label.cat, n;
    if (c.palindrome) {
      var a = pickInt(rng, 1, 9), b = pickInt(rng, 0, 9);
      n = a * 101 + b * 10; // aba palindrome
    } else {
      n = pickInt(rng, c.min, c.max);
    }
    return c.prefix + pad(n, c.pad);
  }

  function drawLabel(rng, coords, year) {
    var top2 = [coords.blend[0].pole, coords.blend[1].pole];
    function inSpan(l) {
      var ok = l.spans.some(function (s) { return year >= s[0] && year <= s[1]; });
      var arch = l.archival && year >= l.archival[0] && year <= l.archival[1];
      return ok || arch;
    }
    function tempMatch(l, ps) { return l.temps.some(function (t) { return ps.indexOf(t) !== -1; }); }
    var cands = CORPUS.labels.filter(function (l) { return inSpan(l) && tempMatch(l, top2); });
    if (!cands.length) cands = CORPUS.labels.filter(function (l) { return inSpan(l) && tempMatch(l, [top2[0]]); });
    if (!cands.length) cands = CORPUS.labels.filter(inSpan); // documented relaxation (see report)
    var adjustedYear = year;
    if (!cands.length) {
      // documented relaxation (see report): the label bank has no label before
      // 1974 (Ortsband) although the earliest era starts 1971 — clamp the year
      // forward to the earliest founding that admits a label.
      var earliest = CORPUS.labels.reduce(function (a, l) { return Math.min(a, l.spans[0][0]); }, 9999);
      adjustedYear = Math.max(year, earliest);
      cands = CORPUS.labels.filter(function (l) {
        return l.spans.some(function (s) { return adjustedYear >= s[0] && adjustedYear <= s[1]; });
      });
    }
    // labels affiliated with the DOMINANT pole are favoured 3:1
    var label = weightedPick(rng, cands, function (l) {
      return l.temps.indexOf(top2[0]) !== -1 ? 3 : 1;
    });
    var archivalWindow = !!(label.archival && adjustedYear >= label.archival[0] &&
      !label.spans.some(function (s) { return adjustedYear >= s[0] && adjustedYear <= s[1]; }));
    return { label: label, archivalWindow: archivalWindow, adjustedYear: adjustedYear };
  }

  function drawFormat(rng, coords, year, label, archivalWindow) {
    var bucket = null;
    for (var i = 0; i < ERAS.length; i++) if (ERAS[i].id === coords.era.id) bucket = ERAS[i].bucket;
    var starkDominant = coords.blend[0].pole === 'STARK';
    var format;
    if (label.cassetteOnly && !archivalWindow) format = 'CS';
    else if (bucket === '70s') { format = 'LP'; rng(); }
    else if (bucket === '80s') {
      var r = rng();
      format = (starkDominant && r < 0.12) ? '7"' : r < 0.45 ? 'CS' : 'LP';
    } else if (bucket === '90s') { format = rng() < 0.3 ? 'CD' : 'LP'; }
    else if (bucket === '2000s') { format = rng() < 0.25 ? 'CD' : 'LP'; }
    else { format = 'LP'; rng(); }

    // MONO affectation possible pre-'75 (CORPUS_NAMES §D)
    var mono = (year <= 1974) && rng() < 0.3;

    // Reissue frame (2013–now only). Archival-window labels force it.
    var reissue = null;
    if (bucket === '2010s') {
      var wantReissue = archivalWindow || rng() < 0.3;
      if (!archivalWindow) { /* draw consumed above */ }
      if (wantReissue) {
        var lo = label.spans[0][0], hi = Math.min(label.spans[0][1], year - 10);
        if (hi < lo) { lo = Math.max(1971, year - 35); hi = year - 10; }
        reissue = { originalYear: pickInt(rng, lo, hi) };
        format = 'LP'; // vinyl reissue frame
      } else { rng(); }
    } else { rng(); rng(); } // stream parity across eras

    return { format: format, mono: mono, reissue: reissue };
  }

  /* ---------------- artist ---------------- */
  var LETTERS = 'ABCDEFGHJKLMNOPRSTUVW'; // initials alphabet (no Q/X/Y/Z oddities aside from authored)
  function allNames(poolsObj, keys) {
    var out = [];
    (keys || Object.keys(poolsObj)).forEach(function (k) { out = out.concat(poolsObj[k]); });
    return out;
  }
  function singleWord(arr) { return arr.filter(function (s) { return s.indexOf(' ') === -1 && s.indexOf('-') === -1; }); }

  function drawArtist(rng, coords, label) {
    var pole = rng() < coords.blend[0].pct / 100 ? coords.blend[0].pole : coords.blend[1].pole;
    var grammars = CORPUS.artistGrammars[pole];
    var g = weightedPick(rng, grammars, function (it) { return it.weight || 1; });
    var name = null, tries = 0;
    while (tries++ < 24) {
      name = renderArtistGrammar(rng, g, pole);
      if (!name) { g = weightedPick(rng, grammars, function (it) { return it.weight || 1; }); continue; }
      if (name === label.name) { name = null; continue; }              // veto: artist ≠ label
      if (CORPUS.banViolations(name).length) { name = null; continue; } // ban scan
      break;
    }
    if (!name) name = pick(rng, allNames(CORPUS.surnames)); // deterministic fallback
    return { name: name, pole: pole, grammar: g.id };
  }

  function renderArtistGrammar(rng, g, pole) {
    switch (g.kind) {
      case 'surname':
        return pick(rng, allNames(CORPUS.surnames, g.pools));
      case 'fixed':
        return pick(rng, g.pool);
      case 'initials': { // "K.R.", "VXA", "N.C. 3"
        var n = pickInt(rng, 2, 3), i, s;
        if (rng() < 0.5) {
          s = '';
          for (i = 0; i < n; i++) s += pick(rng, LETTERS.split('')) + '.';
          if (rng() < 0.3) s += ' ' + pickInt(rng, 2, 9);
          return s;
        }
        s = '';
        for (i = 0; i < n; i++) s += pick(rng, LETTERS.split(''));
        return s;
      }
      case 'firstSurname': {
        var fn = pick(rng, allNames(CORPUS.firstNames, g.pools));
        var sn = pick(rng, allNames(CORPUS.surnames, g.pools));
        if (g.surnameOnlyChance && rng() < g.surnameOnlyChance) return sn;
        if (g.initialChance && rng() < g.initialChance) return fn[0] + '. ' + sn;
        return fn + ' ' + sn;
      }
      case 'placeCollective': {
        var place = pick(rng, singleWord(CORPUS.titlePools.PLACE));
        return place + ' ' + pick(rng, g.suffixes);
      }
      case 'duo': {
        var s1 = pick(rng, allNames(CORPUS.surnames));
        var s2 = pickPass(rng, allNames(CORPUS.surnames), function (x) { return x !== s1; });
        return s1 + ' & ' + s2;
      }
      case 'unit': {
        var nouns = g.nouns.concat(singleWord(CORPUS.titlePools.TECH));
        return pick(rng, nouns) + ' ' + pick(rng, g.suffixes);
      }
      case 'initialsNumber': { // "AV-7", "LK Systems"
        var a = pick(rng, LETTERS.split('')) + pick(rng, LETTERS.split(''));
        return rng() < 0.5 ? a + '-' + pickInt(rng, 2, 9) : a + ' Systems';
      }
    }
    return null;
  }

  /* ---------------- album title ---------------- */
  function drawAlbumTitle(rng, coords, artist, label, year) {
    var pole = coords.blend[0].pole;
    var favored = CORPUS.albumGrammars.favored[pole];
    var bucket = coords.era.bucket;
    var all = [1, 2, 3, 4, 5, 6, 7].filter(function (id) {
      if (id === 7 && (bucket === '70s' || bucket === '80s')) return false; // 90s+ only
      return true;
    });
    var meta = { usedDedication: false, grammar: null };
    var title = null, tries = 0;
    while (tries++ < 30 && !title) {
      var id = weightedPick(rng, all, function (g) {
        var w = favored.indexOf(g) !== -1 ? (3 - favored.indexOf(g)) * 2 + 2 : 1;
        return w;
      });
      var t = renderAlbumGrammar(rng, id, coords);
      if (!t) continue;
      if (t === artist.name || t === label.name) continue; // veto (CORPUS_TITLES §D)
      var probe = CORPUS.banViolations(t);
      if (probe.length) continue;
      title = t; meta.grammar = id;
      if (id === 4) meta.usedDedication = true;
    }
    if (!title) { title = pick(rng, CORPUS.titlePools.PLACE); meta.grammar = 1; }
    return { title: title, meta: meta };
  }

  function renderAlbumGrammar(rng, id, coords) {
    var AG = CORPUS.albumGrammars, P = CORPUS.titlePools;
    switch (id) {
      case 1: return pick(rng, P.PLACE);
      case 2: // noun phrase — authored examples + DOMESTIC atoms (see report)
        return pick(rng, AG.nounPhraseExamples.concat(P.DOMESTIC));
      case 3: return pick(rng, P.TECH);
      case 4: { // "[Noun] for [Initial]."
        var noun = pick(rng, singleWord(P.DOMESTIC).concat(singleWord(P.TECH)));
        return noun + ' for ' + pick(rng, LETTERS.split('')) + '.';
      }
      case 5: // numbered series
        if (rng() < 0.5) return 'Variations ' + pickInt(rng, AG.variationRange[0], AG.variationRange[1]);
        var base = rng() < 0.5 ? pick(rng, singleWord(P.PLACE)) + ' ' : '';
        return base + 'Studies ' + pick(rng, AG.seriesNumeralsI_IV);
      case 6: { // date/measure form
        var r = rng();
        if (coords.blend[0].pole === 'TERRAIN' && r < 0.3) return pick(rng, AG.mapScales); // map-scale: TERRAIN only
        if (r < 0.65) return pick(rng, CORPUS.months) + ' Sessions';
        return pickInt(rng, 34, 52) + ' Minutes';
      }
      case 7: return pick(rng, AG.sentenceFragments);
    }
    return null;
  }

  /* ---------------- tracklist ---------------- */
  var POOL_WEIGHTS = {
    STARK: { TECH: 0.40, NUMBERS: 0.18, PLACE: 0.12, DOMESTIC: 0.12, FIELDNOTE: 0.10, PEOPLE: 0.08 },
    TERRAIN: { PLACE: 0.38, FIELDNOTE: 0.28, NUMBERS: 0.10, DOMESTIC: 0.10, TECH: 0.06, PEOPLE: 0.08 },
    INTERIOR: { DOMESTIC: 0.34, FIELDNOTE: 0.20, PEOPLE: 0.14, NUMBERS: 0.14, PLACE: 0.10, TECH: 0.08 },
    CIRCUIT: { TECH: 0.38, NUMBERS: 0.22, DOMESTIC: 0.12, PLACE: 0.10, FIELDNOTE: 0.10, PEOPLE: 0.08 }
  };

  function drawTrackCount(rng, coords, format) {
    if (format === '7"') return 2; // documented exception (see report): a 7" cannot carry 4–9
    var pole = coords.blend[0].pole;
    if (coords.density === 'solo' && (pole === 'INTERIOR' || pole === 'TERRAIN')) return pickInt(rng, 4, 7);
    if (format === 'CD') return pickInt(rng, 6, 9);
    return pickInt(rng, 4, 9); // CORPUS_TITLES §C: 4–9 tracks
  }

  function isDedicationForm(t) { return /^(For |To |Letter to )/.test(t); }
  function hasParen(t) { return t.indexOf('(') !== -1; }

  function drawTitles(rng, coords, count, artist, label, album, albumMeta) {
    var wA = POOL_WEIGHTS[coords.blend[0].pole], wB = POOL_WEIGHTS[coords.blend[1].pole];
    var mix = coords.blend[0].pct / 100;
    var poolNames = Object.keys(CORPUS.titlePools);
    var titles = [], sources = [], usedFragments = {};
    var parenCount = 0, peopleCount = 0, dedicationCount = albumMeta.usedDedication ? 1 : 0;

    function ok(t, poolName) {
      if (usedFragments[t]) return false;                       // no same fragment twice unmodified
      if (t === artist.name || t === label.name) return false;  // veto §D
      if (t === album) return false;
      if (hasParen(t) && parenCount >= 1) return false;         // one-parenthetical rule
      if (poolName === 'PEOPLE' && peopleCount >= 1) return false;
      if (isDedicationForm(t) && dedicationCount >= 1) return false; // ≤1 dedication per record
      if (CORPUS.banViolations(t).length) return false;
      return true;
    }

    for (var i = 0; i < count; i++) {
      var drawn = null, srcPool = null, tries = 0;
      while (tries++ < 40 && !drawn) {
        var poolName = weightedPick(rng, poolNames, function (p) {
          return (wA[p] || 0.02) * mix + (wB[p] || 0.02) * (1 - mix);
        });
        var t = pick(rng, CORPUS.titlePools[poolName]);
        if (ok(t, poolName)) { drawn = t; srcPool = poolName; }
      }
      if (!drawn) { // deterministic fallback: scan pools in order
        outer:
        for (var pi = 0; pi < poolNames.length; pi++) {
          var pool = CORPUS.titlePools[poolNames[pi]];
          for (var ti = 0; ti < pool.length; ti++) {
            if (ok(pool[ti], poolNames[pi])) { drawn = pool[ti]; srcPool = poolNames[pi]; break outer; }
          }
        }
      }
      usedFragments[drawn] = true;
      if (hasParen(drawn)) parenCount++;
      if (srcPool === 'PEOPLE') peopleCount++;
      if (isDedicationForm(drawn)) dedicationCount++;
      titles.push(drawn); sources.push(srcPool);
    }

    // cross-pollination: a pure-pool record reads generated — force ≥1 PLACE|DOMESTIC
    var hasPlaceDom = sources.some(function (s) { return s === 'PLACE' || s === 'DOMESTIC'; });
    if (!hasPlaceDom && count > 1) {
      var idx = count - 1;
      var repl = pickPass(rng, CORPUS.titlePools.PLACE.concat(CORPUS.titlePools.DOMESTIC), function (t) {
        return ok(t, hasParen(t) ? 'DOMESTIC' : 'PLACE');
      });
      if (repl) {
        usedFragments[repl] = true;
        if (hasParen(repl)) parenCount++;
        titles[idx] = repl;
        sources[idx] = CORPUS.titlePools.PLACE.indexOf(repl) !== -1 ? 'PLACE' : 'DOMESTIC';
      }
    }

    // at most ONE parenthetical VARIANT — "(Reprise)", "(Slow)", "(Version)"
    if (parenCount === 0 && count >= 6 && rng() < 0.15) {
      var srcIdx = pickInt(rng, 0, Math.floor(count / 2) - 1);
      var variant = titles[srcIdx] + ' (' + pick(rng, ['Reprise', 'Slow', 'Version']) + ')';
      if (!CORPUS.banViolations(variant).length) {
        titles[count - 1] = variant;
        sources[count - 1] = sources[srcIdx];
        parenCount++;
      }
    } else { rng(); } // parity

    return { titles: titles, sources: sources };
  }

  /* ---------------- timings ---------------- */
  function durationRange(pole, bucket, format) {
    if (format === '7"') return [170, 300];
    if (pole === 'STARK' && bucket === '80s') return [175, 310]; // 2:55–5:10 (CORPUS_TITLES §C)
    if (pole === 'STARK') return [180, 360];
    if (pole === 'TERRAIN') return [210, 480];
    if (pole === 'INTERIOR') return [200, 420];
    return [190, 420]; // CIRCUIT
  }

  function fixSeparation(durs) {
    // deterministic: no two tracks within 4 seconds of each other
    for (var pass = 0; pass < 8; pass++) {
      var clean = true;
      for (var i = 0; i < durs.length; i++) {
        for (var j = 0; j < i; j++) {
          if (Math.abs(durs[i] - durs[j]) < 4) { durs[i] += 4; clean = false; }
        }
      }
      if (clean) return;
    }
  }

  function bestSplit(durs, cap) {
    var best = null, bestDiff = Infinity;
    for (var s = 1; s < durs.length; s++) {
      var a = durs.slice(0, s).reduce(function (x, y) { return x + y; }, 0);
      var b = durs.slice(s).reduce(function (x, y) { return x + y; }, 0);
      if (a <= cap && b <= cap && Math.abs(a - b) < bestDiff) { best = s; bestDiff = Math.abs(a - b); }
    }
    return best;
  }

  function drawTimings(rng, coords, count, format, label) {
    var pole = coords.blend[0].pole, bucket = coords.era.bucket;
    var range = durationRange(pole, bucket, format);
    var durs = [];
    for (var i = 0; i < count; i++) durs.push(pickInt(rng, range[0], range[1]));

    // INTERIOR: a 12+ minute closer is common — closer 9:00–16:30, 65% of the time
    if (pole === 'INTERIOR' && format !== '7"' && count >= 4) {
      if (rng() < 0.65) durs[count - 1] = pickInt(rng, 540, 990);
    } else { rng(); }

    fixSeparation(durs);

    // Hourglass Annex: "every release exactly 44 minutes, by policy."
    if (label.force44) {
      for (var it = 0; it < 6; it++) {
        var tot = durs.reduce(function (a, b) { return a + b; }, 0);
        if (tot === 2640) break;
        var scale = 2640 / tot;
        durs = durs.map(function (d) { return Math.max(60, Math.round(d * scale)); });
        var drift = 2640 - durs.reduce(function (a, b) { return a + b; }, 0);
        // settle the drift on the longest track, then re-check separation
        var li = 0;
        for (i = 1; i < count; i++) if (durs[i] > durs[li]) li = i;
        durs[li] += drift;
        fixSeparation(durs);
      }
    }

    // side split — LP side ≤ 26:30, C-46 side ≤ 23:00 (CORPUS_TITLES §C)
    var sides = null;
    if (format === 'LP' || format === 'CS' || format === '7"') {
      if (format === '7"') {
        sides = { split: 1 };
      } else {
        var cap = format === 'CS' ? 1380 : 1590;
        var best = bestSplit(durs, cap);
        var guard = 0;
        while (best === null && guard++ < 10) {
          // shrink proportionally, restore separation, and re-search the split
          durs = durs.map(function (d) { return Math.max(80, Math.round(d * 0.92)); });
          fixSeparation(durs);
          best = bestSplit(durs, cap);
        }
        if (best === null) best = Math.ceil(count / 2); // unreachable in practice
        sides = { split: best };
      }
    }
    return { durations: durs, sides: sides };
  }

  function enforceLongestTitleRule(rng, titles, sources, durations, artist, label, album) {
    // "Longest track gets a title from PLACE or NUMBERS"
    var li = 0;
    for (var i = 1; i < durations.length; i++) if (durations[i] > durations[li]) li = i;
    if (sources[li] === 'PLACE' || sources[li] === 'NUMBERS') return;
    for (i = 0; i < titles.length; i++) {
      if (i !== li && (sources[i] === 'PLACE' || sources[i] === 'NUMBERS')) {
        var t = titles[li], s = sources[li];
        titles[li] = titles[i]; sources[li] = sources[i];
        titles[i] = t; sources[i] = s;
        return;
      }
    }
    // none available: redraw the longest track's title from PLACE ∪ NUMBERS
    var cand = pickPass(rng, CORPUS.titlePools.PLACE.concat(CORPUS.titlePools.NUMBERS), function (c) {
      return titles.indexOf(c) === -1 && c !== artist.name && c !== label.name && c !== album &&
        !CORPUS.banViolations(c).length && !(c.indexOf('(') !== -1 && titles.some(hasParen));
    });
    if (cand) { sources[li] = CORPUS.titlePools.PLACE.indexOf(cand) !== -1 ? 'PLACE' : 'NUMBERS'; titles[li] = cand; }
  }

  /* ---------------- personnel ---------------- */
  function nameFromPools(rng, regionBias, used, initialStyle) {
    var regions = ['nordic', 'uk', 'de', 'na'];
    for (var t = 0; t < 24; t++) {
      var region = (regionBias && rng() < 0.6) ? regionBias : pick(rng, regions);
      var fn = pick(rng, CORPUS.firstNames[region] || allNames(CORPUS.firstNames));
      var sn = pick(rng, CORPUS.surnames[region] || allNames(CORPUS.surnames));
      var name = (initialStyle && rng() < 0.4) ? fn[0] + '. ' + sn : fn + ' ' + sn;
      if (!used[name] && !used[sn]) { used[name] = true; used[sn] = true; return name; }
    }
    return pick(rng, allNames(CORPUS.firstNames)) + ' ' + pick(rng, allNames(CORPUS.surnames));
  }

  function housesFor(year, excludeName) {
    var h = CORPUS.masteringHouses.filter(function (x) {
      return year >= (x.from || 0) && x.name !== excludeName;
    });
    return h.length ? h.map(function (x) { return x.name; }) : ['Raum 4'];
  }

  function drawPersonnel(rng, coords, year, format, label, artist, reissue) {
    var bucket = coords.era.bucket;
    var used = {};
    // don't reuse the artist's own surname for staff
    String(artist.name).split(/[\s&.]+/).forEach(function (tok) { if (tok) used[tok] = true; });

    var lines = [];
    var regionBias = label.region === 'de' ? 'de' : label.region === 'uk' ? 'uk' :
      label.region === 'na' ? 'na' : 'nordic';

    // studio — R9a
    var studio;
    var selfLoft = (coords.blend[0].pole === 'CIRCUIT' && rng() < 0.45);
    if (selfLoft) {
      studio = { name: artist.name + "'s own loft", city: null, selfLoft: true };
    } else {
      var studioPool = CORPUS.studios.filter(function (s) {
        if (s.labelTie && s.labelTie !== label.name) return false;
        if (s.from && year < s.from) return false;
        return true;
      });
      studio = weightedPick(rng, studioPool, function (s) {
        if (s.labelTie === label.name) return 6;
        if (s.island && coords.blend[0].pole === 'TERRAIN') return 2;
        return s.island ? 0.7 : 1;
      });
    }
    var houses = housesFor(year, studio.name);

    var engineer = nameFromPools(rng, regionBias, used, true);
    var producer = nameFromPools(rng, regionBias, used, false);
    var sleeve = nameFromPools(rng, regionBias, used, true);
    var mixer = null, master = null;

    var recordedAt = 'Recorded at ' + studio.name + (studio.city ? ', ' + studio.city : '') + '.';

    if (bucket === '70s') {
      lines.push('Produced by ' + producer + '.');
      lines.push('Engineer: ' + engineer + '.');
      lines.push(recordedAt);
      lines.push('Sleeve by ' + sleeve + '.');
    } else if (bucket === '80s') {
      lines.push('Produced by ' + producer + '.');
      lines.push('Engineer: ' + engineer + '.');
      if (coords.density !== 'solo') { mixer = nameFromPools(rng, regionBias, used, true); lines.push('Mixed by ' + mixer + '.'); }
      lines.push(recordedAt);
      if (format === 'CS') lines.push('Dubbed by the label.');
      else lines.push('Cut at ' + pick(rng, houses) + '.');
      lines.push('Sleeve by ' + sleeve + '.');
    } else if (bucket === '90s') {
      lines.push('Recorded and mixed by ' + engineer + (studio.selfLoft ? '' : ' at ' + studio.name) + '.');
      master = pick(rng, CORPUS.masteringNames);
      lines.push('Mastered by ' + master + ' at ' + pick(rng, houses) + '.');
      lines.push('Sleeve by ' + sleeve + '.');
    } else {
      lines.push(recordedAt);
      master = pick(rng, CORPUS.masteringNames);
      if (format === 'LP' || format === '7"') {
        if (rng() < 0.5) lines.push('Mastered for vinyl by ' + master + '.');
        else lines.push('Lacquer cut by ' + master + ' at ' + pick(rng, houses) + '.');
      } else {
        lines.push('Mastered by ' + master + '.');
      }
      lines.push('Sleeve by ' + sleeve + '.');
      if (reissue) lines.push('Remastered from the original tapes, ' + year + '.');
    }

    // ≤1 recurring session player (universe connective tissue) — never for solo
    if (coords.density !== 'solo' && rng() < 0.35) {
      var sp = pick(rng, CORPUS.sessionPlayers);
      lines.splice(Math.min(1, lines.length), 0, sp);
    } else { rng(); }

    return { lines: lines, studio: studio, engineer: engineer, producer: producer, master: master };
  }

  /* ---------------- prose ---------------- */
  function bindProse(rng, entry, ctx) {
    var t = entry.t;
    if (t.indexOf('{STUDIO}') !== -1) t = t.replace('{STUDIO}', ctx.studio.name);
    if (t.indexOf('{ARTIST_SPACE}') !== -1) t = t.replace('{ARTIST_SPACE}', pick(rng, CORPUS.artistSpaces));
    if (t.indexOf('{MONTH2}') !== -1) {
      var m1 = pickInt(rng, 0, 8);
      t = t.replace('{MONTH}', CORPUS.months[m1]).replace('{MONTH2}', CORPUS.months[m1 + pickInt(rng, 1, 3)]);
    } else if (t.indexOf('{MONTH}') !== -1) {
      t = t.replace('{MONTH}', pick(rng, CORPUS.months));
    }
    if (t.indexOf('{YEAR}') !== -1) t = t.replace('{YEAR}', String(ctx.recYear));
    if (t.indexOf('{ISLAND}') !== -1) t = t.replace('{ISLAND}', 'Gotland'); // Sommarhuset is on Gotland (corpus)
    if (t.indexOf('{PERSON}') !== -1) t = t.replace('{PERSON}', ctx.person);
    if (t.indexOf('{T}') !== -1) { // oddity §H: {T} must fall within a real track
      var tr = pick(rng, ctx.tracks);
      var at = pickInt(rng, 15, Math.max(16, tr.seconds - 10));
      t = t.replace('{T}', mmss(at));
    }
    if (t.indexOf('{TSIL}') !== -1) t = t.replace('{TSIL}', mmss(pickInt(rng, 11, 58)));
    if (t.indexOf('{AB}') !== -1) t = t.replace('{AB}', rng() < 0.5 ? 'A' : 'B');
    if (t.indexOf('{TRACK}') !== -1) t = t.replace('{TRACK}', pick(rng, ctx.tracks).title);
    if (t.indexOf('{NAME}') !== -1) t = t.replace('{NAME}', pick(rng, allNames(CORPUS.firstNames)));
    if (t.indexOf('{N}') !== -1) {
      t = entry.bindTrackNo
        ? t.replace('{N}', String(pickInt(rng, 2, ctx.tracks.length)))
        : t.replace('{N}', String(pick(rng, CORPUS.editions)));
    }
    if (t.indexOf('{CITY}') !== -1) t = t.replace('{CITY}', ctx.label.city);
    if (t.indexOf('{INITIAL}') !== -1) t = t.replace('{INITIAL}', pick(rng, LETTERS.split('')));
    return t;
  }

  /* TEMPERAMENT-CONDITIONED BODY SELECTION (assembly rule — pressing plant;
     corpus text untouched). Fit weights per pole for each authored BODY
     sentence, indexed against CORPUS.prose.BODY order. A record's draw
     weight is the blend-weighted mix of its two poles, so records at
     different coordinates draw from meaningfully different subsets.
     Partition documented in the PHASE0 report. */
  var BODY_POLE_W = [
    /*  0 piano not tuned        */ { STARK: 0.3, TERRAIN: 1.0, INTERIOR: 3.0, CIRCUIT: 0.2 },
    /*  1 same spring reverb     */ { STARK: 2.0, TERRAIN: 1.5, INTERIOR: 1.0, CIRCUIT: 1.0 },
    /*  2 synthesizer borrowed   */ { STARK: 1.5, TERRAIN: 0.2, INTERIOR: 0.7, CIRCUIT: 3.0 },
    /*  3 practice amp           */ { STARK: 2.0, TERRAIN: 2.5, INTERIOR: 0.6, CIRCUIT: 0.2 },
    /*  4 room did the work      */ { STARK: 1.0, TERRAIN: 1.5, INTERIOR: 2.5, CIRCUIT: 0.5 },
    /*  5 two tape machines      */ { STARK: 1.0, TERRAIN: 1.0, INTERIOR: 2.0, CIRCUIT: 2.0 },
    /*  6 radiator percussion    */ { STARK: 1.0, TERRAIN: 0.3, INTERIOR: 3.0, CIRCUIT: 0.5 },
    /*  7 strings + coffee       */ { STARK: 0.4, TERRAIN: 2.0, INTERIOR: 2.0, CIRCUIT: 0.3 },
    /*  8 church organ           */ { STARK: 0.5, TERRAIN: 2.5, INTERIOR: 1.5, CIRCUIT: 0.3 },
    /*  9 no computer            */ { STARK: 1.5, TERRAIN: 2.0, INTERIOR: 1.0, CIRCUIT: 0.5 },
    /* 10 firsts / seconds worse */ { STARK: 1.5, TERRAIN: 1.5, INTERIOR: 1.5, CIRCUIT: 1.5 },
    /* 11 bass recorded last     */ { STARK: 2.0, TERRAIN: 1.5, INTERIOR: 1.0, CIRCUIT: 0.7 },
    /* 12 same four bars         */ { STARK: 2.0, TERRAIN: 0.4, INTERIOR: 1.0, CIRCUIT: 3.0 },
    /* 13 mics not touched       */ { STARK: 0.8, TERRAIN: 2.5, INTERIOR: 2.0, CIRCUIT: 0.5 },
    /* — 24 BODY sentences approved 31 Jul 2026; primary pole ~2.6–3.0 — */
    /* 14 kettle audible twice   */ { STARK: 0.3, TERRAIN: 0.8, INTERIOR: 3.0, CIRCUIT: 0.3 },
    /* 15 curtains drawn         */ { STARK: 0.8, TERRAIN: 0.3, INTERIOR: 2.8, CIRCUIT: 0.6 },
    /* 16 chair creak            */ { STARK: 0.2, TERRAIN: 0.7, INTERIOR: 3.0, CIRCUIT: 0.2 },
    /* 17 one mic, eleven moves  */ { STARK: 0.7, TERRAIN: 1.0, INTERIOR: 2.8, CIRCUIT: 0.4 },
    /* 18 upright from beneath   */ { STARK: 0.4, TERRAIN: 0.5, INTERIOR: 3.0, CIRCUIT: 0.3 },
    /* 19 neighbours' volume     */ { STARK: 0.5, TERRAIN: 0.4, INTERIOR: 2.6, CIRCUIT: 0.8 },
    /* 20 four outdoors, wind    */ { STARK: 0.3, TERRAIN: 3.0, INTERIOR: 0.7, CIRCUIT: 0.2 },
    /* 21 generator forty metres */ { STARK: 0.8, TERRAIN: 3.0, INTERIOR: 0.4, CIRCUIT: 0.5 },
    /* 22 boots on, floor sound  */ { STARK: 1.0, TERRAIN: 2.8, INTERIOR: 0.5, CIRCUIT: 0.2 },
    /* 23 van as control room    */ { STARK: 0.8, TERRAIN: 2.8, INTERIOR: 0.4, CIRCUIT: 0.5 },
    /* 24 ferry, timetable       */ { STARK: 0.3, TERRAIN: 3.0, INTERIOR: 0.8, CIRCUIT: 0.2 },
    /* 25 field recs within 1 km */ { STARK: 0.4, TERRAIN: 3.0, INTERIOR: 0.6, CIRCUIT: 0.7 },
    /* 26 drum machine all night */ { STARK: 3.0, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 1.5 },
    /* 27 corridor vocals        */ { STARK: 3.0, TERRAIN: 0.5, INTERIOR: 0.8, CIRCUIT: 0.4 },
    /* 28 no reverb but rooms    */ { STARK: 2.8, TERRAIN: 1.0, INTERIOR: 0.8, CIRCUIT: 0.3 },
    /* 29 tuned once, January    */ { STARK: 2.8, TERRAIN: 1.2, INTERIOR: 0.6, CIRCUIT: 0.2 },
    /* 30 six amps, broken used  */ { STARK: 3.0, TERRAIN: 0.8, INTERIOR: 0.4, CIRCUIT: 0.5 },
    /* 31 heating failed, side B */ { STARK: 2.8, TERRAIN: 0.7, INTERIOR: 0.9, CIRCUIT: 0.4 },
    /* 32 patch not saved        */ { STARK: 0.4, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 3.0 },
    /* 33 sequencer drift        */ { STARK: 0.7, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 3.0 },
    /* 34 four oscillators       */ { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 3.0 },
    /* 35 delay set, taped over  */ { STARK: 1.0, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 2.8 },
    /* 36 nine evenings, fader   */ { STARK: 0.8, TERRAIN: 0.4, INTERIOR: 1.0, CIRCUIT: 2.6 },
    /* 37 modular sold, invoice  */ { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 3.0 },
    /* — 12 added 1 Aug 2026 (pool 38→50); index-aligned to CORPUS.prose.BODY — */
    /* 38 dropped pick kept      */ { STARK: 3.0, TERRAIN: 0.6, INTERIOR: 0.5, CIRCUIT: 0.3 },
    /* 39 loud, once             */ { STARK: 3.0, TERRAIN: 0.7, INTERIOR: 0.4, CIRCUIT: 0.4 },
    /* 40 vocal single pass cold */ { STARK: 2.8, TERRAIN: 0.5, INTERIOR: 0.9, CIRCUIT: 0.3 },
    /* 41 tide kept the hours    */ { STARK: 0.5, TERRAIN: 3.0, INTERIOR: 0.7, CIRCUIT: 0.2 },
    /* 42 tractor, third minute  */ { STARK: 0.6, TERRAIN: 3.0, INTERIOR: 0.5, CIRCUIT: 0.3 },
    /* 43 barn, swallows         */ { STARK: 0.7, TERRAIN: 3.0, INTERIOR: 0.6, CIRCUIT: 0.2 },
    /* 44 hall clock stopped     */ { STARK: 0.4, TERRAIN: 0.5, INTERIOR: 3.0, CIRCUIT: 0.3 },
    /* 45 house asleep           */ { STARK: 0.5, TERRAIN: 0.6, INTERIOR: 2.9, CIRCUIT: 0.3 },
    /* 46 window, courtyard      */ { STARK: 0.4, TERRAIN: 1.0, INTERIOR: 2.8, CIRCUIT: 0.3 },
    /* 47 arpeggiator outlived   */ { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 3.0 },
    /* 48 sequencer left running */ { STARK: 0.7, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 3.0 },
    /* 49 one oscillator palette */ { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 3.0 },
    /* +87 added 1 Aug 2026 (workflow); index-aligned to CORPUS.prose.BODY */
    { STARK: 2.8, TERRAIN: 0.4, INTERIOR: 0.6, CIRCUIT: 0.3 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.6 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.5 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 0.5 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.7 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 0.3 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 0.5 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.3 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.8 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 0.3 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.7, CIRCUIT: 0.3 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 0.5 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.6, CIRCUIT: 0.5 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.8 },
    { STARK: 2.7, TERRAIN: 0.4, INTERIOR: 0.6, CIRCUIT: 0.3 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.6 },
    { STARK: 2.9, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.6 },
    { STARK: 2.7, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 1 },
    { STARK: 2.8, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 0.5 },
    { STARK: 0.5, TERRAIN: 2.8, INTERIOR: 0.7, CIRCUIT: 0.2 },
    { STARK: 0.3, TERRAIN: 3, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 2.9, INTERIOR: 0.5, CIRCUIT: 0.2 },
    { STARK: 0.8, TERRAIN: 2.7, INTERIOR: 0.6, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 2.9, INTERIOR: 0.5, CIRCUIT: 0.2 },
    { STARK: 0.6, TERRAIN: 2.9, INTERIOR: 0.4, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 2.7, INTERIOR: 0.2, CIRCUIT: 0.9 },
    { STARK: 0.3, TERRAIN: 3, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 2.8, INTERIOR: 0.7, CIRCUIT: 0.3 },
    { STARK: 0.7, TERRAIN: 2.6, INTERIOR: 0.8, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 2.7, INTERIOR: 0.3, CIRCUIT: 0.9 },
    { STARK: 0.5, TERRAIN: 2.9, INTERIOR: 0.5, CIRCUIT: 0.3 },
    { STARK: 0.5, TERRAIN: 3, INTERIOR: 0.2, CIRCUIT: 0.2 },
    { STARK: 0.3, TERRAIN: 3, INTERIOR: 0.2, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 3, INTERIOR: 0.4, CIRCUIT: 0.2 },
    { STARK: 0.7, TERRAIN: 2.7, INTERIOR: 0.6, CIRCUIT: 0.2 },
    { STARK: 0.8, TERRAIN: 2.8, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 2.9, INTERIOR: 0.3, CIRCUIT: 0.6 },
    { STARK: 0.4, TERRAIN: 3, INTERIOR: 0.5, CIRCUIT: 0.2 },
    { STARK: 0.8, TERRAIN: 2.9, INTERIOR: 0.4, CIRCUIT: 0.2 },
    { STARK: 0.3, TERRAIN: 2.8, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 2.8, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.3, TERRAIN: 3, INTERIOR: 0.3, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.5 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.7, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 0.6, INTERIOR: 2.7, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.3 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 3, CIRCUIT: 0.2 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.4, TERRAIN: 0.3, INTERIOR: 2.8, CIRCUIT: 0.4 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.4 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 2.7, CIRCUIT: 0.7 },
    { STARK: 0.4, TERRAIN: 0.3, INTERIOR: 2.9, CIRCUIT: 0.5 },
    { STARK: 0.4, TERRAIN: 0.4, INTERIOR: 2.8, CIRCUIT: 0.2 },
    { STARK: 0.7, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.3 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 3, CIRCUIT: 0.2 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 2.9, CIRCUIT: 0.3 },
    { STARK: 0.7, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.6, CIRCUIT: 2.8 },
    { STARK: 0.6, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.6, CIRCUIT: 2.8 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 2.9 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.3, CIRCUIT: 3 },
    { STARK: 0.8, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 2.9 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 3 },
    { STARK: 0.4, TERRAIN: 0.3, INTERIOR: 0.6, CIRCUIT: 2.8 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 3 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.6, CIRCUIT: 2.8 },
    { STARK: 0.6, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 2.8 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.4, TERRAIN: 0.2, INTERIOR: 0.9, CIRCUIT: 2.7 },
    { STARK: 0.4, TERRAIN: 0.3, INTERIOR: 0.5, CIRCUIT: 2.9 },
    { STARK: 0.7, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 2.9 },
    { STARK: 0.7, TERRAIN: 0.4, INTERIOR: 0.5, CIRCUIT: 2.7 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.3, CIRCUIT: 3 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.5, TERRAIN: 0.3, INTERIOR: 0.7, CIRCUIT: 2.8 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 2.8 },
    { STARK: 0.5, TERRAIN: 0.2, INTERIOR: 0.4, CIRCUIT: 2.9 },
    { STARK: 0.6, TERRAIN: 0.2, INTERIOR: 0.3, CIRCUIT: 2.9 }
  ];
  function makeBodyWeight(coords) {
    var p1 = coords.blend[0], p2 = coords.blend[1];
    return function (e) {
      var i = CORPUS.prose.BODY.indexOf(e);
      var w = BODY_POLE_W[i];
      if (!w) return 1;
      return (w[p1.pole] * p1.pct + w[p2.pole] * p2.pct) / 100;
    };
  }

  function drawProse(rng, coords, ctx) {
    var bucket = coords.era.bucket;
    var used = {};
    var clipped = bucket === '80s'; // 80s: clipped — bias toward shorter entries (see report)
    function lengthWeight(e) {
      if (!clipped) return 1;
      var w = words(e.t);
      return w <= 8 ? 2.2 : w <= 12 ? 1.2 : 0.55;
    }
    var bodyWeight = makeBodyWeight(coords);
    function bodyDraw(pool) {
      return weightedPick(rng, pool, function (e) { return lengthWeight(e) * bodyWeight(e); });
    }

    // OPENING
    var openings = CORPUS.prose.OPENING.filter(function (e) {
      if (e.needsSommarhuset && ctx.studio.name !== 'Sommarhuset') return false;
      return true;
    });
    var opening = weightedPick(rng, openings, function (e) {
      var w = lengthWeight(e);
      if (e.needsSommarhuset) w *= 6; // when eligible, prefer the bound line
      return w;
    });
    used[opening.t] = true;

    // BODY (one; the governor may add more)
    function bodyOk(e) {
      if (used[e.t]) return false;
      if (e.minYear && ctx.recYear < e.minYear) return false;
      // combination veto (SYSTEM §6): a sentence naming side B cannot appear
      // on an unsided format (CD) — same class as the minYear guard above
      if (e.t.indexOf('side B') !== -1 && !ctx.hasSides) return false;
      return true;
    }
    var body = bodyDraw(CORPUS.prose.BODY.filter(bodyOk));
    used[body.t] = true;

    // ODDITY — exactly one, slot-bound to real generated elements (§H)
    var oddities = CORPUS.prose.ODDITY.filter(function (e) {
      if (e.needsSides && !ctx.hasSides) return false;
      if (e.needsStereo && ctx.mono) return false;
      if (e.needsEnsemble && coords.density === 'solo') return false;
      return true;
    });
    var oddity = weightedPick(rng, oddities, lengthWeight);

    // CLOSE
    var closes = CORPUS.prose.CLOSE.filter(function (e) {
      if (e.no70s && bucket === '70s') return false; // §F: 70s drops the irony close
      if (e.needsEnsemble && coords.density === 'solo') return false;
      return true;
    });
    var close;
    if (coords.silence) {
      close = { t: 'Play at low volume, or not.' }; // SEED_MAPPING §4 guard: forced CLOSE
      rng();
    } else {
      close = weightedPick(rng, closes, function (e) {
        return lengthWeight(e) * (e.selfRef ? 0.3 : 1); // "use ≤30%"
      });
    }

    var sentences = [
      bindProse(rng, opening, ctx),
      bindProse(rng, body, ctx),
      bindProse(rng, oddity, ctx),
      bindProse(rng, close, ctx)
    ];
    var closeMeta = close;

    // reissue register (§F): prepend "Originally issued {YEAR}."
    if (ctx.reissue) sentences.unshift('Originally issued ' + ctx.reissue.originalYear + '.');

    // WORD-COUNT GOVERNOR (§H): under 60 → add BODY; over 110 → drop CLOSE before BODY
    function wc() { return words(sentences.join(' ')); }
    var guard = 0;
    while (wc() < 60 && guard++ < 6) {
      var extraPool = CORPUS.prose.BODY.filter(bodyOk);
      if (!extraPool.length) break;
      var extra = bodyDraw(extraPool);
      used[extra.t] = true;
      // insert extra BODY before the oddity (keep ODDITY → CLOSE at the end)
      sentences.splice(sentences.length - 2, 0, bindProse(rng, extra, ctx));
    }
    if (wc() > 110) sentences.pop(); // drop CLOSE
    while (wc() > 110 && sentences.length > (ctx.reissue ? 4 : 3)) {
      sentences.splice(sentences.length - 2, 1); // then drop extra bodies
    }

    return { text: sentences.join(' '), closeMeta: closeMeta };
  }

  /* ---------------- pressing line ---------------- */
  function threeWordPhrase(rng) {
    // matrix etch bound to authored atoms: three-word FIELDNOTE fragments
    var threes = CORPUS.titlePools.FIELDNOTE.filter(function (t) {
      return t.replace(/,/g, '').split(/\s+/).length === 3 && !CORPUS.banViolations(t).length;
    });
    return pick(rng, threes).replace(/,/g, '').toLowerCase();
  }

  function drawPressingLine(rng, ctx) {
    function filterPressing(dropEditionExclusion) {
      return CORPUS.prose.PRESSING.filter(function (e) {
        if (e.labelLock && e.labelLock !== ctx.label.name) return false;
        if (e.formats && e.formats.indexOf(ctx.format) === -1) return false;
        if (e.minYear && ctx.recYear < e.minYear) return false;
        if (e.reissueOnly && !ctx.reissue) return false;
        if (!dropEditionExclusion && e.edition && ctx.closeMentionsEdition) return false; // no contradictory press counts
        return true;
      });
    }
    var cands = filterPressing(false);
    if (!cands.length) cands = filterPressing(true); // e.g. CD + edition-mentioning CLOSE
    if (!cands.length) cands = [CORPUS.prose.PRESSING[0]]; // deterministic last resort
    var e = weightedPick(rng, cands, function (c) {
      if (c.labelLock) return 5;                                       // locked lines fire on their label
      if (c.t.indexOf('Matrix') === 0) return ctx.label.matrixEtched ? 4 : 0.6; // Kolonn character affinity
      return 1;
    });
    var t = e.t
      .replace('{EDITION}', String(pick(rng, CORPUS.editions)))
      .replace('{PERSON}', pick(rng, CORPUS.masteringNames))
      .replace('{HOUSE}', pick(rng, housesFor(ctx.recYear, null)))
      .replace('{CAT}', ctx.catalog)
      .replace('{PHRASE}', threeWordPhrase(rng))
      .replace('{OYEAR}', ctx.reissue ? String(ctx.reissue.originalYear) : '')
      .replace('{RYEAR}', String(ctx.recYear));
    return t;
  }

  /* ---------------- lowercase affectation (CORPUS_TITLES §C) ---------------- */
  function maybeLowercase(rng, coords, tracks) {
    var bucket = coords.era.bucket;
    var pole = coords.blend[0].pole;
    if ((bucket === '2000s' || bucket === '2010s') &&
        (pole === 'INTERIOR' || pole === 'CIRCUIT') && rng() < 0.25) {
      tracks.forEach(function (t) { t.title = t.title.toLowerCase(); });
      return true;
    }
    rng(); // parity when the branch doesn't fire
    return false;
  }

  /* ============================================================
     THE PURE FUNCTION — (features, pressing k) → Record
     ============================================================ */
  function generateRecord(features, k, opts) {
    k = k || 0;
    opts = opts || {};
    var seed = (opts.seed != null) ? (opts.seed >>> 0) : FEAT.seedFromFeatures(features);
    var coords = computeCoordinates(features, seed);
    var rng = mulberry32(mixSeed(seed, k));

    // R1 — year
    var year = coords.silence ? pickInt(rng, 2013, 2026)
      : pickInt(rng, coords.era.span[0], coords.era.span[1]);

    // R2 — label + catalog
    var lab = drawLabel(rng, coords, year);
    var label = lab.label;
    if (lab.adjustedYear !== year) year = lab.adjustedYear; // documented 1971–73 clamp
    var catalog = labelCatalog(rng, label);

    // R3 — format / STEREO-MONO / reissue frame
    var fm = drawFormat(rng, coords, year, label, lab.archivalWindow);

    // R4 — artist
    var artist = drawArtist(rng, coords, label);

    // R5 — album title
    var alb = drawAlbumTitle(rng, coords, artist, label, year);

    // R6 — track count
    var count = drawTrackCount(rng, coords, fm.format);

    // R7 — titles
    var tt = drawTitles(rng, coords, count, artist, label, alb.title, alb.meta);

    // R8 — timings (+ longest-track title enforcement, side split, HGA policy)
    var tm = drawTimings(rng, coords, count, fm.format, label);
    enforceLongestTitleRule(rng, tt.titles, tt.sources, tm.durations, artist, label, alb.title);

    var tracks = [];
    for (var i = 0; i < count; i++) {
      tracks.push({
        n: i + 1,
        title: tt.titles[i],
        seconds: tm.durations[i],
        time: mmss(tm.durations[i]),
        side: tm.sides ? (i < tm.sides.split ? 'A' : 'B') : null
      });
    }
    var lowercased = maybeLowercase(rng, coords, tracks);

    // R9 — personnel
    var personnel = drawPersonnel(rng, coords, year, fm.format, label, artist, fm.reissue);

    // R10 — prose
    var proseCtx = {
      studio: personnel.studio, recYear: year, label: label, tracks: tracks,
      hasSides: !!tm.sides, mono: fm.mono, reissue: fm.reissue,
      person: personnel.master || personnel.engineer, catalog: catalog
    };
    var prose = drawProse(rng, coords, proseCtx);

    // R11 — pressing line
    var pressCtx = {
      label: label, format: fm.format, recYear: year, reissue: fm.reissue,
      catalog: catalog,
      closeMentionsEdition: !!(prose.closeMeta && prose.closeMeta.edition &&
        prose.text.indexOf('The label pressed') !== -1)
    };
    var pressingLine = drawPressingLine(rng, pressCtx);

    var totalSeconds = tracks.reduce(function (a, t) { return a + t.seconds; }, 0);

    var record = {
      engine: ENGINE_VERSION,
      seed: seed,
      pressing: k,
      pressingLabel: k > 0 ? ordinal(k + 1) + ' pressing' : null,
      coordinates: {
        era: coords.era.id,
        eraBucket: coords.era.bucket,
        blend: coords.blend,
        density: coords.density,
        silence: coords.silence
      },
      year: year,
      label: { name: label.name, city: label.city, character: label.character },
      catalog: catalog,
      format: fm.format,
      formatLine: fm.format + (fm.format === 'CS' ? ' · C-46' : '') + ' · ' + year,
      channel: fm.mono ? 'MONO' : 'STEREO',
      reissue: fm.reissue,
      artist: artist.name,
      title: alb.title,
      lowercaseTracklist: lowercased,
      tracks: tracks,
      hasSides: !!tm.sides,
      totalSeconds: totalSeconds,
      totalTime: mmss(totalSeconds),
      credits: personnel.lines,
      prose: prose.text,
      pressingLine: pressingLine
    };

    if (opts.dev) banScanRecord(record); // dev mode: a violation is a THROWN error
    return record;
  }

  /* ---- final ban-list scan on everything typeset (belt and braces) ---- */
  function banScanRecord(record) {
    var fields = [
      ['artist', record.artist], ['title', record.title],
      ['prose', record.prose], ['pressingLine', record.pressingLine]
    ];
    record.tracks.forEach(function (t, i) { fields.push(['track ' + (i + 1), t.title]); });
    record.credits.forEach(function (c, i) { fields.push(['credit ' + (i + 1), c]); });
    var violations = [];
    fields.forEach(function (f) {
      CORPUS.banViolations(f[1]).forEach(function (v) { violations.push(f[0] + ': ' + v); });
    });
    if (violations.length) {
      throw new Error('LINER NOTES ban-list violation — ' + violations.join(' · '));
    }
    return true;
  }

  /* ---- dev shim: ?seed= forces a seed with a synthetic feature vector ---- */
  function featuresFromSeed(n) {
    var r = mulberry32(n >>> 0);
    return {
      L: 0.15 + r() * 0.7, C: 0.03 + r() * 0.22, T: r() * 1.2 - 0.6,
      S: r() * 0.7, E: r() * 0.35, Hdom: Math.floor(r() * 9), V: r() * 0.3 - 0.15
    };
  }

  var api = {
    ENGINE_VERSION: ENGINE_VERSION,
    mulberry32: mulberry32,
    mixSeed: mixSeed,
    computeCoordinates: computeCoordinates,
    generateRecord: generateRecord,
    banScanRecord: banScanRecord,
    featuresFromSeed: featuresFromSeed
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LN_PLANT = api;
})(typeof self !== 'undefined' ? self : this);
