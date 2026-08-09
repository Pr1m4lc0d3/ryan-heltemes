// check.js — Door 3, "Check before I publish". Pastes a draft, runs it
// through lint.js against truth.md's own register, and shows four things
// side by side: what got flagged, what is already sourced (the claim map —
// the reassuring half), what was deliberately left out of the draft (claims
// avoided), and a mechanical fix plan. A paste block only ever appears once
// there is nothing left to fix. See plan Task 6 and design.md §6.
//
// Structure mirrors today.js's own house rule: renderCheckHTML is a PURE
// function of (pack, draftText) — no DOM, no globals, deterministic output
// for given input — so it is exercised headlessly in tests/render.mjs.
// mountCheck() is the thin DOM-touching half.
//
// THE CONSOLE NEVER PUBLISHES. There is no send button here, only a paste
// block and a checklist for a human to act on by hand.
//
// EVERY string that came from the pack or the draft (claims, sources,
// reasons, the draft itself) is escaped before insertion — see escapeHtml
// below. Draft text is arbitrary user text and may contain "<".
//
// ONE LINTER, TWO CALLS, NO SECOND ALGORITHM. This module never re-decides
// whether a claim is sourced — that question has exactly one answer and it
// lives in lint.js (see that file's own header on why a second
// implementation of "is this sourced" is the drift risk the whole console
// architecture exists to avoid). computeFindings() below calls findClaims()
// and lint() — both imported unmodified from lint.js — and treats the
// DIFFERENCE between "every claim-shaped span" and "every unsourced one" as
// the sourced set. Nothing here reimplements isSourced() or the span-window
// rule for that decision.
//
// The one place a smaller, display-only heuristic *is* reimplemented is
// attributeCleared() below, which only picks WHICH cleared line to show next
// to a claim already known (by the real lint()) to be sourced. A miss there
// misattributes a line; it can never mis-source a claim, because the
// authoritative call already happened in computeFindings().

import { findClaims, lint, DEFAULT_CONFIG } from '../lint.js';
import { renderNeedsPackHTML } from './loader.js';
import { renderStepGroup } from './steps.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const NOOP_WARN = () => {};

// ---------------------------------------------------------------------------
// Category copy — human labels and the honest "what kind of source would
// settle this" text (Rule: NEVER invent a source, a citation, or a number;
// only name what KIND of source would settle the claim). None of these
// strings contain a digit or a URL — see the "fix plan never fabricates"
// test in tests/render.mjs, which depends on that being true.
// ---------------------------------------------------------------------------

const CATEGORY_LABEL = {
  number: 'Number', magnitude: 'Magnitude', superlative: 'Superlative',
  comparative: 'Comparative', absolute: 'Absolute', testimonial: 'Testimonial',
};

const SOURCE_KIND = {
  number: 'A dated internal record that actually counts this — an order log, invoice count, or analytics export — added to truth.md’s ## Cleared with that source named.',
  magnitude: 'The same as a number claim: a dated internal record or export that actually counts what this claims, not a rounded guess.',
  superlative: 'An independent, dated comparison you can name — a review, a benchmark, or a third-party ranking — cited in truth.md.',
  comparative: 'A named, dated head-to-head comparison against the specific thing being compared to.',
  testimonial: 'The named person or account who actually said this, with their permission to quote them, recorded in truth.md.',
  absolute: 'Evidence covering literally every case this word claims — rare to actually have. If you have it, name where it lives.',
};

// Mechanical rewrites, per RULES: "narrow a superlative to a plain noun,
// drop an unsourced number, replace an absolute with a qualified phrase. If
// a rewrite cannot be produced mechanically, say 'narrow or cut' rather than
// guessing." Only these three categories get an actual generated rewrite;
// magnitude, comparative and testimonial fall through to the honest fallback
// below rather than a guessed one.
const ABSOLUTE_QUALIFIERS = {
  never: 'rarely',
  always: 'usually',
  guaranteed: 'intended',
  nobody: 'few people',
  'no one': 'few people',
  everyone: 'many people',
  zero: 'very few',
};

