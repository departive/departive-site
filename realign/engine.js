/*
 * THE REALIGNMENT — engine.js
 * The arithmetic and the audio. No recordings, no samples — every sound
 * is synthesized here (two click timbres + a realignment thunk), which
 * is the entire rights posture of this instrument.
 *
 * Model: two rings tick at the same tick-rate. Outer = pulse, N ticks
 * per revolution; inner = riff, M ticks per revolution, with an accent
 * pattern (subset of tick indices). They realign every LCM(M,N) ticks
 * = LCM/N pulse bars. Presets carry only factual arithmetic.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Realign = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function gcd(a, b) { while (b) { var t = b; b = a % b; a = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }

  /* ---------- presets: factual arithmetic only (labels read-back gated) ---------- */
  var PRESETS = [
    { id: 'rg',   label: '25 against 16', pulse: 16, riff: 25, accents: [0, 6, 10, 13, 16, 20], note: 'grouping 6+4+3+3+4+5', bpm: 100 },
    { id: 'herta',label: '23 against 16', pulse: 16, riff: 23, accents: [0, 3, 6, 8, 11, 14, 17, 19], note: 'herta-cell family · MOCK until transcription', bpm: 115 },
    { id: 'schism', label: '5+7 against 8', pulse: 8, riff: 12, accents: [0, 5], note: 'the “6½/8” alternation', bpm: 108 },
    { id: '987',  label: '9 · 8 · 7', pulse: 8, riff: 24, accents: [0, 9, 17], note: 'the descending chorus', bpm: 96 }
  ];

  function periodTicks(pulse, riff) { return lcm(pulse, riff); }
  function periodBars(pulse, riff) { return periodTicks(pulse, riff) / pulse; }

  /* ---------- audio: WebAudio, gesture-gated, all ours ---------- */
  var ctx = null, master = null, muted = false;
  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // soft wood tick: filtered noise burst
  function tickPulse(at) {
    if (muted) return;
    var c = ensureCtx(), n = c.createBufferSource(), len = 0.018;
    var buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    n.buffer = buf;
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 1.4;
    var g = c.createGain(); g.gain.value = 0.5;
    n.connect(f); f.connect(g); g.connect(master); n.start(at);
  }
  // riff accent: harder click (short square blip through highpass)
  function tickRiff(at) {
    if (muted) return;
    var c = ensureCtx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 3100;
    g.gain.setValueAtTime(0.28, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.035);
  }
  // realignment: low thunk
  function thunk(at) {
    if (muted) return;
    var c = ensureCtx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(180, at); o.frequency.exponentialRampToValueAtTime(52, at + 0.16);
    g.gain.setValueAtTime(0.7, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.24);
  }
  function setMuted(m) { muted = m; }

  /* ---------- transport: lookahead scheduler (the standard WebAudio clock) ---------- */
  function Transport(state, onTick) {
    // state: {pulse, riff, accents, bpm}; tick duration = beat/ (riff ticks per bar? )
    // Convention: the PULSE ring's tick = one beat subdivision; both rings share tick rate.
    // bpm counts pulse-ring QUARTER bars (pulse/4 ticks per beat) for musical feel.
    var t = { running: false, tick: 0, nextAt: 0, timer: null };
    function tickDur() { return 60 / state.bpm / (state.pulse / 4); }
    function loop() {
      var c = ensureCtx(), horizon = c.currentTime + 0.12;
      while (t.nextAt < horizon) {
        var period = periodTicks(state.pulse, state.riff);
        var k = t.tick % period;
        if (k % state.pulse === 0) tickPulse(t.nextAt);
        var r = k % state.riff;
        if (state.accents.indexOf(r) >= 0) tickRiff(t.nextAt);
        if (k === 0 && t.tick > 0) thunk(t.nextAt);
        onTick(t.tick, t.nextAt - c.currentTime);
        t.tick++; t.nextAt += tickDur();
      }
      t.timer = setTimeout(loop, 40);
    }
    return {
      start: function () { if (t.running) return; ensureCtx(); t.running = true; t.tick = 0; t.nextAt = ctx.currentTime + 0.06; loop(); },
      stop: function () { t.running = false; clearTimeout(t.timer); },
      running: function () { return t.running; },
      pos: function () { // continuous position in ticks for the animation frame
        if (!t.running || !ctx) return 0;
        return t.tick - 1 + Math.max(0, Math.min(1, 1 - (t.nextAt - ctx.currentTime) / tickDur()));
      }
    };
  }

  return { gcd: gcd, lcm: lcm, PRESETS: PRESETS, periodTicks: periodTicks, periodBars: periodBars,
           Transport: Transport, setMuted: setMuted, ensureCtx: ensureCtx };
});
