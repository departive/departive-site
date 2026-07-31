/* LINER NOTES — features.js
   Image → seven features → quantized vector → FNV-1a 32-bit seed.
   Implements SEED_MAPPING §1 and §3 exactly:
     L    mean luminance (0–1)
     C    RMS contrast (std of luminance)
     T    warmth: mean(R−B) normalized to −1…+1
     S    mean saturation (HSL, 0–1)
     E    edge density: Sobel magnitude > threshold, fraction of pixels
     Hdom dominant hue family: largest of 8 hue buckets; S < 0.08 counts
          into a NEUTRAL bucket (index 8)
     V    vertical energy bias: mean |∇y| − mean |∇x|
   Seed hashes the QUANTIZED vector (12 steps per feature), not raw pixels,
   so a re-exported/recompressed copy of the same photo maps to the same
   record.
   Documented constants not fixed by the spec (reported in PHASE0_REPORT):
   Sobel gradients normalized by 4; edge threshold 0.15; V clamped to
   ±0.25 before quantization.

   Classic script + CommonJS guard. Browser: window.LN_FEATURES.
*/
(function (root) {
  'use strict';

  var SIZE = 64;              // downsample grid (SEED_MAPPING §1)
  var EDGE_THRESHOLD = 0.15;  // documented choice
  var NEUTRAL_S = 0.08;       // spec: greys counted by S < 0.08
  var V_CLAMP = 0.25;         // documented choice

  /* ---- FNV-1a 32-bit over a byte array ---- */
  function fnv1a(bytes) {
    var h = 0x811c9dc5;
    for (var i = 0; i < bytes.length; i++) {
      h ^= bytes[i] & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /* ---- compute the seven features from RGBA pixel data (w×h) ---- */
  function computeFeatures(data, w, h) {
    var n = w * h;
    var lum = new Float64Array(n);
    var sumL = 0, sumT = 0, sumS = 0;
    var hueBuckets = new Float64Array(9); // 8 hue families + NEUTRAL (8)

    for (var i = 0; i < n; i++) {
      var r = data[i * 4] / 255, g = data[i * 4 + 1] / 255, b = data[i * 4 + 2] / 255;
      var l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum[i] = l;
      sumL += l;
      sumT += (r - b); // warmth term, already in −1…+1 per pixel
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var lightness = (max + min) / 2;
      var sat = 0;
      if (max !== min) {
        var d = max - min;
        sat = lightness > 0.5 ? d / (2 - max - min) : d / (max + min);
      }
      sumS += sat;
      if (sat < NEUTRAL_S) {
        hueBuckets[8]++;
      } else {
        var hue;
        var dd = max - min;
        if (max === r) hue = ((g - b) / dd) % 6;
        else if (max === g) hue = (b - r) / dd + 2;
        else hue = (r - g) / dd + 4;
        hue = (hue * 60 + 360) % 360;
        hueBuckets[Math.min(7, Math.floor(hue / 45))]++;
      }
    }

    var L = sumL / n;
    var T = sumT / n;
    var S = sumS / n;

    var varSum = 0;
    for (i = 0; i < n; i++) { var dL = lum[i] - L; varSum += dL * dL; }
    var C = Math.sqrt(varSum / n);

    // Sobel on the luminance grid (borders skipped), gradients normalized by 4
    var edgeCount = 0, sumGx = 0, sumGy = 0, inner = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i00 = (y - 1) * w + (x - 1), i01 = (y - 1) * w + x, i02 = (y - 1) * w + (x + 1);
        var i10 = y * w + (x - 1), i12 = y * w + (x + 1);
        var i20 = (y + 1) * w + (x - 1), i21 = (y + 1) * w + x, i22 = (y + 1) * w + (x + 1);
        var gx = (lum[i02] + 2 * lum[i12] + lum[i22] - lum[i00] - 2 * lum[i10] - lum[i20]) / 4;
        var gy = (lum[i20] + 2 * lum[i21] + lum[i22] - lum[i00] - 2 * lum[i01] - lum[i02]) / 4;
        sumGx += Math.abs(gx);
        sumGy += Math.abs(gy);
        if (Math.sqrt(gx * gx + gy * gy) > EDGE_THRESHOLD) edgeCount++;
        inner++;
      }
    }
    var E = inner ? edgeCount / inner : 0;
    var V = inner ? (sumGy / inner) - (sumGx / inner) : 0;

    var Hdom = 8;
    var best = -1;
    for (i = 0; i < 9; i++) if (hueBuckets[i] > best) { best = hueBuckets[i]; Hdom = i; }

    return { L: L, C: C, T: T, S: S, E: E, Hdom: Hdom, V: V };
  }

  /* ---- quantization: each continuous feature to 12 steps (§3) ---- */
  function q12(v) { // v expected 0..1
    var c = Math.max(0, Math.min(1, v));
    return Math.min(11, Math.floor(c * 12));
  }
  function quantize(f) {
    return [
      q12(f.L),
      q12(f.C * 2),                         // C practically ≤ 0.5; spread over range
      q12((f.T + 1) / 2),
      q12(f.S),
      q12(f.E),
      f.Hdom & 0xff,                        // already discrete 0..8
      q12((Math.max(-V_CLAMP, Math.min(V_CLAMP, f.V)) + V_CLAMP) / (2 * V_CLAMP))
    ];
  }

  function seedFromFeatures(f) {
    return fnv1a(quantize(f));
  }

  /* ---- browser path: image element/bitmap → 64×64 canvas → features ---- */
  function featuresFromDrawable(drawable) {
    var canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!canvas) throw new Error('featuresFromDrawable requires a DOM (use computeFeatures in Node)');
    canvas.width = SIZE; canvas.height = SIZE;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(drawable, 0, 0, SIZE, SIZE); // aspect-agnostic squash (SEED_MAPPING §4)
    var img = ctx.getImageData(0, 0, SIZE, SIZE);
    var f = computeFeatures(img.data, SIZE, SIZE);
    return { features: f, seed: seedFromFeatures(f) };
  }

  var api = {
    SIZE: SIZE,
    EDGE_THRESHOLD: EDGE_THRESHOLD,
    fnv1a: fnv1a,
    computeFeatures: computeFeatures,
    quantize: quantize,
    seedFromFeatures: seedFromFeatures,
    featuresFromDrawable: featuresFromDrawable
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LN_FEATURES = api;
})(typeof self !== 'undefined' ? self : this);
