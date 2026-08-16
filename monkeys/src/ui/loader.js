// loader.js — the pack loader's markup, and the copy that surrounds it.
// Extracted out of home.js so today.js and check.js can render their own
// "this door needs a pack" view when they are handed no pack at all, without
// importing home.js (which imports them — a cycle) and without a second copy
// of the loader controls drifting away from the first. One place a pack can
// be loaded from, still.
//
// Every function here is PURE — string in, string out, no DOM. data-action
// attributes are read by mountApp's single delegated listener in home.js;
// nothing here attaches a handler.

import { capabilities, PACK_FILES } from '../fs.js';
import { renderKitDropHTML } from './kitdrop.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Where the pack lives, said once, in the words a founder uses rather than
// the words an agent uses. Kept short — the full explanation of WHY lives in
// README.md, not on screen (see the no-scroll brief: a slow reader pays for
// every word here).
export const MONKEYS_HOME = 'A pack is a <code>.monkeys/</code> folder your AI skills read.';

// Shown when a load genuinely turned up nothing of ours. Names what was
// looked for, because "0 of 9 files present" told a founder nothing about
// which folder they should have picked.
export function emptyLoadMessage() {
  return `No pack files were found there. Looked for: ${PACK_FILES.map((n) => `<code>${escapeHtml(n)}</code>`).join(', ')}, <code>briefings/&lt;date&gt;.md</code>.`;
}

// ---------------------------------------------------------------------------
// The controls themselves.
// ---------------------------------------------------------------------------

// The cold run's founder stared at "Choose files" with no idea what kind of
// file it wanted. The hint line says, once, what to point each control at;
// the fuller explanation lives in each button's title tooltip instead of on
// screen, since a tooltip costs nothing to a reader who never hovers it.
// THE STEP SCREEN'S OWN LOADER, and why it is a separate, permanent control.
//
// The step screen only ever rendered a loader through renderStartHereHTML,
// which is gated on `state.pack ? '' : ...`. So the moment a pack existed —
// including one restored from this browser's localStorage on boot — every way
// of loading a pack disappeared from the only screen the console opens on.
// The console reads the browser's copy, the skills read the folder on disk,
// and there was no control anywhere that re-read one into the other. Reported
// as "I reloaded and did not see gate 8 filled out": the files on disk had the
// rows, the browser had a months-old copy, and nothing on screen could close
// the gap.
//
// Inline and always present, rather than folded behind a <details>: this sits
// in .step-chrome, which is a fixed flex row above a step that already fits
// its viewport by a small margin, so a disclosure that expands in place would
// push the step into a scrollbar exactly when it is used.
export function renderStepLoaderHTML(caps, hasPack) {
  const safeCaps = caps || capabilities();
  const folderBtn = safeCaps.directoryAccess
    ? '<button type="button" class="btn btn-link" data-action="open-folder" title="Point this at your .monkeys/ folder. On Chromium this stays connected, so Save writes back to the same folder.">folder</button>'
    : '';
  const sep = folderBtn ? '<span class="step-load-sep">or</span>' : '';
  return `
    <span class="step-load">
      <span class="step-load-label">${hasPack ? 'Re-read from disk:' : 'Have a <code>.monkeys/</code> folder?'}</span>
      ${folderBtn}${sep}
      <button type="button" class="btn btn-link" data-action="choose-files" title="Select the .md files inside a .monkeys/ folder">files</button>
      <input type="file" id="file-input" data-action="file-input" multiple accept=".md" hidden>
    </span>`;
}

export function renderLoaderControls(caps) {
  const safeCaps = caps || capabilities();
  const folderBtn = safeCaps.directoryAccess
    ? '<button type="button" class="btn btn-secondary" data-action="open-folder" title="Point this at your .monkeys/ folder">Open a folder</button>'
    : '';
  return `
    <div class="loader-controls">
      <p class="loader-controls-hint muted-note">Point at your <code>.monkeys/</code> folder, or its <code>.md</code> files.</p>
      ${folderBtn}
      <button type="button" class="btn btn-secondary" data-action="choose-files" title="Select the .md files inside a .monkeys/ folder">Choose files</button>
      <input type="file" id="file-input" data-action="file-input" multiple accept=".md" hidden>
    </div>`;
}

