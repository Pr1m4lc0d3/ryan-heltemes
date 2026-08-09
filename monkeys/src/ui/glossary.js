// glossary.js — plain-language glosses for the six terms of art Door 2 uses
// every day, attached to their FIRST use in the door rather than left in
// Door 1, which a founder completes once and never opens again.
//
// The terms are NOT renamed. motte stays motte; a gloss appears beside it the
// first time it is used in a render and never again in that render, so the
// door reads as a working screen and not as a dictionary.
//
// Pure: string in, string out, no DOM, no globals. The glosses are static
// text written here, never derived from pack content, so nothing a founder
// typed can end up inside one.

const GLOSSARY = [
  ['motte', 'Motte',
    'assets nobody can take from you — your domain, your mailing list, the product itself. Small and boring on purpose.'],
  ['bailey', 'Bailey',
    'rented ground — a community, a listing, a social account. Where the traffic already is, and revocable by its owner at any moment.'],
  ['standing', 'Standing',
    'how much credit an account has earned in a room. cold = new, no links yet. warming = you posted something useful and it landed. established = a sustained history there.'],
  ['stage', 'Stage',
    'which rung of the ladder the pack currently justifies, counted from zero. Each one opens only when its own gate is met, and none of them can be skipped.'],
  ['gate', 'Gate',
    'the single condition that has to be true before the next stage opens. Nothing else opens it — not effort, not time.'],
  ['drift', 'Drift',
    'campaign.md recording one stage while the pack now justifies another. The written plan has fallen out of step with the evidence, so the plan is what gets re-run, not the evidence.'],
];

// makeGlossState() -> a per-render "already explained" set. One per call to
// renderTodayHTML, so every fresh render explains each term exactly once.
export function makeGlossState() {
  return new Set();
}

// glossFor(state, sectionHtml, forced) -> HTML string (possibly ''). Scans
// the section's own text — tags stripped, so a class name can never trigger a
// gloss — for any term not yet explained in this render, and returns a short
// list for the ones it found. `forced` names terms a section structurally
// uses without spelling the word (the Blocked list IS the gate list; the
// drift notice describes drift in plain English on purpose).
export function glossFor(state, sectionHtml, forced) {
  const text = String(sectionHtml || '').replace(/<[^>]*>/g, ' ').toLowerCase();
  const force = forced || [];
  const items = [];
  for (const [term, label, meaning] of GLOSSARY) {
    if (state.has(term)) continue;
    const used = force.includes(term) || new RegExp(`\\b${term}`, 'i').test(text);
    if (!used) continue;
    state.add(term);
    items.push(`<li class="gloss-item"><strong>${label}</strong> — ${meaning}</li>`);
  }
  if (items.length === 0) return '';
  // Folded shut. A glossary is for the first read and the occasional
  // re-check; left open it was 248px of a briefing that has to be readable
  // in under two minutes, and it pushed the actual day's work off-screen.
  const what = items.length === 1 ? 'this word' : `these ${items.length} words`;
  return `<details class="gloss"><summary>What ${what} mean${items.length === 1 ? 's' : ''}</summary>`
    + `<ul class="gloss-list">${items.join('')}</ul></details>`;
}
