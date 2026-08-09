// icons.js — the icon vocabulary, and the one place a concept is bound to a
// picture.
//
// WHY A MODULE AND NOT A CLASS NAME TYPED AT EACH CALL SITE: the same concept
// appears in more than one door. `truth` is a tab in Door 2 and a step in
// Door 4; `motte` is a tab and also what Door 2 as a whole is about. Those
// must carry the SAME mark, or the icons stop being a vocabulary and become
// decoration that happens to differ per screen. Binding them here makes a
// mismatch a one-line fix instead of a hunt.
//
// HOW THEY ARE PAINTED: mask-image with `background-color: currentColor`, so
// the shape takes whatever colour its context already uses. That is why the
// second sheet was asked for in black only — .door-card inverts bone→ink on
// hover, and a mask inverts with it for free, where a coloured PNG would have
// needed a second asset and a second rule to swap it.
//
// Every name below is a file that exists in console/assets/icons/. A name
// that does not resolve renders as an empty box — silent, and exactly the
// class of failure orders.js refuses for skill names — so the set is frozen
// and checked by tests/render.mjs against the concepts actually in use.

// concept -> file stem. Concepts, not filenames, are what call sites use.
export const ICONS = Object.freeze({
  // Doors
  kickoff: 'door',            // the way in
  setup: 'motte-keep',        // ground you build and own
  today: 'gate',              // this door's whole job is naming the closed gate
  check: 'claim-sealed',      // a claim that holds

  // Pack files (Door 2's tabs)
  truth: 'claim-sealed',
  'sell-kit': 'sell-kit',
  motte: 'motte-keep',
  bailey: 'bailey-tent',
  recon: 'binoculars',
  asymmetry: 'lever',
  campaign: 'campaign',

  // Door 3's readings of the pack
  'do-today': 'moment',       // what to do now
  blocked: 'gate',            // a gate that has not opened
  waiting: 'sign-pen',        // a decision only a person can sign
  attention: 'scars',         // what is damaged or drifting

  // Door 4's readings of a draft
  findings: 'claim-broken',   // a claim that does not hold
  map: 'claim-sealed',        // the ones that do
  avoided: 'avoided',         // deliberately not said
  fix: 'fix-plan',
  ready: 'sign-pen',          // a person signs it
});

// icon(concept) -> HTML string, or '' for an unknown concept.
//
// Returning '' rather than throwing is deliberate and matches this codebase's
// no-blank-screen rule: a missing icon must never take a door down with it.
// The frozen map above plus the render test is where a typo gets caught.
//
// aria-hidden because every icon here sits beside its own visible label. An
// icon that repeated that label to a screen reader would make the interface
// worse for the person relying on it, not better.
export function icon(concept) {
  const file = ICONS[concept];
  if (!file) return '';
  return `<span class="ico ico-${file}" aria-hidden="true"></span>`;
}
