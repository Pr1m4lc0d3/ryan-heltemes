// pack.js — the .monkeys/ pack format layer, and nothing else.
//
// Two functions only: parsePack(files) and serialise(pack). No stage logic,
// no linting, no DOM. This file is the interface contract every other
// console module reads and writes through — see design.md §6 for the format
// this parses, and the owning skills' SKILL.md files for the exact bullet
// shapes (they are authoritative; this file follows them, not the other way
// round).
//
// Three rules this file exists to uphold:
//   1. ABSENT IS NEVER AN ERROR. A missing file goes in `missing[]`; its
//      section comes back empty. parsePack({}) never throws.
//   2. MALFORMED IS RETAINED, NEVER REPAIRED. A bullet missing a required
//      field keeps its raw text and is flagged malformed:true. It never
//      enters a typed array (cleared[], active[], ...); it goes into the
//      top-level `malformed[]` list instead, so a consumer can still show
//      the human exactly what could not be read. Nothing is guessed.
//   3. ROUND-TRIP IS BYTE-STABLE. Every file's original text is cached
//      verbatim in `pack.raw[filename]`. serialise() just hands that cache
//      back — it never reconstructs a file from parsed fields, so nothing
//      it did not touch can drift from what was actually on disk.
//
//   4. AN UNRECOGNISED HEADING IS RETAINED AND REPORTED, NEVER GUESSED AT.
//      A "## " section whose heading is not one the owning file recognises
//      (`## Approved` where the format says `## Cleared`), or a whole file
//      with no recognised heading in it at all (junk, HTML, a paste of
//      something else), lands in the top-level `unrecognised[]` list with
//      its raw lines and the headings that WERE expected. Its text still
//      round-trips byte for byte via rule 3 — nothing is dropped, nothing is
//      renamed, and the console never assumes `## Approved` was meant to be
//      `## Cleared`. It says what it found and what it expected, and the
//      human decides.
//
// Three fields on the returned Pack are not part of the section shapes named
// in the plan (truth/motte/bailey/...) but are load-bearing and documented
// here rather than invented silently by a caller:
//   - `pack.raw`       { [filename]: originalFileText } for every file that
//                       was present (including briefings/<date>.md). This is
//                       what makes serialise() byte-stable.
//   - `pack.malformed` [{file, section, raw, fields}] — every bullet/row
//                       that failed a required-field check, across every
//                       file. This is the "what could not be read" list.
//   - `pack.unrecognised` [{file, heading, lines, expected}] — rule 4. A
//                       `heading` of null means "content that landed under no
//                       heading at all, in a file with no recognised heading
//                       anywhere". `lines` is the raw text, verbatim.

// ---------------------------------------------------------------------------
// Section field contracts, one per bullet/table shape a skill actually
// writes. `required` lists the camelCase field names (see toCamel below)
// that must be present and non-empty for the entry to be well-formed.
// `freeformTail`, where set, means everything after the primary value is one
// unlabelled block of text rather than `key: value` pairs — see the report
// for the one place this disagrees with design.md's stated field rule.
// ---------------------------------------------------------------------------

const TRUTH_CLEARED = { primaryKey: 'claim', required: ['source'] };
const TRUTH_UNCLEARED = { primaryKey: 'fact', required: ['reason'] };
const MOTTE_HELD = { primaryKey: 'asset', required: ['control', 'growsBy'] };
const MOTTE_WANTED = { primaryKey: 'asset', required: [], freeformTail: 'why' };
const BAILEY_ACTIVE = { primaryKey: 'channel', required: ['account', 'joined', 'standing', 'linksAllowed'] };
const BAILEY_EXCLUDED = { primaryKey: 'channel', required: ['reason'] };
const RECON_PAINS = { primaryKey: 'pain', required: ['heardIn', 'verified'] };
const RECON_ROOMS = { primaryKey: 'room', required: ['audience', 'rules', 'entryCost'] };
const ASYMMETRY_INCUMBENTS = { primaryKey: 'incumbent', required: ['revenueModel', 'thereforeCannotSay'] };
const ASYMMETRY_OUR_GROUND = { primaryKey: 'claim', required: ['because'] };
const CAMPAIGN_OPEN_NOW = { primaryKey: 'action', required: ['skill', 'doneWhen'] };
const CAMPAIGN_BLOCKED_ON_HUMAN = { primaryKey: 'decision', required: ['whyItBlocks', 'who'] };
const CAMPAIGN_DRIFT = { primaryKey: 'date', required: [], freeformTail: 'note' };
const BRIEFING_TODAY = { primaryKey: 'action', required: ['skill', 'doneWhen'] };

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