// ---------------------------------------------------------------------------
// Pack status. A load that produced zero pack files is NOT a loaded pack —
// home.js never sets state.pack in that case, and the note below says plainly
// what happened instead of reporting "Pack loaded — 0 of 9 files present".
// `source` distinguishes a pack read off disk from one being typed in Door 1
// and one restored from this browser's own storage, because "Pack loaded" was
// a lie for the last two.
// ---------------------------------------------------------------------------

const SOURCE_LABEL = {
  loaded: 'Pack loaded',
  setup: 'Pack in progress — typed here',
  restored: 'Pack restored from this browser',
  sample: 'Example pack loaded',
};

export function renderPackStatus(state) {
  const s = state || {};
  const parts = [];

  if (s.loadError) {
    parts.push(`<p class="load-error">${escapeHtml(s.loadError)}</p>`);
  }
  if (s.emptyLoadNote) {
    parts.push(`<p class="load-empty">${s.emptyLoadNote}</p>`);
  }

  if (s.pack) {
    const present = PACK_FILES.length - s.pack.missing.length;
    const label = SOURCE_LABEL[s.packSource] || SOURCE_LABEL.loaded;
    parts.push(`<p class="pack-status">${label} — ${present} of ${PACK_FILES.length} files present${s.pack.missing.length ? `, ${s.pack.missing.length} missing` : ''}.</p>`);
  }
  // No "No pack loaded yet." line: with no pack the onboarding heading already
  // says exactly that, and a hub that states the same fact twice is what put
  // the scroll back inside .scroll-body. Errors and notes above still render.

  if (s.skippedNote) {
    parts.push(`<p class="muted-note">${escapeHtml(s.skippedNote)}</p>`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// The persistence line. Says where the work is kept, that it goes nowhere
// else, when the restored copy was saved, and offers one click to erase it.
// ---------------------------------------------------------------------------

export function renderPersistenceNote(state) {
  const s = state || {};
  if (s.persistenceOff) {
    return `
      <p class="persist-note persist-off">This browser will not keep your work — persistence is off. Download your files before closing the tab.</p>`;
  }
  const when = s.savedAt ? ` Saved ${escapeHtml(s.savedAt)}.` : '';
  const cleared = s.clearedNote
    ? `<p class="persist-cleared muted-note">${escapeHtml(s.clearedNote)}</p>`
    : '';
  return `
    <p class="persist-note">Work is kept in this browser only — never uploaded, never sent anywhere.${when}
      <button type="button" class="btn btn-link" data-action="clear-saved">Clear saved copy</button>
    </p>
    ${cleared}`;
}

// ---------------------------------------------------------------------------
// "What do I feed this?" — the console's biggest first-run failure: an empty
// loader with no explanation of what a pack even is, or where one comes from
// if you have none. Cut to near-labels for a slow reader (see the no-scroll
// brief): a heading plus one short line beats a paragraph every time. The
// WHY behind any of this lives in README.md, never on screen. Every function
// here is PURE HTML — home.js decides WHEN to show them.
// ---------------------------------------------------------------------------

// WHAT THIS FIXES. This function was named "explainer" and its own call site
// comment claimed the empty state ran "what it is, how to get one, how to look
// around" — but it rendered a heading and nothing else. Nowhere on the opening
// screen said what a pack was, what it was for, or what a first session should
// achieve. Reported as: "There is nothing for a new builder to understand how
// this tool even works."
//
// Kept to four short lines on purpose. The full model lives in
// GETTING-STARTED.md; this is the part a reader needs before they can press a
// button, and the hub must not scroll (see the no-scroll shell in style.css).
//
// The one-line goal is not encouragement, it is the literal stage-1 gate from
// RAID/skills/raid-campaign/SKILL.md §3: stage 1 opens when truth.md has at
// least one entry under ## Cleared. A new builder reading "ten files" assumes
// ten files of work. It is one line.
export function renderPackExplainerHTML() {
  return `
    <section class="onboard-explainer">
      <h2 class="onboard-heading">What is a pack?</h2>
      <p>
        ${PACK_FILES.length} markdown files in a <code>.monkeys/</code> folder: what you can prove,
        what you own, where you can speak. An agent reads them instead of guessing.
      </p>
      <p class="onboard-first-goal">
        <strong>You do not fill in all ${PACK_FILES.length}.</strong> One sourced line in
        <code>truth.md</code> opens the next stage.
        <a href="GETTING-STARTED.md" target="_blank" rel="noopener">How it works</a>
      </p>
    </section>`;
}

// Each route: a 2-4 word heading, one short line, one button. No paragraph,
// no parentheticals. Full URLs live in the href, not the visible text, so a
// reader never pays word-cost for a link they are not going to type by hand.
export function renderGetPackRoutesHTML(state) {
  const s = state || {};
  return `
    <section class="onboard-routes">
      <div class="onboard-route-grid">
        <div class="onboard-route">
          <h3>Let the agent ask</h3>
          <p>It interviews you. Nothing to fill in.</p>
          <button type="button" class="btn" data-action="navigate" data-door="kickoff">Start here</button>
        </div>
        <div class="onboard-route">
          <h3>Fill it in yourself</h3>
          <p>Guided forms, one file at a time.</p>
          <button type="button" class="btn btn-secondary" data-action="navigate" data-door="setup" data-panel="truth.md">Set up my ground</button>
        </div>
        <div class="onboard-route">
          <h3>From a Sell-Kit</h3>
          <p>A kit is <strong>not</strong> a pack &mdash; every line is graded on the way in.</p>
          ${renderKitDropHTML(s)}
        </div>
      </div>
    </section>`;
}

export function renderSampleLoaderHTML() {
  return `
    <p class="onboard-sample muted-note"><button type="button" class="btn btn-link" data-action="load-sample">Try a sample</button> — an example, not a template.</p>`;
}

// The whole empty-state, in order: what it is, how to get one, how to look
// around without one yet. home.js renders this only when state.pack is
// falsy — see the header on why "before anything else" means before the
// door cards, not before the header.
export function renderOnboardingHTML(state) {
  return `
    <div class="onboarding">
      ${renderPackExplainerHTML()}
      ${renderGetPackRoutesHTML(state)}
      ${renderSampleLoaderHTML()}
    </div>`;
}

// The same content, collapsed behind a native <details> toggle — shown once
// a pack IS loaded, so the routes never compete with the doors for primary
// attention (see FIX 3 in the no-scroll brief). No JS wiring needed: the
// browser's own disclosure widget handles open/closed.
export function renderPackToggleHTML(state) {
  return `
    <details class="pack-toggle">
      <summary>What is a pack?</summary>
      ${renderOnboardingHTML(state)}
    </details>`;
}

// Shown once the sample pack (and only the sample pack) is what is loaded —
// unmistakably labelled as an example, with the one click that clears it.
// packSource is the same state.packSource string home.js already tracks for
// "loaded"/"setup"/"restored"; 'sample' is the fourth value it can hold.
export function renderSampleBannerHTML(packSource) {
  if (packSource !== 'sample') return '';
  return `
    <p class="sample-banner">
      <strong>Example pack</strong> — a made-up tea company, not your data.
      <button type="button" class="btn btn-link" data-action="clear-sample">Clear the example</button>
    </p>`;
}

// ---------------------------------------------------------------------------
// "Needs a pack" — shown in place of door 2 or door 3's body when no pack is
// loaded. Offers the same loader inline for someone who already has files,
// and the same three routes the home screen offers for someone who does not
// — a bare file picker was this door's own dead end before (see the
// console-onboarding brief): "Choose files" to someone with no files yet.
// ---------------------------------------------------------------------------

export function renderNeedsPackHTML(doorTitle, reason, caps, note, state) {
  return `
    <div class="needs-pack">
      <p>${escapeHtml(doorTitle)} needs a loaded pack — it ${escapeHtml(reason)}</p>
      ${note ? `<p class="load-empty">${note}</p>` : ''}
      ${renderLoaderControls(caps)}
      <div class="needs-pack-routes">
        ${renderGetPackRoutesHTML(state)}
      </div>
    </div>`;
}
