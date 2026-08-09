// sellkit.js — importing an Idea Forge Pro Sell-Kit into the pack.
//
// THE RULE THIS FILE EXISTS FOR: importing a kit is NOT clearance.
//
// Idea Forge Pro deliberately refuses to say "clear to build" — craft, demand
// and a critic conceding are three different axes there. Importing into this
// pack is not permission to market either. A kit is largely MODEL-WRITTEN:
// the Prospector proposes, the Smith sharpens, and the founder approves. Text
// that arrives that way is grade F, which establishes nothing, and pouring it
// into truth.md ## Cleared would poison the exact register that exists to
// keep it out.
//
// So every field is graded before it moves, and the grade decides where it
// lands. Nothing is graded UP by this importer; a kit can only tell us a
// claim is weaker than it looks.
//
// PURE. A kit and a pack in, a plan out. Nothing is written until a human
// presses the button, and the plan is shown to them first.

// ---------------------------------------------------------------------------
// The grades, copied from Idea Forge Pro's own evidence module so the two
// products cannot drift apart on the one thing they share. Read from
// packages/forge-engine/src/evidence/index.ts, not invented here.
// ---------------------------------------------------------------------------

export const EVIDENCE_GRADES = Object.freeze({
  A: { label: 'Direct attestation', cleared: true, why: 'A named buyer said it. Needs the quote and the name.' },
  B: { label: 'Observed behaviour', cleared: true, why: 'They already spend money or effort on a workaround.' },
  C: { label: 'Public principle', cleared: true, why: 'Someone stated it publicly. Establishes RELEVANCE only, never demand.' },
  D: { label: 'Analogy or precedent', cleared: true, why: 'A comparable case makes it plausible. A hypothesis, never buyer intent.' },
  E: { label: 'Founder assertion', cleared: false, why: 'You believe it and have no independent evidence yet. Better footing than generated text, still unverified.' },
  F: { label: 'Generated hypothesis', cleared: false, why: 'Written by a model. It establishes NOTHING and cannot be raised — only replaced by something real.' },
});

export const GRADE_ORDER = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F']);

// A–D may be cleared, AND ONLY WITH A SOURCE. The grade alone is not enough:
// IFP marks A–D as needsSource, so a kit line claiming grade B with nothing
// after it is a claim about evidence rather than evidence.
export function gradeClears(grade, source) {
  const g = EVIDENCE_GRADES[String(grade || '').toUpperCase()];
  if (!g) return false;
  return g.cleared && Boolean(String(source || '').trim());
}

// ---------------------------------------------------------------------------
// The kit's own fields. Labels are Idea Forge Pro's, read from its schema.
//
// `to` says where a field may go. NOTE WHAT IS ABSENT: channel and any
// competitor's revenue model are never imported. A kit names a channel TYPE
// ("a developer forum"), and entering a real room on assumed rules is how an
// account gets banned — bailey.md and recon.md are filled by reading the
// actual room, never by inference from a planning document.
// ---------------------------------------------------------------------------

const KIT_FIELDS = [
  { label: 'Buyer', to: 'recon', note: 'Who this is for. Lands in recon.md ## Pains as unverified until someone real says it.' },
  { label: 'Problem', to: 'recon', note: "The pain, in the kit's words rather than a buyer's. Unverified on arrival." },
  { label: 'Why now', to: 'truth', note: 'A claim about the world. Clears only with a source.' },
  { label: 'Offer', to: 'truth', note: 'What you say you do. Clears only with a source.' },
  { label: 'Price', to: 'truth', note: 'A fact about your own product, so usually sourceable by you.' },
  { label: 'Value artifact', to: 'motte', note: 'A thing you make and own. Lands in motte.md ## Wanted until it exists.' },
  { label: 'Intent signal', to: 'skip', note: 'A test-design decision, not a marketing claim.' },
  { label: 'Channel', to: 'skip', note: 'A channel TYPE, not a room. Entering a real room on assumed rules is how accounts get banned — read the room instead.' },
  { label: 'The ask', to: 'campaign', note: "The pre-build test IS the campaign's first objective." },
  { label: 'PASS if', to: 'campaign', note: 'The line that decides the test.' },
  { label: 'KILL if', to: 'campaign', note: 'The line that stops it.' },
  { label: 'By when', to: 'campaign', note: 'The date the test answers by.' },
  { label: 'Commitment signal', to: 'campaign', note: 'What actually counts as interest. Praise does not.' },
  { label: 'What this test CAN prove', to: 'campaign', note: 'The narrow question it answers.' },
  { label: 'What this test CANNOT prove', to: 'campaign', note: 'The caveat that must survive the trip.' },
  { label: 'Stop condition', to: 'campaign', note: 'What would make you stop.' },
  { label: 'What is known', to: 'truth', note: 'The kit says these are supported. Still needs its source named.' },
  { label: 'What is hypothesized', to: 'truth-uncleared', note: 'Proposed for testing, not established. Uncleared by definition.' },
];