// "grows by" -> "growsBy". Keys in every schema are lowercase words only.
function toCamel(label) {
  const words = label.trim().toLowerCase().split(/\s+/);
  return words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join('');
}

// Split a file's text into blocks at each "## Heading" line. blocks[0] is
// the preamble (everything before the first "## " heading, heading:null).
// Every raw line is preserved somewhere, in order — nothing is dropped, so
// re-joining every block's lines with '\n' always reproduces the input.
function walkSections(text) {
  const lines = text.split('\n');
  const blocks = [];
  let current = { heading: null, headingRaw: null, lines: [] };
  for (const raw of lines) {
    const trimmed = raw.trim();
    const m = trimmed.match(/^##\s+(.*)$/);
    if (m) {
      blocks.push(current);
      current = { heading: m[1].trim().toLowerCase(), headingRaw: m[1].trim(), lines: [] };
    } else {
      current.lines.push({ raw, trimmed });
    }
  }
  blocks.push(current);
  return blocks;
}

// Free-text section (e.g. truth.md's "Canonical source"): every non-blank,
// non-comment line joined into one string.
function collectText(blocks, sectionName) {
  const block = blocks.find((b) => b.heading === sectionName);
  if (!block) return '';
  return block.lines
    .map((l) => l.trimmed)
    .filter((t) => t && !t.startsWith('<!--'))
    .join(' ')
    .trim();
}

// Parse one bullet's entry text (everything after "- ") against a field
// contract. Returns {fields, malformed} — never throws, never guesses a
// missing value.
function parseEntry(entryText, config) {
  const parts = entryText.split(' — ');
  const fields = {};
  fields[config.primaryKey] = parts[0];

  if (config.freeformTail) {
    fields[config.freeformTail] = parts.slice(1).join(' — ').trim();
    return { fields, malformed: false };
  }

  for (let i = 1; i < parts.length; i++) {
    const m = parts[i].match(/^([A-Za-z][A-Za-z ]*):\s*([\s\S]*)$/);
    if (m) fields[toCamel(m[1])] = m[2].trim();
  }
  const missing = (config.required || []).filter((k) => !(k in fields) || fields[k] === '');
  return { fields, malformed: missing.length > 0 };
}

// Collect every "- " bullet under one heading into well-formed entries.
// Malformed ones are pushed to malformedSink and excluded from the returned
// array — this is rule 2, applied uniformly for every bulleted section.
function collectEntries(blocks, sectionName, config, fileKey, malformedSink) {
  const block = blocks.find((b) => b.heading === sectionName);
  const result = [];
  if (!block) return result;
  for (const { trimmed } of block.lines) {
    if (!trimmed.startsWith('- ')) continue;
    const entryText = trimmed.slice(2).trim();
    const { fields, malformed } = parseEntry(entryText, config);
    if (malformed) {
      malformedSink.push({ file: fileKey, section: sectionName, raw: entryText, fields });
    } else {
      result.push({ fields, raw: entryText, malformed: false });
    }
  }
  return result;
}

// Pipe-delimited table rows (numbers.md, scars.md). Skips the header row
// and the "|---|---|" separator row; returns every data row as raw cells.
function parseTableRows(text) {
  const lines = text.split('\n');
  const rows = [];
  let sawHeader = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (!sawHeader) {
      sawHeader = true;
      continue;
    }
    if (cells.length && cells.every((c) => /^-+$/.test(c))) continue;
    rows.push({ cells, raw: trimmed });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Per-file parsers
// ---------------------------------------------------------------------------

function parseTruth(text, malformedSink) {
  if (text === undefined) return { cleared: [], uncleared: [], canonicalSource: '' };
  const blocks = walkSections(text);
  return {
    cleared: collectEntries(blocks, 'cleared', TRUTH_CLEARED, 'truth.md', malformedSink),
    uncleared: collectEntries(blocks, 'uncleared', TRUTH_UNCLEARED, 'truth.md', malformedSink),
    canonicalSource: collectText(blocks, 'canonical source'),
  };
}

function parseMotte(text, malformedSink) {
  if (text === undefined) return { held: [], wanted: [] };
  const blocks = walkSections(text);
  return {
    held: collectEntries(blocks, 'held', MOTTE_HELD, 'motte.md', malformedSink),
    wanted: collectEntries(blocks, 'wanted', MOTTE_WANTED, 'motte.md', malformedSink),
  };
}

function parseBailey(text, malformedSink) {
  if (text === undefined) return { active: [], excluded: [] };
  const blocks = walkSections(text);
  return {
    active: collectEntries(blocks, 'active', BAILEY_ACTIVE, 'bailey.md', malformedSink),
    excluded: collectEntries(blocks, 'excluded', BAILEY_EXCLUDED, 'bailey.md', malformedSink),
  };
}

function parseRecon(text, malformedSink) {
  if (text === undefined) return { pains: [], rooms: [] };
  const blocks = walkSections(text);
  return {
    pains: collectEntries(blocks, 'pains', RECON_PAINS, 'recon.md', malformedSink),
    rooms: collectEntries(blocks, 'rooms', RECON_ROOMS, 'recon.md', malformedSink),
  };
}

function parseAsymmetry(text, malformedSink) {
  if (text === undefined) return { incumbents: [], ourGround: [] };
  const blocks = walkSections(text);
  return {
    incumbents: collectEntries(blocks, 'incumbents', ASYMMETRY_INCUMBENTS, 'asymmetry.md', malformedSink),
    ourGround: collectEntries(blocks, 'our ground', ASYMMETRY_OUR_GROUND, 'asymmetry.md', malformedSink),
  };
}

// "Closed, and what opens it" entries look like:
//   **Stage <n> — <name>** — blocked by: <condition>
// The bold span itself contains an em-dash, so it needs its own two-step
// parse instead of the generic split-on-every-em-dash used elsewhere.
function parseClosedEntry(entryText) {
  const m = entryText.match(/^\*\*(.+?)\*\*\s*—\s*([\s\S]*)$/);
  if (!m) return { fields: {}, malformed: true };
  const fields = { stageLabel: m[1].trim() };
  const stageMatch = fields.stageLabel.match(/^Stage\s+(\d+)\s*—\s*(.+)$/);
  if (stageMatch) {
    fields.stageNumber = Number(stageMatch[1]);
    fields.stageName = stageMatch[2].trim();
  }
  const kv = m[2].match(/^blocked by:\s*([\s\S]*)$/i);
  if (kv) fields.blockedBy = kv[1].trim();
  return { fields, malformed: !kv || fields.blockedBy === '' };
}

function collectClosedEntries(blocks, malformedSink) {
  const block = blocks.find((b) => b.heading === 'closed, and what opens it');
  const result = [];
  if (!block) return result;
  for (const { trimmed } of block.lines) {
    if (!trimmed.startsWith('- ')) continue;
    const entryText = trimmed.slice(2).trim();
    const { fields, malformed } = parseClosedEntry(entryText);
    if (malformed) {
      malformedSink.push({ file: 'campaign.md', section: 'closed, and what opens it', raw: entryText, fields });
    } else {
      result.push({ fields, raw: entryText, malformed: false });
    }
  }
  return result;
}

const CAMPAIGN_STAGE_RE = /^\*\*Stage:\*\*\s*(\d+)\s*—\s*(.*)$/;
const CAMPAIGN_OPENED_RE = /^\*\*Opened:\*\*\s*(.*)$/;
const CAMPAIGN_DELIVERY_RE = /^\*\*Delivery check:\*\*\s*(.*)$/;

function parseCampaign(text, malformedSink) {
  if (text === undefined) {
    return {
      stage: { number: null, name: '' }, opened: '', deliveryCheck: '', whyThisStage: '',
      openNow: [], closed: [], blockedOnHuman: [], drift: [],
    };
  }
  const blocks = walkSections(text);
  let stage = { number: null, name: '' };
  let opened = '';
  let deliveryCheck = '';
  for (const { trimmed } of blocks[0].lines) {
    let m;
    if ((m = trimmed.match(CAMPAIGN_STAGE_RE))) stage = { number: Number(m[1]), name: m[2].trim() };
    else if ((m = trimmed.match(CAMPAIGN_OPENED_RE))) opened = m[1].trim();
    else if ((m = trimmed.match(CAMPAIGN_DELIVERY_RE))) deliveryCheck = m[1].trim();
  }
  return {
    stage,
    opened,
    deliveryCheck,
    whyThisStage: collectText(blocks, 'why this stage'),
    openNow: collectEntries(blocks, 'open now', CAMPAIGN_OPEN_NOW, 'campaign.md', malformedSink),
    closed: collectClosedEntries(blocks, malformedSink),
    blockedOnHuman: collectEntries(blocks, 'blocked on a human decision', CAMPAIGN_BLOCKED_ON_HUMAN, 'campaign.md', malformedSink),
    drift: collectEntries(blocks, 'drift', CAMPAIGN_DRIFT, 'campaign.md', malformedSink),
  };
}

function parseNumbers(text, malformedSink) {
  if (text === undefined) return { rows: [] };
  const rows = [];
  for (const { cells, raw } of parseTableRows(text)) {
    const fields = {
      date: cells[0] || '', metric: cells[1] || '', kind: cells[2] || '',
      value: cells[3] || '', source: cells[4] || '',
    };
    const kindOk = fields.kind === 'motte' || fields.kind === 'bailey';
    const malformed = !fields.date || !fields.metric || !kindOk || !fields.value || !fields.source;
    if (malformed) {
      malformedSink.push({ file: 'numbers.md', section: 'rows', raw, fields });
    } else {
      rows.push({ fields, raw, malformed: false });
    }
  }
  return { rows };
}

function parseScars(text, malformedSink) {
  if (text === undefined) return [];
  const result = [];
  for (const { cells, raw } of parseTableRows(text)) {
    const fields = { incident: cells[0] || '', damage: cells[1] || '', rule: cells[2] || '' };
    const malformed = !fields.incident || !fields.damage || !fields.rule;
    if (malformed) {
      malformedSink.push({ file: 'scars.md', section: 'table', raw, fields });
    } else {
      result.push({ fields, raw, malformed: false });
    }
  }
  return result;
}

const BRIEFING_STAGE_RE = /^\*\*Stage \(from campaign\.md\):\*\*\s*(\d+)\s*—\s*(.*)$/;
const BRIEFING_FILE_RE = /^briefings\/(\d{4}-\d{2}-\d{2})\.md$/;

function parseBriefingFile(fileKey, text, malformedSink) {
  const blocks = walkSections(text);
  let stage = { number: null, name: '' };
  for (const { trimmed } of blocks[0].lines) {
    const m = trimmed.match(BRIEFING_STAGE_RE);
    if (m) stage = { number: Number(m[1]), name: m[2].trim() };
  }
  const dateMatch = fileKey.match(BRIEFING_FILE_RE);
  return {
    file: fileKey,
    date: dateMatch ? dateMatch[1] : '',
    stage,
    moved: collectText(blocks, 'moved'),
    today: collectEntries(blocks, 'today', BRIEFING_TODAY, fileKey, malformedSink),
    blocked: collectText(blocks, 'blocked'),
    rot: collectText(blocks, 'rot'),
  };
}

function parseBriefings(files, malformedSink, rawSink, unrecognisedSink) {
  const result = [];
  for (const key of Object.keys(files)) {
    if (BRIEFING_FILE_RE.test(key)) {
      rawSink[key] = files[key];
      collectUnrecognised(key, files[key], unrecognisedSink);
      result.push(parseBriefingFile(key, files[key], malformedSink));
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

// ---------------------------------------------------------------------------
// Rule 4 — the heading vocabulary, and what to do with a heading outside it.
//
// Only the six section-based files (and briefings/<date>.md) have a heading
// vocabulary at all. numbers.md, scars.md and sell-kit.md are deliberately
// absent from this map: they are a table, a table, and a labelled import,
// parsed by scanning the whole file rather than by section, so a "## " line
// in them changes nothing and reporting one would be a false alarm. A file
// with no vocabulary is never checked — knownSectionsFor returns null and
// collectUnrecognised returns immediately.
// ---------------------------------------------------------------------------

const KNOWN_SECTIONS = {
  'truth.md': ['Cleared', 'Uncleared', 'Canonical source'],
  'motte.md': ['Held', 'Wanted'],
  'bailey.md': ['Active', 'Excluded'],
  'recon.md': ['Pains', 'Rooms'],
  'asymmetry.md': ['Incumbents', 'Our ground'],
  'campaign.md': ['Why this stage', 'Open now', 'Closed, and what opens it', 'Blocked on a human decision', 'Drift'],
};

const BRIEFING_SECTIONS = ['Moved', 'Today', 'Blocked', 'Rot'];

// The preamble lines (before the first "## ") that a file's own parser
// genuinely consumes. Everywhere else the preamble is a title and prose,
// which is why it is only ever reported when a file has no recognised
// heading at all — see collectUnrecognised.
const CONSUMED_PREAMBLE = {
  'campaign.md': [CAMPAIGN_STAGE_RE, CAMPAIGN_OPENED_RE, CAMPAIGN_DELIVERY_RE],
};

// knownSectionsFor(fileKey) -> string[] | null. The headings this file
// recognises, in the order the format lists them, or null for a file with no
// heading vocabulary. Exported so a door can name what was expected without
// keeping a second, driftable copy of the list.
export function knownSectionsFor(fileKey) {
  if (BRIEFING_FILE_RE.test(fileKey)) return BRIEFING_SECTIONS.slice();
  return KNOWN_SECTIONS[fileKey] ? KNOWN_SECTIONS[fileKey].slice() : null;
}

function consumedPreambleFor(fileKey) {
  if (BRIEFING_FILE_RE.test(fileKey)) return [BRIEFING_STAGE_RE];
  return CONSUMED_PREAMBLE[fileKey] || [];
}

// collectUnrecognised(fileKey, text, sink) -> void. Two reports, never a
// guess:
//   a. Every "## " heading outside this file's vocabulary, with the raw lines
//      that were sitting under it. Nothing under such a heading reaches a
//      typed array, so without this it would vanish with no signal at all.
//   b. If the file has NO recognised heading anywhere AND named no bad
//      heading either — a junk, HTML, or empty-shell file — its whole
//      remaining body, so an unreadable file is never counted as merely
//      "present". When (a) already fired, (b) stays quiet: the diagnosis has
//      been delivered and repeating the title line under it is noise.
function collectUnrecognised(fileKey, text, sink) {
  const expected = knownSectionsFor(fileKey);
  if (expected === null || text === undefined) return;
  const known = expected.map((h) => h.toLowerCase());
  const blocks = walkSections(text);

  let sawKnown = false;
  let named = 0;
  for (const block of blocks) {
    if (block.heading === null) continue;
    if (known.includes(block.heading)) {
      sawKnown = true;
      continue;
    }
    named += 1;
    sink.push({
      file: fileKey,
      heading: block.headingRaw,
      lines: block.lines.map((l) => l.raw),
      expected: expected.slice(),
    });
  }
  if (sawKnown || named > 0) return;

  const consumed = consumedPreambleFor(fileKey);
  const leftovers = blocks[0].lines
    .map((l) => l.raw)
    .filter((raw) => {
      const t = raw.trim();
      if (t === '' || t.startsWith('<!--')) return false;
      return !consumed.some((re) => re.test(t));
    });
  if (leftovers.length === 0) return;
  sink.push({ file: fileKey, heading: null, lines: leftovers, expected: expected.slice() });
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

// parsePack(files) -> Pack. `files` is a Record<string,string> holding only
// the files that exist (e.g. from disk, from a File System Access handle,
// or from an upload) — any of the 9 named files or a briefings/<date>.md
// may be absent. Never throws: an absent file becomes an empty section plus
// an entry in `missing`, never an exception.
export function parsePack(files) {
  files = files || {};
  const missing = [];
  const malformed = [];
  const unrecognised = [];
  const raw = {};

  function need(name) {
    if (!Object.prototype.hasOwnProperty.call(files, name)) {
      missing.push(name);
      return undefined;
    }
    raw[name] = files[name];
    return files[name];
  }

  // Same as need(), plus rule 4's heading check — used for the files that
  // actually have a heading vocabulary. See knownSectionsFor.
  function section(name) {
    const text = need(name);
    collectUnrecognised(name, text, unrecognised);
    return text;
  }

  // sell-kit.md is CACHED but never parsed here, and the call's return value
  // is deliberately discarded. sellkit.js is the ONE reader of a kit; the
  // second parser that used to live in this file matched `- Label: value`
  // while Idea Forge Pro emits `- **Label:** value`, so it returned nothing
  // from a real kit, and the fixture that "proved" it worked was hand-written
  // in the wrong shape.
  //
  // ⚠ THE CALL IS NOT OPTIONAL just because nothing reads what it returns.
  // need() also records the file in `missing` and caches its text in `raw` so
  // serialise() hands it back. Removing this line dropped a founder's
  // sell-kit.md on download — the identical silent loss voice.md once had,
  // caught here by the round-trip test rather than by a person.
  need('sell-kit.md');

  const pack = {
    truth: parseTruth(section('truth.md'), malformed),
    motte: parseMotte(section('motte.md'), malformed),
    bailey: parseBailey(section('bailey.md'), malformed),
    recon: parseRecon(section('recon.md'), malformed),
    asymmetry: parseAsymmetry(section('asymmetry.md'), malformed),
    campaign: parseCampaign(section('campaign.md'), malformed),
    // voice.md is CACHED but not parsed into fields yet: its structure has
    // no consumer in the console, and caching is what makes it survive a
    // load-and-download round trip. Consumers that need it read pack.raw
    // ('voice.md') — see agent.js, which passes it to the model verbatim
    // rather than risk a misparse dropping the one thing standing between a
    // draft and an invented house style.
    voice: need('voice.md'),
    // sell-kit.md is CACHED but not parsed here, for exactly voice.md's
    // reason above and one more: sellkit.js is the only reader of a kit, and
    // a second parser in this file disagreed with it for months. The one that
    // used to live here matched `- Label: value` while Idea Forge Pro emits
    // `- **Label:** value`, so it returned nothing from a real kit and the
    // fixture that "proved" it worked was hand-written in the wrong shape.
    //
    // ⚠ need() IS NOT OPTIONAL, and its return value being unused is not a
    // reason to drop the call. It does two things besides returning text: it
    // records the file in `missing`, and it caches the text in `raw` so
    // serialise() gives it back. Deleting this line silently dropped a
    // founder's sell-kit.md on download — the identical bug voice.md had.
    numbers: parseNumbers(need('numbers.md'), malformed),
    briefings: parseBriefings(files, malformed, raw, unrecognised),
    scars: parseScars(need('scars.md'), malformed),
    missing,
    malformed,
    unrecognised,
    raw,
  };

  return pack;
}

// serialise(pack) -> Record<string,string>. Hands back the cached raw text
// of every file the pack actually has — see rule 3 above. A pack built from
// {} serialises to {}; nothing is fabricated for a file that was never
// there.
export function serialise(pack) {
  const out = {};
  const raw = (pack && pack.raw) || {};
  for (const name of Object.keys(raw)) out[name] = raw[name];
  return out;
}
