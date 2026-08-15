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

// WHICH STEPS ACTUALLY NEED THE LIVE WEB.
//
// Steps 1 to 4 ask the agent to go and find something that is not on this
// machine: where a claim can be checked, buyers describing a problem in their
// own words, how a rival makes money, which rooms those people are in. Offering
// that to someone whose provider cannot search is the impossible ask this
// console exists to remove — and only OpenRouter can search, with the toggle
// off by default, so the offer was usually a promise nothing could keep.
//
// Steps 5 to 8 are about work the founder does and records; the agent helps
// think, not fetch, so they read the same either way.
const raws = (list) => (Array.isArray(list) ? list : []).map((r) => String(r?.raw ?? '')).filter(Boolean);

/** What an earlier step produced that THIS step should be built on.
 *
 *  Reported: arriving at step 2 with nothing carried over from step 1, and an
 *  agent that could not tell you were on step 2 at all. Each step now says
 *  what it is standing on, so the screen and the agent agree about the job.
 *
 *  Returns {label, items} or null when there is nothing earlier to show. Never
 *  invents a connection: if the earlier step is empty, this says so and the
 *  step tells you to go back rather than pretending it can proceed.
 */
export function carriedInto(stepId, pack) {
  const from = {
    hear: ['What you can already prove', () => raws(pack?.truth?.cleared)],
    ground: ['What your buyer actually said', () => raws(pack?.recon?.pains)],
    rent: ['Who you are looking for', () => raws(pack?.recon?.pains)],
    welcome: ['Where you said you can speak', () => raws(pack?.bailey?.active)],
    make: ['Everything you may say, and nothing else', () => raws(pack?.truth?.cleared)],
    send: ['What you made', () => raws(pack?.motte?.held)],
    keep: ['What you own, so you can tell it from rented attention', () => raws(pack?.motte?.held)],
  }[stepId];
  if (!from) return null;
  return { label: from[0], items: from[1]() };
}

