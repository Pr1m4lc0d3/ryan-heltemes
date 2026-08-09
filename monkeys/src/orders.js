// orders.js — the deployment order. See design.md §6C.
//
// The console researches, plans, drafts and checks. Then it writes one of
// these, a human signs it, and an agent with real tools carries it out. The
// hand-off is the approval gate, not a workaround for a static page: a tool
// that could post is the one place a tired founder clicks through at
// midnight, and every guard in FORTRESS exists for that moment.
//
// This is Idea Forge Pro's work order, deliberately. There an idea becomes a
// Sell-Kit (an interchange format) and separately a brief that leads with
// instructions and names its receiving team by real identifiers. The
// .monkeys/ pack is our Sell-Kit; this is our work order.
//
// PURE. A pack and a package in, markdown out. No DOM, no network, no clock:
// the date is passed in, because a document that stamps itself from the
// machine clock cannot be tested and cannot be reproduced.

// ---------------------------------------------------------------------------
// Identifiers. Read from RAID/skills and FORTRESS/skills, never invented.
//
// THE ONE FAILURE THIS DOCUMENT EXISTS TO PREVENT is naming a skill that does
// not exist: the order fails on arrival, and the founder cannot tell whether
// the plan was wrong or the name was. Anything added here must be checked
// against the plugin directories first.
// ---------------------------------------------------------------------------

export const RAID_SKILLS = Object.freeze([
  'raid', 'raid-recon', 'raid-asymmetry', 'raid-stunt', 'raid-moment',
  'raid-borrow', 'raid-multiply', 'raid-draft', 'raid-campaign', 'raid-briefing',
]);

export const FORTRESS_SKILLS = Object.freeze([
  'fortress', 'fortress-truth', 'fortress-motte', 'fortress-bailey',
  'fortress-standing', 'fortress-measure', 'fortress-gate',
]);

// What Claude Code actually has. An order that assumes a plugin a stranger
// has not installed fails exactly the way a bad skill name does, so anything
// beyond this list is named as an optional accelerant with a fallback.
export const BUILT_IN_TOOLS = Object.freeze([
  'WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash',
]);

export function isKnownSkill(name) {
  return RAID_SKILLS.includes(name) || FORTRESS_SKILLS.includes(name);
}

function esc(v) {
  return String(v ?? '').trim();
}

function bullets(items) {
  return items.length ? items.map((i) => `- ${i}`).join('\n') : '_none_';
}

// ---------------------------------------------------------------------------
// The venue. A venue is the unit an order is written for, because its rules,
// its link tolerance and the standing this account has earned are all
// per-venue. Bundling two venues into one document is how the wrong rules
// get applied to the wrong post.
// ---------------------------------------------------------------------------

// findVenue(pack, channel) -> { channel, account, standing, linksAllowed,
//   rules, entryCost, audience, known }
//
// `known: false` means the console has no bailey.md entry for it. The order
// still writes, and says plainly that the room is unread — a missing entry
// is a gap in the pack, not grounds to invent rules for a room nobody
// looked at.
export function findVenue(pack, channel) {
  const want = esc(channel).toLowerCase();
  const active = (pack?.bailey?.active || []).find(
    (e) => esc(e.fields?.channel).toLowerCase() === want,
  );
  const room = (pack?.recon?.rooms || []).find(
    (e) => esc(e.fields?.room).toLowerCase() === want,
  );
  const f = active?.fields || {};
  const r = room?.fields || {};
  return {
    channel: esc(channel),
    account: esc(f.account),
    standing: esc(f.standing),
    linksAllowed: esc(f.linksAllowed),
    rules: esc(r.rules),
    entryCost: esc(r.entryCost),
    audience: esc(r.audience),
    known: Boolean(active || room),
  };
}

// ---------------------------------------------------------------------------
// The claim map. Every factual sentence has to trace to a cleared line, or
// it does not travel. This is the same discipline Door 3 lints a draft with;
// here it is written into the document so the receiving agent can re-check
// it without the console.
// ---------------------------------------------------------------------------

function clearedLines(pack) {
  return (pack?.truth?.cleared || []).map((e) => ({
    claim: esc(e.fields?.claim) || esc(e.raw).split(' — ')[0],
    source: esc(e.fields?.source),
    raw: esc(e.raw),
  }));
}

// ---------------------------------------------------------------------------
// buildOrder({pack, venue, draft, ask, skill, date, cuts}) -> {markdown, filename, blocked}
//
// `blocked` is non-empty when the order must not be written at all. Refusing
// here is the whole point: an unwritable order caught in the console is a
// sentence on screen, and the same order written anyway is a post.
// ---------------------------------------------------------------------------

