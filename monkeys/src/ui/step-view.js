// step-view.js — one step, on its own screen.
//
// The console used to open on four cards and ten files. This opens on the one
// thing to do next, and nothing else is on the screen competing with it.
//
// Everything here is a PURE render function, same house rule as today.js and
// home.js: a value in, a string out, no DOM and no globals, so the whole view
// is exercisable in tests/render.mjs without a browser.
//
// The four things a step carries, and none of them is optional:
//   1. what it is, in words that need no glossary
//   2. why it matters, in one sentence
//   3. the agent, already pointed at THIS step
//   4. where the answer goes, and the line that says when you are finished
//
// The rail is gone. The agent is a single line under the step until it is
// asked for, because it was a permanent 280px minimum holding a 175px input
// for a panel that can do nothing without a key.

import { STEPS, stepStates } from './steps-model.js';

// THE BUILD STAMP, and why a static tool needs one.
//
// GitHub Pages serves every file with Cache-Control: max-age=600, so a browser
// keeps the ES modules for up to ten minutes after a deploy. Three times in one
// day a change was deployed, verified in the served file, and then judged
// missing from a screen that was running the previous build. There is no way to
// tell those two apart by looking, which is the whole problem: "I see no
// change" and "the change did not deploy" produce identical screenshots.
//
// So the screen says which build it is. Bump this when you deploy. If the
// stamp is old, the browser is stale and a hard reload fixes it; if the stamp
// is current and the change is missing, the change is genuinely missing.
export const BUILD = '2026-08-15 · step-console';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** The progress rail: eight marks, the finished ones filled.
 *
 *  Numbered because this genuinely IS a sequence and the order carries
 *  information the reader needs — you cannot be recognised somewhere before
 *  you have somewhere to be recognised. Numbering a set of parallel choices
 *  would be decoration; numbering these is the content.
 */
export function renderProgressHTML(pack, activeId) {
  const marks = stepStates(pack).map((s) => {
    const state = s.isDone ? 'is-done' : (s.id === activeId ? 'is-here' : '');
    return `
      <button type="button" class="step-mark ${state}" data-action="go-step" data-step="${s.id}"
        aria-current="${s.id === activeId ? 'step' : 'false'}"
        aria-label="${escapeHtml(`Step ${s.n}, ${s.title}`)}"
        title="${escapeHtml(`${s.n}. ${s.title}`)}">
        <span class="step-mark-n">${s.n}</span>
      </button>`;
  }).join('');
  return `<nav class="step-rail" aria-label="Steps">${marks}</nav>`;
}

/** What has already been recorded for this step, read back from the pack.
 *
 *  Seeing your own answers is half of why a form feels like a tool rather than
 *  a suggestion box: without it there is no evidence anything was saved.
 */
function recordedFor(pack, step) {
  const at = {
    prove: () => pack?.truth?.cleared,
    hear: () => pack?.recon?.pains,
    ground: () => pack?.asymmetry?.ourGround,
    rent: () => pack?.bailey?.active,
    welcome: () => pack?.bailey?.active,
    make: () => pack?.motte?.held,
    keep: () => pack?.numbers?.rows,
  }[step.id];
  const rows = (at && at()) || [];
  return rows.map((r) => String(r?.raw ?? '')).filter(Boolean);
}

/** The form. THE thing that was missing.
 *
 *  Every screen before this told the reader to write something down and gave
 *  them nowhere to write it. Four redesigns of a poster about entering a fact.
 */
export function renderStepFormHTML(pack, step) {
  if (!step?.form) return '';
  const fields = step.form.fields.map((f) => `
    <label class="sf-field">
      <span class="sf-label">${escapeHtml(f.label)}</span>
      <input type="text" class="sf-input" data-field="${escapeHtml(f.key)}"
        placeholder="${escapeHtml(f.placeholder)}" autocomplete="off">
    </label>`).join('');

  const recorded = recordedFor(pack, step);
  const list = recorded.length
    ? `<ul class="sf-recorded">${recorded.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
    : '<p class="sf-empty">Nothing recorded yet.</p>';

  return `
    <section class="step-form" data-step-form="${escapeHtml(step.id)}">
      <h3 class="sf-head">Record it</h3>
      ${fields}
      <button type="button" class="btn sf-save" data-action="save-step" data-step="${escapeHtml(step.id)}">Save</button>
      <p class="sf-note" data-sf-note></p>
      <h3 class="sf-head sf-head-second">Recorded so far</h3>
      ${list}
    </section>`;
}

/** One step, whole. */
export function renderStepHTML(pack, step, opts = {}) {
  if (!step) return '';
  const isDone = Boolean(pack && step.done(pack));
  const agentOpen = Boolean(opts.agentOpen);

  const status = isDone
    ? `<p class="step-status is-done">Finished. ${escapeHtml(step.doneLabel)}.</p>`
    : `<p class="step-status">You are here. Finished when: ${escapeHtml(step.doneLabel.toLowerCase())}.</p>`;

  // The agent line names what it would go and do for THIS step, so the offer
  // is concrete rather than an empty box asking what you want.
  const agent = agentOpen ? '' : `
    <button type="button" class="step-agent" data-action="toggle-agent">
      <span class="step-agent-label">Ask</span>
      <span class="step-agent-text">${escapeHtml(step.agentAsk)}</span>
    </button>`;

  return `
    <article class="step">
      <p class="step-eyebrow">Step ${step.n} of ${STEPS.length}</p>
      <h2 class="step-title">${escapeHtml(step.title)}</h2>
      <p class="step-why">${escapeHtml(step.why)}</p>

      <div class="step-do">
        <p class="step-do-label">Do this</p>
        <p class="step-do-text">${escapeHtml(step.todo)}</p>
        <p class="step-example"><span>Like this</span> ${escapeHtml(step.example)}</p>
      </div>

      ${agent}

      <p class="step-tip">${escapeHtml(step.tip)}</p>
      ${status}

      <p class="step-writes">Recorded in <code>${escapeHtml(step.writesTo)}</code></p>
    </article>`;
}

/** The whole screen: where you are, the step, and the way onward. */
export function renderStepScreenHTML(pack, step, opts = {}) {
  const done = stepStates(pack).filter((s) => s.isDone).length;
  return `
    <div class="step-screen">
      <div class="step-screen-head">
        <div class="step-brand">
          <img class="step-mark-img" src="assets/mark-combined.png" alt="">
          <span class="step-brand-name">Monkey Console</span>
        </div>
        ${renderProgressHTML(pack, step && step.id)}
        <p class="step-progress-line">${done} of ${STEPS.length} finished</p>
      </div>
      <div class="step-screen-body">
        <div class="step-columns">
          ${renderStepHTML(pack, step, opts)}
          ${renderStepFormHTML(pack, step)}
        </div>
        <p class="build-stamp">${escapeHtml(BUILD)}</p>
      </div>
    </div>`;
}
