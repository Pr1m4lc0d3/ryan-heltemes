// stages.js — the stage engine. Gate evaluation over a Pack, and nothing
// else: no DOM, no parsing, no linting. Consumes the Pack shape produced by
// src/pack.js only — see that file's header for the shape's guarantees,
// chiefly that every typed array (truth.cleared, bailey.active, motte.held,
// numbers.rows, campaign.blockedOnHuman, ...) already excludes malformed
// entries. Because of that, this file never has to filter malformed itself:
// reading the typed arrays is sufficient for "malformed does not count
// toward a gate" to hold automatically.
//
// This is an encoding of RAID/skills/raid-campaign/SKILL.md §2 and §3 —
// that document is the authority; read it before changing anything here.
//
// ONE ALGORITHM (SKILL.md §3, stated once, never to be duplicated):
//   Evaluate the four gates in order, stage 1 -> stage 4. The conditions are
//   NOT monotonic — a pack can satisfy gate 4's letter while failing gate 1
//   (two dated numbers.md rows and zero cleared facts does exactly that;
//   see tests/pack-fixtures/adversarial/). The open stage is the LAST stage
//   whose gate passed BEFORE the first failure — never a stage picked
//   because its own condition happens to be true in isolation.
//
// gates[] below still reports all four gates' individual pass/fail, because
// campaign.md's own "Closed, and what opens it" section (SKILL.md §8) lists
// every closed stage, not only the next one — a door needs to say what's
// blocking stage 3 AND stage 4 at once. Computing all four independently is
// not a second algorithm: it never changes which stage is "open". Only the
// `stage` walk — which stops at the first failure — decides that.
//
// AMBIGUITY, and Fix round 1 (see the Task 2 report): SKILL.md §4 says the
// delivery check is deliberately never a file read — it must be asked live,
// every run, by the skill that owns campaign.md. This module is a pure
// function over a Pack with nobody to ask. The only place the pack format
// records the answer is campaign.md's `**Delivery check:**` line (parsed as
// pack.campaign.deliveryCheck), in the shape `confirmed YYYY-MM-DD - ...`
// per SKILL.md §8. Reading that recorded line at face value would silently
// reintroduce the staleness §4 exists to prevent — a check from three weeks
// ago reported as if it were asked today. Fix round 1's answer: gate 3 still
// evaluates on the recorded outcome (a pure function has nothing else to
// evaluate on), but the gate result makes the staleness visible instead of
// hiding it — `stale`, `staleAsOf`, and a `caveat` string a door can surface
// next to the open work, rather than pretending a log is an interview.
//
// pack.js already isolates the whole Delivery check line's value as the
// plain string `pack.campaign.deliveryCheck` — the same treatment it gives
// every other freeform field (canonicalSource, whyThisStage, ...). It does
// not split the leading outcome word from the trailing ISO date, because the
// format layer treats the line as one opaque field, same as those others.
// readDeliveryCheck() below reads that already-extracted field's value, not
// pack.raw[...] markdown — pulling a documented sub-part out of a field
// pack.js already handed us is not the "parsing raw text inside stages.js"
// this file is meant to avoid; reaching past pack.js into raw file text
// would be. `pack.campaign.stage.number` (recordedStage, used below) was
// already parsed by pack.js — no gap there either.

const STAGE_NAMES = ['Foundation', 'Standing', 'First artifacts', 'First links', 'Prune'];

// Verbatim from SKILL.md §2's stage table — "The work" column. Not derived
// per-adopter (that needs recon.md room-picking and belongs to a door, not
// this engine); this is the generic description of what a stage's gate
// makes available.
const STAGE_WORK = [
  ['Build the pack.', 'Stand up owned assets.', 'Create accounts — they start cold.', 'Zero promotional activity.'],
  ['Enter rooms and be useful.', 'No links.', 'Earn the right to be heard.'],
  ['Publish something substantial on land you own, then syndicate cuts of it.'],
  ['Share the artifact where it is genuinely on topic.'],
  ['Kill what produced nothing.', 'Double down on what did.'],
];

// Gate 1 · Standing — truth.md ## Cleared is non-empty.
function evalGate1(pack) {
  const cleared = pack.truth?.cleared || [];
  const open = cleared.length > 0;
  return {
    stage: 1,
    open,
    condition: 'truth.md has at least one entry under ## Cleared',
    unmet: open ? '' : 'No cleared facts in truth.md — you have nothing you can safely say yet.',
  };
}

// Gate 2 · First artifacts — a bailey.md ## Active line reads
// standing: warming or standing: established.
function evalGate2(pack) {
  const active = pack.bailey?.active || [];
  const open = active.some((e) => e.fields.standing === 'warming' || e.fields.standing === 'established');
  return {
    stage: 2,
    open,
    condition: 'a bailey.md ## Active line reads standing: warming or standing: established',
    unmet: open
      ? ''
      : 'No account in bailey.md ## Active has earned standing: warming or standing: established — publishing now would waste the artifact on an audience that does not know you yet.',
  };
}

// Today's date as YYYY-MM-DD (UTC), the same shape SKILL.md §8 records
// delivery-check dates in. The one place this file's purity bends to the
// wall clock — staleness is a statement about "since when has nobody
// looked", which has no meaning without knowing what day it is now.
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// Split pack.campaign.deliveryCheck's already-isolated string value into
// {recorded, passed, date} — see the header note on why this reads a field
// pack.js already extracted, not raw markdown.
//   recorded: false only when the line/file is absent entirely (''), per
//             SKILL.md §3's "a missing file reads the same as an empty one".
//   passed:   true only for a line starting "confirmed" — "not yet asked"
//             and "unverified ..." are recorded but not passed.
//   date:     the YYYY-MM-DD after "confirmed", or null if absent/unparseable.
const DELIVERY_CONFIRMED_RE = /^confirmed\s+(\d{4}-\d{2}-\d{2})\b/i;

