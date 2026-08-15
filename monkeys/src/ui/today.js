// today.js — Door 2, "What do I do today". Renders evaluate(pack) into the
// console's second door: current stage and why, 1-3 named actions, what is
// blocked and the shortest honest unblock, what is waiting on a human, and
// the three things the skills cannot see for themselves (stage drift, a
// stale delivery check, malformed pack entries) — see plan Task 5 and
// design.md §6B.
//
// Structure mirrors fs.js's own house rule: the rendering logic
// (renderTodayHTML) is a PURE function of a Pack — no DOM, no globals,
// deterministic output for a given input — so it can be exercised headlessly
// in tests/render.mjs. mountToday() is the thin thing that actually touches
// the DOM. Only src/pack.js and src/stages.js are imported; nothing here
// parses markdown or evaluates gates a second time — see stages.js's own
// header on why there must be exactly one algorithm for that.
//
// EVERY string that came out of the pack (claims, sources, decisions,
// malformed raw text, a founder's own words) is escaped before it is placed
// in the HTML string below — pack content is user text and may contain "<".

import { evaluate, STAGE_NAMES } from '../stages.js';
import { renderNeedsPackHTML } from './loader.js';
import { renderStepGroup } from './steps.js';
import { makeGlossState, glossFor } from './glossary.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// The shortest honest step that opens each gate, one line per gate number.
// Written directly from each gate's own `condition` string in stages.js (see
// evalGate1..4) — a restatement of the same requirement as an action, not a
// second, independently-invented rule. The gate's `unmet` string (shown
// as-is, never paraphrased) stays the full human explanation; this is only
// the short next step.
// Said wherever a skill name is handed to the reader as an instruction. The
// cold run's founder had never heard of raid-campaign and was told to run it
// with no idea what it was — so the sentence that names it also says what it
// is and how it reaches this console.
const SKILL_NOTE =
  'raid-campaign is a skill you run in your own AI agent — it writes campaign.md; this console reads what it writes.';

// PLAIN ENGLISH FOR EACH GATE, because the hero is the one place jargon costs
// the most.
//
// stages.js writes `unmet` for an operator who knows the pack format, and it
// is right to: raid-campaign's SKILL.md defines those strings and this console
// must never paraphrase the authority. But rendered straight into the biggest
// block on the page it read:
//
//   "campaign.md's delivery check has not been confirmed — ask the adopter
//    directly whether a stranger can complete the action end to end"
//
// A file name and the word "adopter", to a person who has never opened the
// doctrine. Same failure raid-dossier's translation rule exists to prevent,
// repeated on the screen instead of in the document.
//
// So the hero says what it MEANS, and the exact string stays underneath it in
// small type — the precise sentence is not lost, it just stops being the first
// thing the eye lands on. Keyed by the gate that is closed.
const GATE_PLAIN = {
  1: 'You have nothing you can safely say in public yet.',
  2: 'Every room you are in, you are a stranger in.',
  3: 'Nobody has checked that a stranger can actually buy this.',
  4: 'You have no recorded results yet, so there is nothing to judge.',
};

const GATE_UNBLOCK = {
  1: 'Add one sourced fact under truth.md’s ## Cleared section.',
  2: 'Get one bailey.md ## Active account to standing: warming or standing: established.',
  3: 'Add an entry under motte.md ## Held, and confirm the delivery check in campaign.md.',
  4: 'Record at least two dated rows in numbers.md, including at least one of Kind: motte.',
};

// ---------------------------------------------------------------------------
// "Current stage and why" — the reason is always read straight from the
// gate that is actually doing the deciding (the last passed gate's
// `condition`, or gate 1's `unmet` at stage 0). That is the one source that
// can never drift, because it is recomputed fresh in the same evaluate()
// call this whole view is built from — unlike campaign.md's own prose,
// which can describe a stage that is no longer the one the pack justifies.
// ---------------------------------------------------------------------------

/** The hero: what to do, and the one thing standing in the way.
 *
 *  WHAT THIS REPLACED, and why it was the worst line on the screen. The old
 *  block put `gate.condition` for the CURRENT stage directly under the
 *  heading — the condition that ALREADY OPENED this stage. On a real pack that
 *  rendered as:
 *
 *      "a bailey.md ## Active line reads standing: warming or established"
 *
 *  In the most prominent position on the page: doctrine vocabulary, a raw file
 *  format, describing something finished. It answered a question nobody asked.
 *
 *  The sentence a reader actually needs is the UNMET condition of the next
 *  closed gate, which the sidebar had been rendering correctly all along while
 *  the main column showed this.
 *
 *  So: the stage number becomes a quiet eyebrow (it is context, not the
 *  point), the stage's plain-English work becomes the answer, and the blocker
 *  becomes the one dark block on a light page. That is also the only place
 *  --gold appears, because gold means exactly one thing now: this is what
 *  stands between you and the next stage.
 */
