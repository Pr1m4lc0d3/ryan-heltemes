// kitdrop.js — the control that takes an Idea Forge Pro export.
//
// WHY THIS EXISTS. The "From a Sell-Kit" route used to offer one thing: a
// link to ideaforgepro.com. It sent you AWAY to get a file and then had
// nowhere to put it, and the setup panel's advice when no kit was loaded was
// "put it in your .monkeys/ folder" — hand-renaming a download into a folder
// the console could not create. Both are now this control, which is the
// difference between naming the funnel and having one.
//
// The link stays, demoted, and opens in a new tab. You have to come back here
// to use what it gives you, so nothing in the console may navigate away.
//
// ⛔ NO NETWORK. FileReader on a file the human picked, nothing else. Same
// rule as the rest of the console: the pack never leaves the browser.
//
// Every function here is PURE — string in, string out, no DOM and no
// handlers, the same house rule loader.js states. The `data-action` and the
// #kit-input change event are read by mountApp's single delegated listener in
// home.js, which is where doKitFile lives. Rendered in two places (loader.js's
// third route, setup.js's sell-kit panel), which is exactly why this is a
// module rather than markup written twice.

import { planImport, EVIDENCE_GRADES } from '../sellkit.js';

const FORGE_URL = 'https://ideaforgepro.com';

// The file input accepts both real extensions. `accept` is a filter on the
// picker, never a check — readKitFile decides what a file is by reading it,
// so a renamed download still works.
const ACCEPT = '.md,.json';

export function renderKitDropHTML(state) {
  const s = state || {};
  const busy = s.kitBusy ? ' disabled' : '';
  const problem = s.kitError
    ? `<p class="kit-drop-error" role="alert">${escapeHtml(s.kitError)}</p>`
    : '';
  const took = s.kitNote && !s.kitError
    ? `<p class="kit-drop-note muted-note">${escapeHtml(s.kitNote)}</p>`
    : '';

  return `
    <div class="kit-drop">
      <button type="button" class="btn" data-action="choose-kit"${busy}>${s.kitBusy ? 'Reading…' : 'Open a Sell-Kit file'}</button>
      <input type="file" id="kit-input" data-action="kit-input" accept="${ACCEPT}" hidden>
      <p class="kit-drop-hint muted-note">
        Takes <code>&hellip;-forge.json</code> or <code>&hellip;-sell-kit.md</code>. Nothing is uploaded.
      </p>
      ${problem}
      ${took}
      <p class="kit-drop-forge muted-note">
        No kit? <a href="${FORGE_URL}" target="_blank" rel="noopener">Idea Forge Pro</a> is free.
      </p>
    </div>`;
}

// A kit is not clearance, said at the point of import rather than only in the
// confirm table. Someone who drops a file and sees fields appear needs to
// know what did NOT just happen.
export function renderKitCaveatHTML() {
  return `
    <p class="muted-note"><strong>Importing a kit is not clearance.</strong>
    A kit is largely model-written. Every line is graded on arrival, and only a
    sourced A&ndash;D claim can be said in public.</p>`;
}