export const IMPORTABLE_FIELDS = Object.freeze(KIT_FIELDS);

// ---------------------------------------------------------------------------
// Parsing. The kit's markdown is "- **Label:** value" lines under headings,
// plus a claim register whose lines carry their own grade.
// ---------------------------------------------------------------------------

const FIELD_RE = /^-\s*\*\*([^:*]+):\*\*\s*(.*)$/;

// A field's value can run to several lines. Idea Forge Pro renders one bullet
// per field — `- **Label:** value` — but a multi-line value (the claim
// register is one line per claim) keeps its newlines, so the second and later
// lines carry no label. Reading only the first line silently truncated the
// claim register to nothing, which imported a kit with every claim dropped
// and no error: the exact silent-data-loss shape voice.md had.
//
// So continuation lines are accumulated until the next labelled bullet or the
// next heading.
export function parseKitFields(text) {
  const out = {};
  let current = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const m = line.match(FIELD_RE);
    if (m) {
      current = m[1].trim();
      out[current] = m[2].trim();
      continue;
    }
    if (/^#{1,6}\s/.test(line)) { current = null; continue; }
    if (current && line) out[current] = `${out[current]}\n${line}`.trim();
    else if (!line) current = current; // a blank line does not end a field
  }
  return out;
}

// A claim-register line, per IFP's own description of the field: "the claim,
// its source, its evidence level (A…F), and what would verify it."
//
// Formats seen in the wild vary, so the grade is found rather than assumed at
// a position: a bare "(B)", "— B —", "level C", "evidence: A". An UNGRADED
// line is not treated as ungraded-but-fine; it is F by default, because the
// commonest way a line loses its grade is a model rewriting it.
export function parseClaimLine(line) {
  const raw = String(line || '').trim().replace(/^[-*]\s*/, '');
  if (!raw) return null;

  // "A" IS ALSO A WORD. A bare letter A-F is ambiguous with the English
  // article, and a case-insensitive bare match graded "a line with no grade at
  // all" as an A — a claim that establishes nothing, promoted to attested,
  // silently. So a bare letter counts only when it is UPPERCASE and set off by
  // a delimiter; lower case needs an explicit marker (level / evidence /
  // grade) or parentheses to be read as a grade at all.
  //
  // Tried in order of how explicit the writer was being.
  const GRADE_PATTERNS = [
    /(?:level|evidence|grade)\s*:?\s*([A-Fa-f])(?=[\s)\].,:;—–-]|$)/,  // "grade B:", "evidence: c"
    /\(\s*([A-Fa-f])\s*\)/,                                            // "(A)"
    /^([A-F])\s*[—–|:-]/,                                              // "A — the claim"
    /[\s(\[—–|-]([A-F])(?=[\s)\].,:;—–|-]|$)/,                         // " B " mid-line, uppercase only
  ];
  let g = null;
  for (const re of GRADE_PATTERNS) { g = raw.match(re); if (g) break; }
  const grade = g ? g[1].toUpperCase() : 'F';

  const s = raw.match(/(?:source|per|from|said by|seen in|cited)\s*:?\s*([^—|]+)/i);
  const source = s ? s[1].trim().replace(/[.,;]$/, '') : '';

  // A LEADING GRADE IS NOT THE CLAIM. Models commonly write the register as
  // "A — the claim — source: …", putting the grade first. Splitting on the
  // first delimiter then returned "A" as the entire claim, so every row read
  // as a one-letter fact — graded correctly and about nothing. Strip a
  // leading grade marker before deciding where the claim ends.
  // Strip a leading grade ONLY when a delimiter proves it is one. The first
  // version also accepted a bare letter followed by a space, which ate the "a"
  // from "a line with no grade at all" and left a claim missing its first
  // word. An article is not a grade.
  const body = raw.replace(
    /^(?:(?:level|evidence|grade)\s*:?\s*)?[A-Fa-f]\s*[—–|:-]+\s*(?=\S)/,
    '',
  );

  // The claim is everything before the first delimiter that introduces
  // metadata, so a claim containing a comma is not truncated at it.
  const claim = body.split(/\s+[—|]\s+|\s*\((?=[A-F][\s)])/)[0].trim().replace(/[.,;]$/, '');

  return { claim, grade, source, raw, ungraded: !g };
}

