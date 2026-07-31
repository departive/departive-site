/*
 * STOCKHOLM LIGHT — sky.js
 * Open-Meteo current conditions for Stockholm (no key, CORS-open):
 * cloud cover %, precipitation (rain/showers/snow), visibility.
 *
 * Behavior:
 *   - fetch on start, then refresh every 15 min while the tab is visible;
 *   - FAIL-OPEN: any network / parse failure resolves to null and the panel
 *     renders the solar layer alone (that layer never fails — it's math);
 *   - staleness honesty: state() reports `stale` once the last good fetch is
 *     older than 20 min, so the panel can say "conditions as of 14:02"
 *     instead of being silently wrong.
 *
 * Loads in the browser as window.SLSky and in Node via module.exports
 * (fetchOnce/normalize are exercised by the test harness).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SLSky = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var DEFAULT_URL = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=59.33&longitude=18.07'
    + '&current=cloud_cover,precipitation,rain,showers,snowfall,visibility'
    + '&timezone=UTC';

  var REFRESH_MS = 15 * 60 * 1000;  // re-fetch cadence while visible
  var STALE_MS = 20 * 60 * 1000;    // older than this => announce staleness

  // Open-Meteo `current` block -> the panel's sky shape, or null if unusable.
  function normalize(json) {
    var c = json && json.current;
    if (!c || typeof c.cloud_cover !== 'number') return null;
    return {
      cloud: c.cloud_cover,                                   // %
      precip: +c.precipitation || 0,                          // mm (total)
      rain: (+c.rain || 0) + (+c.showers || 0),               // mm
      snow: +c.snowfall || 0,                                 // cm
      visibility: (typeof c.visibility === 'number') ? c.visibility : null  // m
    };
  }

  // One fetch. Never rejects — resolves to normalized data or null (fail-open).
  function fetchOnce(url) {
    if (typeof fetch !== 'function') return Promise.resolve(null);
    var p;
    try {
      p = fetch(url || DEFAULT_URL, { cache: 'no-store' });
    } catch (e) {
      return Promise.resolve(null);
    }
    return p
      .then(function (r) { return r && r.ok ? r.json() : null; })
      .then(function (j) { return j ? normalize(j) : null; })
      .catch(function () { return null; });
  }

  /*
   * start({ url?, onUpdate? }) -> { state, refresh }
   * state() => { data: {...}|null, fetchedAt: ms|0, stale: bool }
   * `data` stays at the last GOOD fetch when a refresh fails (with `stale`
   * flipping once it ages out) — never silently wrong, never silently empty.
   */
  function start(opts) {
    opts = opts || {};
    var url = opts.url || DEFAULT_URL;
    var st = { data: null, fetchedAt: 0 };
    var inflight = false;

    function state() {
      return {
        data: st.data,
        fetchedAt: st.fetchedAt,
        stale: !!(st.data && (Date.now() - st.fetchedAt > STALE_MS))
      };
    }

    function refresh() {
      if (inflight) return;
      inflight = true;
      fetchOnce(url).then(function (d) {
        inflight = false;
        if (d) { st.data = d; st.fetchedAt = Date.now(); }
        // on failure: keep the last good data; state().stale does the honesty
        if (opts.onUpdate) opts.onUpdate(state());
      });
    }

    refresh();

    if (typeof document !== 'undefined') {
      var due = function () { return Date.now() - st.fetchedAt >= REFRESH_MS; };
      // minute-grain check; only fetches while the tab is visible and 15 min are up
      setInterval(function () { if (!document.hidden && due()) refresh(); }, 60000);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden && due()) refresh();
      });
    }

    return { state: state, refresh: refresh };
  }

  return { start: start, fetchOnce: fetchOnce, normalize: normalize,
           DEFAULT_URL: DEFAULT_URL, REFRESH_MS: REFRESH_MS, STALE_MS: STALE_MS };
});