// The import plan. Shown BEFORE anything is written, because the review is
// the whole safeguard: a kit is largely model-written, and an import nobody
// read is the same as trusting that prose. Every row says where the line goes
// and why, so the founder can see a claim being refused rather than discover
// later that it never arrived.
//
// MOVED HERE FROM setup.js, which was 1121 lines and over its own hard limit
// before this feature added a line to it. This is the Sell-Kit import's view,
// and it belongs with the control that feeds it rather than in the file that
// happens to render one of the two places it appears.
export function renderSellKitImport(kitText, state) {
  const plan = planImport(kitText);
  if (plan.blocked) {
    // ⛔ THIS BRANCH USED TO SAY "put it in your .monkeys/ folder" AND STOP.
    // It named a file operation the console could not perform, to someone
    // holding a download it had no way to accept. The control goes here.
    return `
      <section class="setup-section">
        <p class="setup-intro muted-note">${escapeHtml(plan.blocked)}</p>
        ${renderKitDropHTML(state)}
        ${renderKitCaveatHTML()}
      </section>`;
  }

  const row = (c) => {
    const clears = c.destination.endsWith('Cleared');
    return `
      <tr class="${clears ? 'imp-clear' : 'imp-hold'}">
        <td>${escapeHtml(c.claim)}</td>
        <td><strong>${escapeHtml(c.grade)}</strong> ${escapeHtml((EVIDENCE_GRADES[c.grade] || {}).label || '')}</td>
        <td>${clears ? 'Cleared' : 'Uncleared'}</td>
        <td class="muted-note">${escapeHtml(c.reason)}</td>
      </tr>`;
  };

  const cleared = plan.claims.filter((c) => c.destination.endsWith('Cleared')).length;
  const held = plan.claims.length - cleared;
  const s = state || {};

  // WHAT THE BUTTON DID. Without this the screen after "Import into my pack"
  // was identical to the screen before it, so the only way to find out whether
  // it worked was to press it again — which used to write everything twice.
  // It names the files, because "imported" without a destination is the same
  // silence in politer words.
  if (s.kitResult) {
    const r = s.kitResult;
    const wrote = r.wrote.length
      ? `Written: ${r.wrote.join(', ')}.`
      : 'Nothing new to write.';
    const dupes = r.already
      ? ` ${r.already} ${r.already === 1 ? 'line was' : 'lines were'} already in your pack, so ${r.already === 1 ? 'it was' : 'they were'} left alone.`
      : '';
    return `
      <section class="setup-section">
        <p class="kit-done"><strong>Imported.</strong> ${escapeHtml(wrote)}${escapeHtml(dupes)}</p>
        <p class="muted-note">A cleared claim is one you can say in public. Everything else is in
        <code>truth.md</code> under Uncleared, with the reason it did not clear.</p>
        <p class="kit-done-next">
          <button type="button" class="btn" data-setup-step-go="truth.md" data-action="see-truth">See truth.md</button>
          <button type="button" class="btn btn-secondary" data-action="navigate" data-door="today">What do I do today</button>
        </p>
        <details class="kit-drop-swap">
          <summary>Import a different Sell-Kit</summary>
          ${renderKitDropHTML(state)}
        </details>
      </section>`;
  }

  return `
    <section class="setup-section">
      <p class="setup-intro muted-note"><strong>Importing a kit is not clearance.</strong> ${cleared} of ${plan.claims.length} claims can be said in public; ${held} cannot, yet.</p>
      ${s.kitNote ? `<p class="kit-drop-note muted-note">${escapeHtml(s.kitNote)}</p>` : ''}

      ${plan.claims.length ? `
      <table class="imp-table">
        <thead><tr><th>Claim</th><th>Grade</th><th>Lands in</th><th>Why</th></tr></thead>
        <tbody>${plan.claims.map(row).join('')}</tbody>
      </table>` : '<p class="muted-note">This kit has no claim register, so there is nothing to grade. Every field below lands uncleared.</p>'}

      <h4>Fields</h4>
      <ul class="setup-entry-list">
        ${plan.fields.map((f) => `<li class="setup-entry"><strong>${escapeHtml(f.label)}</strong> &rarr; ${f.to === 'skip' ? '<em>not imported</em>' : escapeHtml(f.to)} &mdash; <span class="muted-note">${escapeHtml(f.note)}</span></li>`).join('')}
      </ul>

      <form class="setup-form">
        <button type="button" class="btn btn-secondary" data-action="apply-import">Import into my pack</button>
      </form>
      <p class="setup-error" data-setup-error="sell-kit"></p>

      <details class="kit-drop-swap">
        <summary>Open a different Sell-Kit</summary>
        ${renderKitDropHTML(state)}
      </details>
    </section>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
