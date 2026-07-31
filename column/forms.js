/* THE COLUMN — forms.js
   Form catalog per PHASE0_BUILD_PROMPT.md (attributes BINDING) + flat SVG
   silhouettes (the craft deliverable): thin ink stroke, tone as fill, one
   interior line per form, archetypal — never product-like.

   Loading pattern: classic script + UMD-style export. Attaches to
   window.COLUMN in the browser (zero build, works from file:// and any
   static host) and exports via module.exports for the Node test harness.

   Shape family conventions (all forms share these, viewBox 0 0 100 120):
   - one closed outline path (`d`), one interior stroke path (`line`)
   - hard forms use straight segments and crisp corners; soft forms use
     cubic curves and rounded shoulders
   - tops: neck ~y14, hem encodes mass/length; bottoms: waist y16 hem ~104;
   - footwear: side profile, facing right; accents: object silhouettes
   - stroke-width 2 in the 100×120 space at every weight — one ink. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.COLUMN = root.COLUMN || {};
  root.COLUMN.forms = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* The 7-tone strip — §1.3. Order is the adjacency order. */
  var TONES = ['BLACK', 'GREY', 'ECRU', 'NAVY', 'OLIVE', 'BROWN', 'COGNAC'];
  var TONE_FILL = {
    BLACK: '#191a1e', GREY: '#82817b', ECRU: '#d9cfb6', NAVY: '#2e3b55',
    OLIVE: '#585e3e', BROWN: '#53402d', COGNAC: '#a86f3d'
  };

  var SLOTS = ['outer', 'mid', 'base', 'bottoms', 'footwear', 'accent'];
  var REQUIRED = ['outer', 'base', 'bottoms', 'footwear'];
  var MODES = ['TA', 'TS', 'SM', 'NS'];
  var MODE_NAMES = {
    TA: 'TACTICAL ARCHITECT', TS: 'TACTILE SCULPTOR',
    SM: 'SCULPTURAL MINIMALIST', NS: 'NOCTURNAL SHIELD'
  };

  /* f(id, label, hs, vol, mass, statement, sheen, [TA,TS,SM,NS], d, line) */
  function f(id, label, hs, vol, mass, st, sh, modes, d, line) {
    return { id: id, label: label, hs: hs, vol: vol, mass: mass,
             statement: !!st, sheen: !!sh,
             modes: { TA: modes[0], TS: modes[1], SM: modes[2], NS: modes[3] },
             d: d, line: line };
  }

  var CATALOG = {
    outer: [
      f('mac_coat', 'mac coat', 'H', 'L', 'm', 0, 1, [2, 0, 2, 1],
        // clean knee-length column, shallow neck, straight fall; offset fly
        'M38,14 C43,20 57,20 62,14 L80,21 L86,76 L75,78 L69,38 L69,104 L31,104 L31,38 L25,78 L14,76 L20,21 Z',
        'M56,26 L56,101'),
      f('field_jacket', 'field jacket', 'H', 'S', 'm', 0, 0, [3, 0, 0, 1],
        // boxy, collar points, squared hem; one bar where the pockets sit
        'M35,13 L39,20 C44,24 56,24 61,20 L65,13 L82,22 L88,72 L76,74 L71,40 L71,84 L29,84 L29,40 L24,74 L12,72 L18,22 Z',
        'M34,47 L66,47'),
      f('wool_overcoat', 'wool overcoat', 'S', 'V', 'h', 0, 0, [0, 2, 1, 2],
        // generous, soft shoulders, long fall; lapel V as the interior line
        'M37,14 C43,21 57,21 63,14 C72,16 79,20 82,25 C88,43 90,62 88,80 L77,82 C73,62 72,48 72,40 C73,64 74,86 75,108 L25,108 C26,86 27,64 28,40 C28,48 27,62 23,82 L12,80 C10,62 12,43 18,25 C21,20 28,16 37,14 Z',
        'M42,16 L50,36 L58,16'),
      f('puffer', 'puffer', 'S', 'V', 'h', 1, 1, [0, 1, 0, 3],
        // pure lobed mass, nipped at the quilt channels; one channel drawn
        'M36,12 C43,17 57,17 64,12 C76,15 84,22 85,31 C88,39 87,46 83,50 C88,55 88,64 84,69 C88,74 87,82 82,87 C73,93 27,93 18,87 C13,82 12,74 16,69 C12,64 12,55 17,50 C13,46 12,39 15,31 C16,22 24,15 36,12 Z',
        'M17,50 C35,57 65,57 83,50'),
      f('chore_coat', 'chore coat', 'H', 'S', 'm', 0, 0, [2, 1, 1, 0],
        // plain box, round collarless neck, straight hem; centre placket
        'M37,15 C43,21 57,21 63,15 L81,22 L86,73 L75,75 L70,40 L70,86 L30,86 L30,40 L25,75 L14,73 L19,22 Z',
        'M50,25 L50,84'),
      f('long_shield_coat', 'long shield coat', 'H', 'L', 'h', 0, 1, [1, 0, 1, 3],
        // severe full-length, tall funnel collar; off-centre storm seam
        'M39,8 C44,12 56,12 61,8 L63,17 L79,22 L84,80 L73,82 L69,38 L69,112 L31,112 L31,38 L27,82 L16,80 L21,22 L37,17 Z',
        'M58,24 L58,110')
    ],
    mid: [
      f('crew_knit', 'crew knit', 'S', 'S', 'm', 0, 0, [0, 3, 1, 1],
        // soft shoulders, easy fall; doubled neck rib
        'M37,16 C43,23 57,23 63,16 C71,18 77,21 80,25 C85,45 86,65 84,82 L73,84 C70,66 69,50 69,42 L69,92 L31,92 L31,42 C31,50 30,66 27,84 L16,82 C14,65 15,45 20,25 C23,21 29,18 37,16 Z',
        'M39,19 C44,25 56,25 61,19'),
      f('hoodie', 'hoodie', 'S', 'V', 'm', 0, 0, [1, 1, 0, 2],
        // hood dome above the shoulders; inner hood opening as the line
        'M32,20 C30,7 70,7 68,20 L80,26 C86,46 87,64 84,80 L72,82 C70,66 70,52 70,44 L70,94 L30,94 L30,44 C30,52 30,66 28,82 L16,80 C13,64 14,46 20,26 Z',
        'M39,19 C40,10 60,10 61,19'),
      f('overshirt', 'overshirt', 'H', 'S', 'm', 0, 0, [2, 1, 1, 1],
        // squared shirt-jacket, collar points; buttoned placket
        'M36,13 L40,19 C45,23 55,23 60,19 L64,13 L81,22 L85,72 L74,74 L70,40 L70,94 L30,94 L30,40 L26,74 L15,72 L19,22 Z',
        'M50,24 L50,92'),
      f('fine_roll_neck', 'fine roll-neck', 'S', 'L', 'l', 0, 0, [0, 1, 3, 2],
        // tall slim collar, narrow fall; collar fold line
        'M42,6 C46,8 54,8 58,6 L58,16 L74,22 C78,42 78,62 76,80 L67,81 C65,64 64,50 64,42 L64,90 L36,90 L36,42 C36,50 35,64 33,81 L24,80 C22,62 22,42 26,22 L42,16 Z',
        'M42,12 L58,12'),
      f('fleece', 'fleece', 'S', 'V', 'm', 1, 0, [0, 3, 0, 1],
        // deep pile box, funnel collar; yoke seam across the chest
        'M36,10 C42,14 58,14 64,10 L66,18 L82,24 C87,44 87,62 84,78 L72,80 C70,64 70,50 70,44 L70,90 L30,90 L30,44 C30,50 30,64 28,80 L16,78 C13,62 13,44 18,24 L34,18 Z',
        'M30,38 C40,42 60,42 70,38'),
      f('tailored_waistcoat', 'tailored waistcoat', 'H', 'L', 'l', 0, 0, [1, 0, 2, 1],
        // deep V, pointed double hem; button line to the notch
        'M40,14 L50,40 L60,14 L70,18 L72,50 L68,88 L58,92 L50,84 L42,92 L32,88 L28,50 L30,18 Z',
        'M50,46 L50,80')
    ],
    base: [
      f('tee', 'tee', 'S', 'S', 'l', 0, 0, [1, 1, 1, 1],
        // the archetype: short sleeve, even fall; neck rib
        'M38,18 C44,25 56,25 62,18 L79,26 L85,48 L72,53 L68,40 L68,94 L32,94 L32,40 L28,53 L15,48 L21,26 Z',
        'M40,20 C45,25 55,25 60,20'),
      f('heavy_boxy_tee', 'heavy boxy tee', 'S', 'V', 'm', 0, 0, [1, 2, 0, 1],
        // dropped shoulder, wide and short; one press fold across the body
        'M36,16 C43,23 57,23 64,16 L84,26 L89,50 L75,55 L72,42 L72,90 L28,90 L28,42 L25,55 L11,50 L16,26 Z',
        'M30,58 L70,58'),
      f('oxford_shirt', 'oxford shirt', 'H', 'S', 'l', 0, 0, [1, 0, 2, 0],
        // collar points, long sleeve, curved shirt hem; placket
        'M37,12 L40,18 C45,22 55,22 60,18 L63,12 L78,21 L82,74 L71,76 L68,40 L68,92 C60,97 40,97 32,92 L32,40 L29,76 L18,74 L22,21 Z',
        'M50,22 L50,93'),
      f('knit_tee', 'knit tee', 'S', 'S', 'l', 0, 0, [0, 2, 2, 1],
        // tee softened throughout, rounded sleeve; ribbed hem line
        'M38,18 C44,26 56,26 62,18 C70,20 76,23 78,27 C82,42 82,48 80,52 L70,56 C68,46 68,42 68,40 L68,92 L32,92 L32,40 C32,42 32,46 30,56 L20,52 C18,48 18,42 22,27 C24,23 30,20 38,18 Z',
        'M33,87 L67,87'),
      f('band_graphic_tee', 'band / graphic tee', 'S', 'S', 'l', 1, 0, [1, 1, 0, 2],
        // tee silhouette; the statement is the abstract print block
        'M38,18 C44,25 56,25 62,18 L79,26 L85,48 L72,53 L68,40 L68,94 L32,94 L32,40 L28,53 L15,48 L21,26 Z',
        'M38,44 L62,44 L62,66 L38,66 Z'),
      f('zip_base', 'zip base', 'H', 'L', 'l', 0, 1, [2, 0, 1, 2],
        // stand collar, close linear body; the zip runs the full column
        'M40,12 C45,15 55,15 60,12 L61,18 L76,23 L80,76 L70,78 L66,42 L66,92 L34,92 L34,42 L30,78 L20,76 L24,23 L39,18 Z',
        'M50,15 L50,90')
    ],
    bottoms: [
      f('wide_trouser', 'wide trouser', 'S', 'V', 'm', 0, 0, [0, 2, 2, 1],
        // full-width fall, straight to the floor; waistband
        'M30,16 L70,16 L76,104 L54,104 L50,48 L46,104 L24,104 Z',
        'M30,23 L70,23'),
      f('straight_jean', 'straight jean', 'H', 'S', 'm', 0, 0, [2, 1, 1, 1],
        // even straight leg; fly curve
        'M33,16 L67,16 L70,104 L55,104 L50,46 L45,104 L30,104 Z',
        'M50,18 C50,26 46,29 46,35'),
      f('cargo', 'cargo', 'H', 'V', 'h', 1, 0, [3, 0, 0, 1],
        // wide utility leg; the bellows pocket is the statement
        'M31,16 L69,16 L75,104 L53,104 L50,46 L47,104 L25,104 Z',
        'M30,58 L44,58 L45,76 L31,76 Z'),
      f('tailored_trouser', 'tailored trouser', 'H', 'L', 'm', 0, 0, [1, 0, 3, 1],
        // slim, exact; pressed creases
        'M35,16 L65,16 L66,104 L54,104 L50,44 L46,104 L34,104 Z',
        'M41,30 L40,102 M59,30 L60,102'),
      f('relaxed_jean', 'relaxed jean', 'S', 'V', 'm', 0, 0, [1, 2, 0, 1],
        // full through the seat, soft taper; waistband
        'M31,16 L69,16 L72,78 C72,92 70,104 67,104 L52,104 L50,48 L48,104 L33,104 C30,104 28,92 28,78 Z',
        'M31,23 L69,23'),
      f('track_pant', 'track pant', 'S', 'S', 'l', 0, 1, [1, 1, 0, 2],
        // tapered to a cuffed ankle; side stripe
        'M34,16 L66,16 L62,92 L61,102 L53,102 L54,92 L50,46 L46,92 L47,102 L39,102 L38,92 Z',
        'M64,20 L60,90')
    ],
    footwear: [
      f('low_profile_sneaker', 'low-profile sneaker', 'H', 'L', 'l', 0, 0, [1, 0, 3, 1],
        // slim wedge: heel collar, ankle dip, long low toe; thin sole line
        'M13,80 L12,71 L15,58 C17,53 22,52 25,55 L31,59 L35,57 C39,52 45,52 49,55 C61,60 75,66 85,71 L88,74 L88,80 Z',
        'M12,73 C38,76 68,76 88,74'),
      f('heavy_sneaker', 'heavy sneaker', 'H', 'V', 'h', 0, 0, [2, 1, 0, 2],
        // tall padded upper on a stacked slab; midsole line
        'M15,70 L14,53 C16,46 22,44 27,47 L33,51 L37,48 C43,44 51,44 57,47 C68,52 78,58 86,64 L90,68 L91,80 C66,86 30,86 12,81 L11,71 Z',
        'M11,72 C36,76 68,75 91,71'),
      f('chelsea', 'chelsea', 'H', 'L', 'm', 0, 1, [1, 1, 2, 2],
        // slim ankle shaft, elongated clean toe; elastic gusset line
        'M18,80 L20,44 C23,39 36,39 39,43 L41,58 C55,60 69,65 79,70 C83,73 85,76 85,80 Z',
        'M29,46 L31,63'),
      f('derby', 'derby', 'H', 'L', 'm', 0, 0, [1, 0, 3, 0],
        // low and exact: heel block, laced instep; quarter line
        'M16,80 L15,73 L17,61 C19,56 25,54 30,57 L36,60 L40,57 C45,54 51,55 55,58 C65,62 76,68 83,72 L86,75 L86,80 Z',
        'M38,59 C42,64 48,66 54,65'),
      f('boot', 'boot', 'H', 'S', 'h', 0, 0, [2, 1, 0, 2],
        // straight shaft, weighted sole slab; welt line
        'M20,81 L23,36 L45,36 L47,56 C58,58 70,63 80,68 L85,72 L86,82 C60,86 32,86 18,83 Z',
        'M19,76 C46,80 68,78 86,75'),
      f('statement_runner', 'statement runner', 'H', 'V', 'h', 1, 1, [1, 1, 0, 2],
        // sculpted oversized sole — the loud one; midsole ridge
        'M16,66 L18,48 C22,42 30,40 38,44 L44,48 C57,52 71,58 82,64 L92,68 C96,73 95,80 88,83 C78,88 66,84 56,87 C44,90 32,90 20,86 C10,83 7,72 16,66 Z',
        'M12,79 C30,71 56,84 90,73')
    ],
    accent: [
      f('beanie', 'beanie', 'S', 'S', 'l', 0, 0, [1, 2, 1, 1],
        // soft dome; folded band
        'M28,66 C28,40 72,40 72,66 L72,76 L28,76 Z',
        'M28,64 L72,64'),
      f('cap', 'cap', 'H', 'S', 'l', 0, 0, [2, 0, 0, 1],
        // profile crown and brim; crown seam
        'M26,68 C24,48 56,40 68,54 L70,62 L88,64 C92,66 92,70 86,70 L26,70 Z',
        'M48,42 C54,48 58,54 60,62'),
      f('scarf', 'scarf', 'S', 'V', 'm', 0, 0, [0, 3, 1, 0],
        // looped once, two uneven diverging falls; fold line through the loop
        'M32,26 C32,15 68,15 68,26 C68,34 64,39 58,42 L63,92 L51,93 L53,45 C51,42 49,42 47,45 L49,93 L37,95 L42,42 C36,39 32,34 32,26 Z',
        'M38,25 C43,31 57,31 62,25'),
      f('tote', 'tote', 'S', 'S', 'm', 0, 0, [1, 1, 1, 0],
        // flat body, two wide handles; top fold
        'M30,46 L34,46 C33,26 49,26 48,46 L52,46 C51,26 67,26 66,46 L70,46 L74,92 L26,92 Z',
        'M29,53 L71,53'),
      f('crossbody', 'crossbody', 'H', 'S', 'l', 1, 1, [2, 0, 0, 2],
        // small hard case, the long strap crossing — the loud accent; flap line
        'M28,56 L72,56 L74,86 L26,86 Z M32,56 L68,14 L75,19 L41,56 Z',
        'M27,66 L73,66'),
      f('watch', 'watch', 'H', 'L', 'l', 0, 1, [1, 0, 2, 1],
        // case and strap, face-on; hands
        'M42,18 L58,18 L58,45 L42,45 Z M42,75 L58,75 L58,102 L42,102 Z M34,60 A16,16 0 1 0 66,60 A16,16 0 1 0 34,60 Z',
        'M50,60 L50,50 M50,60 L58,63')
    ]
  };

  function getForm(slot, id) {
    var list = CATALOG[slot];
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Dev-mode catalog assertions — table invariants, run by rules.js in dev. */
  function assertCatalog() {
    var fail = function (m) { throw new Error('COLUMN catalog assertion: ' + m); };
    if (SLOTS.length !== 6) fail('six slots');
    SLOTS.forEach(function (slot) {
      var list = CATALOG[slot];
      if (!list || list.length !== 6) fail(slot + ': six forms required');
      var stars = 0, seen = {};
      list.forEach(function (fm) {
        if (seen[fm.id]) fail('duplicate id ' + fm.id); seen[fm.id] = 1;
        if (fm.hs !== 'H' && fm.hs !== 'S') fail(fm.id + ': hs');
        if ('LSV'.indexOf(fm.vol) < 0) fail(fm.id + ': volume');
        if ('lmh'.indexOf(fm.mass) < 0) fail(fm.id + ': mass');
        MODES.forEach(function (m) {
          var w = fm.modes[m];
          if (typeof w !== 'number' || w < 0 || w > 3) fail(fm.id + ': mode weight ' + m);
        });
        if (fm.statement) stars++;
        if (!fm.d || !fm.line) fail(fm.id + ': silhouette paths');
      });
      if (stars !== 1) fail(slot + ': exactly one statement variant (found ' + stars + ')');
    });
    return true;
  }

  return {
    TONES: TONES, TONE_FILL: TONE_FILL, SLOTS: SLOTS, REQUIRED: REQUIRED,
    MODES: MODES, MODE_NAMES: MODE_NAMES, CATALOG: CATALOG,
    getForm: getForm, assertCatalog: assertCatalog
  };
});
