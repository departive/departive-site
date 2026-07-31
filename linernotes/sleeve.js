/* LINER NOTES — sleeve.js
   The sleeve back: DOM typesetting per CARD_DESIGN.md, canvas render at 2×
   for PNG export, drop zone, "Next pressing" (diegetic k+1), empty state.
   Browser-only; corpus/features/plant are pure and DOM-free.

   The card is typeset at its 1400×1400 logical base (CARD_DESIGN §1) and
   transform-scaled to the viewport — mobile scales the card; export always
   renders at the fixed 2× base (2800×2800), unaffected by viewport.
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

  /* label tones — the card's single accent use (catalog number only).
     Presentation values, not corpus content. */
  var LABEL_TONES = {
    'FÄLT': '#4d5c48', 'Third Hour': '#54506b', 'Kolonn': '#3d3d40',
    'Ortsband': '#7a5230', 'Ledger & Sons': '#5d4a3a', 'Fjärde Våningen': '#44586b',
    'Meridian Tape Club': '#5b6350', 'Palindrome': '#6b3f42', 'Under Bark': '#4a5a41',
    'Hourglass Annex': '#706040'
  };

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
    typeset(state.record, state.cover);
    el.next.disabled = false;
    el.exportBtn.disabled = false;
    el.counter.textContent = state.record.pressingLabel || 'first pressing';
  }

  /* ============================================================
     DOM TYPESETTING — CARD_DESIGN §2 layout skeleton, §3 era values
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
    card.style.setProperty('--tone', LABEL_TONES[rec.label.name] || '#5a5347');

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

    // 2 — artist / title / year+format
    var head = div('row head-block');
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

    // 8 — foot row
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
     clipping: tighten gaps first, then type scale, never below 0.88. */
  function fit(card, inner) {
    var steps = [
      ['--gapscale', ['1', '0.85', '0.7']],
      ['--ts', ['1', '0.96', '0.92', '0.88']]
    ];
    card.style.setProperty('--gapscale', '1');
    card.style.setProperty('--ts', '1');
    function fits() { return inner.scrollHeight <= inner.clientHeight; }
    if (fits()) return;
    for (var g = 0; g < steps[0][1].length; g++) {
      card.style.setProperty('--gapscale', steps[0][1][g]);
      for (var t = 0; t < steps[1][1].length; t++) {
        card.style.setProperty('--ts', steps[1][1][t]);
        if (fits()) return;
      }
    }
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
     CANVAS RENDER — 2× base (2800×2800) for PNG export
     ============================================================ */
  var GROTESK = "'Instrument Sans', system-ui, sans-serif";
  var MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
  var PAPER = '#F2F1EE', INK = '#1A1917';
  function ink2(alpha) { return 'rgba(26,25,23,' + (alpha || 0.62) + ')'; }

  function eraValues(bucket) {
    // §3: era changes VALUES, never the layout skeleton
    return {
      hair: bucket === '70s' ? 2.4 : bucket === '80s' ? 1.4 : (bucket === '2000s' || bucket === '2010s') ? 0.7 : 1.4,
      artistWeight: bucket === '70s' ? '700' : '600',
      track: bucket === '80s' ? -0.6 : 0,          // px letter-spacing at base
      catSize: bucket === '80s' ? 30 : 24,
      channelSize: bucket === '70s' ? 22 : 18,
      leading: bucket === '90s' ? 1.62 : 1.45,
      leaders: bucket === '90s',
      gap: (bucket === '2000s' || bucket === '2010s') ? 1.18 : 1
    };
  }

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
    var tone = LABEL_TONES[rec.label.name] || '#5a5347';

    // measure pass → type scale that survives the longest content (§5).
    // The foot row is pinned at y≈1318; content must clear it with margin.
    var ts = 1, h = layout(null);
    while (h > 1278 && ts > 0.8) { ts -= 0.03; h = layout(null); }
    draw();

    function F(sizePx, fam, weight) {
      ctx.font = (weight || '400') + ' ' + (sizePx * ts * s) + 'px ' + fam;
    }

    /* one function, two passes: measure (ctx text only) and draw */
    function layout(drawing) {
      var PAD = 90, x0 = PAD, x1 = 1400 - PAD, y = PAD;
      var g = function (v) { return v * ev.gap * ts; };

      function hairline(yy) {
        if (drawing) {
          ctx.fillStyle = ink2(0.8);
          ctx.fillRect(x0 * s, yy * s, (x1 - x0) * s, Math.max(1, ev.hair * s));
        }
      }
      function text(str, xx, yy, align, color) {
        if (drawing) {
          ctx.textAlign = align || 'left';
          ctx.fillStyle = color || INK;
          ctx.fillText(str, xx * s, yy * s);
        }
      }

      // 1 masthead
      var thumbSize = 240;
      if (drawing) {
        if (cover) ctx.drawImage(cover, x0 * s, y * s, thumbSize * s, thumbSize * s);
        else { ctx.fillStyle = ink2(0.06); ctx.fillRect(x0 * s, y * s, thumbSize * s, thumbSize * s); }
        ctx.strokeStyle = ink2(0.8);
        ctx.lineWidth = Math.max(1, ev.hair * s);
        ctx.strokeRect(x0 * s, y * s, thumbSize * s, thumbSize * s);
      }
      var my = y + 30;
      F(22, GROTESK, '600');
      if (drawing && ctx.letterSpacing !== undefined) ctx.letterSpacing = (3.2 * s) + 'px';
      text(rec.label.name.toUpperCase(), x1, my, 'right');
      if (drawing && ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
      my += 40 * ts;
      F(ev.catSize, MONO, '500');
      text(rec.catalog, x1, my, 'right', tone); // the single accent use
      my += 34 * ts;
      F(ev.channelSize, MONO);
      text(rec.channel, x1, my, 'right', ink2());
      y += thumbSize + g(44);

      // 2 artist / title / yearline
      F(64, GROTESK, ev.artistWeight);
      var artistLines = wrapText(ctx, rec.artist, x1 - x0);
      artistLines.forEach(function (l) { y += 64 * ts; text(l, x0, y); });
      y += g(14);
      F(40, GROTESK, '400');
      if (drawing) ctx.font = 'italic ' + (40 * ts * s) + 'px ' + GROTESK;
      var titleLines = wrapText(ctx, rec.title, x1 - x0);
      titleLines.forEach(function (l) { y += 46 * ts; text(l, x0, y); });
      y += g(26);
      F(20, MONO);
      y += 20 * ts;
      text(rec.formatLine, x0, y, 'left', ink2());
      y += g(30);

      hairline(y); y += g(30);

      // 4 tracklist
      var side = null;
      rec.tracks.forEach(function (tr) {
        if (rec.hasSides && tr.side !== side) {
          if (side !== null) y += g(18); // air between sides
          side = tr.side;
          y += 22 * ts;
          F(17, MONO, '500');
          if (drawing && ctx.letterSpacing !== undefined) ctx.letterSpacing = (2.4 * s) + 'px';
          text('SIDE ' + side, x0, y, 'left', ink2());
          if (drawing && ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
          y += g(14);
        }
        y += 32 * ts;
        F(24, GROTESK);
        if (drawing && ctx.letterSpacing !== undefined && ev.track) ctx.letterSpacing = (ev.track * s) + 'px';
        text(tr.title, x0, y);
        if (drawing && ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
        F(24, MONO);
        text(tr.time, x1, y, 'right');
        if (drawing && ev.leaders) {
          F(24, GROTESK);
          var tw = ctx.measureText(tr.title).width / s;
          F(24, MONO);
          var mw = ctx.measureText(tr.time).width / s;
          var lx = x0 + tw + 16, rx = x1 - mw - 16;
          ctx.fillStyle = ink2(0.4);
          for (var dx = lx; dx < rx; dx += 11) {
            ctx.fillRect(dx * s, (y - 4) * s, 1.6 * s, 1.6 * s);
          }
        }
        y += g(8);
      });
      y += g(22);

      hairline(y); y += g(34);

      // 6 credits
      F(18, MONO);
      rec.credits.forEach(function (c) {
        y += 26 * ts;
        text(c, x0, y, 'left', ink2(0.78));
      });
      y += g(34);

      // 7 prose — max measure ~62ch, justified left
      F(21, GROTESK);
      var ch = ctx.measureText('abcdefghijklmnopqrstuvwxyz').width / 26 / s;
      var measure = Math.min(x1 - x0, ch * 62);
      var proseLines = wrapText(ctx, rec.prose, measure);
      proseLines.forEach(function (l) { y += 21 * ev.leading * ts; text(l, x0, y); });

      // 8 foot row — pinned to the bottom
      var fy = 1400 - PAD + 8;
      F(17, MONO);
      text(rec.pressingLine, x0, fy, 'left', ink2());
      var right = 'linernotes · departive.com';
      if (rec.pressingLabel) {
        F(17, MONO, '500');
        text(rec.pressingLabel + '   ', x1 - ctx.measureText(right).width / s - 8, fy, 'right', ink2(0.85));
      }
      F(17, MONO);
      text(right, x1, fy, 'right', ink2(0.5));

      return y + 60; // content height before the pinned foot
    }

    function draw() {
      // paper ground + deterministic paper grain (seeded speckle)
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, px, px);
      var rg = PLANT.mulberry32(rec.seed ^ 0x9e3779b9);
      ctx.fillStyle = 'rgba(26,25,23,0.024)';
      for (var i = 0; i < 3600; i++) {
        ctx.fillRect(rg() * px, rg() * px, s * (0.8 + rg() * 1.6), s * (0.8 + rg() * 1.6));
      }
      ctx.textBaseline = 'alphabetic';
      layout(true);
    }

    return canvas;
  }

  function exportPNG() {
    if (!state.record) return;
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
  if (DEV) window.LN_SLEEVE = { renderCanvas: renderCanvas, state: state, typeset: typeset };

  /* boot: empty state, or ?seed= dev shim (synthetic feature vector) */
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