function readDeliveryCheck(pack) {
  const raw = (pack.campaign?.deliveryCheck || '').trim();
  if (raw === '') return { recorded: false, passed: false, date: null };
  const m = raw.match(DELIVERY_CONFIRMED_RE);
  if (m) return { recorded: true, passed: true, date: m[1] };
  return { recorded: true, passed: false, date: null };
}

// Gate 3 · First links — motte.md ## Held is non-empty AND the delivery
// check has passed. See the header note for how "passed" is read from a
// static Pack, and for `stale`/`staleAsOf`/`caveat` — added in Fix round 1
// so an open-but-stale check is never reported as flatly as a fresh one.
function evalGate3(pack) {
  const held = pack.motte?.held || [];
  const heldOpen = held.length > 0;
  const delivery = readDeliveryCheck(pack);
  const open = heldOpen && delivery.passed;

  let unmet = '';
  let stale = false;
  let staleAsOf = null;
  let caveat = '';

  if (open) {
    staleAsOf = delivery.date;
    // A confirmed line with no parseable date is treated as stale too —
    // "confirmed, date unknown" gets no free pass to look fresh.
    stale = delivery.date === null || delivery.date !== todayISODate();
    if (stale) {
      caveat = delivery.date
        ? `Delivery last confirmed ${delivery.date}. Re-confirm before acting on stage 3; a path that worked then can be broken now.`
        : 'Delivery was confirmed but no date was recorded. Re-confirm before acting on stage 3; a path that worked then can be broken now.';
    }
  } else if (!heldOpen && !delivery.passed) {
    unmet = delivery.recorded
      ? 'motte.md has nothing under ## Held, and campaign.md\'s delivery check has not been confirmed — there is no owned ground to send a link to, and no one has verified a stranger can actually receive what they paid for.'
      : 'motte.md has nothing under ## Held, and campaign.md records no delivery check at all — absent is not the same as passed. There is no owned ground to send a link to, and no one has confirmed a stranger can actually receive what they paid for.';
  } else if (!heldOpen) {
    unmet =
      'motte.md has nothing under ## Held yet — a link into rented ground would convert earned standing into someone else\'s asset instead of your own.';
  } else {
    unmet = delivery.recorded
      ? 'campaign.md\'s delivery check has not been confirmed — ask the adopter directly whether a stranger can complete the action end to end (download, install, buy, receive), and record the answer before sending traffic anywhere.'
      : 'No delivery check is recorded in campaign.md — the check must be confirmed before stage 3 can open. Absent is not the same as passed.';
  }

  return {
    stage: 3,
    open,
    condition: 'motte.md ## Held is non-empty AND the delivery check has passed',
    unmet,
    stale,
    staleAsOf,
    caveat,
  };
}

// Gate 4 · Prune — numbers.md has at least two dated rows, at least one of
// Kind: motte. pack.numbers.rows already excludes malformed rows (missing
// date, metric, a valid Kind, value, or source) — see pack.js.
function evalGate4(pack) {
  const rows = pack.numbers?.rows || [];
  const motteRows = rows.filter((r) => r.fields.kind === 'motte');
  const open = rows.length >= 2 && motteRows.length >= 1;
  let unmet = '';
  if (!open) {
    if (rows.length < 2) {
      unmet = `numbers.md has only ${rows.length} dated row${rows.length === 1 ? '' : 's'} — you cannot prune against nothing; the gate needs at least two before there is evidence to act on.`;
    } else {
      unmet = 'numbers.md has at least two dated rows but none of Kind: motte — two rows of rented-platform attention is not evidence to prune with.';
    }
  }
  return {
    stage: 4,
    open,
    condition: 'numbers.md has at least two dated rows, at least one of Kind: motte',
    unmet,
  };
}

const GATE_EVALUATORS = [evalGate1, evalGate2, evalGate3, evalGate4];

// evaluate(pack) -> {
//   stage, openWork[], gates[], blockedOnHuman[],
//   recordedStage, stageDrift, stageDriftMessage,
// }
//
// `gates` always holds all four results (see the header note on why that is
// not a second algorithm). `stage` is derived by walking them in order and
// stopping at the first one that is not open — the one algorithm.
//
// `recordedStage`/`stageDrift`/`stageDriftMessage` — Fix round 1.
// campaign.md is derived output (raid-campaign's last write); the pack is
// input. `recordedStage` is what campaign.md's own `**Stage:**` line last
// said (pack.campaign.stage.number, already parsed by pack.js — null if
// campaign.md is absent or the line is unparseable). When it disagrees with
// the freshly computed `stage`, the pack has moved since the agent's last
// run and the human should be told, not left to trust stale prose — this
// console reads and reports the drift, it never rewrites campaign.md.
export function evaluate(pack) {
  pack = pack || {};

  const gates = GATE_EVALUATORS.map((fn) => fn(pack));

  let stage = 0;
  for (const gate of gates) {
    if (!gate.open) break;
    stage = gate.stage;
  }

  const blockedOnHuman = (pack.campaign?.blockedOnHuman || []).map((e) => e.raw);

  const recordedStage = pack.campaign?.stage?.number ?? null;
  const stageDrift = recordedStage !== null && recordedStage !== stage;
  const stageDriftMessage = stageDrift
    ? `campaign.md records stage ${recordedStage}, but the pack now justifies stage ${stage}. Re-run raid-campaign.`
    : '';

  return {
    stage,
    openWork: STAGE_WORK[stage].slice(),
    gates,
    blockedOnHuman,
    recordedStage,
    stageDrift,
    stageDriftMessage,
  };
}

export { STAGE_NAMES };