function suggestNarrow(finding) {
  if (finding.category === 'superlative') {
    return `Remove “${escapeHtml(finding.span)}” — what is left is usually a plain, provable noun.`;
  }
  if (finding.category === 'number') {
    return `Remove the unsourced figure “${escapeHtml(finding.span)}”.`;
  }
  if (finding.category === 'absolute') {
    const key = finding.span.trim().toLowerCase().replace(/\s+/g, ' ');
    const q = ABSOLUTE_QUALIFIERS[key];
    if (q) return `Replace “${escapeHtml(finding.span)}” with “${escapeHtml(q)}”.`;
  }
  return 'A mechanical rewrite is not safe to generate for this one — narrow or cut it by hand.';
}

// ---------------------------------------------------------------------------
// The register, and the authoritative sourced/unsourced split.
// pack.truth.cleared already excludes malformed entries (pack.js's own
// contract) — the same guarantee stages.js leans on, see that file's header.
// ---------------------------------------------------------------------------

function buildRegister(pack) {
  return (pack.truth?.cleared || []).map((e) => e.raw.toLowerCase());
}

function sameFinding(a, b) {
  return a.line === b.line && a.col === b.col && a.category === b.category
    && a.span === b.span && a.severity === b.severity;
}

// {all, flagged, sourced} — `all` is every claim-shaped span findClaims()
// finds, `flagged` is lint()'s own unsourced subset, and `sourced` is the
// set difference. See the module header for why this is the diff of two
// real calls rather than a reimplementation of isSourced().
function computeFindings(pack, draftText) {
  const register = buildRegister(pack);
  const all = findClaims(draftText, DEFAULT_CONFIG, NOOP_WARN);
  const flagged = lint(draftText, register, DEFAULT_CONFIG, NOOP_WARN);
  const sourced = all.filter((a) => !flagged.some((f) => sameFinding(a, f)));
  return { flagged, sourced };
}

// ---------------------------------------------------------------------------
// Claim map attribution — display-only heuristic, see module header. Tries
// the claim's own line, then a short trailing window (the same shape
// lint.js's own span-window rule takes, simplified — it does not need to be
// exact, because the sourced/unsourced call already happened elsewhere).
// ---------------------------------------------------------------------------

function draftLine(draftText, lineNumber) {
  const lines = draftText.split(/\r\n|\n|\r/);
  return lines[lineNumber - 1] || '';
}

