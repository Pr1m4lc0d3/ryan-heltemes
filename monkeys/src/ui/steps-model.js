// steps-model.js — the eight steps, and how the console knows you finished one.
//
// WHAT THIS REPLACES. The console used to be four doors onto ten files. Asked
// what a person actually does with it, nobody could say, including whoever
// built it — so every screen displayed a file rather than completing a step,
// and the entry point could not make sense because there was no sequence for
// it to be the entry to. doctrine/the-workflow.md is that sequence. This file
// is the sequence made checkable.
//
// TWO RULES HOLD EVERY ENTRY BELOW.
//
// 1. EVERY `done` CHECK READS THE REAL PACK. Not a flag the console sets, not
//    a box the user ticks. If a step cannot be verified from the files, it does
//    not belong here as a step, because a checklist that marks itself finished
//    teaches nothing and can lie. Each check below was written against the
//    parsed shape (truth.cleared, recon.pains, asymmetry.ourGround, motte.held,
//    bailey.active, campaign.deliveryCheck, numbers.rows) rather than hoped at.
//
// 2. NO DOCTRINE WORDS. Not "standing", not "artifact", not "land you own",
//    not "rooms", not "cold", not "prune", and no file names in a sentence the
//    reader is meant to act on. Same rule as src/ui/plain.js and the same
//    reason: a screen that needs a glossary has failed, however correct it is.
//
// The four gates in stages.js are still the authority on which STAGE a pack is
// at. Steps 1, 5, 6+7 and 8 line up with gates 1 to 4 exactly; steps 2, 3 and
// 4 are the work between them that no gate measures. This file never
// recomputes a stage — it asks the same files a different question: what is
// finished, and what is next.

const has = (list) => Array.isArray(list) && list.length > 0;

