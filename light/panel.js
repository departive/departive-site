/*
 * STOCKHOLM LIGHT — panel.js
 * The panel per LIGHT_SYSTEM §2: one drawn arc, phase line + countdown,
 * conditions line (phrase bank), numbers row, monthly footnote.
 *
 * Structure:
 *   - a PURE half (phrase bank, K mapping, footnotes, countdown text,
 *     arc SVG string builder) — unit-tested by the Node harness;
 *   - a DOM half (renderAll/boot), guarded so the file also loads in Node.
 *
 * PHRASE BANK IS AUTHORED (LIGHT_SYSTEM §3/§4) — transcribed verbatim.
 * The month lines marked AUTHORED-AT-BUILD below are new, in-register,
 * pending David's approval (see PHASE0 report).
 *
 * Double-mount safety (TASKS.md): the Now/Lately host runs the dc-runtime,
 * which re-mounts page content after load, replacing raw DOM nodes.
 * Therefore this module NEVER caches nodes: every render re-queries
 * [data-light-panel], filters to visible instances (getClientRects), and a
 * rAF retry loop (~300 tries) plus a slow watchdog re-render any instance
 * the runtime wiped. boot() is idempotent (window.__SL_BOOTED) in case the
 * host duplicates script tags. Rendering is a full idempotent rebuild —
 * there is no state in the DOM.
 */
