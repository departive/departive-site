/* LINER NOTES — sleeve.js
   The sleeve back: DOM typesetting per CARD_DESIGN.md (Phase 0 amendments:
   dark site-native ground; large-cover composition), TWO canvas exports —
   SLEEVE 1400×1400 @2× (2800²) and STORY 1080×1920 @2× (2160×3840) — drop
   zone, "Next pressing" (diegetic k+1), empty state.
   Browser-only; corpus/features/plant are pure and DOM-free.

   OVERLAP-PROOFING (Phase 0 bug fixes, round 2):
   - ROOT CAUSE of the live export overlap: the old renderer set canvas fonts
     at DEVICE size (logical × s) so measureText returned DEVICE widths, but
     wrapped against LOGICAL maxWidths — at the real 2× export (s=2) every
     wrap happened at HALF the intended measure (David's "~34ch prose"),
     content overran the fixed-y foot, and the 1×-only node test never saw
     it (at s=1 the two unit spaces coincide).
   - FIX: ctx.scale(s,s) once; every font is set at LOGICAL size and every
     coordinate/measure/wrap is LOGICAL. measureText ignores the transform,
     so measure space ≡ layout space ≡ draw space at any export scale.
   - ONE MEASURED FLOW: layout builds a primitive list with a single y-cursor
     (columns are sub-cursors merged by max); the pressing/foot lines are part
     of the same flow — bottom-anchored when content is short, pushed below
     content when long, never fixed over it. Fonts are awaited (ensureFonts)
     before DOM fit and before any canvas pass. A dev-mode assertion throws
     if content crosses the foot band.
   - STORY reflow: gap-tighten → type-scale → deterministic prose truncation
     at sentence boundaries with a quiet " …" (never mid-sentence).
*/
(function () {
  'use strict';

  var CORPUS = window.LN_CORPUS, FEAT = window.LN_FEATURES, PLANT = window.LN_PLANT;

  /* ---------------- dev mode ---------------- */
  var params = new URLSearchParams(location.search);
  var DEV = params.has('dev') || params.has('seed') ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (DEV) CORPUS.assertPools(true); // minimum-pool assertions (throws; surnames warn — known)

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* REFLOW MODE (<=700px). On a phone the 1400² board would have to be scaled
     to ~0.27× — the prose lands at 6px and the sleeve becomes a picture of
     itself. Below 700px index.html re-sets the same skeleton as a portrait
     column at native type sizes, so everything here that assumes the fixed
     board — the transform, the stage height, the autofit governor — must stand
     down. The breakpoint is duplicated in the stylesheet; keep the two in step. */
  var reflowMQ = window.matchMedia ? window.matchMedia('(max-width:700px)') : null;
  function isReflow() { return !!(reflowMQ && reflowMQ.matches); }

  /* ---------------- fonts: load before any measuring ---------------- */
  var SERIF = "'Instrument Serif', Georgia, serif";
  var SANS = "'Instrument Sans', system-ui, sans-serif";
  var MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
  var fontsPromise = null;
  function ensureFonts() {
    if (fontsPromise) return fontsPromise;
    if (!(document.fonts && document.fonts.load)) {
      fontsPromise = Promise.resolve();
      return fontsPromise;
    }
    fontsPromise = Promise.all([
      document.fonts.load('400 72px "Instrument Serif"'),
      document.fonts.load('italic 400 44px "Instrument Serif"'),
      document.fonts.load('400 21px "Instrument Sans"'),
      document.fonts.load('500 21px "Instrument Sans"'),
      document.fonts.load('600 21px "Instrument Sans"'),
      document.fonts.ready
    ]).catch(function () { /* fall through — fallback faces still measure truly */ });
    return fontsPromise;
  }

  /* era flavoring on the dark ground — subtle shifts in accent hue, ink
     warmth and rule weight; values only, never the skeleton (CARD_DESIGN §3) */
  function bone(a) { return 'rgba(237,231,219,' + a + ')'; }
  function eraValues(bucket) {
    var v = {
      acc: '#b0835a', ink: '#ede7db', ink2: bone(0.62), ink3: bone(0.45),
      rule: bone(0.14), hair: 1.2, track: 0, catSize: 24,
      channelSize: 18, channelInk: bone(0.45), leading: 1.5, leaders: false, gap: 1
    };
    if (bucket === '70s') { // heavier ink, thicker hairlines, STEREO prominent, warmer accent
      v.hair = 2.2; v.rule = bone(0.2); v.acc = '#c1894f'; v.ink = '#f2eee6';
      v.channelSize = 22; v.channelInk = bone(0.62);
    } else if (bucket === '80s') { // tighter tracking, colder ink, catalog larger, accent cooled
      v.acc = '#9c8f7d'; v.ink = '#e6e4df'; v.track = -0.6; v.catSize = 30;
    } else if (bucket === '90s') { // looser leading, dot leaders
      v.leading = 1.62; v.leaders = true;
    } else if (bucket === '2000s' || bucket === '2010s') { // whitespace up, rules down
      v.hair = 0.6; v.rule = bone(0.10); v.gap = 1.15;
    }
    return v;
  }

  /* ---------------- state ---------------- */
  var state = { features: null, seed: null, k: 0, record: null, cover: null, forcedSeed: null };

  var el = {
    stage: document.querySelector('[data-stage]'),
    drop: document.querySelector('[data-drop]'),
    file: document.querySelector('[data-file]'),
    next: document.querySelector('[data-next]'),
    exportBtns: [].slice.call(document.querySelectorAll('[data-export]')),
    counter: document.querySelector('[data-counter]')
  };

  /* ============================================================
     IMAGE INTAKE — analyzed here, never uploaded
     ============================================================ */
  function handleFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      // center-square cover crop (SEED_MAPPING §4); 960² so the large cover
      // stays sharp in the 2× exports
      var side = Math.min(img.naturalWidth, img.naturalHeight);
      var cover = document.createElement('canvas');
      cover.width = 960; cover.height = 960;
      cover.getContext('2d').drawImage(img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, 960, 960);
      var fs = FEAT.featuresFromDrawable(img);
      state.features = fs.features;
      state.seed = fs.seed;
      state.forcedSeed = null;
      state.cover = cover;
      state.k = 0;
      press(true); // true = a fresh photograph, so fold the box and go look
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* The drop box is a means, not a monument: once a photograph is in it folds
     to a one-line chip (same element, same handlers — only its clothes change),
     so on a phone the load reads as something that HAPPENED. */
  function collapseDrop() {
    if (!el.drop || el.drop.classList.contains('compact')) return;
    el.drop.classList.add('compact');
    el.drop.setAttribute('aria-label', 'Photograph loaded — choose a different photograph');
  }

  /* Mobile only: the stage sits BELOW the rail there, so without this the
     sleeve is generated off-screen and nothing appears to happen. On desktop
     the stage is already beside the rail — moving the page would be rude. */
  function revealSleeve() {
    if (!isReflow() || !el.stage) return;
    var from = window.pageYOffset || document.documentElement.scrollTop || 0;
    var top = el.stage.getBoundingClientRect().top + from - 12;
    if (top < 0) top = 0;
    function jump() { window.scrollTo(0, top); }
    if (reduceMotion || !('scrollBehavior' in document.documentElement.style)) { jump(); return; }
    try { window.scrollTo({ top: top, behavior: 'smooth' }); } catch (e) { jump(); return; }
    // Some engines accept the smooth request and then quietly ignore it. If
    // nothing has moved a beat later, take the jump — a silent no-op here is
    // exactly the "nothing happened" this whole change exists to fix.
    setTimeout(function () {
      if (Math.abs((window.pageYOffset || document.documentElement.scrollTop || 0) - from) < 2) jump();
    }, 400);
  }

  function press(fromPhoto) {
    var opts = { dev: DEV };
    if (state.forcedSeed != null) opts.seed = state.forcedSeed;
    state.record = PLANT.generateRecord(state.features, state.k, opts);
    if (DEV) console.log('[linernotes] ' + PLANT.ENGINE_VERSION, {
      seed: state.record.seed, pressing: state.k, coordinates: state.record.coordinates
    });
    ensureFonts().then(function () { // fonts first — the fit governor needs real metrics
      typeset(state.record, state.cover);
      el.next.disabled = false;
      el.exportBtns.forEach(function (b) { b.disabled = false; });
      el.counter.textContent = state.record.pressingLabel || 'first pressing';
      if (state.cover) collapseDrop();
      if (fromPhoto) revealSleeve();
    });
  }

  /* ============================================================
     DOM TYPESETTING — CARD_DESIGN skeleton, large-cover composition.
     All normal flow: flex column, foot on margin-top:auto.
     ============================================================ */
  function div(cls, text) {
    var d = document.createElement('div');
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function typeset(rec, cover) {
    var card = div('sleeve');
    card.dataset.era = rec.coordinates.eraBucket;

    var inner = div('sleeve-inner');
    card.appendChild(inner);

    // 1 — top plate: large cover + masthead beside it
    var top = div('row plate-top');
    var thumbWrap = div('thumb');
    if (cover) {
      var t = document.createElement('canvas');
      t.width = cover.width; t.height = cover.height;
      t.getContext('2d').drawImage(cover, 0, 0);
      thumbWrap.appendChild(t);
    } else {
      thumbWrap.classList.add('thumb-empty');
    }
    top.appendChild(thumbWrap);

    var mastCol = div('mast-col');
    var mblock = div('mast-block');
    mblock.appendChild(div('mast-label', rec.label.name.toUpperCase()));
    mblock.appendChild(div('mast-cat', rec.catalog));
    mblock.appendChild(div('mast-channel', rec.channel));
    mastCol.appendChild(mblock);

    var head = div('head-block');
    head.appendChild(div('head-rule'));
    head.appendChild(div('artist', rec.artist));
    head.appendChild(div('album', rec.title));
    head.appendChild(div('yearline', rec.formatLine));
    mastCol.appendChild(head);
    top.appendChild(mastCol);
    inner.appendChild(top);

    inner.appendChild(div('row hairline'));

    // 2 — lower plate: tracklist left · credits + prose right
    var low = div('row plate-low');
    var colTracks = div('col-tracks');
    var side = null;
    rec.tracks.forEach(function (tr) {
      if (rec.hasSides && tr.side !== side) {
        side = tr.side;
        colTracks.appendChild(div('side-head', 'SIDE ' + side));
      }
      var row = div('t-row');
      row.appendChild(div('t-title', tr.title));
      row.appendChild(div('t-leader'));
      row.appendChild(div('t-time', tr.time));
      colTracks.appendChild(row);
    });
    low.appendChild(colTracks);

    var colNotes = div('col-notes');
    var credits = div('credits');
    rec.credits.forEach(function (c) { credits.appendChild(div('credit', c)); });
    colNotes.appendChild(credits);
    colNotes.appendChild(div('prose', rec.prose));
    low.appendChild(colNotes);
    inner.appendChild(low);

    // 3 — foot row (normal flow; margin-top:auto anchors it, never overlaps)
    var foot = div('row foot');
    foot.appendChild(div('press-line', rec.pressingLine));
    var fr = div('foot-right');
    if (rec.pressingLabel) fr.appendChild(div('press-count', rec.pressingLabel));
    fr.appendChild(div('site-credit', 'linernotes · departive.com'));
    foot.appendChild(fr);
    inner.appendChild(foot);

    mount(card);
    fit(card, inner);
    settle(card);
  }

  function emptyState() {
    var card = div('sleeve sleeve-empty');
    card.dataset.era = '2010s';
    var inner = div('sleeve-inner');
    card.appendChild(inner);
    var top = div('row plate-top');
    top.appendChild(div('thumb thumb-empty ghost-cover'));
    var mastCol = div('mast-col');
    var mb = div('mast-block');
    mb.appendChild(div('ghost-bar gb-1'));
    mb.appendChild(div('ghost-bar gb-2'));
    mastCol.appendChild(mb);
    var head = div('head-block');
    head.appendChild(div('head-rule'));
    head.appendChild(div('ghost-bar gb-artist'));
    head.appendChild(div('ghost-bar gb-title'));
    mastCol.appendChild(head);
    top.appendChild(mastCol);
    inner.appendChild(top);
    inner.appendChild(div('row hairline'));
    var low = div('row plate-low');
    var colTracks = div('col-tracks');
    for (var i = 0; i < 5; i++) {
      var r = div('t-row');
      r.appendChild(div('ghost-bar gb-track'));
      r.appendChild(div('t-leader'));
      r.appendChild(div('ghost-bar gb-time'));
      colTracks.appendChild(r);
    }
    low.appendChild(colTracks);
    var colNotes = div('col-notes');
    for (i = 0; i < 3; i++) colNotes.appendChild(div('ghost-bar gb-credit'));
    low.appendChild(colNotes);
    inner.appendChild(low);
    mount(card);
  }

  var scaleRAF = null;
  function mount(card) {
    el.stage.innerHTML = '';
    el.stage.appendChild(card);
    rescale();
  }
  function rescale() {
    var card = el.stage.firstChild;
    if (!card) return;
    if (isReflow()) {
      // fluid card: no transform, and the stage must go back to auto height —
      // a px height computed from the 1400² board would crop the column.
      card.style.transform = '';
      el.stage.style.height = '';
      return;
    }
    var w = el.stage.clientWidth;
    card.style.transform = 'scale(' + (w / 1400) + ')';
    el.stage.style.height = w + 'px';
  }

  var wasReflow = isReflow();
  window.addEventListener('resize', function () {
    if (scaleRAF) cancelAnimationFrame(scaleRAF);
    scaleRAF = requestAnimationFrame(function () {
      rescale();
      if (isReflow() === wasReflow) return; // mobile URL-bar resizes are not mode changes
      wasReflow = isReflow();
      var card = el.stage.firstChild; // crossing the breakpoint re-opens the fit question
      if (card && card.classList.contains('sleeve') && !card.classList.contains('sleeve-empty')) {
        var inner = card.querySelector('.sleeve-inner');
        if (inner) fit(card, inner);
      }
    });
  });

  /* CARD_DESIGN §5 — the card must survive the longest content without
     clipping: tighten gaps first, then type scale. Runs after fonts load. */
  function fit(card, inner) {
    var gaps = ['1', '0.85', '0.7'];
    var scales = ['1', '0.96', '0.92', '0.88', '0.84'];
    card.style.setProperty('--gapscale', '1');
    card.style.setProperty('--ts', '1');
    // In reflow mode the column grows instead of clipping, so there is nothing
    // to fit — and shrinking type here would silently undercut the mobile
    // sizes. Neutral 1/1 is the whole contract with the stylesheet.
    if (isReflow()) return;
    function fits() { return inner.scrollHeight <= inner.clientHeight; }
    if (fits()) return;
    for (var g = 0; g < gaps.length; g++) {
      card.style.setProperty('--gapscale', gaps[g]);
      for (var t = 0; t < scales.length; t++) {
        card.style.setProperty('--ts', scales[t]);
        if (fits()) return;
      }
    }
  }
  // safety: if the faces settle after first paint for any reason, re-fit
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      var card = el.stage.firstChild;
      if (card && card.classList.contains('sleeve') && !card.classList.contains('sleeve-empty')) {
        var inner = card.querySelector('.sleeve-inner');
        if (inner) fit(card, inner);
      }
    });
  }

  /* settle animation — rows fade/rise, 40ms staggered (CARD_DESIGN §4);
     off under prefers-reduced-motion */
  function settle(card) {
    if (reduceMotion) return;
    var rows = card.querySelectorAll('.row');
    rows.forEach(function (r, i) {
      r.style.opacity = '0';
      r.style.transform = 'translateY(10px)';
      r.style.transition = 'opacity 0.5s cubic-bezier(0.22,1,0.36,1) ' + (i * 40) + 'ms,' +
        ' transform 0.5s cubic-bezier(0.22,1,0.36,1) ' + (i * 40) + 'ms';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        rows.forEach(function (r) { r.style.opacity = '1'; r.style.transform = 'none'; });
      });
    });
  }

  /* ============================================================
     EXPORT RENDERER — one measured flow, two formats.
     ctx is scaled once (ctx.scale(s,s)); ALL sizes, coordinates and
     measurements below are in LOGICAL px. Primitives are collected by a
     y-cursor layout and painted afterwards; the foot is part of the flow.
     ============================================================ */
  var EXPORT_SPECS = {
    sleeve: { W: 1400, H: 1400, pad: 90, scale: 2 },  // → 2800×2800
    story: { W: 1080, H: 1920, pad: 72, scale: 2 }    // → 2160×3840
  };

  function wrapText(ctx, text, maxWidth) {
    // ctx.font is LOGICAL — maxWidth is LOGICAL — same space, always.
    var out = [], line = '';
    String(text).split(/\s+/).forEach(function (w) {
      var probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > maxWidth && line) { out.push(line); line = w; }
      else line = probe;
    });
    if (line) out.push(line);
    return out;
  }

  function splitSentences(text) {
    // conservative sentence split for deterministic story truncation
    var parts = String(text).match(/[^.!?]+[.!?]+(?:['")’]+)?(?:\s+|$)/g);
    return parts ? parts.map(function (p) { return p.trim(); }) : [String(text)];
  }

  /* --- primitive collector (shared by both compositions) --- */
  function makeP(ctx, ev, ts) {
    var prims = [];
    return {
      prims: prims,
      font: function (size, fam, style) {
        ctx.font = (style || '400') + ' ' + (size * ts) + 'px ' + fam;
        return [size, fam, style || '400'];
      },
      w: function (str) { return ctx.measureText(str).width; },
      wrap: function (str, maxW) { return wrapText(ctx, str, maxW); },
      text: function (str, x, y, f, color, align, ls) {
        prims.push({ k: 't', str: str, x: x, y: y, f: [f[0] * ts, f[1], f[2] || '400'], c: color, a: align || 'left', ls: ls || 0 });
      },
      rect: function (x, y, w, h, color) { prims.push({ k: 'r', x: x, y: y, w: w, h: h, c: color }); },
      img: function (x, y, w, h) { prims.push({ k: 'i', x: x, y: y, w: w, h: h }); },
      dots: function (x0, x1, y, color) { prims.push({ k: 'd', x0: x0, x1: x1, y: y, c: color }); },
      hairline: function (x0, x1, y) { prims.push({ k: 'r', x: x0, y: y, w: x1 - x0, h: Math.max(0.8, ev.hair), c: ev.rule }); }
    };
  }

  /* --- SLEEVE 1400×1400: large cover + masthead beside it; lower plate in
         two columns (tracks left · credits/prose right); flowed foot --- */
  function layoutSleeve(ctx, rec, ev, ts, gap, prose, spec) {
    var P = makeP(ctx, ev, ts);
    var pad = spec.pad, W = spec.W, H = spec.H;
    var x0 = pad, x1 = W - pad;
    var g = function (v) { return v * gap * ev.gap * ts; };

    // top plate — cover 520², hairline-keyed
    var coverS = 520;
    P.img(x0, pad, coverS, coverS);

    var mx = x0 + coverS + 56;            // masthead column left edge
    var mw = x1 - mx;

    // label block, right-aligned at x1
    var my = pad + 26;
    P.font(18, MONO, '500');
    P.text(rec.label.name.toUpperCase(), x1, my, [18, MONO, '500'], ev.ink2, 'right', 3.4);
    my += 36 * ts;
    P.text(rec.catalog, x1, my, [ev.catSize, MONO, '500'], ev.acc, 'right');
    my += 30 * ts;
    P.text(rec.channel, x1, my, [ev.channelSize, MONO, ev.channelSize > 18 ? '500' : '400'], ev.channelInk, 'right');
    var mastBottom = my;

    // head block — bottom-anchored to the cover, never into the label block
    P.font(72, SERIF);
    var artistLines = P.wrap(rec.artist, mw);
    ctx.font = 'italic 400 ' + (44 * ts) + 'px ' + SERIF;
    var titleLines = wrapText(ctx, rec.title, mw);
    var blockH = (2 + g(26)) + artistLines.length * 70 * ts + g(14) +
      titleLines.length * 48 * ts + g(22) + 20 * ts;
    var headTop = Math.max(mastBottom + g(44), pad + coverS - blockH);
    var y = headTop;
    P.rect(mx, y, 26, 2, ev.acc);
    y += g(26);
    artistLines.forEach(function (l) { y += 70 * ts; P.text(l, mx, y, [72, SERIF, '400'], ev.ink); });
    y += g(14);
    titleLines.forEach(function (l) { y += 48 * ts; P.text(l, mx, y, [44, SERIF, 'italic 400'], bone(0.92)); });
    y += g(22) + 20 * ts;
    P.text(rec.formatLine, mx, y, [20, MONO, '400'], ev.ink3);

    var topBottom = Math.max(pad + coverS, y);
    y = topBottom + g(42);
    P.hairline(x0, x1, y);
    y += g(38);

    // lower plate — two columns
    var leftW = 560, colGap = 64 * gap;
    var rightX = x0 + leftW + colGap, rightW = x1 - rightX;

    // LEFT: tracklist
    var yL = y, side = null;
    rec.tracks.forEach(function (tr) {
      if (rec.hasSides && tr.side !== side) {
        if (side !== null) yL += g(16);
        side = tr.side;
        yL += 20 * ts;
        P.text('SIDE ' + side, x0, yL, [17, MONO, '500'], ev.ink3, 'left', 2.6);
        yL += g(12);
      }
      P.font(22, MONO);
      var timeW = P.w(tr.time);
      var fTitle = P.font(23, SANS);
      var tLines = P.wrap(tr.title, leftW - timeW - 24);
      tLines.forEach(function (l, li) {
        yL += 31 * ts;
        P.text(l, x0, yL, fTitle, ev.ink, 'left', ev.track);
        if (li === 0) {
          P.text(tr.time, x0 + leftW, yL, [22, MONO, '400'], ev.ink2, 'right');
          if (ev.leaders) {
            ctx.font = '400 ' + (23 * ts) + 'px ' + SANS;
            var tw = ctx.measureText(l).width;
            P.dots(x0 + tw + 14, x0 + leftW - timeW - 14, yL - 4, bone(0.28));
          }
        }
      });
      yL += g(7);
    });

    // RIGHT: credits then prose
    var yR = y;
    var fCredit = P.font(18, MONO);
    rec.credits.forEach(function (c) {
      P.wrap(c, rightW).forEach(function (l) { // long credit lines wrap in-column
        yR += 25 * ts;
        P.text(l, rightX, yR, fCredit, ev.ink2);
      });
    });
    yR += g(30);
    var fProse = P.font(21, SANS);
    var ch = P.w('abcdefghijklmnopqrstuvwxyz') / 26;
    var measure = Math.min(rightW, ch * 62);
    P.wrap(prose, measure).forEach(function (l) {
      yR += 21 * ev.leading * ts;
      P.text(l, rightX, yR, fProse, bone(0.82));
    });

    var bottom = Math.max(yL, yR);

    // foot — same flow: anchored at the base only if content clears it
    var footTop = H - pad - 24;
    var footRule = footTop - 26;
    P.hairline(x0, x1, footRule);
    var footY = footTop + 17 * ts;
    P.text(rec.pressingLine, x0, footY, [17, MONO, '400'], ev.ink3);
    P.font(17, MONO);
    var right = 'linernotes · departive.com';
    var rightWd = P.w(right);
    if (rec.pressingLabel) {
      P.text(rec.pressingLabel, x1 - rightWd - 28, footY, [17, MONO, '500'], ev.acc, 'right');
    }
    P.text(right, x1, footY, [17, MONO, '400'], bone(0.35), 'right');

    return { prims: P.prims, bottom: bottom, footTop: footRule, ts: ts, gap: gap };
  }

  /* --- STORY 1080×1920: cover large up top, masthead, tracklist,
         condensed credits + prose; flowed foot --- */
  function layoutStory(ctx, rec, ev, ts, gap, prose, spec) {
    var P = makeP(ctx, ev, ts);
    var pad = spec.pad, W = spec.W, H = spec.H;
    var x0 = pad, x1 = W - pad, cw = x1 - x0;
    var g = function (v) { return v * gap * ev.gap * ts; };

    // cover — full content width
    P.img(x0, pad, cw, cw);
    var y = pad + cw + g(44);

    // label row: label left · catalog right (accent)
    P.text(rec.label.name.toUpperCase(), x0, y, [17, MONO, '500'], ev.ink2, 'left', 3);
    P.text(rec.catalog, x1, y, [Math.min(ev.catSize, 24), MONO, '500'], ev.acc, 'right');
    y += g(34);

    // head block
    P.rect(x0, y, 24, 2, ev.acc);
    y += g(24);
    var fArtist = P.font(60, SERIF);
    P.wrap(rec.artist, cw).forEach(function (l) { y += 58 * ts; P.text(l, x0, y, fArtist, ev.ink); });
    y += g(12);
    ctx.font = 'italic 400 ' + (38 * ts) + 'px ' + SERIF;
    wrapText(ctx, rec.title, cw).forEach(function (l) { y += 42 * ts; P.text(l, x0, y, [38, SERIF, 'italic 400'], bone(0.92)); });
    y += g(20) + 18 * ts;
    P.text(rec.formatLine + ' · ' + rec.channel, x0, y, [18, MONO, '400'], ev.ink3);
    y += g(30);
    P.hairline(x0, x1, y);
    y += g(30);

    // tracklist — full-width rows
    var side = null;
    rec.tracks.forEach(function (tr) {
      if (rec.hasSides && tr.side !== side) {
        if (side !== null) y += g(12);
        side = tr.side;
        y += 18 * ts;
        P.text('SIDE ' + side, x0, y, [16, MONO, '500'], ev.ink3, 'left', 2.4);
        y += g(10);
      }
      P.font(21, MONO);
      var timeW = P.w(tr.time);
      var fTitle = P.font(22, SANS);
      P.wrap(tr.title, cw - timeW - 24).forEach(function (l, li) {
        y += 30 * ts;
        P.text(l, x0, y, fTitle, ev.ink, 'left', ev.track);
        if (li === 0) {
          P.text(tr.time, x1, y, [21, MONO, '400'], ev.ink2, 'right');
          if (ev.leaders) {
            ctx.font = '400 ' + (22 * ts) + 'px ' + SANS;
            P.dots(x0 + ctx.measureText(l).width + 14, x1 - timeW - 14, y - 4, bone(0.28));
          }
        }
      });
      y += g(6);
    });
    y += g(22);
    P.hairline(x0, x1, y);
    y += g(28);

    // condensed credits
    var fCredit = P.font(16, MONO);
    rec.credits.forEach(function (c) {
      P.wrap(c, cw).forEach(function (l) {
        y += 22 * ts;
        P.text(l, x0, y, fCredit, ev.ink2);
      });
    });
    y += g(26);

    // prose — readable measure
    var fProse = P.font(21, SANS);
    var ch = P.w('abcdefghijklmnopqrstuvwxyz') / 26;
    var measure = Math.min(cw, ch * 62);
    P.wrap(prose, measure).forEach(function (l) {
      y += 21 * ev.leading * ts;
      P.text(l, x0, y, fProse, bone(0.82));
    });

    var bottom = y;

    // foot — same flow
    var footTop = H - pad - 22;
    var footY = footTop + 16 * ts;
    P.text(rec.pressingLine, x0, footY, [16, MONO, '400'], ev.ink3);
    P.font(16, MONO);
    var right = 'linernotes · departive.com';
    var rightWd = P.w(right);
    if (rec.pressingLabel) {
      P.text(rec.pressingLabel, x1 - rightWd - 26, footY, [16, MONO, '500'], ev.acc, 'right');
    }
    P.text(right, x1, footY, [16, MONO, '400'], bone(0.35), 'right');

    return { prims: P.prims, bottom: bottom, footTop: footTop, ts: ts, gap: gap };
  }

  function renderExport(rec, cover, kind) {
    var spec = EXPORT_SPECS[kind] || EXPORT_SPECS.sleeve;
    var s = spec.scale;
    var canvas = document.createElement('canvas');
    canvas.width = spec.W * s; canvas.height = spec.H * s;
    var ctx = canvas.getContext('2d');
    ctx.scale(s, s); // ← from here on, everything is logical units
    var ev = eraValues(rec.coordinates.eraBucket);

    // reflow governor: gaps → type scale → (story only) prose truncation
    var gaps = [1, 0.85, 0.7];
    var scales = [1, 0.97, 0.94, 0.91, 0.88, 0.85, 0.82];
    var sentences = splitSentences(rec.prose);
    var maxCut = kind === 'story' ? Math.max(0, sentences.length - 2) : 0;
    var chosen = null, cutUsed = 0;
    outer:
    for (var cut = 0; cut <= maxCut; cut++) {
      var prose = cut === 0 ? rec.prose
        : sentences.slice(0, sentences.length - cut).join(' ') + ' …';
      for (var gi = 0; gi < gaps.length; gi++) {
        for (var ti = 0; ti < scales.length; ti++) {
          var L = (kind === 'story')
            ? layoutStory(ctx, rec, ev, scales[ti], gaps[gi], prose, spec)
            : layoutSleeve(ctx, rec, ev, scales[ti], gaps[gi], prose, spec);
          if (L.bottom + 30 <= L.footTop) { chosen = L; cutUsed = cut; break outer; }
        }
      }
    }
    if (!chosen) { // deterministic last resort (still one flow — nothing overlaps, content just runs tight)
      var lastProse = kind === 'story' ? sentences.slice(0, 2).join(' ') + ' …' : rec.prose;
      chosen = (kind === 'story')
        ? layoutStory(ctx, rec, ev, 0.82, 0.7, lastProse, spec)
        : layoutSleeve(ctx, rec, ev, 0.82, 0.7, rec.prose, spec);
      cutUsed = maxCut;
    }

    // dev assertion: content may never cross the foot band
    if (DEV && chosen.bottom + 24 > chosen.footTop) {
      throw new Error('linernotes export (' + kind + '): content ' + Math.round(chosen.bottom) +
        ' crosses the foot band ' + Math.round(chosen.footTop) + ' — layout bug');
    }

    paint(ctx, chosen.prims, rec, cover, ev, spec);
    canvas.__ln_meta = { kind: kind, ts: chosen.ts, gap: chosen.gap, cut: cutUsed, bottom: chosen.bottom, footTop: chosen.footTop };
    return canvas;
  }

  /* --- paint pass: ground, grain, then primitives (fonts per-prim) --- */
  function paint(ctx, prims, rec, cover, ev, spec) {
    var W = spec.W, H = spec.H;
    // matte dark board — the site's ground family
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#161009');
    grad.addColorStop(0.42, '#141009');
    grad.addColorStop(1, '#100c06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // deterministic grain — bone speckle, very low
    var rg = PLANT.mulberry32(rec.seed ^ 0x9e3779b9);
    ctx.fillStyle = bone(0.02);
    for (var i = 0; i < 3600; i++) {
      ctx.fillRect(rg() * W, rg() * H, 0.8 + rg() * 1.6, 0.8 + rg() * 1.6);
    }
    // board edge hairline
    ctx.strokeStyle = bone(0.10);
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.textBaseline = 'alphabetic';

    prims.forEach(function (p) {
      if (p.k === 'i') {
        if (cover) ctx.drawImage(cover, p.x, p.y, p.w, p.h);
        else { ctx.fillStyle = bone(0.05); ctx.fillRect(p.x, p.y, p.w, p.h); }
        ctx.strokeStyle = ev.rule;
        ctx.lineWidth = Math.max(0.8, ev.hair * 0.9);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.k === 'r') {
        if (p.c) { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.w, p.h); }
      } else if (p.k === 'd') {
        ctx.fillStyle = p.c;
        for (var dx = p.x0; dx < p.x1; dx += 11) ctx.fillRect(dx, p.y, 1.6, 1.6);
      } else if (p.k === 't') {
        ctx.font = p.f[2] + ' ' + p.f[0] + 'px ' + p.f[1];
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = p.ls ? p.ls + 'px' : '0px';
        ctx.textAlign = p.a;
        ctx.fillStyle = p.c || ev.ink;
        ctx.fillText(p.str, p.x, p.y);
        if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
      }
    });
  }

  function exportPNG(kind) {
    if (!state.record) return;
    ensureFonts().then(function () { // never measure or draw before the faces are in
      var canvas = renderExport(state.record, state.cover, kind);
      var name = 'linernotes-' + state.record.catalog.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() +
        (state.k > 0 ? '-p' + (state.k + 1) : '') + (kind === 'story' ? '-story' : '') + '.png';
      // assets/save-image.js — download on desktop, share sheet on a phone
      // (on iOS that sheet's "Save Image" is the only way into the camera roll)
      canvas.toBlob(function (blob) {
        if (window.saveImage) { window.saveImage(blob, name); return; }
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      }, 'image/png');
    });
  }

  /* ============================================================
     WIRING
     ============================================================ */
  el.drop.addEventListener('click', function () { el.file.click(); });
  el.drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.file.click(); }
  });
  el.file.addEventListener('change', function () {
    handleFile(el.file.files[0]); // reads the file synchronously, so clearing after is safe
    el.file.value = ''; // otherwise re-choosing the SAME photograph fires no change event
  });
  ['dragover', 'dragenter'].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    el.drop.addEventListener(ev, function (e) { e.preventDefault(); el.drop.classList.remove('over'); });
  });
  el.drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });

  el.next.addEventListener('click', function () {
    if (!state.features) return;
    state.k += 1; // the re-roll is diegetic — same coordinates, next pressing
    press();
  });
  el.exportBtns.forEach(function (b) {
    b.addEventListener('click', function () { exportPNG(b.getAttribute('data-export')); });
  });

  /* dev handle (dev mode only) — used by the Phase 0 harness */
  if (DEV) window.LN_SLEEVE = {
    renderExport: renderExport, state: state, typeset: typeset,
    eraValues: eraValues, EXPORT_SPECS: EXPORT_SPECS
  };

  /* boot: empty state, or ?seed= dev shim (synthetic feature vector) */
  ensureFonts(); // kick the loads early
  if (params.has('seed')) {
    var forced = parseInt(params.get('seed'), 10) >>> 0;
    state.features = PLANT.featuresFromSeed(forced);
    state.seed = forced;
    state.forcedSeed = forced;
    state.cover = null;
    state.k = 0;
    press();
  } else {
    emptyState();
  }
})();