function shortWindow(line, col, span) {
  if (col < 0 || line.slice(col, col + span.length) !== span) return line;
  const after = line.slice(col + span.length).trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (after.length === 0) return line;
  return `${span} ${after.join(' ')}`;
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attributeCleared(finding, draftText, clearedEntries) {
  const line = draftLine(draftText, finding.line);
  const window = shortWindow(line, finding.col, finding.span);
  const candidates = [line, window]
    .map((t) => t.trim().toLowerCase().replace(/\.+$/, ''))
    .filter((t) => t.length > 0);
  for (const entry of clearedEntries) {
    const hay = ` ${entry.raw.toLowerCase()} `;
    for (const needle of candidates) {
      if (new RegExp(`(?:^|[^A-Za-z0-9])${escapeRe(needle)}(?:$|[^A-Za-z0-9])`, 'i').test(hay)) {
        return entry;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Claims avoided — token overlap, kept simple and honest per the plan: an
// empty draft can't be judged for relevance, so every uncleared entry is
// shown instead of guessing. A non-empty draft with no entry crossing the
// overlap threshold is reported as exactly that, not hidden.
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'will', 'your', 'their', 'about',
  'which', 'there', 'these', 'those', 'into', 'over', 'after', 'before',
  'because', 'been', 'were', 'they', 'them', 'when', 'what', 'than',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

function overlapCount(draftTokenSet, entryTokens) {
  let n = 0;
  for (const w of entryTokens) if (draftTokenSet.has(w)) n += 1;
  return n;
}

const AVOIDED_OVERLAP_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// Render — each function below returns an HTML string for one region.
// ---------------------------------------------------------------------------

function renderMissingTruthNote(pack) {
  if (!(pack.missing || []).includes('truth.md')) return '';
  return `
    <section class="check-notice">
      <p><strong>truth.md is missing from this pack.</strong> With no register, every claim-shaped sentence below will read as unsourced. Add truth.md's <code>## Cleared</code> section to start sourcing claims.</p>
    </section>`;
}

function renderDraftInput(draftText) {
  return `
    <section class="check-section">
      <h3>Draft</h3>
      <p class="muted-note">Paste the text you're about to publish.</p>
      <textarea id="check-draft" class="draft-input" rows="10" placeholder="Paste your draft here…">${escapeHtml(draftText)}</textarea>
    </section>`;
}

// The write panel. Door 3 was "check a draft you wrote somewhere else",
// which left the console collecting a pack it could do nothing with. It
// writes one now, from the pack, and the draft lands in the same box the
// linter already reads — so every generated line goes straight through the
// same check a hand-written one does. The model is told the rules AND the
// output is checked; neither alone is a guard.
//
// The provider row is a <details>: a founder who has set a key once should
// not have to look at it again.
function renderWritePanel(cfg, ask, busy, error) {
  const configured = Boolean(cfg.baseUrl && cfg.apiKey && cfg.model);
  return `
    <section class="check-section">
      <div class="write-row">
        <input type="text" id="write-ask" class="setup-input" value="${escapeHtml(ask)}"
          placeholder="What do you want written? e.g. a short post for the forum about the batch dates">
        <button type="button" class="btn btn-secondary" data-action="write-draft"${busy ? ' disabled' : ''}>${busy ? 'Writing…' : 'Write a draft'}</button>
      </div>
      ${error ? `<p class="load-error">${escapeHtml(error)}</p>` : ''}
      ${configured ? '' : '<p class="muted-note">No API key yet. Set one in the <strong>Agent</strong> panel on the right; it is used for this too.</p>'}
    </section>`;
}

function renderFindingItem(f) {
  return `
    <li class="finding-item finding-${escapeHtml(f.severity)}">
      <p class="finding-meta">line ${f.line} &middot; ${escapeHtml(CATEGORY_LABEL[f.category] || f.category)} &middot; <strong>${escapeHtml(f.severity)}</strong></p>
      <p class="finding-span">&ldquo;${escapeHtml(f.span)}&rdquo;</p>
    </li>`;
}

// `empty` splits the two zero-states apart. "No unsourced claim-shaped
// language found" is a verdict, and an untouched textarea has not earned one
// — same reason renderNothingToCheck exists.
function renderFindingsSection(flagged, empty) {
  const body = flagged.length
    ? `<ul class="finding-list">${flagged.map(renderFindingItem).join('')}</ul>`
    : `<p class="muted-note">${empty ? 'Nothing has been pasted yet, so there is nothing to find.' : 'No unsourced claim-shaped language found.'}</p>`;
  return `
    <section class="check-section">
      <h3>Findings</h3>
      ${body}
    </section>`;
}

function renderClaimMapItem(finding, entry) {
  const sourceText = entry
    ? `<p class="claim-source">traces to truth.md ## Cleared: &ldquo;${escapeHtml(entry.raw)}&rdquo;</p>`
    : '<p class="claim-source muted-note">sourced by an entry in truth.md ## Cleared — which line could not be pinned down automatically; check by hand.</p>';
  return `
    <li class="claim-item">
      <p class="claim-span">&ldquo;${escapeHtml(finding.span)}&rdquo; — line ${finding.line}</p>
      ${sourceText}
    </li>`;
}

function renderClaimMapSection(pack, draftText, sourced) {
  const cleared = pack.truth?.cleared || [];
  const body = sourced.length
    ? `<ul class="claim-list">${sourced.map((f) => renderClaimMapItem(f, attributeCleared(f, draftText, cleared))).join('')}</ul>`
    : '<p class="muted-note">No claim in this draft is currently sourced.</p>';
  return `
    <section class="check-section">
      <h3>Claim map</h3>
      <p class="muted-note">Claims in this draft that are already sourced, and the truth.md line each traces to.</p>
      ${body}
    </section>`;
}

function renderAvoidedItem(entry) {
  return `
    <li class="avoided-item">
      <p class="avoided-fact">${escapeHtml(entry.fields.fact || entry.raw)}</p>
      <p class="avoided-reason muted-note">reason: ${escapeHtml(entry.fields.reason || '(not recorded)')}</p>
    </li>`;
}

function renderClaimsAvoidedSection(pack, draftText) {
  const uncleared = pack.truth?.uncleared || [];
  if (uncleared.length === 0) {
    return `
      <section class="check-section">
        <h3>Claims avoided</h3>
        <p class="muted-note">No entries under truth.md ## Uncleared.</p>
      </section>`;
  }
  const draftTokens = tokenize(draftText);
  if (draftTokens.length === 0) {
    return `
      <section class="check-section">
        <h3>Claims avoided</h3>
        <p class="muted-note">The draft is empty, so relevance can't be judged yet — showing every uncleared entry so nothing is hidden.</p>
        <ul class="avoided-list">${uncleared.map(renderAvoidedItem).join('')}</ul>
      </section>`;
  }
  const draftSet = new Set(draftTokens);
  const relevant = uncleared.filter(
    (e) => overlapCount(draftSet, tokenize(e.fields.fact || e.raw)) >= AVOIDED_OVERLAP_THRESHOLD,
  );
  const body = relevant.length
    ? `<ul class="avoided-list">${relevant.map(renderAvoidedItem).join('')}</ul>`
    : '<p class="muted-note">No uncleared entry shares enough wording with this draft to flag as related (a simple word-overlap check, kept deliberately plain).</p>';
  return `
    <section class="check-section">
      <h3>Claims avoided</h3>
      <p class="muted-note">Uncleared claims related to this draft by word overlap, and why they were left out.</p>
      ${body}
    </section>`;
}

function renderFixItem(finding) {
  const sourceKind = SOURCE_KIND[finding.category] || 'A dated, named record you can point to.';
  return `
    <li class="fix-item finding-${escapeHtml(finding.severity)}">
      <p class="fix-span">&ldquo;${escapeHtml(finding.span)}&rdquo; — line ${finding.line}, ${escapeHtml(CATEGORY_LABEL[finding.category] || finding.category)}</p>
      <ul class="fix-options">
        <li><strong>Source it:</strong> ${escapeHtml(sourceKind)}</li>
        <li><strong>Narrow it:</strong> ${suggestNarrow(finding)}</li>
        <li><strong>Cut it:</strong> Delete this span from the draft entirely.</li>
      </ul>
    </li>`;
}

function renderFixPlanSection(flagged, empty) {
  const body = flagged.length
    ? `<ul class="fix-list">${flagged.map(renderFixItem).join('')}</ul>`
    : `<p class="muted-note">${empty ? 'Nothing has been pasted yet, so there is nothing to plan.' : 'Nothing to fix — no unsourced claim-shaped language found.'}</p>`;
  return `
    <section class="check-section">
      <h3>Fix plan</h3>
      ${body}
    </section>`;
}

// Shown for an empty or whitespace-only draft. Green is earned, never the
// resting state: with nothing pasted there is no verdict to give, so this
// says so plainly and offers no paste block at all. See the cold run's
// finding 2 — "Ready to send" over an empty <pre> is the one thing a door
// whose whole job is to be the adult in the room must never say.
function renderNothingToCheck() {
  return `
    <section class="check-section check-idle">
      <h3>Nothing to check yet</h3>
      <p>Paste your draft above. No verdict yet — an empty draft is not a clean one.</p>
    </section>`;
}

function renderPasteBlock(draftText) {
  return `
    <section class="check-section check-paste">
      <h3>Ready to send</h3>
      <p class="muted-note">Zero blocking findings. Not a publish button — nothing leaves this browser.</p>
      <pre class="paste-block" id="paste-block">${escapeHtml(draftText)}</pre>
      <button type="button" class="btn btn-secondary" data-action="copy-paste-block">Copy this text</button>
      <h4>Before you send it, by hand</h4>
      <ul class="checklist">
        <li>Re-read the draft once, ideally out loud.</li>
        <li>Confirm every number or fact against truth.md — not from memory.</li>
        <li>Check bailey.md's posting rules for that room.</li>
        <li>You choose where and whether to send this.</li>
      </ul>
    </section>`;
}

function renderBlockedNotice(errorCount) {
  return `
    <section class="check-section check-blocked">
      <h3>Not ready to send</h3>
      <p>${errorCount} error-level finding${errorCount === 1 ? '' : 's'} must be sourced, narrowed, or cut before a paste block is offered. Warnings alone do not block — only errors do.</p>
    </section>`;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

// The reason this door needs a pack, said once — same arrangement as
// today.js's TODAY_NEEDS_PACK_REASON.
export const CHECK_NEEDS_PACK_REASON =
  'reads truth.md to know which claims you can actually prove before it can lint a draft.';

// renderCheckHTML(pack, draftText) -> string. Pure: no DOM, no globals
// besides the arguments. A null/absent pack returns the "this door needs a
// pack" view rather than throwing — the no-blank-screen guarantee belongs to
// the renderer, same as today.js. `draftText` may be '' or undefined; an
// empty or whitespace-only draft gets a neutral prompt and NO verdict, since
// there is nothing to have an opinion about.
export function renderCheckHTML(pack, draftText, agent) {
  if (!pack) return renderNeedsPackHTML('This door', CHECK_NEEDS_PACK_REASON);

  const a = agent || { cfg: { baseUrl: '', apiKey: '', model: '' }, ask: '', busy: false, error: '' };
  const text = draftText || '';
  const { flagged, sourced } = computeFindings(pack, text);
  const errorCount = flagged.filter((f) => f.severity === 'error').length;
  const empty = text.trim() === '';
  const readySection = empty
    ? renderNothingToCheck()
    : (errorCount === 0 ? renderPasteBlock(text) : renderBlockedNotice(errorCount));

  // The draft box stays put — it is what you are working on. The five
  // readings of it are steps, one at a time, the same shape Door 1 uses.
  // Tiling them was pixel arithmetic that broke again every time a card
  // changed size; this cannot overflow however long a finding runs.
  const steps = [
    ['findings', 'Findings', renderFindingsSection(flagged, empty)],
    ['map', 'Claim map', renderClaimMapSection(pack, text, sourced)],
    ['avoided', 'Avoided', renderClaimsAvoidedSection(pack, text)],
    ['fix', 'Fix plan', renderFixPlanSection(flagged, empty)],
    ['ready', 'Ready to publish', readySection],
  ];

  return `
    <div class="check-view">
      ${renderMissingTruthNote(pack)}
      <div class="check-compose">
        ${renderWritePanel(a.cfg, a.ask, a.busy, a.error)}
        ${renderDraftInput(text)}
      </div>
      ${renderStepGroup('check', steps)}
    </div>`;
}

// wireCopy(root, getText) -> void. The paste block's Copy button, matching
// the one Door 1 already has for its kickoff prompt — the cold run found it
// inconsistent that this door told you to copy by hand while the other door
// one click away had a button. Clipboard denial is not fatal: the <pre> is
// still there to select. home.js drives the same data-action through its own
// single delegated listener when this door is rendered inside the app shell;
// this is mountCheck's standalone equivalent.
function wireCopy(root, getText) {
  const btn = root.querySelector('[data-action="copy-paste-block"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(getText());
      }
    } catch {
      // Clipboard permission denied — the paste block above still holds the
      // full text, selectable by hand. Not fatal.
    }
  });
}

// mountCheck(container, pack) -> void. The thin DOM-touching half — the only
// place in this module that touches the DOM directly. Re-renders the whole
// view on every keystroke (renderCheckHTML is the single source of truth for
// the markup) but preserves the textarea's caret position across the
// re-render, since replacing innerHTML would otherwise reset it to the end.
// NOTE: DEAD CODE. home.js renders Door 3 through renderCheckHTML directly
// and drives it from its own delegated listener, so nothing calls this. It
// is left as it was rather than extended: the write button did nothing at
// first because it was wired in here, where no click ever arrives.
export function mountCheck(container, pack) {
  let draftText = '';

  function paint() {
    container.innerHTML = renderCheckHTML(pack, draftText);
    wireCopy(container, () => draftText);
    const textarea = container.querySelector('#check-draft');
    if (!textarea) return;
    textarea.addEventListener('input', () => {
      draftText = textarea.value;
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      paint();
      const fresh = container.querySelector('#check-draft');
      if (fresh) {
        fresh.focus();
        fresh.setSelectionRange(selStart, selEnd);
      }
    });
  }

  paint();
}
