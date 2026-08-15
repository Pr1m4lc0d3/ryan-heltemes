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
        title="${escapeHtml(`${s.n}. ${s.title}`)}">
        <span class="step-mark-n">${s.n}</span>
        <span class="step-mark-label">${escapeHtml(s.title)}</span>
      </button>`;
  }).join('');
  return `<nav class="step-rail" aria-label="Steps">${marks}</nav>`;
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
        ${renderProgressHTML(pack, step && step.id)}
        <p class="step-progress-line">${done} of ${STEPS.length} finished</p>
      </div>
      <div class="step-screen-body">
        ${renderStepHTML(pack, step, opts)}
      </div>
    </div>`;
}
