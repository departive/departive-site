/*
 * THE SHADOW LINE — canyon.js
 * NOAA solar position (azimuth + altitude) for Stockholm, and the street-
 * canyon shade-line geometry. Pure functions, no DOM, no network.
 *
 * The line: for an infinite canyon of width w, occluder height H, street
 * axis θ (deg, 0 = N–S, 90 = E–W), sun at (az, alt):
 *   h = clamp( H − w·tan(alt)/|sin(az − θ)| , 0, H )
 * measured on the facade the rays strike (the far side from the sun).
 * |sin(az−θ)| < 0.05 → the light runs down the street (no cross line).
 *
 * Validation gates (run via Node — see report_13):
 *   sunset Stockholm 2026-08-03 = 21:09 local (fieldwalk anchor)
 *   2026-08-03 15:53:37 local @ 59.31901,18.07093 → az 237.55°, alt 37.01° (±0.1°)
 *
 * Same UMD + Europe/Stockholm conventions as /light/solar.js.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Canyon = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LAT = 59.319, LON = 18.071;           // Södermalm
  var TZ = 'Europe/Stockholm';
  var MIN_MS = 60000, DAY_MS = 86400000;
  var RAD = Math.PI / 180;

  /* ---------- solar position: azimuth + altitude (NOAA, Julian-day form) ---------- */
  function solarPos(ms, lat, lon) {
    lat = (lat == null) ? LAT : lat; lon = (lon == null) ? LON : lon;
    var jd = ms / DAY_MS + 2440587.5;                    // Unix ms → Julian day
    var T = (jd - 2451545.0) / 36525.0;
    var L0 = ((280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360 + 360) % 360;
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var Mr = M * RAD;
    var C = (1.914602 - T * (0.004817 + 0.000014 * T)) * Math.sin(Mr)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) + 0.000289 * Math.sin(3 * Mr);
    var trueLong = L0 + C;
    var omega = 125.04 - 1934.136 * T;
    var lam = (trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD)) * RAD;
    var eps0 = 23 + (26 + (21.448 - T * (46.8150 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var eps = (eps0 + 0.00256 * Math.cos(omega * RAD)) * RAD;
    var decl = Math.asin(Math.sin(eps) * Math.sin(lam));
    var y = Math.tan(eps / 2) * Math.tan(eps / 2);
    var L0r = L0 * RAD;
    var Etime = 4 / RAD * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr)
              + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
              - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
    var d = new Date(ms);
    var minutesUTC = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    var tst = ((minutesUTC + Etime + 4 * lon) % 1440 + 1440) % 1440;
    var ha = (tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180) * RAD;
    var latR = lat * RAD;
    var cosZen = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
    var zen = Math.acos(Math.max(-1, Math.min(1, cosZen)));
    var alt = 90 - zen / RAD;
    var az = ((Math.atan2(Math.sin(ha),
              Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)) / RAD) + 180) % 360;
    return { az: az, alt: alt };
  }

  /* ---------- the canyon ---------- */
  // state at instant ms for street {axisDeg, w (m), H (m)}
  // side: which facade carries the line, as seen in a section looking DOWN-AXIS:
  //   sun azimuth left of axis → rays strike the right facade, and vice versa.
  function lineAt(ms, street) {
    var p = solarPos(ms);
    if (p.alt <= -0.833) return { state: 'night', alt: p.alt, az: p.az };
    var delta = (p.az - street.axisDeg) * RAD;
    var s = Math.sin(delta);
    if (Math.abs(s) < 0.05) return { state: 'axial', alt: p.alt, az: p.az };
    var h = street.H - street.w * Math.tan(p.alt * RAD) / Math.abs(s);
    return {
      state: h <= 0 ? 'full-sun' : (h >= street.H ? 'dark' : 'line'),
      h: Math.max(0, Math.min(street.H, h)),
      side: s > 0 ? 'right' : 'left',
      alt: p.alt, az: p.az
    };
  }

  // next narrative event after ms (48 h scan, minute steps):
  // pavement loses the sun (full-sun → line) · wall goes dark (→ dark/night)
  // · sun returns to a wall (night/dark/axial → line/full-sun)
  function nextEvent(ms, street) {
    var base = Math.floor(ms / MIN_MS) * MIN_MS;
    var prev = lineAt(base, street);
    for (var i = 1; i <= 48 * 60; i++) {
      var t = base + i * MIN_MS;
      var cur = lineAt(t, street);
      var was = prev.state, is = cur.state;
      if (was !== is) {
        if (was === 'full-sun' && is === 'line') return { atMs: t, kind: 'shade-reaches-pavement' };
        if (is === 'dark' || is === 'night') {
          if (was === 'line' || was === 'full-sun') return { atMs: t, kind: 'wall-goes-dark' };
        }
        if ((was === 'night' || was === 'dark' || was === 'axial') && (is === 'line' || is === 'full-sun'))
          return { atMs: t, kind: 'sun-returns' };
        if ((was === 'line' || was === 'full-sun') && is === 'axial')
          return { atMs: t, kind: 'light-turns-axial' };
        if (was === 'line' && is === 'full-sun') return { atMs: t, kind: 'pavement-regains-sun' };
      }
      prev = cur;
    }
    return null;
  }

  /* ---------- Europe/Stockholm plumbing (subset of /light/solar.js) ---------- */
  var _p = null;
  function sthlmParts(ms) {
    _p = _p || new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    var o = {}; _p.formatToParts(new Date(ms)).forEach(function (x) { o[x.type] = x.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour === 24 ? 0 : +o.hour), mi: +o.minute };
  }
  function offsetAt(ms) {
    var p = sthlmParts(ms);
    return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ms / MIN_MS) * MIN_MS;
  }
  function wallToUTC(y, mo, d, h, mi) {
    var target = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
    var guess = target - offsetAt(target);
    return target - offsetAt(guess);
  }
  var _t = null;
  function fmtTime(ms) {
    _t = _t || new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    return _t.format(new Date(ms));
  }

  // "2¾ floors" — quarter-floor precision, 3.0 m per floor
  var QUARTERS = ['', '¼', '½', '¾'];
  function fmtFloors(hMeters) {
    var q = Math.round(hMeters / 3.0 * 4);
    var whole = Math.floor(q / 4), frac = QUARTERS[q % 4];
    if (whole === 0 && !frac) return 'the pavement';
    if (whole === 0) return frac + ' of a floor';
    return whole + frac + (whole === 1 && !frac ? ' floor' : ' floors');
  }

  return {
    LAT: LAT, LON: LON, TZ: TZ,
    solarPos: solarPos, lineAt: lineAt, nextEvent: nextEvent,
    sthlmParts: sthlmParts, wallToUTC: wallToUTC, fmtTime: fmtTime, fmtFloors: fmtFloors
  };
});