function renderStageBlock(evalResult) {
  const name = STAGE_NAMES[evalResult.stage] || '';
  const last = STAGE_NAMES.length - 1;
  const nextClosed = evalResult.gates.find((g) => !g.open);

  // The stage's own work, in the plain words stages.js already keeps. Falls
  // back to the stage name rather than inventing a sentence.
  const answer = (evalResult.openWork && evalResult.openWork[0]) || name;

  const gate = nextClosed
    ? `
      <section class="gate">
        <p class="gate-label">In the way</p>
        <p class="gate-condition">${escapeHtml(GATE_PLAIN[nextClosed.stage] || nextClosed.unmet || '')}</p>
        <p class="gate-note">${escapeHtml(nextClosed.unmet || '')}</p>
      </section>`
    : `
      <section class="gate">
        <p class="gate-label">Nothing is blocking you</p>
        <p class="gate-condition">Every gate is open. What is left is the work itself.</p>
      </section>`;

  return `
    <section class="today-stage">
      <p class="landing-eyebrow">Stage ${evalResult.stage} of ${last} · ${escapeHtml(name)}</p>
      <h2 class="landing-answer">${escapeHtml(answer)}</h2>
      ${gate}
    </section>`;
}

// ---------------------------------------------------------------------------
// "Do today" — 1 to 3 named actions. The ONLY place in the pack that names a
// skill alongside an action is campaign.md's ## Open now (already excluded
// of malformed entries by pack.js). It is shown as-is ONLY when campaign.md
// agrees with the freshly computed stage (no drift): under drift, campaign's
// Open now was written for whatever stage IT last recorded, which may since
// have closed or moved on — showing it uncritically risks exactly the thing
// this section must never do, surface work from a closed stage. When drift
// is present, or no campaign.md exists yet, this falls back to the generic,
// always-fresh per-stage description (evaluate().openWork) with a clear
// label that it is general guidance, not a skill-named action — never
// inventing a skill name that was not actually written by campaign.md.
// ---------------------------------------------------------------------------

function renderActionItem(entry) {
  return `
    <li class="action-item">
      <p class="action-text">${escapeHtml(entry.fields.action)}</p>
      <p class="action-meta">skill: <strong>${escapeHtml(entry.fields.skill)}</strong> — done when: ${escapeHtml(entry.fields.doneWhen)}</p>
    </li>`;
}

function renderDoTodaySection(pack, evalResult) {
  const openNow = pack.campaign?.openNow || [];
  const trustworthy = !evalResult.stageDrift && openNow.length > 0;

  if (trustworthy) {
    const items = openNow.slice(0, 3).map(renderActionItem).join('');
    return `
      <section class="today-section">
        <h3>Do today</h3>
        <ul class="action-list">${items}</ul>
      </section>`;
  }

  const note = evalResult.stageDrift
    ? 'campaign.md’s actions may target an old stage, so they are not shown. Re-run raid-campaign for fresh ones. Meanwhile, this stage calls for:'
    : 'No campaign.md action list yet — run raid-campaign for named actions. Meanwhile, this stage calls for:';
  const generic = evalResult.openWork.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  return `
    <section class="today-section">
      <h3>Do today</h3>
      <p class="muted-note">${note}</p>
      <p class="muted-note skill-note">${SKILL_NOTE}</p>
      <ul class="generic-list">${generic}</ul>
    </section>`;
}

// ---------------------------------------------------------------------------
// "Blocked" — every currently closed gate (evalResult.gates already holds
// all four; see stages.js's header for why that is not a second algorithm),
// each with its unmet condition shown AS-IS (never paraphrased — the strings
// in stages.js are already written for a human) plus the shortest honest
// unblock from GATE_UNBLOCK above.
// ---------------------------------------------------------------------------

function renderGateBlock(gate) {
  return `
    <li class="gate-block">
      <p class="gate-condition">Stage ${gate.stage} — ${escapeHtml(STAGE_NAMES[gate.stage] || '')}</p>
      <p class="gate-unmet">${escapeHtml(gate.unmet)}</p>
      <p class="gate-unblock"><strong>Shortest unblock:</strong> ${escapeHtml(GATE_UNBLOCK[gate.stage] || '')}</p>
    </li>`;
}

