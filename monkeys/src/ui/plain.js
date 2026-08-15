// plain.js — the console's translation layer. Doctrine goes in, English comes out.
//
// WHY THIS FILE EXISTS. Reported, after three rounds of layout fixes: "the
// content on the left is still gibberish." It was, and the layout was never
// the reason. Every user-facing string reaching the screen came from
// stages.js, which is written for an operator who has read the doctrine:
//
//   "Standing"                              account reputation, a RAID term
//   "First artifacts"                       artifact = a thing you publish
//   "Publish something substantial on land   land, syndicate, cuts
//    you own, then syndicate cuts of it."
//   "Enter rooms and be useful."            rooms = communities
//   "Create accounts — they start cold."    cold = no history there yet
//   "Prune"                                 prune what?
//
// Six metaphors from guerrilla warfare, rendered raw, to a person who came to
// find out what to do about marketing. No amount of type scale fixes that.
//
// THE RULE IS raid-dossier's, APPLIED WHERE IT WAS WRITTEN AND THEN IGNORED:
// every doctrine term is translated, every time. A screen containing the word
// "bailey" has failed however accurate the rest of it is. So has one saying
// "syndicate cuts".
//
// WHY NOT FIX stages.js INSTEAD. Because it is the authority. Its strings are
// defined by RAID/skills/raid-campaign/SKILL.md and the skills read the same
// vocabulary; changing them there would break the shared language the agent
// half depends on and would put this console in the business of paraphrasing
// its own source of truth. The doctrine keeps its words. The screen speaks
// English. One file does the conversion, so the two cannot drift.
//
// HOUSE RULE FOR ADDING TO THIS FILE: write the sentence for someone who has
// never read a word of the doctrine and never will. If it contains a file
// name, a stage number, a skill name, or a metaphor, it is not finished.

/** What each phase is actually for, in words that need no glossary. */
export const PHASE_NAME = [
  'Getting your facts straight',
  'Becoming a familiar face',
  'Making something worth reading',
  'Sending people to it',
  'Keeping what worked',
];

/** The single sentence answering "so what do I do". One per phase. */
export const PHASE_WORK = [
  'Write down what you can prove, and set up the places you own outright.',
  'Be useful where your buyers already are. Do not post links yet.',
  'Write one good piece on your own site, then reuse parts of it elsewhere.',
  'Share that piece where it genuinely belongs.',
  'Drop what produced nothing. Do more of what worked.',
];

/** What is in the way, per closed gate, said as a consequence and not a rule. */
export const GATE_PLAIN = {
  1: 'You have nothing you can safely say in public yet.',
  2: 'You are still a stranger everywhere you post.',
  3: 'Nobody has checked that a stranger can actually buy this.',
  4: 'You have no recorded results, so there is nothing to judge.',
};

/** The shortest real step that clears it. An instruction, not a condition. */
export const GATE_FIX = {
  1: 'Write down one fact about your product and where it can be checked.',
  2: 'Be useful in one place until people there recognise you.',
  3: 'Buy your own product the way a stranger would, and write down what happened.',
  4: 'Record two dated results, at least one from something you own.',
};

/** Phase name by index, safe for an index the pack could not produce. */
export function phaseName(index) {
  return PHASE_NAME[index] || '';
}

/** The answer sentence for a phase. */
export function phaseWork(index) {
  return PHASE_WORK[index] || PHASE_NAME[index] || '';
}

/** Plain blocker for a closed gate, falling back to the doctrine's own words.
 *
 *  The fallback matters: a gate this file has not learned yet must still say
 *  SOMETHING true rather than nothing. Jargon is worse than English and much
 *  better than silence.
 */
export function gateBlocker(gate) {
  if (!gate) return '';
  return GATE_PLAIN[gate.stage] || gate.unmet || '';
}

/** Plain fix for a closed gate, or '' when there is nothing honest to say. */
export function gateFix(gate) {
  return gate ? (GATE_FIX[gate.stage] || '') : '';
}
