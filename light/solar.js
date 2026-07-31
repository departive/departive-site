/*
 * STOCKHOLM LIGHT — solar.js
 * NOAA solar position for Stockholm (59.33° N, 18.07° E).
 * Pure functions, no DOM, no network — this layer never fails; it's math.
 *
 * Phase system per LIGHT_SYSTEM §1:
 *   NIGHT < −6° · BLUE −6°…−0.5° · GOLDEN −0.5°…+6° · DAY > +6°
 *
 * Conventions (shared with the landing-page light ledger):
 *   - the "day" is the Stockholm calendar day (Europe/Stockholm),
 *     regardless of the visitor's timezone;
 *   - all displayed times format in Europe/Stockholm;
 *   - rise/set use the standard −0.833° horizon (refraction + solar radius),
 *     phase thresholds use geometric altitude.
 *
 * Loads in the browser as window.SLSolar and in Node via module.exports
 * (the Node path exists for the unit-test harness).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SLSolar = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LAT = 59.33, LON = 18.07;
  var TZ = 'Europe/Stockholm';
  var DAY_MS = 86400000, MIN_MS = 60000;
  var RAD = Math.PI / 180;

  /* ---------- core: geometric solar elevation (degrees) at a UTC-ms instant ---------- */
  /* NOAA short-form: fractional year -> declination + equation of time -> hour angle.  */
  function elevation(ms) {
    var d = new Date(ms);
    var doy = (ms - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY_MS;
    var hourUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    var g = (2 * Math.PI / 365) * (doy - 1 + (hourUTC - 12) / 24);        // fractional year, rad
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
             - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
             - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);    // declination, rad
    var eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
               - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)); // minutes
    var tst = (hourUTC * 60 + eqtime + 4 * LON + 1440) % 1440;             // true solar time, min
    var ha = (tst / 4 - 180) * RAD;                                        // hour angle, rad
    var lat = LAT * RAD;
    var cosZen = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
    return 90 - Math.acos(Math.max(-1, Math.min(1, cosZen))) / RAD;
  }

  /* ---------- phase derivation (LIGHT_SYSTEM §1) ---------- */
  function phaseOf(alt) {
    if (alt > 6) return 'DAY';
    if (alt > -0.5) return 'GOLDEN';
    if (alt > -6) return 'BLUE';
    return 'NIGHT';
  }

  /* ---------- Europe/Stockholm calendar plumbing (DST-safe, Intl-based) ---------- */
  var _fmtParts = null;
  function sthlmParts(ms) {
    _fmtParts = _fmtParts || new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    var o = {};
    _fmtParts.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: (+o.hour === 24 ? 0 : +o.hour), mi: +o.minute };
  }

  // Stockholm UTC-offset (ms) in effect at instant ms.
  function offsetAt(ms) {
    var p = sthlmParts(ms);
    var wallAsUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    return wallAsUTC - Math.floor(ms / MIN_MS) * MIN_MS;
  }

  // UTC instant of 00:00 Stockholm for the calendar day containing ms.
  // Second pass refines across DST boundaries (offset at midnight, not at ms).
  function dayStartMs(ms) {
    var p = sthlmParts(ms);
    var target = Date.UTC(p.y, p.mo - 1, p.d);
    var guess = target - offsetAt(ms);
    return target - offsetAt(guess);
  }

  // Stockholm wall-clock (y, mo 1–12, d, h, mi) -> UTC ms. Same two-pass refinement.
  function wallToUTC(y, mo, d, h, mi) {
    var target = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
    var guess = target - offsetAt(target);
    return target - offsetAt(guess);
  }

  /* ---------- dev clock: ?t= querystring freezes the clock ----------
   * Accepts "2026-06-21T21:00" (read as Stockholm wall time),
   * or any ISO string with an explicit zone ("...Z", "...+02:00"). */
  function parseFrozen(str) {
    if (!str) return null;
    if (/([zZ]|[+\-]\d\d:?\d\d)$/.test(str)) {
      var t = Date.parse(str);
      return isNaN(t) ? null : t;
    }
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(str);
    if (m) return wallToUTC(+m[1], +m[2], +m[3], +m[4], +m[5]);
    var t2 = Date.parse(str);
    return isNaN(t2) ? null : t2;
  }

  /* ---------- day scan: rise/set, civil twilight, min/max altitude ---------- */
  // 1441 one-minute samples across the Stockholm calendar day starting at startMs.
  function scanDay(startMs) {
    var rise = null, set = null, civilDawn = null, civilDusk = null;
    var minAlt = 90, maxAlt = -90, minAt = startMs, maxAt = startMs;
    var prev = elevation(startMs);
    for (var m = 1; m <= 1440; m++) {
      var t = startMs + m * MIN_MS;
      var e = elevation(t);
      if (!rise && prev < -0.833 && e >= -0.833) rise = t;
      if (prev >= -0.833 && e < -0.833) set = t;
      if (!civilDawn && prev < -6 && e >= -6) civilDawn = t;
      if (prev >= -6 && e < -6) civilDusk = t;
      if (e < minAlt) { minAlt = e; minAt = t; }
      if (e > maxAlt) { maxAlt = e; maxAt = t; }
      prev = e;
    }
    var dayLenMs = (rise && set && set > rise) ? (set - rise) : (maxAlt >= -0.833 ? DAY_MS : 0);
    return {
      startMs: startMs, rise: rise, set: set,
      civilDawn: civilDawn, civilDusk: civilDusk,
      dayLenMs: dayLenMs, minAlt: minAlt, maxAlt: maxAlt, minAt: minAt, maxAt: maxAt
    };
  }

  /* ---------- next phase transition (for the countdown) ---------- */
  // Minute-scan forward up to 48 h; at 59.33° N a transition always occurs well inside that.
  function nextTransition(nowMs) {
    var from = phaseOf(elevation(nowMs));
    var base = Math.floor(nowMs / MIN_MS) * MIN_MS;
    for (var i = 1; i <= 48 * 60; i++) {
      var t = base + i * MIN_MS;
      var p = phaseOf(elevation(t));
      if (p !== from) return { atMs: t, from: from, to: p };
    }
    return null;
  }

  /* ---------- one-call snapshot for the panel ---------- */
  function snapshot(nowMs) {
    var alt = elevation(nowMs);
    var start = dayStartMs(nowMs);
    var today = scanDay(start);
    var yesterday = scanDay(dayStartMs(start - DAY_MS / 2));
    return {
      nowMs: nowMs,
      alt: alt,
      phase: phaseOf(alt),
      next: nextTransition(nowMs),
      today: today,
      // day length vs yesterday — negative in autumn (the melancholy detail; keep it)
      deltaMs: (today.dayLenMs && yesterday.dayLenMs) ? (today.dayLenMs - yesterday.dayLenMs) : null,
      // no astronomical darkness tonight (sun never below −18°): the midsummer condition.
      // NB the stricter civil reading (never below −6°) is unreachable at 59.33° N —
      // the solstice minimum is ≈ −7.2° — see PHASE0 report.
      neverFullyDark: today.minAlt > -18,
      noNightPhase: today.minAlt > -6
    };
  }

  /* ---------- formatters (Europe/Stockholm always) ---------- */
  var _fmtTime = null;
  function fmtTime(ms) {
    _fmtTime = _fmtTime || new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
    return _fmtTime.format(new Date(ms));
  }

  // "1 h 12 m" / "42 m" — countdown to a transition
  function fmtCountdown(ms) {
    var mins = Math.max(1, Math.round(ms / MIN_MS));
    if (mins < 60) return mins + ' m';
    return Math.floor(mins / 60) + ' h ' + (mins % 60) + ' m';
  }

  // "16 h 27 m" — day length
  function fmtDayLen(ms) {
    var mins = Math.round(ms / MIN_MS);
    return Math.floor(mins / 60) + ' h ' + ('0' + (mins % 60)).slice(-2) + ' m';
  }

  // "−2 m 40 s" / "+3 m 05 s" — day-length delta vs yesterday (U+2212 minus)
  function fmtDelta(ms) {
    if (ms == null) return '—';
    var s = Math.round(Math.abs(ms) / 1000);
    var sign = ms < 0 ? '−' : '+';
    return sign + Math.floor(s / 60) + ' m ' + ('0' + (s % 60)).slice(-2) + ' s';
  }

  // "+3.2°" / "−6.1°" — signed altitude, one decimal
  function fmtAlt(deg) {
    var v = Math.abs(deg).toFixed(1);
    return (deg < 0 ? '−' : '+') + v + '°';
  }

  return {
    LAT: LAT, LON: LON, TZ: TZ, DAY_MS: DAY_MS,
    elevation: elevation, phaseOf: phaseOf,
    sthlmParts: sthlmParts, offsetAt: offsetAt, dayStartMs: dayStartMs, wallToUTC: wallToUTC,
    parseFrozen: parseFrozen,
    scanDay: scanDay, nextTransition: nextTransition, snapshot: snapshot,
    fmtTime: fmtTime, fmtCountdown: fmtCountdown, fmtDayLen: fmtDayLen,
    fmtDelta: fmtDelta, fmtAlt: fmtAlt
  };
});
