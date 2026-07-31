/* LINER NOTES — sleeve.js
   The sleeve back: DOM typesetting per CARD_DESIGN.md (Phase 0 amendment:
   dark site-native ground supersedes the white sleeve — skeleton, era
   value-flavoring and reflow rules unchanged), canvas render at 2× for PNG
   export, drop zone, "Next pressing" (diegetic k+1), empty state.
   Browser-only; corpus/features/plant are pure and DOM-free.

   The card is typeset at its 1400×1400 logical base and transform-scaled to
   the viewport — mobile scales the card uniformly; export always renders at
   the fixed 2× base (2800×2800), unaffected by viewport.

   OVERLAP-PROOFING (Phase 0 bug fix):
   - DOM: every row is normal flow inside a flex column; the foot row uses
     margin-top:auto (bottom-anchored when short, flows below content when
     long) — nothing variable is absolutely positioned, so rows cannot cross.
   - Fonts: typesetting and canvas rendering both await ensureFonts()
     (explicit loads of the Instrument faces + document.fonts.ready) before
     any measurement, so the fit governor and measureText see real metrics.
   - Canvas: a measure pass walks the same y-cursor over measured wrapped
     lines and shrinks type until content clears the foot; only then draws.
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
      document.fonts.load('400 66px "Instrument Serif"'),
      document.fonts.load('italic 400 42px "Instrument Serif"'),
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
    exportBtn: document.querySelector('[data-export]'),
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
      // center-square cover crop (SEED_MAPPING §4)
      var side = Math.min(img.naturalWidth, img.naturalHeight);
      var cover = document.createElement('canvas');
      cover.width = 480; cover.height = 480;
      cover.getContext('2d').drawImage(img,
        (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side,
        0, 0, 480, 480);
      var fs = FEAT.featuresFromDrawable(img);
      state.features = fs.features;
      state.seed = fs.seed;
      state.forcedSeed = null;
      state.cover = cover;
      state.k = 0;
      press();
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  function press() {
    var opts = { dev: DEV };
    if (state.forcedSeed != null) opts.seed = state.forcedSeed;
    state.record = PLANT.generateRecord(state.features, state.k, opts);
    if (DEV) console.log('[linernotes] ' + PLANT.ENGINE_VERSION, {
      seed: state.record.seed, pressing: state.k, coordinates: state.record.coordinates
    });
    ensureFonts().then(function () { // fonts first — the fit governor needs real metrics
      typeset(state.record, state.cover);
      el.next.disabled = false;
      el.exportBtn.disabled = false;
      el.counter.textContent = state.record.pressingLabel || 'first pressing';
    });
  }

  /* ============================================================
     DOM TYPESETTING — CARD_DESIGN §2 layout skeleton (all normal flow)
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

    // 1 — masthead row
    var mast = div('row masthead-row');
    var thumbWrap = div('thumb');
    if (cover) {
      var t = document.createElement('canvas');
      t.width = 480; t.height = 480;
      t.getContext('2d').drawImage(cover, 0, 0);
      thumbWrap.appendChild(t);
    } else {
      thumbWrap.classList.add('thumb-empty');
    }
    mast.appendChild(thumbWrap);
    var mblock = div('mast-block');
    mblock.appendChild(div('mast-label', rec.label.name.toUpperCase()));
    mblock.appendChild(div('mast-cat', rec.catalog));
    mblock.appendChild(div('mast-channel', rec.channel));
    mast.appendChild(mblock);
    inner.appendChild(mast);

    // 2 — artist / title / year+format (accent kicker rule, site idiom)
    var head = div('row head-block');
    head.appendChild(div('head-rule'));
    head.appendChild(div('artist', rec.artist));
    head.appendChild(div('album', rec.title));
    head.appendChild(div('yearline', rec.formatLine));
    inner.appendChild(head);

    inner.appendChild(div('row hairline'));

    // 4 — tracklist
    var list = div('row tracklist');
    var side = null;
    rec.tracks.forEach(function (tr) {
      if (rec.hasSides && tr.side !== side) {
        side = tr.side;
        list.appendChild(div('side-head', 'SIDE ' + side));
      }
      var row = div('t-row');
      row.appendChild(div('t-title', tr.title));
      row.appendChild(div('t-leader'));
      row.appendChild(div('t-time', tr.time));
      list.appendChild(row);
    });
    inner.appendChild(list);

    inner.appendChild(div('row hairline'));

    // 6 — credits
    var credits = div('row credits');
    rec.credits.forEach(function (c) { credits.appendChild(div('credit', c)); });
    inner.appendChild(credits);

    // 7 — liner prose
    var prose = div('row prose', rec.prose);
    inner.appendChild(prose);

    // 8 — foot row (normal flow; margin-top:auto anchors it, never overlaps)
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
    var mast = div('row masthead-row');
    mast.appendChild(div('thumb thumb-empty'));
    var mb = div('mast-block');
    mb.appendChild(div('ghost-bar gb-1'));
    mb.appendChild(div('ghost-bar gb-2'));
    mast.appendChild(mb);
    inner.appendChild(mast);
    var head = div('row head-block');
    head.appendChild(div('head-rule'));
    head.appendChild(div('ghost-bar gb-artist'));
    head.appendChild(div('ghost-bar gb-title'));
    inner.appendChild(head);
    inner.appendChild(div('row hairline'));
    for (var i = 0; i < 5; i++) {
      var r = div('t-row');
      r.appendChild(div('ghost-bar gb-track'));
      r.appendChild(div('t-leader'));
      r.appendChild(div('ghost-bar gb-time'));
      inner.appendChild(r);
    }
    inner.appendChild(div('row hairline'));
    for (i = 0; i < 3; i++) inner.appendChild(div('ghost-bar gb-credit'));
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
    var w = el.stage.clientWidth;
    card.style.transform = 'scale(' + (w / 1400) + ')';
    el.stage.style.height = w + 'px';
  }
  window.addEventListener('resize', function () {
    if (scaleRAF) cancelAnimationFrame(scaleRAF);
    scaleRAF = requestAnimationFrame(rescale);
  });

  /* CARD_DESIGN §5 — the card must survive the longest content without
     clipping: tighten gaps first, then type scale. Runs after fonts load,
     so scrollHeight reflects true metrics. */
  function fit(card, inner) {
    var gaps = ['1', '0.85', '0.7'];
    var scales = ['1', '0.96', '0.92', '0.88', '0.84'];
    card.style.setProperty('--gapscale', '1');
    card.style.setProperty('--ts', '1');
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
     CANVAS RENDER — 2× base (2800×2800) for PNG export.
     Same dark ground, same skeleton, same era values as the DOM card.
     The y-cursor walks measured wrapped lines; a measure pass shrinks
     type until content clears the foot row — zero overlap by construction.
     ============================================================ */
  function wrapText(ctx, text, maxWidth) {
    var out = [], line = '';
    text.split(/\s+/).forEach(function (w) {
      var probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > maxWidth && line) { out.push(line); line = w; }
      else line = probe;
    });
    if (line) out.push(line);
    return out;
  }

  function renderCanvas(rec, cover, px) {
    var canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = px;
    var ctx = canvas.getContext('2d');
    var s = px / 1400; // base scale
    var ev = eraValues(rec.coordinates.eraBucket);

    var PAD = 90, x0 = PAD, x1 = 1400 - PAD;
    var footY = 1400 - 82;      // foot baseline (logical)
    var footClear = footY - 46; // content must end above this

    // measure pass → type scale that survives the longest content (§5)
    var ts = 1, h = layout(false);
    while (h > footClear && ts > 0.78) { ts -= 0.03; h = layout(false); }
    draw();

    function F(sizePx, fam, style) {
      ctx.font = (style || '400') + ' ' + (sizePx * ts * s) + 'px ' + fam;
    }
    function letterSp(v) { if (ctx.letterSpacing !== undefined) ctx.letterSpacing = v ? (v * s) + 'px' : '0px'; }

    /* one function, two passes: measure (fonts only) and draw */
    function layout(drawing) {
      var y = PAD;
      var g = function (v) { return v * ev.gap * ts; };

      function hairline(yy) {
        if (drawing) {
          ctx.fillStyle = ev.rule;
          ctx.fillRect(x0 * s, yy * s, (x1 - x0) * s, Math.max(1, ev.hair * s));
        }
      }
      function text(str, xx, yy, align, color) {
        if (drawing) {
          ctx.textAlign = align || 'left';
          ctx.fillStyle = color || ev.ink;
          ctx.fillText(str, xx * s, yy * s);
        }
      }

      // 1 masthead — thumb hairline-keyed; right block: label / catalog / channel
      var thumbSize = 240;
      if (drawing) {
        if (cover) ctx.drawImage(cover, x0 * s, y * s, thumbSize * s, thumbSize * s);
        else { ctx.fillStyle = bone(0.05); ctx.fillRect(x0 * s, y * s, thumbSize * s, thumbSize * s); }
        ctx.strokeStyle = ev.rule;
        ctx.lineWidth = Math.max(1, ev.hair * 0.9 * s);
        ctx.strokeRect(x0 * s, y * s, thumbSize * s, thumbSize * s);
      }
      var my = y + 28;
      F(18, MONO, '500');
      if (drawing) letterSp(3.4);
      text(rec.label.name.toUpperCase(), x1, my, 'right', ev.ink2);
      if (drawing) letterSp(0);
      my += 38 * ts;
      F(ev.catSize, MONO, '500');
      text(rec.catalog, x1, my, 'right', ev.acc); // the accent use
      my += 32 * ts;
      F(ev.channelSize, MONO, ev.channelSize > 18 ? '500' : '400');
      text(rec.channel, x1, my, 'right', ev.channelInk);
      y += thumbSize + g(46);

      // 2 head block — accent kicker rule, serif artist, serif-italic title
      if (drawing) {
        ctx.fillStyle = ev.acc;
        ctx.fillRect(x0 * s, y * s, 26 * s, 2 * s);
      }
      y += g(26);
      ctx.font = '400 ' + (66 * ts * s) + 'px ' + SERIF;
      var artistLines = wrapText(ctx, rec.artist, x1 - x0);
      artistLines.forEach(function (l) { y += 64 * ts; text(l, x0, y, 'left', ev.ink); });
      y += g(16);
      ctx.font = 'italic 400 ' + (42 * ts * s) + 'px ' + SERIF;
      var titleLines = wrapText(ctx, rec.title, x1 - x0);
      titleLines.forEach(function (l) { y += 46 * ts; text(l, x0, y, 'left', bone(0.92)); });
      y += g(28);
      F(20, MONO);
      y += 20 * ts;
      text(rec.formatLine, x0, y, 'left', ev.ink3);
      y += g(30);

      hairline(y); y += g(30);

      // 4 tracklist
      var side = null;
      rec.tracks.forEach(function (tr) {
        if (rec.hasSides && tr.side !== side) {
          if (side !== null) y += g(18); // air between sides
          side = tr.side;
          y += 20 * ts;
          F(17, MONO, '500');
          if (drawing) letterSp(2.6);
          text('SIDE ' + side, x0, y, 'left', ev.ink3);
          if (drawing) letterSp(0);
          y += g(14);
        }
        // wrap long titles inside the row's measure (timing column reserved)
        F(24, MONO); // timing width first
        var timeW = ctx.measureText(tr.time).width / s;
        ctx.font = '400 ' + (24 * ts * s) + 'px ' + SANS;
        var titleMax = (x1 - x0) - timeW - 40;
        var tLines = wrapText(ctx, tr.title, titleMax);
        tLines.forEach(function (l, li) {
          y += 32 * ts;
          if (drawing) letterSp(ev.track);
          text(l, x0, y, 'left', ev.ink);
          if (drawing) letterSp(0);
          if (li === 0) {
            F(24, MONO);
            text(tr.time, x1, y, 'right', ev.ink2);
            if (drawing && ev.leaders) {
              ctx.font = '400 ' + (24 * ts * s) + 'px ' + SANS;
              var tw = ctx.measureText(l).width / s;
              var lx = x0 + tw + 16, rx = x1 - timeW - 16;
              ctx.fillStyle = bone(0.28);
              for (var dx = lx; dx < rx; dx += 11) {
                ctx.fillRect(dx * s, (y - 4) * s, 1.6 * s, 1.6 * s);
              }
            }
            ctx.font = '400 ' + (24 * ts * s) + 'px ' + SANS;
          }
        });
        y += g(8);
      });
      y += g(22);

      hairline(y); y += g(34);

      // 6 credits
      F(18, MONO);
      rec.credits.forEach(function (c) {
        y += 26 * ts;
        text(c, x0, y, 'left', ev.ink2);
      });
      y += g(34);

      // 7 prose — max measure ~62ch, justified left
      ctx.font = '400 ' + (21 * ts * s) + 'px ' + SANS;
      var ch = ctx.measureText('abcdefghijklmnopqrstuvwxyz').width / 26 / s;
      var measure = Math.min(x1 - x0, ch * 62);
      var proseLines = wrapText(ctx, rec.prose, measure);
      proseLines.forEach(function (l) { y += 21 * ev.leading * ts; text(l, x0, y, 'left', bone(0.82)); });

      // 8 foot row — anchored at the base (content is guaranteed to clear it)
      if (drawing) {
        F(17, MONO);
        text(rec.pressingLine, x0, footY, 'left', ev.ink3);
        var right = 'linernotes · departive.com';
        var rightW = ctx.measureText(right).width / s;
        if (rec.pressingLabel) {
          F(17, MONO, '500');
          text(rec.pressingLabel, x1 - rightW - 28, footY, 'right', ev.acc);
        }
        F(17, MONO);
        text(right, x1, footY, 'right', bone(0.35));
      }

      return y; // content bottom (compared against footClear)
    }

    function draw() {
      // matte dark board — the site's ground family
      var grad = ctx.createLinearGradient(0, 0, 0, px);
      grad.addColorStop(0, '#161009');
      grad.addColorStop(0.42, '#141009');
      grad.addColorStop(1, '#100c06');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, px, px);
      // deterministic grain — bone speckle, very low
      var rg = PLANT.mulberry32(rec.seed ^ 0x9e3779b9);
      ctx.fillStyle = bone(0.02);
      for (var i = 0; i < 3600; i++) {
        ctx.fillRect(rg() * px, rg() * px, s * (0.8 + rg() * 1.6), s * (0.8 + rg() * 1.6));
      }
      // board edge hairline
      ctx.strokeStyle = bone(0.10);
      ctx.lineWidth = Math.max(1, 1 * s);
      ctx.strokeRect(0.5 * s, 0.5 * s, px - s, px - s);
      ctx.textBaseline = 'alphabetic';
      layout(true);
    }

    return canvas;
  }

  function exportPNG() {
    if (!state.record) return;
    ensureFonts().then(function () { // never draw before the faces are in
      var canvas = renderCanvas(state.record, state.cover, 2800);
      var name = 'linernotes-' + state.record.catalog.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase() +
        (state.k > 0 ? '-p' + (state.k + 1) : '') + '.png';
      canvas.toBlob(function (blob) {
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
  el.file.addEventListener('change', function () { handleFile(el.file.files[0]); });
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
  el.exportBtn.addEventListener('click', exportPNG);

  /* dev handle (dev mode only) — used by the Phase 0 harness */
  if (DEV) window.LN_SLEEVE = { renderCanvas: renderCanvas, state: state, typeset: typeset, eraValues: eraValues };

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