function renderBlockedSection(evalResult) {
  const closed = evalResult.gates.filter((g) => !g.open);
  const body = closed.length
    ? `<ul class="gate-list">${closed.map(renderGateBlock).join('')}</ul>`
    : '<p class="muted-note">Nothing is blocked — every gate is open.</p>';
  return `
    <section class="today-section">
      <h3>Blocked</h3>
      ${body}
    </section>`;
}

// ---------------------------------------------------------------------------
// "Waiting on you" — decisions no work can unblock (campaign.md's own
// "Blocked on a human decision" section, already excluded of malformed
// entries by pack.js; evaluate() hands back the raw bullet text for each).
// ---------------------------------------------------------------------------

function renderWaitingSection(evalResult) {
  const items = evalResult.blockedOnHuman;
  const body = items.length
    ? `<ul class="waiting-list">${items.map((raw) => `<li>${escapeHtml(raw)}</li>`).join('')}</ul>`
    : '<p class="muted-note">Nothing is waiting on a human decision right now.</p>';
  return `
    <section class="today-section">
      <h3>Waiting on you</h3>
      ${body}
    </section>`;
}

// ---------------------------------------------------------------------------
// "Needs attention" — the three things a skill running in isolation cannot
// see for itself, and the console's whole reason to exist (plan Task 5):
//   1. stage drift        — evaluate()'s own stageDrift/stageDriftMessage.
//   2. stale delivery check — gate 3's own stale/caveat, only meaningful
//      when gate 3 is OPEN (a closed gate 3 already appears under Blocked).
//   3. malformed pack entries — pack.malformed, verbatim raw text, never
//      hidden and never repaired.
//   4. unrecognised headings — pack.unrecognised (pack.js rule 4). A section
//      heading the format does not know, or a file with no recognised heading
//      at all. Nothing under one of those ever reaches a typed array, so
//      without this it disappears with no signal — the exact silent drop the
//      Setup door promises never happens. What was FOUND and what was
//      EXPECTED are both named; the console never assumes the two were meant
//      to be the same thing.
// ---------------------------------------------------------------------------

function renderUnrecognisedEntry(entry) {
  const where = entry.heading === null
    ? `${escapeHtml(entry.file)} — no recognised heading anywhere in the file`
    : `${escapeHtml(entry.file)} — found the heading “## ${escapeHtml(entry.heading)}”`;
  const expected = (entry.expected || []).map((h) => `## ${escapeHtml(h)}`).join(', ');
  const body = (entry.lines || []).join('\n').replace(/\s+$/, '');
  return `
    <li class="unrecognised-entry">
      <p class="unrecognised-loc">${where}</p>
      <p class="unrecognised-expected">Expected: ${expected}. Nothing under it was read; your file is unchanged.</p>
      ${body ? `<pre class="unrecognised-raw">${escapeHtml(body)}</pre>` : ''}
    </li>`;
}

function renderUnrecognisedBlock(unrecognised) {
  if (!unrecognised.length) return '';
  const n = unrecognised.length;
  return `
    <li class="attention-item">
      <p>${n} ${n === 1 ? 'section' : 'sections'} ${n === 1 ? 'uses' : 'use'} a heading this format doesn’t recognise. Rename it yourself if you meant one of these:</p>
      <ul class="unrecognised-list">${unrecognised.map(renderUnrecognisedEntry).join('')}</ul>
    </li>`;
}

function renderMalformedEntry(entry) {
  return `
    <li class="malformed-entry">
      <p class="malformed-loc">${escapeHtml(entry.file)} — ${escapeHtml(entry.section)}</p>
      <pre class="malformed-raw">${escapeHtml(entry.raw)}</pre>
    </li>`;
}