export const STEPS = [
  {
    id: 'prove',
    needsWeb: true,
    form: {
      heading: 'Cleared',
      fields: [
      { key: 'claim', label: 'The fact', placeholder: 'Runs offline with no account' },
      { key: 'source', label: 'Where it can be checked', placeholder: 'https://example.com/download' },
      ],
      compose: (v) => `${v.claim} — source: ${v.source}`,
    },
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
    needsWeb: true,
    form: {
      heading: 'Pains',
      fields: [
      { key: 'pain', label: 'What they said, in their words', placeholder: 'I keep getting confident answers that turn out to be wrong' },
      { key: 'where', label: 'Where you found it', placeholder: 'a forum thread, with the link' },
      ],
      compose: (v) => `${v.pain} — heard in: ${v.where} — verified: yes`,
    },
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
    needsWeb: true,
    form: {
      heading: 'Our ground',
      fields: [
      { key: 'claim', label: 'What you can say', placeholder: 'Pay once, it is yours' },
      { key: 'because', label: 'Why a rival cannot', placeholder: 'a subscription business would have to become a different company' },
      ],
      compose: (v) => `${v.claim} — because: ${v.because}`,
    },
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
    needsWeb: true,
    form: {
      heading: 'Active',
      fields: [
      { key: 'channel', label: 'The place', placeholder: 'a forum where your buyers argue about this' },
      { key: 'account', label: 'Your account there', placeholder: 'the handle you post under' },
      ],
      compose: (v) => `${v.channel} — account: ${v.account} — joined: ${new Date().toISOString().slice(0,10)} — standing: cold — links allowed: no`,
    },
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
    form: {
      heading: 'Active',
      fields: [
      { key: 'channel', label: 'The place you are now known', placeholder: 'the forum you have been answering in' },
      { key: 'account', label: 'Your account there', placeholder: 'the handle you post under' },
      ],
      compose: (v) => `${v.channel} — account: ${v.account} — joined: ${new Date().toISOString().slice(0,10)} — standing: warming — links allowed: no`,
    },
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
    form: {
      heading: 'Held',
      fields: [
      { key: 'asset', label: 'What you made and own', placeholder: 'the guide on your own site' },
      { key: 'grows', label: 'What makes it grow', placeholder: 'every reader who links to it' },
      ],
      compose: (v) => `${v.asset} — control: full — grows by: ${v.grows}`,
    },
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
    form: {
      heading: null,
      fields: [
      { key: 'outcome', label: 'How you confirmed it, and what happened', placeholder: 'discount code order on 3 March: checkout, payment and the emails all worked' },
      ],
    },
    n: 7,
    title: 'Check it, then send people',
    why: 'Traffic down a path nobody has walked wastes the one first impression you get. Checking it once is enough; it does not have to be checked again, and it does not have to cost you money.',
    todo: 'Confirm that a stranger can get from your page to a working product, and write down what happened. Then share what you made where it genuinely belongs.',
    example: 'Real order on 2026-07-17, #4285181: checkout, payment and the emails all worked.',
    tip: 'It does not have to cost you anything: a 100% discount code, your store’s test mode, or a friend buying it all prove the same thing. An older check counts only for the parts that have not changed since. If the product, the download link or the site has moved, re-walk those legs, because they are the ones most likely to be broken and the ones a stale check quietly vouches for.',
    agentAsk: 'Walk me through what a stranger would experience buying this, step by step, so I can check each one.',
    writesTo: 'campaign.md',
    done: (pack) => /^confirmed/i.test(String(pack?.campaign?.deliveryCheck || '').trim()),
    doneLabel: 'You have bought your own product and recorded it',
  },
  {
    id: 'keep',
    // A TABLE ROW, not a bullet, and it carries the OWNED/RENTED column.
    //
    // This form had date, metric, value and source and no kind at all, while
    // the gate requires at least one row marked owned. Filled in perfectly it
    // could never open its own step. It also had no writer, so Save dead-ended
    // on "recorded by hand for now", and numbers.md is a table, so the bullet
    // writer every other step uses would have corrupted it.
    form: {
      heading: null,
      table: true,
      fields: [
        { key: 'date', label: 'Date', placeholder: '2026-09-01' },
        { key: 'metric', label: 'What you counted', placeholder: 'downloads of the installer' },
        { key: 'kind', label: 'Owned or rented?', placeholder: 'owned' },
        { key: 'value', label: 'How many', placeholder: '14' },
        { key: 'source', label: 'Where you read it', placeholder: 'the releases page download count' },
      ],
      compose: (v) => `| ${v.date} | ${v.metric} | ${/^own/i.test(v.kind) ? 'motte' : 'bailey'} | ${v.value} | ${v.source} |`,
    },
    n: 8,
    title: 'Keep what worked',
    why: 'This step is for after you have sent people somewhere. Until then there is nothing to judge, and saying so is the honest answer rather than a gap to fill.',
    todo: 'Once a week write down what actually happened: the date, what you counted, how many, and where you read it. Two entries is enough to start telling what worked from what did not.',
    example: '2026-09-01 · downloads of the installer · owned · 14 · the releases page download count',
    tip: 'Where to look, best first: your store’s order count, because it is the only number that means somebody paid. Then your own site analytics and your own download counts, since nobody can take those away. Views and likes on a platform are the easiest to collect and the least useful, so mark those rented and never let them be the only thing you record.',
    agentAsk: 'Which of these numbers came from something I own, and which came from a platform that could take it away?',
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

/** A prompt the founder can paste into any tool that CAN reach the web.
 *
 *  Borrowed from Idea Forge Pro, which hit this same wall and answered it
 *  properly: a browser cannot fetch DuckDuckGo or a rival's pricing page,
 *  because those hosts send no CORS headers to it, so on any provider without
 *  server-side search the console genuinely cannot go and look. Saying so and
 *  stopping is honest but useless. IFP says so and hands over a prompt to run
 *  somewhere that can, which keeps the step completable on every provider.
 *
 *  It carries what is already recorded, so the research is about THIS product
 *  rather than a generic question, and it asks for links because a finding
 *  without a source cannot clear anything.
 */
export function researchPrompt(step, pack) {
  if (!step?.needsWeb) return '';
  const carried = carriedInto(step.id, pack);
  const known = (carried?.items || []).slice(0, 3);
  return [
    `I am working on marketing a product and I need you to search the web and come back with sources.`,
    '',
    `WHAT I NEED: ${step.agentAsk}`,
    '',
    known.length ? `WHAT I ALREADY KNOW (${carried.label.toLowerCase()}):
${known.map((k) => `- ${k}`).join(String.fromCharCode(10))}` : '',
    known.length ? '' : '',
    `RULES:`,
    `- Every finding must come with the URL it came from. A statement with no link is useless to me.`,
    `- Quote people in their own words. Do not tidy their phrasing into marketing language.`,
    `- If you cannot find something, say so. Do not fill the gap.`,
    '',
    `Give me the findings as a short list I can paste back, each one line plus its link.`,
  ].filter((l) => l !== null).join(String.fromCharCode(10));
}

/** How many are finished, for the progress line. */
export function doneCount(pack) {
  return stepStates(pack).filter((s) => s.isDone).length;
}
