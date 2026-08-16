// campaign.js — the printable working sheet. THE thing the pack exists to
// produce, and the thing the console did not produce for its first five
// redesigns.
//
// Asked, in the plainest possible terms: "This is supposed to build a
// guerrilla marketing campaign. Where is the campaign? Where is the actionable
// plan that I can print out and work from, step by step?"
//
// It was nowhere. The console had a step workflow that FILLS the pack and a
// status screen that REPORTS on it. Ten files in, a stage number out. Nothing
// turned the pack back into work a person could hold.
//
// WHAT SEPARATES THIS FROM today.js, since both read the same pack:
//   today.js answers "where am I", on screen, in one glance, and it is right
//   to be short. This answers "what do I do, in what order, in which room,
//   using which words, and how do I know when it is done" — on paper, away
//   from the machine, with a box to tick. A status line and a working sheet
//   are different artifacts and neither substitutes for the other.
//
// Every function here is PURE — pack in, string out, no DOM, no globals —
// the same house rule as today.js, step-view.js and home.js, so the whole
// sheet is exercisable in tests/render.mjs without a browser.

import { evaluate, STAGE_NAMES } from '../stages.js';
import { SHEET_CSS, STANDALONE_CSS } from './campaign-css.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const f = (entry, key) => String(entry?.fields?.[key] ?? '').trim();

/** Rooms, joined to the standing recorded for them in bailey.md.
 *
 *  recon.md says what a room WANTS. bailey.md says where you actually stand
 *  in it. Printed apart they are two lists a reader has to join by hand, and
 *  the join is the whole decision: "links allowed: yes" on an account whose
 *  standing is cold is how a founder gets removed from a room they had a
 *  genuine reason to be in.
 */
export function roomsWithStanding(pack) {
  const active = pack?.bailey?.active || [];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (pack?.recon?.rooms || []).map((room) => {
    const name = f(room, 'room');
    const match = active.find((a) => {
      const chan = norm(f(a, 'channel'));
      const key = norm(name);
      return chan && key && (chan.includes(key) || key.includes(chan));
    });
    return {
      name,
      audience: f(room, 'audience'),
      rules: f(room, 'rules'),
      entryCost: f(room, 'entryCost'),
      standing: match ? f(match, 'standing') : '',
      linksAllowed: match ? f(match, 'linksAllowed') : '',
      account: match ? f(match, 'account') : '',
    };
  });
}

/** The one line that decides whether any of this is safe to act on.
 *
 *  A delivery check is the only gate condition that is not a file read, so it
 *  is the only one that rots silently. Printed at the top, with its age, or a
 *  founder works a whole sheet toward a checkout that stopped working.
 */
export function deliveryStatus(pack, todayISO) {
  const line = String(pack?.campaign?.deliveryCheck || '').trim();
  if (!line) return { state: 'never', text: 'Never asked.', days: null };
  const m = line.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { state: 'undated', text: line, days: null };
  const then = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const t = String(todayISO || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!t) return { state: 'undated', text: line, days: null };
  const now = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]));
  const days = Math.round((now - then) / 86400000);
  // Fourteen days, matching the trailing window numbers.md measures over, so
  // the sheet does not call a check fresh that is older than the data beside it.
  return { state: days > 14 ? 'stale' : 'fresh', text: line, days };
}

function checkbox() {
  return '<span class="cs-box" aria-hidden="true"></span>';
}

function section(title, bodyHtml, note) {
  if (!bodyHtml) return '';
  return `
    <section class="cs-section">
      <h2>${escapeHtml(title)}</h2>
      ${note ? `<p class="cs-note">${note}</p>` : ''}
      ${bodyHtml}
    </section>`;
}