function renderAttentionSection(pack, evalResult) {
  const items = [];

  if (evalResult.stageDrift) {
    items.push(`<li class="attention-item">${escapeHtml(evalResult.stageDriftMessage)}</li>`);
  }

  const gate3 = evalResult.gates.find((g) => g.stage === 3);
  if (gate3 && gate3.open && gate3.caveat) {
    items.push(`<li class="attention-item">${escapeHtml(gate3.caveat)}</li>`);
  }

  const malformed = pack.malformed || [];
  const malformedBlock = malformed.length
    ? `<li class="attention-item">
        <p>${malformed.length} pack ${malformed.length === 1 ? 'entry' : 'entries'} could not be read and ${malformed.length === 1 ? 'was' : 'were'} left out, exactly as written:</p>
        <ul class="malformed-list">${malformed.map(renderMalformedEntry).join('')}</ul>
      </li>`
    : '';
  if (malformedBlock) items.push(malformedBlock);

  const unrecognisedBlock = renderUnrecognisedBlock(pack.unrecognised || []);
  if (unrecognisedBlock) items.push(unrecognisedBlock);

  const body = items.length
    ? `<ul class="attention-list">${items.join('')}</ul>`
    : '<p class="muted-note">Nothing needs attention right now.</p>';
  return `
    <section class="today-section">
      <h3>Needs attention</h3>
      ${body}
    </section>`;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

// The reason this door needs a pack, said once. home.js passes the same
// string when IT decides there is no pack; renderTodayHTML falls back to it
// when handed nothing directly, so the two can never describe the door
// differently.
export const TODAY_NEEDS_PACK_REASON =
  'reads truth.md, bailey.md, motte.md, campaign.md and numbers.md to know your stage, today’s actions, and what is blocked.';

// renderTodayHTML(pack) -> string. Pure: no DOM, no globals besides the pack
// argument itself. A null/absent pack returns the "this door needs a pack"
// view rather than throwing: the no-blank-screen guarantee belongs to the
// renderer, not to whoever happens to call it. home.js still decides the
// same thing one level up, which is where the loader's state lives — this is
// the floor under that, not a replacement for it.
export function renderTodayHTML(pack) {
  if (!pack) return renderNeedsPackHTML('This door', TODAY_NEEDS_PACK_REASON);

  const evalResult = evaluate(pack);
  const gloss = makeGlossState();

  const stage = renderStageBlock(evalResult);
  const doToday = renderDoTodaySection(pack, evalResult);
  const blocked = renderBlockedSection(evalResult);
  const waiting = renderWaitingSection(evalResult);
  const attention = renderAttentionSection(pack, evalResult);

  // The stage line stays pinned — it is the answer to the door's own
  // question, and burying it behind a step would mean the one fact you came
  // for needs a click. The four readings below it are steps.
  //
  // MEASURED: stacked, this view came to 804px at 1400x700 and 1111px at
  // 1100x640 against roughly 600px of room — so the blockers, which are the
  // whole reason to open this door, sat below the fold on every screen this
  // was tested at. One at a time is the same answer Door 2 and Door 4 already
  // give, and the same one asked for after the six stacked file forms.
  // 'Blocked' is NOT a step any more: the gate block in the hero above is the
  // blocker, set larger and read first. Keeping both meant the same fact twice
  // on one screen, and the pair pushed this view 246px past its viewport at
  // 1400x700 (tests/noscroll.mjs). The hero states the gate that is actually
  // in the way; the fuller reading of every closed gate stays one tab along,
  // under 'Needs attention', where it is reference rather than headline.
  const steps = [
    ['do-today', 'Do today', `${doToday}${glossFor(gloss, doToday)}`],
    ['waiting', 'Waiting on you', `${waiting}${glossFor(gloss, waiting)}`],
    ['attention', 'Needs attention',
      `${blocked}${attention}${glossFor(gloss, `${blocked}${attention}`, evalResult.stageDrift ? ['drift', 'gate'] : ['gate'])}`],
  ];

  // .landing carries the measure (~68ch) and the vertical rhythm. The column
  // ran ~120 characters per line before, which is roughly double what anyone
  // reads comfortably.
  // THE HERO IS FIXED, THE LIST SCROLLS. Three actions each carrying a
  // done-when condition is real content, not padding, and at 1100x640 it does
  // not fit under a hero no matter how the type is tuned. Truncating it would
  // hide the conditions that make an action checkable — the whole point of the
  // list. So the answer and the gate stay pinned where the eye lands, and the
  // list below them scrolls in its own region, the same treatment the agent
  // transcript already gets. .scroll-body itself stays un-overflowed, which is
  // what tests/noscroll.mjs measures.
  return `
    <div class="today-view landing">
      <div class="landing-fixed">${stage}${glossFor(gloss, stage)}</div>
      <div class="landing-scroll">${renderStepGroup('today', steps)}</div>
    </div>`;
}

// mountToday(container, pack) -> void. The thin DOM-touching half — the only
// place in this module that assigns innerHTML.
export function mountToday(container, pack) {
  container.innerHTML = renderTodayHTML(pack);
}
