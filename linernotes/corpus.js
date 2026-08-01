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
      { t: 'Recorded quickly, mixed slowly.' },
      /* +27 added 1 Aug 2026 (workflow) */
      { t: "Made in a rented flat, mostly after dark." },
      { t: "Tracked in the off-season, when the town had emptied." },
      { t: "Set down in three afternoons and then left alone." },
      { t: "Recorded above a laundrette, during opening hours." },
      { t: "Cut in a borrowed office over a long weekend." },
      { t: "Made between shifts, on the days that lined up." },
      { t: "Tracked in a hotel room on the last leg of a tour." },
      { t: "Recorded whenever the trains had stopped for the night." },
      { t: "Made in the gap between two other records." },
      { t: "Recorded in a kitchen with the table pushed back." },
      { t: "Committed to tape while the studio was being packed up." },
      { t: "Recorded in a church hall booked by the hour." },
      { t: "Recorded in the room at the top of the stairs." },
      { t: "Tracked in a single week and mixed the following spring." },
      { t: "Made in the weeks the river was frozen over." },
      { t: "Set down in the shed at the end of the garden." },
      { t: "Recorded in the days either side of a power cut." },
      { t: "Made largely on the nights it rained, which was most of them." },
      { t: "Recorded once the scaffolding came down." },
      { t: "Tracked in a lock-up with the door rolled halfway." },
      { t: "Begun on the coldest week and finished on the warmest." },
      { t: "Recorded in the flat below the one we lived in." },
      { t: "Made in the month between leases, boxes everywhere." },
      { t: "Recorded in the smaller of two identical rooms, for reasons since forgotten." },
      { t: "Made over a single weekend that gained an hour to the clocks; the hour was used." },
      { t: "Recorded in a building of thirteen floors, on the fourteenth." },
      { t: "Tracked in a studio reachable only by boat, at low tide, twice a day." }
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
      { t: 'Microphones were placed and then not touched for a month.' },
      /* — 24 BODY sentences authored via Phase 0 candidates, approved by
         David 31 Jul 2026. Transcribed byte-exact from the approved list.
         Pole affinities live in plant.js (BODY_POLE_W), not here. — */
      { t: 'The kettle is audible twice; both takes were kept.' },
      { t: 'Recorded with the curtains drawn, on the advice of no one.' },
      { t: 'The chair creak in the quiet passages is the good chair.' },
      { t: 'One microphone, moved eleven times, is the whole stereo image.' },
      { t: 'The upright was recorded from underneath. This was not revisited.' },
      { t: 'Nothing was played louder than the neighbours would allow.' },
      { t: 'Four of these were recorded outdoors; the wind decided which four.' },
      { t: 'The generator is audible on the quiet ones. It was forty metres away.' },
      { t: 'Boots remained on throughout. The floor is part of the drum sound.' },
      { t: 'The van served as the control room, engine off.' },
      { t: 'Two songs were finished on the ferry; the timetable is thanked.' },
      { t: 'The field recordings are from within a kilometre of the studio door.' },
      { t: 'The drum machine ran all night; the takes are excerpts.' },
      { t: 'Vocals were done standing in the corridor, facing the wall.' },
      { t: 'There is no reverb on this record that a room did not provide.' },
      { t: 'The guitar was tuned once, in January.' },
      { t: 'Six amps were tried. The broken one was used.' },
      { t: 'Nothing was recorded after the heating failed; side B is from before.' },
      { t: 'The patch was not saved. This is the only document of it.' },
      { t: 'The sequencer drifted; the drift was promoted to structure.' },
      { t: 'All four oscillators were borrowed from three people.' },
      { t: 'The delay unit was set once and taped over.' },
      { t: 'Mixing took nine evenings, the same fader most of them.' },
      { t: 'The modular was sold on completion; the invoice is in the sleeve of copy one.' },
      /* — 12 BODY sentences added 1 Aug 2026 (pool 38→50); ~3 per pole for even
         coverage. Voice per §VOICE (deadpan studio micro-fact); pole affinities
         appended index-aligned to plant.js BODY_POLE_W. — */
      { t: 'The take with the dropped pick is the one that was kept.' },
      { t: 'Played loud, played once; nothing here was rehearsed twice.' },
      { t: 'The vocal was cut in a single pass, cold, before coffee.' },
      { t: 'The tide kept the hours; two takes went out with it.' },
      { t: 'A tractor passes in the third minute and is not faded.' },
      { t: 'Recorded in the barn until the swallows objected.' },
      { t: 'The hall clock was stopped for the week and not wound back.' },
      { t: 'Recorded in the hours the house was asleep.' },
      { t: 'The window stayed open to the courtyard; the courtyard is on the tape.' },
      { t: 'The arpeggiator was set on the first day and outlived the sessions.' },
      { t: 'The sequencer was left running between sessions; nothing reset it.' },
      { t: 'One oscillator, multiplied and detuned, is the entire palette.' },
      /* +87 added 1 Aug 2026 (workflow); weights index-aligned in plant.js */
      { t: "The snare was tuned to the room and then hit harder than that." },
      { t: "The bass amp had one working input; everything went through it in turn." },
      { t: "The vocal clipped on the loud words, and the clipping was kept." },
      { t: "Nothing was compressed; the dynamics are whatever the players had left." },
      { t: "The fuzz pedal had a loose jack; the dropouts are on every take and stayed." },
      { t: "The count-off is shouted; the headphones were not loud enough." },
      { t: "Feedback holds the last chord; no one reached the amp in time." },
      { t: "A bass string broke in the second minute; the take carried on without it." },
      { t: "The distortion is the desk, driven past where it was meant to go." },
      { t: "The vocals were sung flat out until the voice gave; that take is the one." },
      { t: "One microphone took the whole kit and most of the wall behind it." },
      { t: "The guitar amp ran hot for six hours and smelled of it by the end." },
      { t: "The bleed between microphones was total; the tracks were never separated." },
      { t: "The gain structure is wrong throughout and holds the record together." },
      { t: "The floor tom doubled as a chair between takes and sounds like it." },
      { t: "The volume was set to maximum and the knob taken off to end the discussion." },
      { t: "A quieter setting was requested and could not be found on the amplifier." },
      { t: "The drum machine has a stop button; it was located after the sessions." },
      { t: "There is a spare amplifier kept in case the loud one grows louder." },
      { t: "The rain came through the roof twice; only the second leak is on the tape." },
      { t: "Sheep are audible in the long fade. They were not directed." },
      { t: "A gull walked the length of the roof during take two and stayed in." },
      { t: "The church was cold enough that breath is audible on the quiet takes." },
      { t: "The barn door was propped with a brick for the week." },
      { t: "Recorded between tides, on a floor that is underwater by evening." },
      { t: "The wind turbine up the hill is the drone under the fourth track." },
      { t: "The dawn chorus starts under the third song and was not asked to leave." },
      { t: "The peat fire is the low hum; it was not going out for anyone." },
      { t: "Frost on the window is why the piano went flat overnight." },
      { t: "The generator was refuelled twice a night; the gaps are where the songs end." },
      { t: "A tin roof under hail is the whole percussion of the last track." },
      { t: "The river was in flood that week and is louder than intended throughout." },
      { t: "Geese pass overhead in the outro and were left where they landed." },
      { t: "A horse in the yard shifts its weight through the quiet middle." },
      { t: "The village hall was booked for a funeral and vacated straight after." },
      { t: "Recorded a fortnight after the last boat of the season had gone." },
      { t: "The bog road flooded, so the amps came in by wheelbarrow." },
      { t: "Every window was open to the estuary, which does not keep time." },
      { t: "Snow closed the pass for three days; the record is what those days held." },
      { t: "A goat holds a writing credit and has declined the royalties." },
      { t: "The weather was scheduled for Tuesday and kept the appointment." },
      { t: "One field was hired for its acoustics; the livestock came at no extra cost." },
      { t: "The pipes knock when the heating comes on; the knock is on three of these." },
      { t: "Recorded at the kitchen table; the low notes carry the grain of it." },
      { t: "The staircase was the booth; two vocals were cut four steps up." },
      { t: "The net curtains stayed up; the street outside is filtered, not gone." },
      { t: "The gas fire ticks as it warms and was not turned off for it." },
      { t: "One board on the landing answers the low notes and was not fixed." },
      { t: "Recorded in the front room, the settee pushed up against the door." },
      { t: "The airing cupboard held one microphone for a week; the towels are the treatment." },
      { t: "The upright's pedal squeaks in the slow passages, and in the others." },
      { t: "A teaspoon left standing in a mug rings at the close; no one moved it." },
      { t: "The neighbours' television carries faintly through the wall on the third." },
      { t: "Recorded in the hour between the school run and the second post." },
      { t: "The radiator ticks as it cools; that is the count-in before each verse." },
      { t: "The standard lamp hums at a steady pitch; one song is tuned to it." },
      { t: "The cat sat on the amplifier for the warm songs and left before the loud one." },
      { t: "The letterbox goes twice in the second minute; the post is thanked." },
      { t: "The hall carpet takes the low end out; none of it was added back." },
      { t: "The alarm clock was wound each morning and ticks faintly under the quiet ones." },
      { t: "The parlour has one wall of books; that wall is the whole reverb." },
      { t: "The good chair has tenure and was not asked to move." },
      { t: "The mantel clock was consulted about the tempo and disagreed." },
      { t: "One machine sets the clock; everything else runs about three percent behind it." },
      { t: "The mains hum sits at fifty cycles under the record; it was tuned to, not out." },
      { t: "The gate was left open on the last note; the tape ends before it shuts." },
      { t: "The filter was opened by hand across four minutes; the hand tired before the note." },
      { t: "The tape delay was fed back until it held a note of its own, then eased off one notch." },
      { t: "Sixteen steps, one altered each pass; by the end none were the ones written down." },
      { t: "The drum machine's factory preset is the spine of the record, undisguised." },
      { t: "The memory battery failed between sessions; the sounds here are approximations of themselves." },
      { t: "Nothing runs on MIDI; the wires between the boxes are the arrangement." },
      { t: "The attack was set slow enough that some notes never fully arrive." },
      { t: "A sample-and-hold supplies the random parts; it is the same random on every pass." },
      { t: "The hiss under the quiet parts is a noise generator, invited and kept." },
      { t: "Each layer was bounced down to make room; the earliest ones are mostly hiss now." },
      { t: "The modular filled one case; whatever did not fit is not on the record." },
      { t: "When the fridge cycled the pitch dipped; the fridge is on three of these." },
      { t: "The glide between notes is the tune; the notes themselves are incidental." },
      { t: "The swing is the drum machine's own and was not a decision." },
      { t: "A power cut ended the third session; the drop as the rack died was left in." },
      { t: "Two detuned oscillators give a beat about once a second; the record is built on it." },
      { t: "An envelope follower let the machine play itself; it kept better time than we did." },
      { t: "The pulse under all of it is a wind-up metronome, wired into the clock in." },
      { t: "The synthesizer has a knob marked FINE. It was set coarse." },
      { t: "The sequencer's manual was lost early; it was run on memory and superstition." },
      { t: "The drum machine counts in a time signature that does not exist. It was not corrected." }
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
      { t: "'{TRACK}' ends abruptly because the reel did.", bindTrack: true },
      /* +37 added 1 Aug 2026 (workflow) */
      { t: "A telephone rings once in a quiet passage and was left where it fell." },
      { t: "A wall clock keeps time through the closing minute; nobody wound it to match." },
      { t: "The parish bells arrive an hour fast on one song and were kept anyway." },
      { t: "A cough near the end was in time, and so it stayed." },
      { t: "Birdsong from the open window is on the morning takes only." },
      { t: "A floorboard announces every entrance to the room and was never fixed." },
      { t: "The last note is allowed to decay for the better part of a minute." },
      { t: "The record fades in rather than begins, for no reason anyone recorded." },
      { t: "Ring-road traffic is the only pad on the quiet ones." },
      { t: "A struck match opens one song and was not planned." },
      { t: "One song sits a semitone flat and stayed there." },
      { t: "A held breath before the first note is the whole introduction." },
      { t: "The pull-cord of the light clicks in the gap between two songs." },
      { t: "A dropped mug kept its time and became the downbeat." },
      { t: "Feedback arrived unasked and was kept as an ending." },
      { t: "A string broke on the final chord; the buzz is on the record." },
      { t: "The reverb is a stairwell that has since been demolished." },
      { t: "A power cut ended one take early; the short version is the one here." },
      { t: "The wrong reel was played back one morning and preferred." },
      { t: "A splice joins two takes; the seam is audible and was left proud." },
      { t: "A metronome left running in the corner became the hi-hat." },
      { t: "Someone laughed in the second minute and it was not removed." },
      { t: "A neighbour's television is faintly present for four bars, in another language." },
      { t: "The running order was settled by a coin and left." },
      { t: "Nothing is panned; the whole record sits in the middle by choice." },
      { t: "The count that opens the record is faster than anything that follows." },
      { t: "A pen set down at the end of the last take is the final sound." },
      { t: "The tape leader clicks once at the start and was thought fitting." },
      { t: "Ice moving in a glass is audible once and belongs to no one." },
      { t: "The loudest moment on the record is its quietest song." },
      { t: "The boiler's pilot light ticks steadily beneath one number." },
      { t: "A biscuit tin was mic'd for a fortnight and used once." },
      { t: "There is a note held so long it is credited to two people." },
      { t: "The tape was measured and found to be exactly long enough. This was luck." },
      { t: "The loudest amp was recorded from the car park, for safety." },
      { t: "One channel is silent and is being kept for later." },
      { t: "A click no one can hear was removed at considerable expense." }
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
      { t: 'Sequence is chronological, roughly.' },
      /* +30 added 1 Aug 2026 (workflow) */
      { t: "Recorded over eleven evenings, none of them planned." },
      { t: "The room is gone now; a bank stands where the desk was." },
      { t: "Two takes were kept, and neither was the good one." },
      { t: "The mistakes were left in and are load-bearing." },
      { t: "Mixed in one afternoon, then not touched again." },
      { t: "The title came last and fits nothing in particular." },
      { t: "The engineer went home early; the rest was done alone." },
      { t: "We meant to re-record it and did not." },
      { t: "Made in a rented flat, returned in better condition than found." },
      { t: "Recorded at night to keep the traffic out; it is in three of these anyway." },
      { t: "The running order was decided by a coin, then adjusted by hand." },
      { t: "One song was cut for length and is not missed." },
      { t: "No click was used, and it shows in the better places." },
      { t: "It cost rather less than the equipment would suggest." },
      { t: "The hiss was left in; removing it removed too much else." },
      { t: "Nobody involved does this for a living." },
      { t: "The working title is written on the tape box and stays there." },
      { t: "The final mix was the third; one person still prefers the first." },
      { t: "The good take was the tired one, recorded last." },
      { t: "Everyone was paid, eventually, in the agreed order." },
      { t: "A quieter version was attempted and is worse." },
      { t: "The tapes are in a drawer and will stay in the drawer." },
      { t: "Assembled from the parts that survived a burst pipe; not all did." },
      { t: "The last day ran three hours over, and those hours are the keepers." },
      { t: "It was finished on a Sunday and sent on the Monday." },
      { t: "The four of us agreed on the ending, which had not happened before." },
      { t: "The tape machine is older than everyone who touched it, combined." },
      { t: "A clause requires the kettle be credited. It is not." },
      { t: "One microphone was flown across an ocean and recorded nothing." },
      { t: "The mastering was done twice to be sure, and a third time to be less sure." }
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
    chk('prose BODY', prose.BODY.length, 38); // 14 original + 24 approved 31 Jul 2026
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