export const STEPS = [
  {
    id: 'prove',
    n: 1,
    title: 'Prove one thing',
    why: 'Until one fact about your product can be checked by a stranger, there is nothing you can safely say in public.',
    todo: 'Write down one true thing about your product, and where someone could go to check it.',
    example: 'Runs offline with no account. Checkable on the download page.',
    tip: 'Your own pricing page counts. Your own README counts. "Trusted by thousands" does not, because there is nowhere to send someone.',
    agentAsk: 'Find where this claim can be independently checked, and give me the exact link.',
    writesTo: 'truth.md',
    done: (pack) => has(pack?.truth?.cleared),
    doneLabel: 'One fact recorded with a source',
  },
  {
    id: 'hear',
    n: 2,
    title: 'Hear the buyer',
    why: 'A problem you wrote is a problem you can already answer, which makes it useless for testing whether anyone else has it.',
    todo: 'Find three people describing this problem in their own words, and copy what they said.',
    example: '"I keep getting confident answers that turn out to be wrong and I have nobody to check them against."',
    tip: 'Quote them. The moment you tidy it up into marketing language you have replaced their problem with your pitch.',
    agentAsk: 'Search public forums and communities for people describing this problem in their own words, and quote them with links.',
    writesTo: 'recon.md',
    done: (pack) => has(pack?.recon?.pains),
    doneLabel: 'At least one buyer quoted in their own words',
  },
  {
    id: 'ground',
    n: 3,
    title: 'Find what only you can say',
    why: 'A competitor with more money can copy any feature. They cannot copy a claim their own business model forbids them to make.',
    todo: 'Work out how a well-funded rival makes money, then name what that forces them to never say. Keep whichever of those you can honestly claim.',
    example: 'A company charging monthly cannot offer to sell it once. That would make it a different company.',
    tip: 'This is private. Never name a competitor in anything a stranger reads. Claim the ground, not the fight.',
    agentAsk: 'Read how the main alternatives in this market make money, and work out what each model forbids them to claim.',
    writesTo: 'asymmetry.md',
    done: (pack) => has(pack?.asymmetry?.ourGround),
    doneLabel: 'At least one claim only you can make',
  },
  {
    id: 'rent',
    n: 4,
    title: 'List where you can speak',
    why: 'Every account you have is borrowed. Knowing which places are borrowed is what stops you building on ground that can be taken back.',
    todo: 'List the places you can post: communities, platforms, anywhere with an audience you did not build.',
    example: 'A subreddit where your buyers already argue about this.',
    tip: 'Also write down the ones you are ruling out and why, or you will reconsider the same bad idea every month.',
    agentAsk: 'Find the communities and platforms where the people I quoted actually gather, and tell me the posting rules of each.',
    writesTo: 'bailey.md',
    done: (pack) => has(pack?.bailey?.active),
    doneLabel: 'At least one place recorded',
  },
  {
    id: 'welcome',
    n: 5,
    title: 'Be worth listening to',
    why: 'Posting a link somewhere nobody knows you is how accounts get banned, and a ban is not something you recover from.',
    todo: 'Pick one place and be useful in it. Answer questions. Post no links at all. Do this until someone there recognises your name.',
    example: 'Two weeks of answering questions properly, with nothing to sell in any of them.',
    tip: 'This is the longest step and no software shortens it. Weeks, not days.',
    agentAsk: 'What are people asking in this community right now that I could answer well?',
    writesTo: 'bailey.md',
    done: (pack) => (pack?.bailey?.active || []).some((a) => /warming|established/i.test(String(a?.fields?.standing || a?.raw || ''))),
    doneLabel: 'Known in at least one place',
  },
  {
    id: 'make',
    n: 6,
    title: 'Make one good thing',
    why: 'Everything else is rented. A thing on your own site is the only asset nobody can take back.',
    todo: 'Publish one substantial piece on something you own, using only facts from step 1. Then reuse pieces of it elsewhere.',
    example: 'A written explanation of how the thing works, good enough that a stranger can judge it without buying.',
    tip: 'Every claim in it has to trace back to step 1. If it does not, either source it or cut it.',
    agentAsk: 'Draft this piece using only my recorded facts, and flag anything I have not sourced.',
    writesTo: 'motte.md',
    done: (pack) => has(pack?.motte?.held),
    doneLabel: 'At least one thing you own outright',
  },
  {
    id: 'send',
    n: 7,
    title: 'Check it, then send people',
    why: 'Traffic down a path nobody has walked wastes the one first impression you get.',
    todo: 'Buy your own product exactly as a stranger would. Download, install, pay, receive. Write down what happened. Then share what you made where it genuinely belongs.',
    example: 'Bought it on a clean machine, card went through, licence arrived in four minutes.',
    tip: 'Do this even if you are certain it works. Certainty is what makes people skip it.',
    agentAsk: 'Walk me through what a stranger would experience buying this, step by step, so I can check each one.',
    writesTo: 'campaign.md',
    done: (pack) => /^confirmed/i.test(String(pack?.campaign?.deliveryCheck || '').trim()),
    doneLabel: 'You have bought your own product and recorded it',
  },
  {
    id: 'keep',
    n: 8,
    title: 'Keep what worked',
    why: 'You cannot drop what failed until you have written down what happened, and memory is not a record.',
    todo: 'Record dated results, including at least one from something you own rather than a platform. Then stop doing whatever produced nothing.',
    example: '2026-09-01 · signups from the guide · 14 · site analytics',
    tip: 'Likes on a platform are the easiest number to collect and the least useful. Count the ones that reached something you own.',
    agentAsk: 'Which of these results came from something I own, and which came from rented attention?',
    writesTo: 'numbers.md',
    done: (pack) => (pack?.numbers?.rows || []).length >= 2,
    doneLabel: 'Two dated results recorded',
  },
];

/** Which steps are finished, in order. Reads the pack, never a stored flag. */
export function stepStates(pack) {
  return STEPS.map((s) => ({ ...s, isDone: Boolean(pack && s.done(pack)) }));
}

/** The step to work on: the first unfinished one.
 *
 *  NOT the furthest one finished. A pack can satisfy a later step while an
 *  earlier one is still empty — two recorded results and nothing sourced does
 *  exactly that — and pointing someone at step 8 while step 1 is blank is the
 *  same trap stages.js's gate walk exists to avoid. First unfinished, always.
 */
export function currentStep(pack) {
  const states = stepStates(pack);
  return states.find((s) => !s.isDone) || states[states.length - 1];
}

/** How many are finished, for the progress line. */
export function doneCount(pack) {
  return stepStates(pack).filter((s) => s.isDone).length;
}