export function buildOrder(input) {
  const { pack, draft, ask, date } = input || {};
  const skill = esc(input?.skill) || 'raid-draft';
  const channel = esc(input?.venue);
  const cuts = input?.cuts || [];
  const text = esc(draft);

  if (!pack) return { markdown: '', filename: '', blocked: 'No pack is loaded.' };
  if (!text) return { markdown: '', filename: '', blocked: 'There is no draft to deploy.' };
  if (!channel) return { markdown: '', filename: '', blocked: 'Name the venue this goes to.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(esc(date))) {
    return { markdown: '', filename: '', blocked: 'An order needs a date, as YYYY-MM-DD.' };
  }
  if (!isKnownSkill(skill)) {
    return {
      markdown: '', filename: '',
      blocked: `"${skill}" is not a skill in RAID or FORTRESS. An order naming a skill that does not `
        + 'exist fails on arrival, and the founder cannot tell whether the plan was wrong or the name was.',
    };
  }

  const cleared = clearedLines(pack);
  if (!cleared.length) {
    return {
      markdown: '', filename: '',
      blocked: 'truth.md has no cleared facts, so nothing in this draft can be traced to a source.',
    };
  }

  const v = findVenue(pack, channel);

  // A link into a room that has not earned one is refused HERE, by the
  // document, rather than left for the sending agent to notice. This is the
  // rule that gets accounts banned, and it is checkable from the text.
  const carriesLink = /https?:\/\/|\bwww\./i.test(text);
  if (carriesLink && v.linksAllowed === 'no') {
    return {
      markdown: '', filename: '',
      blocked: `This draft carries a link and ${v.channel} has "links allowed: no". Earn standing `
        + 'there first, or cut the link.',
    };
  }

  const uncleared = (pack?.truth?.uncleared || []).map((e) => esc(e.raw));
  const slug = v.channel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'venue';

  const md = [
    `# Deployment order — ${v.channel} — ${date}`,
    '',
    '**Status:** UNSIGNED. An unsigned order is a draft, not a backlog item. Do not act on it.',
    '',
    '## Approval',
    '',
    'A person signs this by replacing the line below with their name and the date.',
    '',
    '    approved by: ____________________  on: ____________',
    '',
    '## Instruction',
    '',
    `Run \`${skill}\`. Post the package below to **${v.channel}**${v.account ? ` as \`${v.account}\`` : ''}.`,
    '',
    `**Tools needed:** ${BUILT_IN_TOOLS.join(', ')} — all built in, nothing to install.`,
    '',
    '**Optional accelerant:** a browser driver (Playwright) can post directly. Without one, hand the '
      + 'package to the human to paste. The order is complete either way; it never depends on a '
      + 'plugin a stranger may not have.',
    '',
    '**Done when:** the post is live and its URL is recorded in `numbers.md` by a human or by an '
      + 'agent holding real credentials. This console never writes that row.',
    '',
    '## The venue',
    '',
    v.known
      ? bullets([
        `channel: ${v.channel}`,
        v.account ? `account: ${v.account}` : 'account: _not recorded in bailey.md_',
        v.standing ? `standing: ${v.standing}` : 'standing: _not recorded_',
        v.linksAllowed ? `links allowed: ${v.linksAllowed}` : 'links allowed: _not recorded — assume no_',
        v.rules ? `rules: ${v.rules}` : 'rules: _not read yet_',
        v.entryCost ? `entry cost: ${v.entryCost}` : '',
        v.audience ? `audience: ${v.audience}` : '',
      ].filter(Boolean))
      : `**This room is unread.** There is no \`${v.channel}\` in \`bailey.md ## Active\` or `
        + '`recon.md ## Rooms`, so its rules, its entry cost and this account\'s standing are all '
        + 'unknown. Read the room before posting: run `raid-recon` and record what it actually says.',
    '',
    '## The package',
    '',
    '```',
    text,
    '```',
    '',
    cuts.length
      ? `### Cuts for other surfaces\n\n${cuts.map((c, i) => `${i + 1}. ${esc(c)}`).join('\n')}\n\n`
        + 'Each cut must stand alone. A cut that needs the source post for context is not a cut.'
      : '_No cuts. `raid-multiply` can make them from the package above._',
    '',
    '## Claim map',
    '',
    'Every factual sentence in the package must trace to one of these. A sentence that traces to '
      + 'nothing does not travel — cut it rather than sourcing it after the fact.',
    '',
    bullets(cleared.map((c) => `${c.claim}${c.source ? ` — source: ${c.source}` : ''}`)),
    '',
    '## Deliberately not said',
    '',
    uncleared.length
      ? 'These were in reach and were left out. They are decisions, not oversights, and re-proposing '
        + 'them without new evidence is a step backwards.\n\n' + bullets(uncleared)
      : '_Nothing in `truth.md ## Uncleared` yet._',
    '',
    '## Refused by this order',
    '',
    bullets([
      'No claim outside the map above.',
      'No competitor named, in any wording. `asymmetry.md` is internal and is not in this document.',
      'No invented number, quote, testimonial, name or date.',
      v.linksAllowed === 'no'
        ? `No link: ${v.channel} has not earned one.`
        : 'A link only if the package already carries one; do not add one.',
    ]),
    '',
    `_Written by the Monkey Console from the \`.monkeys/\` pack on ${date}. The console does not post._`,
    '',
  ].join('\n');

  return {
    markdown: md,
    filename: `orders/${date}-${slug}.md`,
    blocked: '',
    venue: v,
  };
}