(function (root, factory) {
  var Solar = (typeof module === 'object' && module.exports)
    ? require('./solar.js')
    : root.SLSolar;
  var api = factory(Solar);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SLPanel = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function (Solar) {
  'use strict';

  /* ================= PURE HALF ================= */

  /* ---------- phrase bank — LIGHT_SYSTEM §3, verbatim ---------- */
  var PHRASES = {
    'GOLDEN.clear': [
      'Low, warm, directional. Long shadows doing the composition for you.',
      'The grazing hour — texture reads, faces glow, meters lie. Trust the highlights.'
    ],
    'GOLDEN.scattered': [
      'Gold with interruptions. Wait for the gaps; they’re worth the minute.',
      'Broken warm light — dramatic when the cloud edge cooperates.'
    ],
    'GOLDEN.overcast': [
      'The golden hour is happening above the cloud. Down here: soft and even.',
      'No gold today, but the softbox is enormous.'
    ],
    'BLUE.any': [
      'Blue hour. Tungsten windows against a cobalt sky — the ten good minutes.',
      'The city’s lights and the sky at equal strength. Work quickly.'
    ],
    'DAY.clear': [
      'Hard overhead light. Shadows are black, contrast is honest — shoot structure, not faces.',
      'Full sun. Good for graphics and geometry; unkind to portraits.'
    ],
    'DAY.scattered': [
      'Sun and cloud trading places. Variable — bracket, or wait for your light.',
      'A moving softbox. Watch the ground for the cloud shadows coming.'
    ],
    'DAY.overcast': [
      'Overcast, even — good for portraits, colour, and detail work. The shadowless day.',
      'Flat, kind light. Nothing will be dramatic; everything will be accurate.'
    ],
    'NIGHT.clear': [
      'Dark and clean. Long exposures, city glow, stars if you leave town.'
    ],
    'NIGHT.overcast': [
      'Dark, low ceiling. The city lights the clouds from below — orange lid.'
    ]
  };

  var PRECIP = {
    rain: 'Wet streets double every light source. Bring a cloth.',
    snow: 'Falling snow: the cheapest atmosphere there is. Expose to the right.'
  };

  /* ---------- seasonal footnotes — LIGHT_SYSTEM §4, month-keyed ---------- */
  var FOOTNOTES = {
    1:  'The sun stays low all day — when it shows, the whole day shoots like golden hour.', // AUTHORED-AT-BUILD (Jan absent from the §4 pool) — pending approval
    2:  'The light is coming back — a few minutes a day, and you can feel it.',
    3:  'Snow on the ground, sun climbing: the brightest weeks of the year.',
    4:  'Light after dinner again. The year is paying back what October took.',              // AUTHORED-AT-BUILD — pending approval
    5:  'Sunset slips past nine and keeps going — the first of the long evenings.',          // AUTHORED-AT-BUILD — pending approval
    6:  'The sun barely commits to setting. Golden hour is a golden evening.',
    7:  'Late light past ten, and the days already shortening — nobody notices until August.', // AUTHORED-AT-BUILD (flagged) — pending approval
    8:  'The first real darkness since May. Blue hour returns.',
    9:  'Even light, long evenings — the fair-weather photographer’s month.',
    10: 'Golden hour moves into the afternoon. The light is leaving, and it leaves beautifully.', // AUTHORED-AT-BUILD (flagged) — pending approval
    11: 'Grey on grey. The month that teaches tone.',
    12: 'Six hours of usable light. All of it is worth something.'
  };

  /* ---------- cloud buckets (§3 keys: 0–30 / 30–70 / 70–100) ---------- */
  function cloudBucket(cloudPct) {
    if (cloudPct == null) return 'clear';         // fail-open assumption, K only
    if (cloudPct <= 30) return 'clear';
    if (cloudPct <= 70) return 'scattered';
    return 'overcast';
  }

  function phraseKey(phase, cloudPct) {
    if (phase === 'BLUE') return 'BLUE.any';
    if (phase === 'NIGHT') return cloudPct > 50 ? 'NIGHT.overcast' : 'NIGHT.clear';
    return phase + '.' + cloudBucket(cloudPct);
  }

  /*
   * pickPhrase(phase, cloudPct, precip {rain, snow}, dayOfYear)
   * Deterministic variant choice (dayOfYear % variants) — stable all day,
   * varies day to day, unit-testable. Precip modifier appends per §3;
   * snow wins when both are falling.
   */
  function pickPhrase(phase, cloudPct, precip, dayOfYear) {
    var variants = PHRASES[phraseKey(phase, cloudPct)];
    var line = variants[(dayOfYear || 0) % variants.length];
    if (precip) {
      if (precip.snow > 0) line += ' ' + PRECIP.snow;
      else if (precip.rain > 0 || precip.precip > 0) line += ' ' + PRECIP.rain;
    }
    return line;
  }

  /* ---------- colour-temperature estimate (K mapping table) ----------
   * Anchors per LIGHT_SYSTEM §2: golden-clear 3200–3800 K · blue 8000–10000 K
   * · overcast-day ≈6500 K · clear-day ≈5500 K. Interpolated cells in-family.
   * Displayed as the midpoint, always labeled "≈". NIGHT has no sun: "—".  */
  var KELVIN = {
    GOLDEN: { clear: [3200, 3800], scattered: [3600, 4600], overcast: [5500, 6500] },
    BLUE:   { any: [8000, 10000] },
    DAY:    { clear: [5200, 5800], scattered: [5500, 6500], overcast: [6000, 7000] }
  };

  function kelvinRange(phase, cloudPct) {
    if (phase === 'NIGHT') return null;
    if (phase === 'BLUE') return KELVIN.BLUE.any;
    return KELVIN[phase][cloudBucket(cloudPct)];
  }

  function kelvinText(phase, cloudPct) {
    var r = kelvinRange(phase, cloudPct);
    if (!r) return '—';
    var mid = Math.round((r[0] + r[1]) / 2 / 100) * 100;
    return '≈' + mid + ' K';
  }

  /* ---------- phase labels (§2) + countdown text ---------- */
  var LABELS = { GOLDEN: 'Golden hour', BLUE: 'Blue hour', DAY: 'Flat daylight', NIGHT: 'Dark' };
  var NEXT_NAMES = { GOLDEN: 'golden', BLUE: 'blue', DAY: 'daylight', NIGHT: 'dark' };

  /*
   * §2 exemplars: "golden in 1 h 12 m" / "ends 21:44".
   * The bounded, desirable phases (GOLDEN/BLUE) count down to their end time;
   * the ambient phases (DAY/NIGHT) count toward what comes next.
   */
  function countdownText(phase, next, nowMs) {
    if (!next) return '';
    if (phase === 'GOLDEN' || phase === 'BLUE') return 'ends ' + Solar.fmtTime(next.atMs);
    return NEXT_NAMES[next.to] + ' in ' + Solar.fmtCountdown(next.atMs - nowMs);
  }

  function dayOfYearSthlm(ms) {
    var p = Solar.sthlmParts(ms);
    return Math.round((Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(p.y, 0, 1)) / 86400000) + 1;
  }

  function footnoteFor(ms) { return FOOTNOTES[Solar.sthlmParts(ms).mo]; }

  /* ---------- the arc (§2.1) — SVG string builder, pure ----------
   * Sun-altitude curve across the Stockholm calendar day, x = 00→24 h,
   * segments coloured by phase; vertical golden/blue band shading; horizon
   * line; rise/set times on the horizon; now-marker on the curve.       */
  var ARC_COLORS = {
    DAY: 'rgba(237,231,219,0.72)',
    GOLDEN: '#d7a24a',
    BLUE: '#7d93b2',
    NIGHT: 'rgba(237,231,219,0.16)'
  };
  var BAND_FILL = { GOLDEN: 'rgba(215,162,74,0.09)', BLUE: 'rgba(125,147,178,0.08)' };

  function arcSVG(snap, compact) {
    var W = 640, H = compact ? 190 : 235, L = 14, R = W - 14, T = 14, B = H - 34;
    var N = 288; // 5-min samples
    var start = snap.today.startMs, DAY_MS = Solar.DAY_MS;
    var alts = [], i;
    for (i = 0; i <= N; i++) alts.push(Solar.elevation(start + i * (DAY_MS / N)));
    var lo = Math.min(-14, snap.today.minAlt - 3), hi = Math.max(16, snap.today.maxAlt + 4);
    function x(f) { return L + f * (R - L); }
    function y(a) { return B - (a - lo) / (hi - lo) * (B - T); }
    function pt(i2) { return x(i2 / N).toFixed(1) + ' ' + y(alts[i2]).toFixed(1); }

    var s = '';
    // vertical golden/blue band shading
    var runPhase = Solar.phaseOf(alts[0]), runStart = 0;
    for (i = 1; i <= N; i++) {
      var p = (i === N) ? null : Solar.phaseOf(alts[i]);
      if (p !== runPhase) {
        if (BAND_FILL[runPhase]) {
          s += '<rect x="' + x(runStart / N).toFixed(1) + '" y="' + T + '" width="'
             + (x(i / N) - x(runStart / N)).toFixed(1) + '" height="' + (B - T)
             + '" fill="' + BAND_FILL[runPhase] + '"/>';
        }
        runPhase = p; runStart = i;
      }
    }
    // horizon
    var yh = y(0).toFixed(1);
    s += '<line x1="' + L + '" y1="' + yh + '" x2="' + R + '" y2="' + yh
       + '" stroke="rgba(237,231,219,0.22)" stroke-width="1"/>';
    // the arc, segmented by phase (segments overlap one sample: no gaps)
    runPhase = Solar.phaseOf(alts[0]); runStart = 0;
    for (i = 1; i <= N; i++) {
      var p2 = (i === N) ? null : Solar.phaseOf(alts[i]);
      if (p2 !== runPhase) {
        var d = 'M' + pt(runStart);
        for (var j = runStart + 1; j <= Math.min(i, N); j++) d += ' L' + pt(j);
        s += '<path d="' + d + '" fill="none" stroke="' + ARC_COLORS[runPhase]
           + '" stroke-width="1.6" stroke-linecap="round"/>';
        runPhase = p2; runStart = Math.min(i, N) - 1 >= 0 ? i - 1 : i;
      }
    }
    // hour ticks 00 06 12 18 24 (Stockholm wall hours)
    for (i = 0; i <= 24; i += 6) {
      var xf = x(i / 24).toFixed(1);
      s += '<line x1="' + xf + '" y1="' + (B + 4) + '" x2="' + xf + '" y2="' + (B + 9)
         + '" stroke="rgba(237,231,219,0.3)" stroke-width="1"/>'
         + '<text x="' + xf + '" y="' + (B + 21) + '" text-anchor="middle" fill="var(--muted,#9e9484)"'
         + ' style="font-family:var(--mono,monospace); font-size:9px; letter-spacing:0.08em;">'
         + ('0' + (i % 24)).slice(-2) + '</text>';
    }
    // sunrise / sunset ticks + times on the horizon
    function riseSetTick(ms, anchor) {
      if (!ms) return '';
      var f = (ms - start) / DAY_MS, xf2 = x(f).toFixed(1);
      return '<line x1="' + xf2 + '" y1="' + (y(0) - 4).toFixed(1) + '" x2="' + xf2 + '" y2="'
        + (y(0) + 4).toFixed(1) + '" stroke="rgba(237,231,219,0.5)" stroke-width="1"/>'
        + '<text x="' + xf2 + '" y="' + (y(0) + 15).toFixed(1) + '" text-anchor="' + anchor
        + '" fill="var(--muted,#9e9484)" style="font-family:var(--mono,monospace); font-size:9px; letter-spacing:0.08em;">'
        + Solar.fmtTime(ms) + '</text>';
    }
    s += riseSetTick(snap.today.rise, 'start') + riseSetTick(snap.today.set, 'end');
    // now-marker (breathing halo; reduced-motion disables via injected CSS)
    var fNow = Math.min(1, Math.max(0, (snap.nowMs - start) / DAY_MS));
    var nx = x(fNow).toFixed(1), ny = y(snap.alt).toFixed(1);
    s += '<circle cx="' + nx + '" cy="' + ny + '" r="3.6" fill="var(--accent,#b0835a)"/>'
       + '<circle class="sl-breath" cx="' + nx + '" cy="' + ny + '" r="3.6" fill="var(--accent,#b0835a)" opacity="0.35"/>';

    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%; height:auto; display:block; overflow:visible;"'
      + ' role="img" aria-label="Today’s sun path over Stockholm: altitude through 24 hours, gold through the golden hours, blue through twilight, with a marker at the current minute">'
      + s + '</svg>';
  }

  /* ================= DOM HALF ================= */

  var MONO = 'font-family:var(--mono,monospace);';
  var SERIF = 'font-family:var(--serif,Georgia,serif);';

  function numberCell(label, value) {
    return '<div style="min-width:96px;">'
      + '<span style="display:block; ' + MONO + ' font-size:9px; letter-spacing:0.2em; text-transform:uppercase; color:var(--mutedInk,#6b6252); margin-bottom:6px;">' + label + '</span>'
      + '<span style="display:block; ' + MONO + ' font-size:14px; letter-spacing:0.04em; color:var(--onDark,#ede7db);">' + value + '</span>'
      + '</div>';
  }

  // Build the full panel HTML for one root. Pure given (snap, skyState, compact).
  function panelHTML(snap, skyState, compact) {
    var hasSky = !!(skyState && skyState.data);
    var cloud = hasSky ? skyState.data.cloud : null;
    var doy = dayOfYearSthlm(snap.nowMs);

    var phaseLabel = LABELS[snap.phase];
    var cd = countdownText(snap.phase, snap.next, snap.nowMs);

    var conditions = hasSky
      ? pickPhrase(snap.phase, cloud, skyState.data, doy)
      : null;

    var kText = kelvinText(snap.phase, cloud);
    var lines = [];
    lines.push(footnoteFor(snap.nowMs));
    if (snap.neverFullyDark) lines.push('The sky never fully darkens tonight.');

    var h = '';
    h += '<div data-sl-rendered style="max-width:760px;">';
    h += arcSVG(snap, compact);
    // phase line + countdown
    h += '<div style="display:flex; align-items:baseline; gap:18px; flex-wrap:wrap; margin-top:' + (compact ? '18px' : '26px') + ';">'
      + '<span style="' + SERIF + ' font-weight:400; font-size:' + (compact ? 'clamp(26px,4vw,38px)' : 'clamp(34px,5vw,54px)') + '; line-height:1; letter-spacing:-0.01em; color:var(--onDark,#ede7db);">' + phaseLabel + '</span>'
      + (cd ? '<span style="' + MONO + ' font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent,#b0835a);">' + cd + '</span>' : '')
      + '</div>';
    // conditions line (phrase bank) — omitted entirely when the sky layer failed (solar-only)
    if (conditions) {
      h += '<p style="margin:' + (compact ? '12px' : '16px') + ' 0 0; ' + SERIF + ' font-style:italic; font-size:' + (compact ? 'clamp(15px,1.6vw,18px)' : 'clamp(17px,1.9vw,21px)') + '; line-height:1.5; color:rgba(237,231,219,0.72); max-width:56ch;">' + conditions + '</p>';
    }
    // staleness honesty
    if (hasSky && skyState.stale) {
      h += '<p style="margin:8px 0 0; ' + MONO + ' font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:var(--mutedInk,#6b6252);">conditions as of ' + Solar.fmtTime(skyState.fetchedAt) + '</p>';
    }
    // numbers row
    h += '<div style="display:flex; gap:clamp(20px,4vw,44px); flex-wrap:wrap; margin-top:' + (compact ? '18px' : '26px') + '; padding-top:' + (compact ? '14px' : '18px') + '; border-top:1px solid rgba(237,231,219,0.08);">'
      + numberCell('Sun altitude', Solar.fmtAlt(snap.alt))
      + numberCell('Colour temp', kText + ((!hasSky && kText !== '—') ? ' · clear est.' : ''))
      + numberCell('Day length', Solar.fmtDayLen(snap.today.dayLenMs))
      + numberCell('vs yesterday', Solar.fmtDelta(snap.deltaMs))
      + '</div>';
    // footnote(s)
    h += '<p style="margin:' + (compact ? '14px' : '20px') + ' 0 0; ' + MONO + ' font-size:11px; letter-spacing:0.06em; line-height:1.8; color:var(--muted,#9e9484);">' + lines.join('<br>') + '</p>';
    h += '</div>';
    return h;
  }

  /* ---------- visible-instance rendering (double-mount safe) ---------- */
  function isVis(el) { return el.getClientRects().length > 0; }

  function visibleRoots() {
    var out = [], list = document.querySelectorAll('[data-light-panel]');
    for (var i = 0; i < list.length; i++) if (isVis(list[i])) out.push(list[i]);
    return out;
  }

  // Full idempotent rebuild of every visible instance. Never caches nodes.
  function renderAll(snap, skyState) {
    if (typeof document === 'undefined') return;
    var roots = visibleRoots();
    for (var i = 0; i < roots.length; i++) {
      var compact = roots[i].hasAttribute('data-light-compact');
      roots[i].innerHTML = panelHTML(snap, skyState, compact);
    }
    return roots.length;
  }

  function injectStyle() {
    if (document.getElementById('sl-style')) return;
    var st = document.createElement('style');
    st.id = 'sl-style';
    st.textContent =
      '@keyframes slBreath { 0%,100% { transform:scale(1); opacity:0.35; } 50% { transform:scale(2.1); opacity:0; } }'
      + ' .sl-breath { animation:slBreath 5s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }'
      + ' @media (prefers-reduced-motion: reduce) { .sl-breath { animation:none !important; opacity:0 !important; } }';
    document.head.appendChild(st);
  }

  /*
   * boot() — call once per page (idempotent; safe if the host duplicates the tag).
   *   ?t=2026-06-21T21:00  freezes the clock (Stockholm wall time, or ISO+zone)
   *   ?sky=off             disables the weather layer (dev)
   * Per-minute tick, visible tab only; re-render on visibility return;
   * slow watchdog re-fills any instance the dc-runtime re-mount wiped.
   */
  function boot() {
    if (typeof document === 'undefined') return;
    if (typeof window !== 'undefined') {
      if (window.__SL_BOOTED) return;
      window.__SL_BOOTED = true;
    }
    injectStyle();

    var qs = null;
    try { qs = new URLSearchParams(location.search); } catch (e) {}
    var frozen = qs ? Solar.parseFrozen(qs.get('t')) : null;
    function NOW() { return frozen != null ? frozen : Date.now(); }

    var sky = null;
    if (typeof SLSky !== 'undefined' && (!qs || qs.get('sky') !== 'off')) {
      sky = SLSky.start({ onUpdate: function () { render(); } });
    }

    function render() { return renderAll(Solar.snapshot(NOW()), sky ? sky.state() : null); }

    // initial mount: rAF retry (~300 tries) until a visible instance exists —
    // survives the dc-runtime double-mount replacing the raw nodes after load
    var tries = 0;
    (function run() {
      if (!render()) { if (++tries < 300) requestAnimationFrame(run); return; }
      var tick = function () { if (!document.hidden) render(); };
      setTimeout(function () { tick(); setInterval(tick, 60000); },
                 60000 - (Date.now() % 60000) + 250);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
      // watchdog: if a re-mount emptied a visible instance, repaint within ~1.5 s
      setInterval(function () {
        var roots = visibleRoots();
        for (var i = 0; i < roots.length; i++) {
          if (!roots[i].querySelector('[data-sl-rendered]')) { render(); return; }
        }
      }, 1500);
    })();
  }

  return {
    PHRASES: PHRASES, PRECIP: PRECIP, FOOTNOTES: FOOTNOTES, KELVIN: KELVIN, LABELS: LABELS,
    cloudBucket: cloudBucket, phraseKey: phraseKey, pickPhrase: pickPhrase,
    kelvinRange: kelvinRange, kelvinText: kelvinText,
    countdownText: countdownText, dayOfYearSthlm: dayOfYearSthlm, footnoteFor: footnoteFor,
    arcSVG: arcSVG, panelHTML: panelHTML,
    renderAll: renderAll, boot: boot
  };
});
