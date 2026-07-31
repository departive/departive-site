/* LINER NOTES — corpus.js
   Verbatim transcription of CORPUS_NAMES.md, CORPUS_TITLES.md, CORPUS_PROSE.md
   into data structures. NOTHING here is invented, merged, or paraphrased:
   every fragment string below appears in the authored corpus files. Where a
   grammar in the corpus names a pool that was not authored (see the
   PHASE0_REPORT "corpus ambiguities" list), the stopgap draws only from
   authored example atoms and is marked with an AMBIGUITY comment.

   Classic script + CommonJS guard (see report: module-loading choice).
   Browser: window.LN_CORPUS · Node: require('./corpus.js')
*/
(function (root) {
  'use strict';

  /* ============================================================
     NAME POOLS — CORPUS_NAMES §A (transcribed verbatim)
     ============================================================ */
  var firstNames = {
    nordic: ['Åsa', 'Ellen', 'Henrik', 'Marta', 'Nils', 'Ingrid', 'Tove', 'Björn', 'Lisbet', 'Aron'],
    uk: ['Thomas', 'Ruth', 'Alec', 'Margaret', 'Ceri', 'Douglas'],
    de: ['Jürgen', 'Anke', 'Roland', 'Sabine'],
    na: ['Warren', 'Dana', 'Curtis', 'June']
  };

  var surnames = {
    nordic: ['Marklund', 'Lindqvist', 'Bergström', 'Holm', 'Vinter', 'Ek', 'Sandell', 'Åkesson'],
    uk: ['Hargreave', 'Pryce', 'Whitmore', 'Sallis', 'Erskine'],
    // "Richter-adjacent AVOID famous … prefer Ohlmann, Brauer, Wenzel"
    de: ['Kessler', 'Brandt', 'Ohlmann', 'Brauer', 'Wenzel'],
    na: ['Ellison', 'Marsh', 'Colby', 'Vance']
  };
  // AMBIGUITY (reported): pooled surnames total 22 against the §E minimum of
  // 28. Transcribed as authored; the assertion below warns rather than throws
  // for this one pool. Do not add names here without David's sign-off.

  /* ARTIST NAME GRAMMARS — CORPUS_NAMES §A.
     'fixed' pools carry the authored examples verbatim; generative kinds
     ('initials', 'firstSurname', …) implement the authored grammar syntax. */
  var artistGrammars = {
    STARK: [
      { id: 'stark-solo', kind: 'surname', pools: ['nordic', 'de'] },
      // AMBIGUITY (reported): no ConcreteNoun pool authored for the compound
      // grammar; only the two authored examples are used. Weighted low.
      { id: 'stark-solo-project', kind: 'fixed', pool: ['Ironhouse', 'Saltwork'], weight: 0.4 },
      { id: 'stark-band', kind: 'fixed', pool: ['The Turbines', 'Fault Units', 'Kolonn', 'Meridian Locks', 'Drift Committee'] },
      { id: 'stark-initials', kind: 'initials' }
    ],
    TERRAIN: [
      { id: 'terrain-band', kind: 'fixed', pool: ['Kymlinge Pass', 'The Long Fields', 'Norra Berget', 'Half Acre Choir', 'Fell Survey', 'Ridge & Pine'] },
      { id: 'terrain-solo', kind: 'firstSurname', pools: ['nordic', 'uk'], initialChance: 0.3 },
      // "[Place] [Ensemble|Group|Assembly]" — Place drawn from the authored
      // single-word PLACE atoms (see title pools). AMBIGUITY reported.
      { id: 'terrain-collective', kind: 'placeCollective', suffixes: ['Ensemble', 'Group', 'Assembly'] }
    ],
    INTERIOR: [
      { id: 'interior-solo', kind: 'firstSurname', pools: ['nordic', 'uk', 'de', 'na'], initialChance: 0.25, surnameOnlyChance: 0.25 },
      { id: 'interior-project', kind: 'fixed', pool: ['Room Study', 'Glass Index', 'Winter Archive', 'Piano Ledger'] },
      { id: 'interior-duo', kind: 'duo' }
    ],
    CIRCUIT: [
      { id: 'circuit-alias', kind: 'fixed', pool: ['Telemetrist', 'Rasterhaus', 'Modulari', 'Fjärrkontroll', 'Circuitry Dept.', 'Oscilla'] },
      // "[Noun] [Unit|System|Werk]" — nouns are the authored example atoms
      // (Signal, Pattern) plus single-word TECH title atoms. AMBIGUITY reported.
      { id: 'circuit-unit', kind: 'unit', nouns: ['Signal', 'Pattern'], suffixes: ['Unit', 'System', 'Werk'] },
      { id: 'circuit-initialsNumber', kind: 'initialsNumber' }
    ]
  };

  /* ============================================================
     LABEL BANK — CORPUS_NAMES §B (persistent universe, verbatim)
     spans: inclusive year ranges; second span = reissue/archival window.
     ============================================================ */
  var labels = [
    { name: 'FÄLT', city: 'Gothenburg', region: 'nordic', temps: ['TERRAIN', 'INTERIOR'],
      spans: [[1998, 9999]], cat: { prefix: 'FÄLT ', pad: 3, min: 1, max: 120 },
      character: 'field recordings and slow music; sleeves always photographic.' },
    { name: 'Third Hour', city: 'Manchester', region: 'uk', temps: ['INTERIOR'],
      spans: [[1979, 9999]], cat: { prefix: 'THD-', pad: 3, min: 100, max: 199 },
      character: 'insomniac music; famously irregular release schedule.' },
    { name: 'Kolonn', city: 'Stockholm', region: 'nordic', temps: ['STARK'],
      spans: [[1981, 1994]], archival: [2016, 9999], cat: { prefix: 'KOL-', pad: 2, min: 1, max: 34 },
      character: 'post-industrial; matrix numbers hand-etched.', matrixEtched: true },
    { name: 'Ortsband', city: 'Düsseldorf', region: 'de', temps: ['CIRCUIT'],
      spans: [[1974, 9999]], cat: { prefix: 'OR-', pad: 2, min: 1, max: 99 },
      character: 'kosmische lineage; catalog skips numbers without explanation.' },
    { name: 'Ledger & Sons', city: 'Sheffield', region: 'uk', temps: ['STARK', 'TERRAIN'],
      spans: [[1983, 9999]], cat: { prefix: 'LGR ', pad: 3, min: 1, max: 60 },
      character: 'began as a print shop; sleeves letterpressed.' },
    { name: 'Fjärde Våningen', city: 'Malmö', region: 'nordic', temps: ['INTERIOR', 'CIRCUIT'],
      spans: [[2004, 9999]], cat: { prefix: 'FV-', pad: 2, min: 1, max: 60 },
      character: '"fourth floor"; runs of 300, numbered by hand.' },
    { name: 'Meridian Tape Club', city: 'Bergen', region: 'nordic', temps: ['TERRAIN'],
      spans: [[1986, 1991]], archival: [2019, 9999], cat: { prefix: 'MTC C-', pad: 2, min: 1, max: 60 },
      character: 'cassette-only originally; dubbed on two decks in a kitchen.', cassetteOnly: true },
    { name: 'Palindrome', city: 'Chicago', region: 'na', temps: ['CIRCUIT', 'STARK'],
      spans: [[1992, 9999]], cat: { prefix: 'PAL ', pad: 3, min: 1, max: 999, palindrome: true },
      character: 'catalog numbers all palindromes when possible (PAL 101, PAL 111).' },
    { name: 'Under Bark', city: 'Umeå', region: 'nordic', temps: ['TERRAIN'],
      spans: [[2011, 9999]], cat: { prefix: 'UB-', pad: 2, min: 1, max: 40 },
      character: 'forest-adjacent drone; sleeves smell faintly of pine, allegedly.' },
    { name: 'Hourglass Annex', city: 'Toronto', region: 'na', temps: ['INTERIOR'],
      spans: [[1996, 9999]], cat: { prefix: 'HGA-', pad: 3, min: 1, max: 99 },
      character: 'modern classical/tape; every release exactly 44 minutes, by policy.', force44: true }
  ];

  /* PERSONNEL — CORPUS_NAMES §C (conventions consumed by plant.js) */
  var masteringNames = ['Ove Sandell', 'R. Whitmore', 'Anke Brauer', 'D. Vance', 'J. Colby'];
  // "the label" is the 80s-cassette mastering credit ("Dubbed by the label.")
  // `from` gates anachronisms: a place named after a label cannot be credited
  // before that label's authored founding year.
  var studios = [
    { name: 'Studio Ateljén', city: 'Stockholm' },
    { name: 'The Granary', city: 'North Yorkshire' },
    { name: 'Raum 4', city: 'Leipzig' },
    { name: 'Hourglass Annex Room B', city: 'Toronto', labelTie: 'Hourglass Annex', from: 1996 },
    { name: 'Sommarhuset', city: 'Gotland', island: 'Gotland' }
    // + the CIRCUIT self-recorded convention: "{Artist}'s own loft"
    //   (corpus exemplar: "Pattern Unit's own loft") — built in plant.js.
  ];
  var sessionPlayers = ['N. Ek — pedal steel', 'Lisbet Holm — cello', 'A. Pryce — tapes', 'Warren Marsh — modular'];

  // AMBIGUITY (reported): no mastering-house bank authored. Stopgap pool is
  // authored place atoms only.
  var masteringHouses = [
    { name: 'Ledger & Sons', from: 1983 },
    { name: 'Hourglass Annex Room B', from: 1996 },
    { name: 'Raum 4', from: 0 }
  ];

  // AMBIGUITY (reported): no {ARTIST_SPACE} pool authored. Stopgap atoms are
  // spaces named elsewhere in the corpus (kitchen: Meridian Tape Club; loft:
  // Pattern Unit; summer house: Sommarhuset).
  var artistSpaces = ['kitchen', 'loft', 'summer house'];

  var editions = [300, 500]; // "Edition of {300|500}" / "The label pressed {N}"

  /* ============================================================
     TITLE POOLS — CORPUS_TITLES §B (verbatim)
     ============================================================ */
  var titlePools = {
    PLACE: [ // TERRAIN-weighted; ≥30
      'Kymlinge', 'Norra Länken', 'Ravenscar', 'Ödeshög', 'Fell Gate', 'Isfjorden',
      'Marsh Lane', 'Sightline', 'Ryggen', 'The Allotments', 'Vattentornet', 'Haltern',
      'Grain Elevator', 'Skäret', 'County Road 9', 'The Old Ferry Queue', 'Sorsele',
      'Blackthorn Verge', 'Understation', 'Tullhuset', 'Mile 14', 'The North Field',
      'Pumphouse', 'Kilometre Zero', 'Långholmen', // "(VETO if too-real conflicts: keep)"
      'Weir', 'The Passing Place', 'Frost Pocket', 'Signalbron', 'Two Rivers'
    ],
    TECH: [ // STARK+CIRCUIT; ≥30
      'Wow and Flutter', 'Dropout', 'Room Tone', 'Sine Study', 'Insulation', 'Relay',
      'Voltage Divider', 'Dead Air', 'Print-Through', 'Test Card', 'Crosstalk',
      'Headroom', 'Azimuth', 'Signal Path', 'Bias', 'The Return Spring', 'Attenuator',
      'Ground Loop', 'Four-Track Economy', 'Tape Hiss Apology', 'Oscillator Left On',
      'Monitor Mix', 'Spill', 'Patch Notes', 'Slow Attack', 'Gate Time', 'Reel Two',
      'Calibration', 'Second Harmonic', 'Line Level'
    ],
    DOMESTIC: [ // INTERIOR; ≥26
      'The Kitchen Radio', 'Piano Ledger', 'Coat Hooks', 'Windowsill', 'The Spare Key',
      'Enamel Cup', 'Stairwell', 'Blue Door', 'The Heater', 'Curtain Weight',
      'Table for One', 'Glass Index', 'Pilot Light', 'The Landing', 'Winter Coat',
      'Fruit Bowl (Empty)', 'The Good Chair', 'Bookmark', 'Sunday Kitchen',
      'Dust on the Lid', 'Radiator Song', 'The Upstairs Neighbour', 'Small Repairs',
      'Lamp Left On', 'Postcard, Unsent', 'Hallway at Five'
    ],
    FIELDNOTE: [ // TERRAIN+INTERIOR; ≥24
      'First Frost, Late This Year', 'Rain by Nine', 'Snow on the Line',
      'Visibility 400 m', 'Thaw', 'Low Water', 'The Wind From the Sound',
      'Overcast, Still', 'Two Degrees', 'Midsommar, Overheard', 'Black Ice Advisory',
      'Light Until Ten', 'The Dry Month', 'Fog Signals', 'High Pressure',
      'Morning Was Blue', 'After the Gritters', 'Long Shadows at Four',
      'No Wind at the Crossing', 'The Late Ferry', 'Cold Coming In', 'Bright Interval',
      'Ground Frost', 'The Quiet Week'
    ],
    PEOPLE: [ // dedication forms; ≥16
      'For M.', 'Letter to Ruth', "Björn's Waltz", "The Engineer's Daughter",
      'After Sandell', 'Marta, Waving', 'For the Man at the Kiosk', "E.'s Theme",
      "Ove's Loop", 'What Anke Said', 'Portrait, Unfinished', 'The Twins',
      'To the Previous Tenant', "Warren's Turnaround", 'For Two Sisters', 'J.C.'
    ],
    NUMBERS: [ // ≥18 — (the pool's authored preamble aside about "4" is reported as an ambiguity)
      '44 Minutes', '3:41', 'Study II', 'Variation 9', 'The Second Take',
      'Fourteenth Floor', '1971', 'Two of Three', 'Interval', 'Sixty Cycles',
      'The Third Hour', 'Reprise (Slow)', 'Nine Doors', 'Half Speed', 'One Mic',
      'Take 11, Kept', 'Sides', '4/4, Then Not'
    ]
  };

  /* ALBUM TITLE GRAMMARS — CORPUS_TITLES §A.
     Weights: "STARK favors 2,3,5 · TERRAIN 1,6,2 · INTERIOR 4,5,2 · CIRCUIT 3,5,7" */
  var albumGrammars = {
    favored: { STARK: [2, 3, 5], TERRAIN: [1, 6, 2], INTERIOR: [4, 5, 2], CIRCUIT: [3, 5, 7] },
    // grammar 2 authored examples; the pool otherwise draws authored DOMESTIC
    // noun-phrase atoms (AMBIGUITY reported — no album noun/adjective pool).
    nounPhraseExamples: ['Standing Water', 'The Long Room'],
    // grammar 6 atoms
    dateFormExamples: { sessions: '{MONTH} Sessions', minutes: '{N} Minutes' },
    mapScales: ['1:12,000', '1:25,000', '1:50,000'], // authored example + standard map scales; TERRAIN only
    // grammar 7 (90s+ only) — only two authored sentence fragments (reported)
    sentenceFragments: ['We Left the Heater On', 'It Was Lighter Then'],
    seriesNumeralsI_IV: ['I', 'II', 'III', 'IV'],
    variationRange: [2, 9]
  };

  /* ============================================================
     PROSE — CORPUS_PROSE (verbatim; slot markers in braces are bound
     by plant.js — never rendered; see §H veto)
     ============================================================ */
  var prose = {
    OPENING: [
      { t: 'Recorded over two nights in February at {STUDIO}.', needsStudio: true },
      { t: 'Committed to tape in a single sitting, {MONTH} {YEAR}.' },
      { t: 'Assembled from sessions at {STUDIO} and the {ARTIST_SPACE}.', needsStudio: true },
      { t: 'Recorded at home between {MONTH} and {MONTH2}; finished elsewhere.' },
      { t: 'Tracked live to two microphones, no overdubs.' },
      { t: 'Begun as sketches for another record entirely.' },
      { t: 'Recorded in the week the building was sold.' },
      { t: 'Sessions ran from midnight, by preference.' },
      { t: 'Made in the summer house on {ISLAND}, August only.', needsSommarhuset: true },
      { t: 'Cut down from four hours of tape.' },
      { t: 'Recorded twice; the first version is lost.' },
      { t: 'Completed in the order you hear.' },
      { t: 'Taped during the cold snap of {YEAR}.' },
      { t: 'Recorded quickly, mixed slowly.' }
    ],
    BODY: [
      { t: 'The piano was not tuned; this was discussed and then accepted.' },
      { t: 'Everything runs through the same spring reverb, including the voice.' },
      { t: 'The synthesizer was borrowed and has since been returned.' },
      { t: 'Guitars recorded through the practice amp, lid closed.' },
      { t: 'The room did most of the work.' },
      { t: 'Two tape machines, slightly out of agreement, carry the middle third.' },
      { t: 'Percussion is the radiator, mostly.' },
      { t: 'Strings arranged by {PERSON}, who also made the coffee.' },
      { t: 'The organ belongs to the church down the road; used with permission, once.' },
      { t: 'No computer was involved until the very end.', minYear: 1990 },
      { t: 'Most takes are firsts. The seconds were worse.' },
      { t: 'The bass was recorded last, in one afternoon.' },
      { t: 'Half the record is the same four bars, treated differently.' },
      { t: 'Microphones were placed and then not touched for a month.' }
    ],
    ODDITY: [
      { t: "The hum audible at {T} is the studio refrigerator, retained at the artist's insistence.", bindT: true },
      { t: 'Side {AB} plays quieter; this is on the master and is intentional.', needsSides: true },
      { t: "A dog can be heard at the end of '{TRACK}'. Her name was {NAME}.", bindTrack: true, bindName: true },
      { t: "The applause on '{TRACK}' is from a different evening.", bindTrack: true },
      { t: 'Track {N} was recorded in the stairwell after hours.', bindTrackNo: true },
      { t: "The typewriter on '{TRACK}' belonged to the engineer's father.", bindTrack: true },
      { t: '{TSIL} of silence at the close of side A appears as cut.', needsSides: true, bindSilence: true },
      { t: 'The whistling is not credited by request.' },
      { t: 'One channel was lost in transfer; the mono section is the repair.', needsStereo: true },
      { t: "'{TRACK}' uses the last of a discontinued tape stock.", bindTrack: true },
      { t: 'The count-in on track 1 survives because no one minded.' },
      { t: "Rain on the skylight is audible throughout '{TRACK}'; no one waited for it to stop.", bindTrack: true },
      { t: 'The final chord was played by whoever was still in the room.', needsEnsemble: true },
      { t: 'A wrong note at {T} is preserved. It had seniority.', bindT: true },
      { t: 'The bell is the {CITY} tram, passing on schedule.', bindCity: true },
      { t: "'{TRACK}' ends abruptly because the reel did.", bindTrack: true }
    ],
    CLOSE: [
      { t: 'For {INITIAL}.', bindInitial: true },
      { t: 'For the previous tenant.' },
      { t: 'No further sessions are planned.' },
      { t: 'The label pressed {N}; most sold at the shows.', edition: true },
      { t: 'It is quieter than intended, and better for it.' },
      { t: 'Play at low volume, or not.' },
      { t: 'The cover is the view from the desk.', selfRef: true }, // "use ≤30%"
      { t: 'Everything else is on the tape.' },
      { t: 'Thanks are owed and known.' },
      { t: 'A second volume exists in theory.' },
      { t: 'Made for winter; released in June.' },
      { t: 'The band did not reconvene.', needsEnsemble: true },
      { t: 'Nothing here is a metaphor.', no70s: true }, // §F: 70s drops this
      { t: 'Sleeve notes were declined; this is the compromise.' },
      { t: 'Sequence is chronological, roughly.' }
    ],
    PRESSING: [
      { t: 'Edition of {EDITION}, numbered by hand.', edition: true },
      { t: 'First pressing of 500. A second was discussed.', formats: ['LP', '7"'], edition: true },
      { t: 'C-46, chrome tape. Dubbed by the label.', formats: ['CS'] },
      { t: '180 g, clear vinyl. The download code has long expired.', formats: ['LP'], minYear: 2000 },
      { t: 'Lacquer cut by {PERSON} at {HOUSE}.', formats: ['LP', '7"'], minYear: 2000 }, // veto: never on cassette
      { t: "Matrix hand-etched: '{CAT} — {PHRASE}'.", formats: ['LP', '7"'] },
      { t: 'First vinyl issue since {OYEAR}.', reissueOnly: true },
      { t: 'Remastered from the original tapes, {RYEAR}. Gently.', reissueOnly: true },
      { t: 'Sleeve letterpressed at Ledger & Sons.', labelLock: 'Ledger & Sons' },
      { t: 'Exactly 44 minutes, by policy.', labelLock: 'Hourglass Annex' },
      { t: '300 copies. The plates were then retired.', formats: ['LP', '7"'], edition: true },
      { t: 'Catalog number {CAT}. The gap in the sequence is not explained.', labelLock: 'Ortsband' }
    ]
  };

  /* Calendar facts (not corpus fragments) used to bind {MONTH}. */
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  /* ============================================================
     BAN LIST — LINER_NOTES_SYSTEM §2 law 1 (+ "seminal", law 4)
     ============================================================ */
  var banPatterns = [
    /\bechoe?s?\b/i, /\bwhisper/i, /\bshadow/i, /\bsoul(s)?\b/i, /\bdream/i,
    /\bjourney/i, /\bethereal\b/i, /\bhaunt/i, /\btapestr/i,
    /\bsoundscape/i, /\bsonic landscape/i, /\ba meditation on\b/i,
    /\bsorrow\b/i, /\blonging\b/i, /\bjoy\b/i,
    /\bseminal\b/i
  ];
  // AMBIGUITY (reported): the authored FIELDNOTE fragment "Long Shadows at
  // Four" collides with the banned stem "shadow". The corpus is authored and
  // postdates the law; weather-as-fact usage is explicitly preferred by law 2.
  // Stopgap: this exact authored string is whitelisted. Flagged for David.
  var banWhitelist = ['Long Shadows at Four'];

  function banViolations(text) {
    if (text == null) return [];
    var probe = String(text);
    banWhitelist.forEach(function (w) {
      probe = probe.split(w).join('');
    });
    var hits = [];
    banPatterns.forEach(function (re) {
      var m = probe.match(re);
      if (m) hits.push(re.source + ' → "' + m[0] + '"');
    });
    // unbound slot check (CARD_DESIGN §5: never render placeholder braces)
    if (/[{}]/.test(probe)) hits.push('unbound-slot → "' + probe.match(/\{[^}]*\}?/)[0] + '"');
    return hits;
  }

  /* ============================================================
     MINIMUM-POOL ASSERTIONS — CORPUS_NAMES §E + title/prose pool minimums
     Dev-mode check: throws on any shortfall except the known authored
     surname shortfall (22 < 28), which warns (reported ambiguity).
     ============================================================ */
  function assertPools(log) {
    var out = [];
    function count(obj) { return Object.keys(obj).reduce(function (n, k) { return n + obj[k].length; }, 0); }
    function chk(name, actual, min, softKnown) {
      var ok = actual >= min;
      out.push({ pool: name, actual: actual, min: min, ok: ok, soft: !!softKnown });
      if (!ok) {
        var msg = 'corpus pool "' + name + '": ' + actual + ' < minimum ' + min;
        if (softKnown) {
          if (typeof console !== 'undefined') console.warn('LINER NOTES corpus (known authored shortfall, see PHASE0_REPORT): ' + msg);
        } else {
          throw new Error('LINER NOTES corpus: ' + msg);
        }
      }
    }
    chk('first names', count(firstNames), 24);
    chk('surnames', count(surnames), 28, /* known authored shortfall */ true);
    chk('label bank', labels.length, 10);
    chk('studios', studios.length + 1 /* + the CIRCUIT self-loft convention */, 6);
    Object.keys(artistGrammars).forEach(function (t) {
      chk('artist grammars ' + t, artistGrammars[t].length, 3);
    });
    chk('PLACE', titlePools.PLACE.length, 30);
    chk('TECH', titlePools.TECH.length, 30);
    chk('DOMESTIC', titlePools.DOMESTIC.length, 26);
    chk('FIELDNOTE', titlePools.FIELDNOTE.length, 24);
    chk('PEOPLE', titlePools.PEOPLE.length, 16);
    chk('NUMBERS', titlePools.NUMBERS.length, 18);
    chk('prose OPENING', prose.OPENING.length, 14);
    chk('prose BODY', prose.BODY.length, 14);
    chk('prose ODDITY', prose.ODDITY.length, 16);
    chk('prose CLOSE', prose.CLOSE.length, 14);
    chk('pressing lines', prose.PRESSING.length, 12);
    if (log && typeof console !== 'undefined') console.table && console.table(out);
    return out;
  }

  var api = {
    firstNames: firstNames,
    surnames: surnames,
    artistGrammars: artistGrammars,
    labels: labels,
    masteringNames: masteringNames,
    studios: studios,
    sessionPlayers: sessionPlayers,
    masteringHouses: masteringHouses,
    artistSpaces: artistSpaces,
    editions: editions,
    titlePools: titlePools,
    albumGrammars: albumGrammars,
    prose: prose,
    months: months,
    banPatterns: banPatterns,
    banWhitelist: banWhitelist,
    banViolations: banViolations,
    assertPools: assertPools
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LN_CORPUS = api;
})(typeof self !== 'undefined' ? self : this);