/** The sheet. */
export function renderCampaignSheetHTML(pack, opts = {}) {
  if (!pack) return '';
  const todayISO = String(opts.today || '');
  const ev = evaluate(pack);
  const stage = ev.stage;
  const delivery = deliveryStatus(pack, todayISO);

  // ── the actions ────────────────────────────────────────────────────────
  // Numbered because this IS an order of operations, not a menu. Each carries
  // the skill that does it and the condition that ends it, because "publish an
  // artifact" with no done-condition is a mood, not an action.
  const actions = (pack.campaign?.openNow || []).map((a, i) => `
    <li class="cs-action">
      ${checkbox()}
      <div class="cs-action-body">
        <p class="cs-action-what"><span class="cs-n">${i + 1}</span>${escapeHtml(f(a, 'action'))}</p>
        <p class="cs-action-meta">
          <span><b>Done when</b> ${escapeHtml(f(a, 'doneWhen'))}</span>
          <span><b>Run</b> ${escapeHtml(f(a, 'skill') || 'your own work')}</span>
        </p>
      </div>
    </li>`).join('');

  // ── the rooms ──────────────────────────────────────────────────────────
  const rooms = roomsWithStanding(pack).map((r) => {
    // The one thing that gets an account removed, stated as a verdict rather
    // than left for the reader to infer from two fields in different columns.
    const verdict = r.linksAllowed === 'yes' && r.standing === 'cold'
      ? 'Links are permitted here and your standing is cold. Permitted is not the same as welcome.'
      : (r.standing === 'cold' ? 'Cold. Read before posting.' : '');
    return `
      <div class="cs-room">
        <h3>${escapeHtml(r.name)}${r.standing ? `<span class="cs-standing cs-standing-${escapeHtml(r.standing)}">${escapeHtml(r.standing)}</span>` : ''}</h3>
        <p class="cs-room-who">${escapeHtml(r.audience)}</p>
        <p class="cs-room-rule"><b>Their rules</b> ${escapeHtml(r.rules)}</p>
        <p class="cs-room-rule"><b>Price of admission</b> ${escapeHtml(r.entryCost)}</p>
        ${verdict ? `<p class="cs-room-warn">${escapeHtml(verdict)}</p>` : ''}
      </div>`;
  }).join('');

  // ── what can safely be said ────────────────────────────────────────────
  // On the sheet because it is needed at the moment of writing, which is the
  // moment the founder is furthest from the file. Every one carries its source,
  // so a claim can be defended in the room it is made in without going back.
  const claims = (pack.truth?.cleared || []).map((c) => `
    <li><span class="cs-claim">${escapeHtml(f(c, 'claim'))}</span>
      <span class="cs-src">${escapeHtml(f(c, 'source'))}</span></li>`).join('');

  const banned = (pack.truth?.uncleared || []).map((c) => `
    <li><span class="cs-claim">${escapeHtml(f(c, 'fact'))}</span>
      <span class="cs-src">${escapeHtml(f(c, 'reason'))}</span></li>`).join('');

  // ── the baseline ───────────────────────────────────────────────────────
  // Printed so the next prune has something to compare against. A number with
  // no dated predecessor cannot show movement, which is the only thing a
  // number on this sheet is for.
  const numbers = (pack.numbers?.rows || []).map((r) => `
    <tr>
      <td>${escapeHtml(f(r, 'date'))}</td>
      <td>${escapeHtml(f(r, 'metric'))}</td>
      <td>${escapeHtml(f(r, 'kind') === 'motte' ? 'owned' : 'rented')}</td>
      <td class="cs-num">${escapeHtml(f(r, 'value'))}</td>
    </tr>`).join('');

  const blocked = (pack.campaign?.blockedOnHuman || []).map((b) => `
    <li>${checkbox()}<div><p class="cs-block-what">${escapeHtml(f(b, 'decision'))}</p>
      <p class="cs-action-meta"><span><b>Why it blocks</b> ${escapeHtml(f(b, 'whyItBlocks'))}</span></p></div></li>`).join('');

  return `
    <article class="campaign-sheet">
      <header class="cs-head">
        <h1>The campaign</h1>
        <p class="cs-stage">Stage ${stage} of 4 &middot; ${escapeHtml(STAGE_NAMES[stage] || '')}</p>
        ${todayISO ? `<p class="cs-date">Printed ${escapeHtml(todayISO)}</p>` : ''}
      </header>

      <div class="cs-delivery cs-delivery-${delivery.state}">
        <p class="cs-delivery-head">${
          delivery.state === 'fresh' ? 'Delivery confirmed'
            : delivery.state === 'stale' ? `Delivery check is ${delivery.days} days old. Re-ask it before you send anyone anywhere.`
            : delivery.state === 'never' ? 'Delivery has never been checked. Do not drive traffic until it has.'
            : 'Delivery check recorded, undated.'
        }</p>
        <p class="cs-delivery-line">${escapeHtml(delivery.text)}</p>
      </div>

      ${section('Do these, in this order', actions ? `<ol class="cs-actions">${actions}</ol>` : '')}
      ${section('Waiting on you, and on nobody else', blocked ? `<ul class="cs-blocked">${blocked}</ul>` : '')}
      ${section('The rooms, and what each one costs to enter', rooms)}
      ${section('What you can say, and where it is written down', claims
        ? `<ul class="cs-claims">${claims}</ul>` : '',
        'Every public claim traces to one of these or it does not ship.')}
      ${section('What you cannot say yet', banned ? `<ul class="cs-claims cs-banned">${banned}</ul>` : '')}
      ${section('The baseline you are pruning against', numbers
        ? `<table class="cs-numbers"><thead><tr><th>Date</th><th>What</th><th>Ground</th><th>Value</th></tr></thead><tbody>${numbers}</tbody></table>` : '')}
    </article>`;
}


// ---------------------------------------------------------------------------
// The saved file.
// ---------------------------------------------------------------------------

/** The sheet as a standalone document, stylesheet inlined.
 *
 *  WHY THIS EXISTS AS WELL AS THE PRINT BUTTON, which was the whole objection:
 *  rendering the sheet on screen and offering the browser's print dialog is not
 *  the same as PRODUCING a file. The founder's own sheet was generated by a
 *  node script that does not ship, so the console could show an adopter their
 *  campaign and could not hand them one. A plan you cannot save is a plan you
 *  cannot email, cannot keep beside last month's, and cannot give to the person
 *  doing the work.
 *
 *  Self-contained on purpose: no <link>, no external font, no script. It opens
 *  from a thumb drive in five years, and it prints the same as it did today.
 *  That is the point of a document.
 */
export function campaignDocument(pack, opts = {}) {
  const today = String(opts.today || '');
  const name = String(opts.name || 'The campaign');
  const title = today ? `${name}, ${today}` : name;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STANDALONE_CSS}\n${SHEET_CSS}</style>`,
    '</head>',
    '<body>',
    `<div class="cs-page">${renderCampaignSheetHTML(pack, { today })}</div>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

/** What the saved file is called. Dated, because the point of keeping one is
 *  comparing it with the next. */
export function campaignFilename(today) {
  const d = String(today || '').match(/\d{4}-\d{2}-\d{2}/);
  return d ? `campaign-${d[0]}.html` : 'campaign.html';
}