// SILENT TOTAL LOSS, found 2026-08-09 by importing a kit in Idea Forge Pro's
// REAL export shape rather than the hand-written fixture.
//
// IFP renders every field as ONE bullet — `- **Claim + evidence register:**
// <value>` — and parseKitFields strips the label before this ever sees it. So
// the value's first line does not begin with a dash. This used to require one,
// which discarded the entire register and reported zero claims with no error.
// A kit whose claims all vanish imports as a kit with nothing to grade, and
// grading is the only reason the import exists.
//
// The lesson is the fixture's, not the parser's: console/tests/pack-fixtures
// held a hand-written approximation using `- Label: value`, where the real
// exporter writes `- **Label:** value`. A fixture invented to stand in for a
// generator's output tests the invention.
//
// So: split on newlines OR on a pipe used as a separator (a model asked for
// several claims in one field commonly writes either), and never require a
// leading dash. Anything left that carries no grade falls to F by
// parseClaimLine's own rule — which is the safe direction, because an
// unrecognised fragment lands in Uncleared where a human sees it, rather than
// disappearing.
export function parseClaimRegister(text) {
  return String(text || '')
    .split(/\r?\n|\s+\|\s+/)
    .map((l) => l.trim().replace(/^[-*]\s*/, ''))
    // Short fragments are punctuation and stray words, not claims. A real
    // claim line carries a claim, and usually a grade and a source too.
    .filter((l) => l.length >= 8)
    .map(parseClaimLine)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// planImport(kitText) -> { claims, fields, blocked }
//
// A PLAN, not a write. Every row says where it will land and why, so a human
// reads the grading before anything moves. That review is the point: an
// import nobody looked at is the same as trusting a model's prose.
// ---------------------------------------------------------------------------

export function planImport(kitText) {
  const text = String(kitText || '').trim();
  if (!text) return { claims: [], fields: [], blocked: 'No sell-kit.md in this pack.' };

  const fieldValues = parseKitFields(text);
  const register = fieldValues['Claim + evidence register'] || '';
  const claims = parseClaimRegister(register).map((c) => {
    const clears = gradeClears(c.grade, c.source);
    return {
      ...c,
      destination: clears ? 'truth.md ## Cleared' : 'truth.md ## Uncleared',
      reason: clears
        ? `grade ${c.grade}, ${EVIDENCE_GRADES[c.grade].label.toLowerCase()}, with a source`
        : reasonForUncleared(c),
    };
  });

  const fields = KIT_FIELDS
    .filter((f) => fieldValues[f.label])
    .map((f) => ({ ...f, value: fieldValues[f.label] }));

  return { claims, fields, blocked: '' };
}

function reasonForUncleared(c) {
  const g = EVIDENCE_GRADES[c.grade];
  if (c.ungraded) return 'no evidence grade on the line, so it is treated as model-written';
  if (c.grade === 'F') return 'model-written, cannot be raised';
  if (c.grade === 'E') return 'founder assertion, no independent evidence yet';
  return `grade ${c.grade} (${g.label.toLowerCase()}) but no source given — the grade is a claim about evidence, not evidence`;
}

// ---------------------------------------------------------------------------
// applyImport(plan) -> { 'truth.md': [...lines], 'recon.md': [...], ... }
//
// Returns the BULLET LINES to append, keyed by file and heading. It writes
// nothing itself: setup.js's appendBulletToFile is the only writer, so the
// never-destroy-existing-data rule holds here too.
// ---------------------------------------------------------------------------

export function applyImport(plan, importedOn) {
  const on = String(importedOn || '').trim();
  const stamp = on ? ` — imported: ${on}` : '';
  const out = [];

  for (const c of (plan.claims || [])) {
    if (c.destination.endsWith('Cleared')) {
      out.push({ file: 'truth.md', heading: 'Cleared', line: `${c.claim} — source: ${c.source}${stamp}` });
    } else {
      out.push({ file: 'truth.md', heading: 'Uncleared', line: `${c.claim} — reason: ${c.reason}${stamp}` });
    }
  }

  for (const f of (plan.fields || [])) {
    if (f.to === 'skip') continue;
    if (f.to === 'recon') {
      out.push({ file: 'recon.md', heading: 'Pains', line: `${f.value} — heard in: an Idea Forge Pro Sell-Kit — verified: no` });
    } else if (f.to === 'motte') {
      out.push({ file: 'motte.md', heading: 'Wanted', line: `${f.value} — why: named as the value artifact in the Sell-Kit` });
    } else if (f.to === 'campaign') {
      out.push({ file: 'campaign.md', heading: 'Open now', line: `${f.label}: ${f.value} — skill: raid-campaign — done when: the pre-build test has run` });
    } else if (f.to === 'truth-uncleared') {
      out.push({ file: 'truth.md', heading: 'Uncleared', line: `${f.value} — reason: hypothesised in the Sell-Kit, not established${stamp}` });
    } else if (f.to === 'truth') {
      // Even a field the kit calls known lands UNCLEARED unless the founder
      // supplies the source. The importer never invents one, and never grades
      // a field up on the strength of the heading it sat under.
      out.push({ file: 'truth.md', heading: 'Uncleared', line: `${f.value} — reason: from the Sell-Kit, source not yet named${stamp}` });
    }
  }

  return out;
}
