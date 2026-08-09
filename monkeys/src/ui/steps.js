// steps.js — the step strip: how it is drawn, and how it switches.
//
// WHY THIS FILE EXISTS. The strip was drawn in two places and switched in
// one. setup.js had renderStepGroup AND the click wiring, inside its own
// mountSetup; check.js hand-rolled the same markup and relied on the app
// shell to wire it — and home.js never did. So Door 4's strip was DEAD in the
// running app: clicking "Claim map", "Avoided", "Fix plan" or "Ready to
// publish" changed nothing, and the paste block that is the entire point of
// that door could not be reached at all. It rendered, it looked right, and it
// did nothing, which is why neither the unit tests (which call the pure
// renderer) nor the no-scroll sweep (which measured a panel that never
// changed) caught it.
//
// So drawing and switching now live together, in one place, and every strip
// uses both halves. A strip that renders is a strip that works.

import { icon } from './icons.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Keys are "<group>:<step>". The group is what lets several independent
// strips coexist on one screen — Door 2 renders six at once, and switching a
// step in one must not touch the others.
export function stepGroupOf(key) {
  return String(key ?? '').split(':')[0];
}

// renderStepGroup(idPrefix, steps) -> the strip plus one panel per step,
// exactly one shown. `steps` is [[key, label, bodyHtml], ...].
//
// Every file whose panel holds more than one section uses this: motte is Held
// + Wanted, bailey is Active + Excluded, recon is Pains + Rooms. Stacked,
// each pair overflowed the screen from about 1024px down — and that width is
// exactly where browser zoom puts a big monitor.
//
// icon(key) is looked up per step and returns '' for a key with no mark, so a
// strip whose steps are not in the icon vocabulary simply renders without
// them rather than needing a second function.
export function renderStepGroup(idPrefix, steps) {
  const strip = steps.map(([key, label], i) => `
    <button type="button" class="setup-step-tab${i === 0 ? ' is-active' : ''}" data-setup-step="${idPrefix}:${key}">
      <span class="setup-step-n" aria-hidden="true"></span>${icon(key)}${escapeHtml(label)}
    </button>`).join('');

  const panels = steps.map(([key, , body], i) => `
    <div class="setup-step${i === 0 ? ' is-active' : ''}" data-setup-step-panel="${idPrefix}:${key}">
      ${body}
    </div>`).join('');

  return `<nav class="setup-steps" aria-label="section">${strip}</nav>${panels}`;
}

// activateStep(root, key) -> void. Shows one step of one group and marks its
// tab, leaving every other group alone. The only switcher; both the app shell
// and mountSetup call this rather than each keeping a copy.
export function activateStep(root, key) {
  const group = stepGroupOf(key);
  root.querySelectorAll('[data-setup-step-panel]').forEach((el) => {
    if (stepGroupOf(el.dataset.setupStepPanel) !== group) return;
    el.classList.toggle('is-active', el.dataset.setupStepPanel === key);
  });
  root.querySelectorAll('[data-setup-step]').forEach((el) => {
    if (stepGroupOf(el.dataset.setupStep) !== group) return;
    el.classList.toggle('is-active', el.dataset.setupStep === key);
  });
}
