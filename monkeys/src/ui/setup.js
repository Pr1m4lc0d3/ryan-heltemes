// setup.js — Door 1, "Set up my ground". Guided forms that build the pack,
// one file at a time, in the format order from design.md §6: truth.md,
// motte.md, bailey.md, recon.md, asymmetry.md, campaign.md. numbers.md,
// scars.md, sell-kit.md and briefings/ are out of scope here — design.md §6's
// own "Written by" column has them written by an ongoing companion, an
// import, or a daily process, never by kickoff — matching the placeholder
// text src/ui/home.js already shipped for this door (Task 5).
//
// Same split as today.js/check.js: pure helpers plus renderSetupHTML(files)
// are DOM-free and exercised headlessly in tests/render.mjs; mountSetup is
// the thin DOM-touching half.
//
// FOUR RULES THIS FILE EXISTS TO ENFORCE (see the Task 7 brief):
//   1. NOTHING PRE-FILLED. No <input> below ever carries a `value="..."`
//      built from pack content or an example. A full re-render only ever
//      happens right after a successful Add/Save (which clears the form by
//      construction) — never on a keystroke — so there is no controlled
//      input anywhere that could leak an example into. <select> OPTIONS
//      (e.g. "warming") are UI choices, not pre-filled content.
//   2. AN UNANSWERABLE FIELD IS LEFT EMPTY, AND THE GATE IT CLOSES IS NAMED.
//      Cleared/Active-standing/Held each show their own gate's `unmet`
//      string, read live from stages.js's evaluate() — never a second,
//      hand-written copy of that text (same discipline today.js already
//      follows).
//   3. A CLEARED CLAIM NEVER SHIPS WITHOUT A SOURCE. classifyTruthEntry()
//      is the one place that decision gets made: a source given → Cleared;
//      no source but a reason given → Uncleared; neither → refused, nothing
//      written. See its own comment.
//   4. NEVER DESTROY EXISTING DATA. Every mutation here only appends a
//      bullet under a heading, or replaces one designated free-text
//      section/line, on top of `files[name]` — the pack's own cached raw
//      text, seeded from pack.raw. There is no "rebuild the whole file from
//      parsed fields" path anywhere in this module, so anything the user
//      did not touch passes through byte for byte.
//
// The fifth thing the brief asks for — "copy a kickoff prompt for your AI
// agent" — is buildKickoffPrompt() below. It never reads a claim, a field
// value, or anything else from the pack's own content: only static doctrine
// text plus the plain list of which of the nine files are still missing (a
// structural fact about the pack, not a product detail).
//
// EVERY string that came from the pack (existing entries, current free-text
// values) is escaped before insertion — pack content is user text and may
// contain "<".

import { parsePack } from '../pack.js';
import { evaluate } from '../stages.js';
import { downloadPack } from '../fs.js';
import { planImport, EVIDENCE_GRADES } from '../sellkit.js';
import { icon } from './icons.js';
import { renderStepGroup, activateStep, stepGroupOf } from './steps.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// ---------------------------------------------------------------------------
// Pure text-mutation helpers. Each takes a file's current raw text (or
// undefined/empty, for a file that does not exist yet) and returns new raw
// text. None of these rebuild a file from parsed fields — see rule 4 above.
// ---------------------------------------------------------------------------

function headingLineIndex(lines, heading) {
  const target = heading.trim().toLowerCase();
  return lines.findIndex((l) => {
    const m = l.trim().match(/^##\s+(.*)$/);
    return m !== null && m[1].trim().toLowerCase() === target;
  });
}

function sectionEndIndex(lines, startIdx) {
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i].trim())) return i;
  }
  return lines.length;
}

// appendBulletToFile(fileText, heading, bulletLine) -> new file text with
// "- bulletLine" added as the last bullet under "## heading". Creates the
// heading (and the file, if absent) rather than guessing where else a
// bullet with no home yet might belong. Everything before and after the
// target section passes through unchanged, line for line.
export function appendBulletToFile(fileText, heading, bulletLine) {
  const text = fileText || '';
  const lines = text.length ? text.split('\n') : [];
  const idx = headingLineIndex(lines, heading);
  if (idx === -1) {
    const sep = lines.length && lines[lines.length - 1].trim() !== '' ? '\n\n' : (lines.length ? '\n' : '');
    return `${lines.join('\n')}${sep}## ${heading}\n\n- ${bulletLine}\n`;
  }
  const end = sectionEndIndex(lines, idx);
  let insertAt = end;
  while (insertAt > idx + 1 && lines[insertAt - 1].trim() === '') insertAt--;
  const before = lines.slice(0, insertAt);
  const after = lines.slice(insertAt);
  return [...before, `- ${bulletLine}`, ...after].join('\n');
}

// setSectionText(fileText, heading, newText) -> new file text with the
// entire body of "## heading" replaced by one paragraph, newText. Used only
// for the pack's free-text sections (Canonical source, Why this stage) —
// appendBulletToFile is the only writer for a bulleted one.
export function setSectionText(fileText, heading, newText) {
  const text = fileText || '';
  const lines = text.length ? text.split('\n') : [];
  const idx = headingLineIndex(lines, heading);
  if (idx === -1) {
    const sep = lines.length && lines[lines.length - 1].trim() !== '' ? '\n\n' : (lines.length ? '\n' : '');
    return `${lines.join('\n')}${sep}## ${heading}\n\n${newText}\n`;
  }
  const end = sectionEndIndex(lines, idx);
  const before = lines.slice(0, idx + 1);
  const after = lines.slice(end);
  return [...before, '', newText, '', ...after].join('\n');
}

// setPreambleLine(fileText, matchRe, newLine) -> new file text with the
// first preamble line (before the first "## " heading) matching matchRe
// replaced by newLine, or newLine inserted at the end of the preamble when
// nothing matched. The only caller is campaign.md's "**Delivery check:**"
// line — Stage and Opened are raid-campaign's own output; this door
// deliberately never writes them (see renderCampaignSection's intro copy).
export function setPreambleLine(fileText, matchRe, newLine) {
  const text = fileText || '';
  const lines = text.length ? text.split('\n') : [];
  const headIdx = lines.findIndex((l) => /^##\s+/.test(l.trim()));
  const end = headIdx === -1 ? lines.length : headIdx;
  for (let i = 0; i < end; i++) {
    if (matchRe.test(lines[i].trim())) {
      lines[i] = newLine;
      return lines.join('\n');
    }
  }
  const before = lines.slice(0, end);
  while (before.length && before[before.length - 1].trim() === '') before.pop();
  const after = lines.slice(end);
  const body = before.length ? [...before, newLine, ''] : [newLine, ''];
  return [...body, ...after].join('\n');
}

// buildEntryLine(primary, pairs) -> "primary — label: value — label: value",
// the exact " — key: value" grammar src/pack.js's parseEntry expects. A pair
// whose value is blank is left out entirely, rather than appearing as
// "label: " with nothing after it.
function buildEntryLine(primary, pairs) {
  const parts = [String(primary).trim()];
  for (const [label, value] of pairs) {
    const v = String(value ?? '').trim();
    if (v !== '') parts.push(`${label}: ${v}`);
  }
  return parts.join(' — ');
}

// ---------------------------------------------------------------------------
// Rule 3 — the one place a Cleared claim's fate is decided. See the header.
// ---------------------------------------------------------------------------

export function classifyTruthEntry({ claim, source, reason }) {
  const claimText = (claim || '').trim();
  if (!claimText) {
    return { ok: false, error: 'Say what the claim is before sourcing it or setting it aside.' };
  }
  const sourceText = (source || '').trim();
  if (sourceText) {
    return {
      ok: true, section: 'cleared', heading: 'Cleared',
      line: buildEntryLine(claimText, [['source', sourceText]]),
    };
  }
  const reasonText = (reason || '').trim();
  if (reasonText) {
    return {
      ok: true, section: 'uncleared', heading: 'Uncleared',
      line: buildEntryLine(claimText, [['reason', reasonText]]),
    };
  }
  return {
    ok: false,
    error: 'No source? Say why in the reason field, or nothing is saved.',
  };
}

// ---------------------------------------------------------------------------
// The kickoff handoff — the honest path for what a browser cannot do.
// ---------------------------------------------------------------------------

// buildKickoffPrompt(files) -> string. Reads ONLY pack.missing — a
// structural fact (which of the nine files exist) — never a claim, a field
// value, or any other pack content. See rule 5 in the header.
export function buildKickoffPrompt(files) {
  const pack = parsePack(files || {});
  const missing = pack.missing;
  const lines = [
    'You are my AI agent, working from the Maverick\'s Monkeys FORTRESS and RAID plugins. I am setting up my .monkeys/ pack by hand in the Monkey Console, but part of it needs work a browser cannot do: fetching another site, reading a competitor\'s pricing page, or finding a specific room\'s posting rules. Guessing any of that is exactly what gets an account banned, so please do not guess — fetch, read, and cite what you actually find.',
    '',
    'Please:',
    '1. Run the `fortress` skill\'s kickoff for my product — it builds or updates truth.md, motte.md and bailey.md.',
    '2. Run the `raid` skill\'s kickoff — it builds or updates recon.md and asymmetry.md. Actually fetch and read whatever you cite; never invent a claim, a room\'s rules, or a competitor\'s revenue model.',
    '3. Write the results into the .monkeys/ pack files, following the format in design.md section 6 exactly — every claim in truth.md needs a real source, every bailey.md exclusion needs a real reason.',
    '4. Never overwrite anything I already wrote by hand — only add what is genuinely missing.',
    '5. Tell me when you are done so I can load the pack back into the Monkey Console and pick up from Door 2, "What do I do today".',
    '',
    missing.length
      ? `Files this pack does not have yet: ${missing.join(', ')}.`
      : 'Every pack file already has something in it — please only add to what is genuinely missing, never overwrite a section that is already there.',
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry-form configuration — one entry per bulleted sub-section this door
// covers. Field shapes and required-ness mirror src/pack.js's own field
// contracts (TRUTH_CLEARED, MOTTE_HELD, ...) exactly, so nothing built here
// can come back malformed. `wireLabel` is the literal label text the " — "
// grammar needs; it defaults to `key` when the two are already the same
// word (see buildEntryLine / the wiring below).
// ---------------------------------------------------------------------------

const YES_NO = ['yes', 'no'];
const STANDING_OPTIONS = ['cold', 'warming', 'established'];
const CONTROL_OPTIONS = ['full', 'partial'];

const SIMPLE_FORMS = [
  {
    id: 'motte-held', file: 'motte.md', heading: 'Held',
    title: 'Held — what you own outright',
    intro: 'Domains, email lists, the product itself.',
    primaryLabel: 'Asset', primaryHelp: 'A short name for the thing you own outright.',
    fields: [
      { key: 'control', label: 'Control', help: 'How completely do you control it?', select: CONTROL_OPTIONS, required: true },
      // Partial control is the case that decides how much of an asset is
      // really motte. "Partial" on its own records a feeling; these three
      // record who can take what, and what is left standing if they do —
      // and only that residue is ground nobody can confiscate.
      {
        key: 'sharedWith', wireLabel: 'shared with', label: 'Shared with',
        help: 'Who else holds a piece of it. Name them.',
        required: true, showWhen: { field: 'control', equals: 'partial' },
      },
      {
        key: 'theyCan', wireLabel: 'they can', label: 'They can',
        help: 'What they could take, block or veto without asking you.',
        required: true, showWhen: { field: 'control', equals: 'partial' },
      },
      {
        key: 'youKeep', wireLabel: 'you keep', label: 'You keep',
        help: 'What is still yours the day they walk. This part is the motte.',
        required: true, showWhen: { field: 'control', equals: 'partial' },
      },
      { key: 'growsBy', wireLabel: 'grows by', label: 'Grows by', help: 'What makes this bigger over time?', required: true },
    ],
    gateStage: 3,
    getEntries: (p) => p.motte.held,
  },
  {
    id: 'motte-wanted', file: 'motte.md', heading: 'Wanted',
    title: 'Wanted — owned ground you do not have yet',
    intro: 'Named so it is never re-proposed as already built.',
    primaryLabel: 'Asset', primaryHelp: 'A short name for the thing you want to own but do not yet.',
    fields: [
      { key: 'why', label: 'Why', help: 'One honest sentence. Optional.', required: false },
    ],
    gateStage: null,
    getEntries: (p) => p.motte.wanted,
  },
  {
    id: 'bailey-active', file: 'bailey.md', heading: 'Active',
    title: 'Active — rented ground you are using',
    intro: 'A community, a listing, a social account.',
    primaryLabel: 'Channel', primaryHelp: 'The room or platform, plainly named.',
    fields: [
      { key: 'account', label: 'Account', help: 'The handle or listing name you post as there.', required: true },
      { key: 'joined', label: 'Joined', help: 'The date you joined, YYYY-MM-DD.', required: true },
      { key: 'standing', label: 'Standing', help: 'cold = new, no links yet. warming = posted something useful and it landed. established = a sustained history.', select: STANDING_OPTIONS, required: true },
      // warming and established are what open stage 2's gate. Claiming
      // either without naming what earned it is the same unsourced claim
      // truth.md refuses — it just fails less visibly, because standing is
      // a judgement about a room rather than a fact about the world.
      {
        key: 'earnedBy', wireLabel: 'earned by', label: 'Earned by',
        help: 'What you posted there that landed. Cold standing needs nothing; this does.',
        required: true, showWhen: { field: 'standing', oneOf: ['warming', 'established'] },
      },
      { key: 'linksAllowed', wireLabel: 'links allowed', label: 'Links allowed', help: 'Has this account earned the right to post a link here yet?', select: YES_NO, required: true },
      // A link posted without the right is how an account gets banned, and
      // RAID's send gate reads this field before it will stage a draft
      // carrying one. Say which rule or which moment granted it.
      {
        key: 'allowedBecause', wireLabel: 'allowed because', label: 'Allowed because',
        help: "The room's own rule, or the moment this account earned it.",
        required: true, showWhen: { field: 'linksAllowed', equals: 'yes' },
      },
    ],
    gateStage: 2,
    getEntries: (p) => p.bailey.active,
  },
  {
    id: 'bailey-excluded', file: 'bailey.md', heading: 'Excluded',
    title: 'Excluded — ground you ruled out',
    intro: 'Recorded so it is not re-proposed every session.',
    primaryLabel: 'Channel', primaryHelp: 'The room or platform you are ruling out.',
    fields: [
      { key: 'reason', label: 'Reason', help: 'Why this is not worth entering.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.bailey.excluded,
  },
  {
    id: 'recon-pains', file: 'recon.md', heading: 'Pains',
    title: 'Pains — who hurts, in their own words',
    intro: 'Their actual phrasing, not a marketer\'s paraphrase.',
    primaryLabel: 'Pain', primaryHelp: 'The pain, quoted or closely paraphrased in their own words.',
    fields: [
      { key: 'heardIn', wireLabel: 'heard in', label: 'Heard in', help: 'Where you actually saw or heard this said.', required: true },
      { key: 'verified', label: 'Verified', help: 'yes = you found this at the source yourself, this session. no = secondhand or unconfirmed.', select: YES_NO, required: true },
      // The same two-branch shape truth.md uses for claims: a source when
      // there is one, a reason when there is not. "verified: yes" with
      // nothing behind it is an unsourced claim wearing a checkmark.
      {
        key: 'verifiedBy', wireLabel: 'verified by', label: 'Verified by',
        help: 'Where you saw it yourself — the thread, the call, the review.',
        required: true, showWhen: { field: 'verified', equals: 'yes' },
      },
      {
        key: 'wouldVerify', wireLabel: 'would verify', label: 'Would verify',
        help: 'What would confirm it, so this is a task and not a shrug.',
        required: true, showWhen: { field: 'verified', equals: 'no' },
      },
    ],
    gateStage: null,
    getEntries: (p) => p.recon.pains,
  },
  {
    id: 'recon-rooms', file: 'recon.md', heading: 'Rooms',
    title: 'Rooms — where this audience gathers',
    intro: 'A room you do not build, only enter well.',
    primaryLabel: 'Room', primaryHelp: 'The community, forum, or venue, plainly named.',
    fields: [
      { key: 'audience', label: 'Audience', help: 'Who is actually there.', required: true },
      { key: 'rules', label: 'Rules', help: 'What this room forbids or requires before you post.', required: true },
      { key: 'entryCost', wireLabel: 'entry cost', label: 'Entry cost', help: 'Time, a fee, an introduction — what it costs to earn a hearing.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.recon.rooms,
  },
  {
    id: 'asymmetry-incumbents', file: 'asymmetry.md', heading: 'Incumbents',
    title: 'Incumbents — ground their model forbids them',
    intro: 'Internal only — never published, never a real company name.',
    primaryLabel: 'Incumbent', primaryHelp: 'Describe them by category (e.g. "a subscription-funded incumbent"), not by name.',
    fields: [
      { key: 'revenueModel', wireLabel: 'revenue model', label: 'Revenue model', help: 'How they actually make money.', required: true },
      { key: 'thereforeCannotSay', wireLabel: 'therefore cannot say', label: 'Therefore cannot say', help: 'What that revenue model forbids them to claim.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.asymmetry.incumbents,
  },
  {
    id: 'asymmetry-ourground', file: 'asymmetry.md', heading: 'Our ground',
    title: 'Our ground — what they structurally cannot say',
    intro: 'The claim, and why it is safe for you to say.',
    primaryLabel: 'Claim', primaryHelp: 'What you can honestly say.',
    fields: [
      { key: 'because', label: 'Because', help: 'Why their model forbids this and yours does not.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.asymmetry.ourGround,
  },
  {
    id: 'campaign-open', file: 'campaign.md', heading: 'Open now',
    title: 'Open now — named actions for today',
    intro: 'Each names the skill that does it — never a vague to-do.',
    primaryLabel: 'Action', primaryHelp: 'What to actually do.',
    fields: [
      { key: 'skill', label: 'Skill', help: 'Which skill does this (e.g. raid-recon, fortress-bailey).', required: true },
      { key: 'doneWhen', wireLabel: 'done when', label: 'Done when', help: 'The concrete signal that this action is finished.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.campaign.openNow,
  },
  {
    id: 'campaign-blocked', file: 'campaign.md', heading: 'Blocked on a human decision',
    title: 'Blocked on a human decision',
    intro: 'A decision no agent can make for you.',
    primaryLabel: 'Decision', primaryHelp: 'The decision that is waiting on you.',
    fields: [
      { key: 'whyItBlocks', wireLabel: 'why it blocks', label: 'Why it blocks', help: 'What cannot proceed until this is decided.', required: true },
      { key: 'who', label: 'Who', help: 'Who is actually making this call.', required: true },
    ],
    gateStage: null,
    getEntries: (p) => p.campaign.blockedOnHuman,
  },
];

// ---------------------------------------------------------------------------
// Render — generic pieces shared by every entry form above.
// ---------------------------------------------------------------------------

function fieldInput(cfg, f) {
  const id = `${cfg.id}-${f.key}`;
  if (f.select) {
    const opts = ['', ...f.select]
      .map((o) => `<option value="${escapeHtml(o)}">${o ? escapeHtml(o) : 'choose…'}</option>`)
      .join('');
    return `<select id="${id}" class="setup-select" title="${escapeHtml(f.help)}">${opts}</select>`;
  }
  // The help goes IN the box, not on a line of its own. Forty-four help
  // sentences, one under every label, were the single biggest thing making
  // these panels scroll — and a sentence you have to read before you can
  // start typing is worse than the same words sitting where you type.
  return `<input type="text" id="${id}" class="setup-input" placeholder="${escapeHtml(f.help)}" title="${escapeHtml(f.help)}">`;
}

// showWhen: { field, equals } for one triggering value, or
// { field, oneOf: [...] } for several. One reader for both shapes so the
// render side and the live toggle can never disagree about what triggers a
// field.
function showWhenValues(showWhen) {
  return showWhen.oneOf ? showWhen.oneOf : [showWhen.equals];
}

// A field with `showWhen` is rendered but hidden until the field it depends
// on holds one of those values — every <select> starts on "choose…", so a
// conditional field is always hidden on first paint. Hidden fields are
// skipped by BOTH the required check and the entry line (see fieldIsShown /
// wireSimple), so changing an answer back cannot smuggle a stale follow-up
// into the pack.
function renderFieldRow(cfg, f) {
  const cond = f.showWhen
    ? ` data-when-field="${escapeHtml(f.showWhen.field)}" data-when-equals="${escapeHtml(showWhenValues(f.showWhen).join('|'))}" hidden`
    : '';
  // A <select> keeps its help line — there is nowhere inside a dropdown to
  // put it. Text fields carry theirs as the placeholder (see fieldInput).
  const help = f.select ? `<span class="setup-field-help">${escapeHtml(f.help)}</span>` : '';
  return `
    <label class="setup-field" for="${cfg.id}-${f.key}"${cond}>
      <span class="setup-field-label">${escapeHtml(f.label)}${f.required ? ' *' : ''}</span>
      ${help}
      ${fieldInput(cfg, f)}
    </label>`;
}

function renderSimpleForm(cfg) {
  const rows = cfg.fields.map((f) => renderFieldRow(cfg, f)).join('');
  return `
    <form class="setup-form" data-setup-form="${cfg.id}">
      <label class="setup-field" for="${cfg.id}-primary">
        <span class="setup-field-label">${escapeHtml(cfg.primaryLabel)} *</span>
        <input type="text" id="${cfg.id}-primary" class="setup-input" placeholder="${escapeHtml(cfg.primaryHelp)}" title="${escapeHtml(cfg.primaryHelp)}">
      </label>
      ${rows}
      <p class="setup-error" data-setup-error="${cfg.id}"></p>
      <button type="button" class="btn btn-secondary" data-setup-add="${cfg.id}">Add</button>
    </form>`;
}

// How many existing entries a list shows before folding the rest away. A
// panel that grows a line every time you add a claim will eventually
// overflow any screen, however much padding gets shaved off it — so the
// list is bounded by construction rather than by measurement. The overflow
// is a native <details>, so nothing is hidden from you and nothing scrolls.
const ENTRIES_SHOWN = 3;

function renderEntryList(entries) {
  if (!entries.length) return '<p class="muted-note">Nothing added yet.</p>';
  const li = (e) => `<li class="setup-entry">${escapeHtml(e.raw)}</li>`;
  const head = entries.slice(0, ENTRIES_SHOWN).map(li).join('');
  const rest = entries.slice(ENTRIES_SHOWN);
  const more = rest.length
    ? `<details class="entry-more"><summary>${rest.length} more</summary>`
      + `<ul class="setup-entry-list">${rest.map(li).join('')}</ul></details>`
    : '';
  return `<ul class="setup-entry-list">${head}</ul>${more}`;
}

function gateNoteHtml(evalResult, stage, label) {
  if (stage === null) return '';
  const gate = evalResult.gates.find((g) => g.stage === stage);
  if (!gate || gate.open) return '';
  return `<p class="setup-gate-note">${escapeHtml(label)}: ${escapeHtml(gate.unmet)}</p>`;
}

// inStepGroup: the step's tab already carries cfg.heading, so repeating
// cfg.title as an <h4> one line below it is the same words twice. The intro
// stays — it says something the label does not — but it rides with the gate
// note on one line instead of owning a paragraph of its own.
function renderSimpleSectionBody(cfg, draftPack, evalResult, inStepGroup) {
  const head = inStepGroup ? '' : `<h4>${escapeHtml(cfg.title)}</h4>`;
  return `
    ${head}
    <p class="setup-intro muted-note">${escapeHtml(cfg.intro)}</p>
    ${gateNoteHtml(evalResult, cfg.gateStage, `Leaving this empty keeps Stage ${cfg.gateStage} closed`)}
    ${renderEntryList(cfg.getEntries(draftPack))}
    ${renderSimpleForm(cfg)}`;
}

function renderFileGroup(title, intro, bodyHtml) {
  return `
    <section class="setup-section">
      <h3>${escapeHtml(title)}</h3>
      <p class="setup-intro muted-note">${escapeHtml(intro)}</p>
      ${bodyHtml}
    </section>`;
}

// ---------------------------------------------------------------------------
// Render — the two sections with their own shape (truth.md, campaign.md).
// ---------------------------------------------------------------------------

function renderTruthSection(draftPack, evalResult) {
  const gate1 = evalResult.gates.find((g) => g.stage === 1);
  const gateNote = gate1 && !gate1.open
    ? `<p class="setup-gate-note">Leaving Cleared empty keeps Stage 1 closed: ${escapeHtml(gate1.unmet)}</p>`
    : '';
  const canonical = draftPack.truth.canonicalSource;
  // Four sections, so four steps — the same shape every other file uses.
  // Stacked, this was the tallest panel in the door: two entry lists, a
  // three-field form and the canonical-source form, all at once.
  return `
    <section class="setup-section">
      <h3>truth.md — what you can and cannot say yet</h3>
      <p class="setup-intro muted-note">Every claim needs a source. No source? It goes to Uncleared with a reason instead.</p>
      ${gateNote}
      ${renderStepGroup('truth', [
        ['add', 'Add a claim', `
          <form class="setup-form" data-setup-form="truth">
            <label class="setup-field" for="truth-claim">
              <span class="setup-field-label">Claim *</span>
              <input type="text" id="truth-claim" class="setup-input" placeholder="The thing you want to be able to say publicly." title="The thing you want to be able to say publicly.">
            </label>
            <label class="setup-field" for="truth-source">
              <span class="setup-field-label">Source</span>
              <input type="text" id="truth-source" class="setup-input" placeholder="A dated, real record. Leave blank if you don't have one." title="A dated, real record. Leave blank if you don't have one.">
            </label>
            <label class="setup-field" for="truth-reason">
              <span class="setup-field-label">Reason (if no source)</span>
              <input type="text" id="truth-reason" class="setup-input" placeholder="Why you cannot source it yet." title="Why you cannot source it yet.">
            </label>
            <p class="setup-error" data-setup-error="truth"></p>
            <button type="button" class="btn btn-secondary" data-setup-add="truth">Add</button>
          </form>`],
        ['cleared', 'Cleared', renderEntryList(draftPack.truth.cleared)],
        ['uncleared', 'Uncleared', renderEntryList(draftPack.truth.uncleared)],
        ['canonical', 'Canonical source', `
          <p class="setup-field-help">The one page a re-check should re-fetch — usually your about or pricing page.</p>
          <p class="setup-current muted-note">Current: ${canonical ? escapeHtml(canonical) : 'not set yet.'}</p>
          <form class="setup-form" data-setup-form="truth-canonical">
            <input type="text" id="truth-canonical-source" class="setup-input" placeholder="https://…">
            <button type="button" class="btn btn-secondary" data-setup-save="truth-canonical">Save</button>
          </form>`],
      ])}
    </section>`;
}

function renderCampaignSection(draftPack, evalResult) {
  const openCfg = SIMPLE_FORMS.find((c) => c.id === 'campaign-open');
  const blockedCfg = SIMPLE_FORMS.find((c) => c.id === 'campaign-blocked');
  const gate3 = evalResult.gates.find((g) => g.stage === 3);
  const deliveryNote = gate3 && !gate3.open
    ? `<p class="setup-gate-note">No delivery check recorded yet: ${escapeHtml(gate3.unmet)}</p>`
    : '';
  const why = draftPack.campaign.whyThisStage;
  const delivery = draftPack.campaign.deliveryCheck;
  // campaign.md is four separate records, not one page. Stacked, they came
  // to 631px past the viewport on a laptop; as four steps each one fits.
  // Same rule as the file tabs above it: show the one thing being answered.

  return `
    <section class="setup-section">
      <h3>campaign.md</h3>
      <p class="setup-intro muted-note">Stage and Opened are written by raid-campaign, not here. This door records why, what is blocked on you, and the delivery check.</p>

      ${renderStepGroup('campaign', [
        ['why', 'Why this stage', `
        <p class="setup-current muted-note">Current: ${why ? escapeHtml(why) : 'not set yet.'}</p>
        <form class="setup-form" data-setup-form="campaign-why">
          <label class="setup-field" for="campaign-why">
            <textarea id="campaign-why" class="setup-textarea" rows="3" placeholder="Where the pack stands, and what is left before the next stage opens."></textarea>
          </label>
          <button type="button" class="btn btn-secondary" data-setup-save="campaign-why">Save</button>
        </form>`],
        ['open', 'Open now', renderSimpleSectionBody(openCfg, draftPack, evalResult, true)],
        ['blocked', 'Blocked', renderSimpleSectionBody(blockedCfg, draftPack, evalResult, true)],
        ['delivery', 'Delivery check', `
        <p class="setup-field-help">Did a real stranger complete this end to end, verified by you today? Only check the box if verified today.</p>
        ${deliveryNote}
        <p class="setup-current muted-note">Current: ${delivery ? escapeHtml(delivery) : 'not recorded.'}</p>
        <form class="setup-form" data-setup-form="campaign-delivery">
          <label class="setup-field">
            <input type="checkbox" id="campaign-delivery-confirmed"> I personally verified this today, start to finish.
          </label>
          <label class="setup-field" for="campaign-delivery-details">
            <span class="setup-field-label">Details</span>
            <input type="text" id="campaign-delivery-details" class="setup-input"
              data-delivery-help
              data-help-confirmed="What you checked, step by step."
              data-help-unconfirmed="What is still unverified, and why."
              placeholder="What is still unverified, and why."
              title="What is still unverified, and why.">
          </label>
          <button type="button" class="btn btn-secondary" data-setup-save="campaign-delivery">Save</button>
        </form>`],
      ])}
    </section>`;
}

// ---------------------------------------------------------------------------
// Unrecognised headings (src/pack.js rule 4) — the same list Door 2 shows
// under "Needs attention", surfaced here too because this is the door where
// the headings actually get written. A heading outside the format's
// vocabulary means everything under it was read by nobody; saying so here is
// what makes the promise two paragraphs down ("never silently dropped") true.
// The console names what it FOUND and what it EXPECTED and stops there — it
// never assumes "## Approved" was meant to be "## Cleared".
// ---------------------------------------------------------------------------

function renderUnrecognisedItem(entry) {
  const where = entry.heading === null
    ? `${escapeHtml(entry.file)} — no recognised heading anywhere in the file`
    : `${escapeHtml(entry.file)} — found the heading “## ${escapeHtml(entry.heading)}”`;
  const expected = (entry.expected || []).map((h) => `## ${escapeHtml(h)}`).join(', ');
  const body = (entry.lines || []).join('\n').replace(/\s+$/, '');
  return `
    <li class="unrecognised-entry">
      <p class="unrecognised-loc">${where}</p>
      <p class="unrecognised-expected">Expected: ${expected}. Nothing under it was read; your file is unchanged.</p>
      ${body ? `<pre class="unrecognised-raw">${escapeHtml(body)}</pre>` : ''}
    </li>`;
}

function renderUnrecognisedNotice(draftPack) {
  const entries = draftPack.unrecognised || [];
  if (!entries.length) return '';
  const n = entries.length;
  return `
    <section class="setup-section setup-unrecognised">
      <h3>${n} ${n === 1 ? 'section is' : 'sections are'} written under a heading this format does not recognise</h3>
      <p class="setup-intro muted-note">Skipped — not in the lists below, and not malformed either. Rename it yourself if you meant one of the expected names.</p>
      <ul class="unrecognised-list">${entries.map(renderUnrecognisedItem).join('')}</ul>
    </section>`;
}

// The import plan. Shown BEFORE anything is written, because the review is
// the whole safeguard: a kit is largely model-written, and an import nobody
// read is the same as trusting that prose. Every row says where the line goes
// and why, so the founder can see a claim being refused rather than discover
// later that it never arrived.
export function renderSellKitImport(kitText) {
  const plan = planImport(kitText);
  if (plan.blocked) {
    return `
      <section class="setup-section">
        <p class="setup-intro muted-note">${escapeHtml(plan.blocked)} Export one from Idea Forge Pro and put it in your <code>.monkeys/</code> folder.</p>
        <p class="muted-note"><strong>Importing a kit is not clearance.</strong> A kit is largely model-written. Every line is graded on arrival, and only a sourced A&ndash;D claim can be said in public.</p>
      </section>`;
  }

  const row = (c) => {
    const clears = c.destination.endsWith('Cleared');
    return `
      <tr class="${clears ? 'imp-clear' : 'imp-hold'}">
        <td>${escapeHtml(c.claim)}</td>
        <td><strong>${escapeHtml(c.grade)}</strong> ${escapeHtml((EVIDENCE_GRADES[c.grade] || {}).label || '')}</td>
        <td>${clears ? 'Cleared' : 'Uncleared'}</td>
        <td class="muted-note">${escapeHtml(c.reason)}</td>
      </tr>`;
  };

  const cleared = plan.claims.filter((c) => c.destination.endsWith('Cleared')).length;
  const held = plan.claims.length - cleared;

  return `
    <section class="setup-section">
      <p class="setup-intro muted-note"><strong>Importing a kit is not clearance.</strong> ${cleared} of ${plan.claims.length} claims can be said in public; ${held} cannot, yet.</p>

      ${plan.claims.length ? `
      <table class="imp-table">
        <thead><tr><th>Claim</th><th>Grade</th><th>Lands in</th><th>Why</th></tr></thead>
        <tbody>${plan.claims.map(row).join('')}</tbody>
      </table>` : '<p class="muted-note">This kit has no claim register, so there is nothing to grade. Every field below lands uncleared.</p>'}

      <h4>Fields</h4>
      <ul class="setup-entry-list">
        ${plan.fields.map((f) => `<li class="setup-entry"><strong>${escapeHtml(f.label)}</strong> &rarr; ${f.to === 'skip' ? '<em>not imported</em>' : escapeHtml(f.to)} &mdash; <span class="muted-note">${escapeHtml(f.note)}</span></li>`).join('')}
      </ul>

      <form class="setup-form">
        <button type="button" class="btn btn-secondary" data-action="apply-import">Import into my pack</button>
      </form>
      <p class="setup-error" data-setup-error="sell-kit"></p>
    </section>`;
}

export function renderKickoffCallout(files) {
  const prompt = buildKickoffPrompt(files);
  return `
    <section class="setup-kickoff">
      <div class="kickoff-row">
        <button type="button" class="btn" data-action="start-kickoff">Start with the agent</button>
        <p class="muted-note">It will interview you until you have one fact you can prove. That single fact is what lets you say anything in public.</p>
      </div>

      <details class="kickoff-handoff">
        <summary>Or hand it to an agent that can browse</summary>
        <p class="muted-note">The agent here can search the web when your provider supports it, but it cannot <em>act</em>: it does not write your files, open your repo, or post anything. For that, copy this into Claude Code with the RAID and FORTRESS skills installed. It has the tools and writes the pack back.</p>
        <textarea class="setup-kickoff-prompt" readonly>${escapeHtml(prompt)}</textarea>
        <button type="button" class="btn btn-secondary" data-setup-action="copy-kickoff">Copy prompt</button>
      </details>
    </section>`;
}

// Where the downloaded files belong, said before the click and again after
// it. The cold run's founder pressed this, got one file into Downloads, and
// had nothing anywhere in the console telling them what to do with it.
const DOWNLOAD_DESTINATION =
  'Saves to your downloads folder. Move the files into a <code>.monkeys/</code> folder at the root of the project or site this marketing is for — what your AI skills read and write.';

// The same sentence as plain text, for the after-download note (textContent,
// so it cannot carry the <code> tags). Said again there because that is the
// moment the founder in the cold run actually needed it — file in Downloads,
// nothing anywhere telling them where it belonged.
const DOWNLOAD_DESTINATION_TEXT =
  'Move them into a .monkeys/ folder at the root of the project or site this marketing is for — what your AI skills read and write.';

function renderSaveBar(files) {
  const names = Object.keys(files || {});
  const willSave = names.length
    ? `This will save ${names.length} file${names.length === 1 ? '' : 's'}.`
    : 'Nothing entered yet — nothing to download.';
  const fileList = names.length
    ? `<p class="muted-note">${names.map((n) => `<code>${escapeHtml(n)}</code>`).join(', ')}</p>`
    : '';
  // One row, not four stacked paragraphs: the button and what it will write
  // sit on the same line, and the two standing notes (where the files go,
  // where the work is kept) share the line below it. Same words, 294px of
  // bar down to about a third of that.
  return `
    <section class="setup-save-bar">
      <div class="setup-save-row">
        <button type="button" class="btn btn-secondary" data-setup-action="download">Download pack files</button>
        <p class="muted-note">${willSave}</p>
        <details class="setup-where">
          <summary>Where do these go?</summary>
          ${fileList}
          <p class="muted-note setup-download-destination">${DOWNLOAD_DESTINATION} Kept in this browser as you move between doors. Never uploaded — the console never publishes.</p>
        </details>
        <p class="setup-download-note" data-setup-note="download"></p>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

// renderSetupHTML(files) -> string. Pure: no DOM, no globals besides the
// argument. `files` is a Record<string,string> in the same shape
// parsePack() takes — {} for a brand-new pack, or a loaded pack's own
// pack.raw to populate the forms from what already exists.
// The tab strip's own order and labels. Short labels on purpose: this strip
// is a wayfinder, not a second set of headings — each panel already carries
// its own full "<file> — <what it is>" title.
// The six files in format order, then Kickoff. Kickoff sat first and read
// as step one of the sequence, which it is not: it is the way to skip the
// sequence by handing the work to an agent. Last, after the files it would
// otherwise write, is where it belongs.
// The six pack files this door edits, in format order. Kickoff is NOT here:
// it is a door of its own now. It was a tab inside this one while it was a
// prompt to copy, which made "start here" a thing you had to already be
// inside the forms to find.
// `ico` is the concept name from src/ui/icons.js, written out rather than
// derived by stripping ".md" off the key: two of these seven keys are not
// file names at all, so a derivation would have had one silent exception the
// day it was written.
export const SETUP_PANELS = [
  { key: 'truth.md', label: 'truth', ico: 'truth' },
  { key: 'sell-kit', label: 'import a Sell-Kit', ico: 'sell-kit' },
  { key: 'motte.md', label: 'motte', ico: 'motte' },
  { key: 'bailey.md', label: 'bailey', ico: 'bailey' },
  { key: 'recon.md', label: 'recon', ico: 'recon' },
  { key: 'asymmetry.md', label: 'asymmetry', ico: 'asymmetry' },
  { key: 'campaign.md', label: 'campaign', ico: 'campaign' },
];

const DEFAULT_PANEL = 'truth.md';

// Every panel is rendered, exactly one is shown. Six stacked file forms came
// to 11,337px — fourteen screens on a laptop — against a door whose own
// first line promises "one file at a time". Hiding the inactive panels with
// display:none (see .setup-panel in style.css) makes that line true without
// splitting the render: the markup stays whole and auditable, hidden
// siblings contribute no height, and switching tabs costs no repaint and so
// cannot lose a half-typed field.
function panel(key, activeKey, html) {
  const cls = key === activeKey ? 'setup-panel is-active' : 'setup-panel';
  return `<div class="${cls}" data-setup-panel="${key}">${html}</div>`;
}

export function renderSetupHTML(files, activePanel) {
  const safeFiles = files || {};
  const draftPack = parsePack(safeFiles);
  const evalResult = evaluate(draftPack);
  const active = SETUP_PANELS.some((p) => p.key === activePanel) ? activePanel : DEFAULT_PANEL;

  // One step per section in the file. A file with a single section renders
  // it plainly — a one-step wizard is just a page with a useless strip.
  const stepsFor = (file) => {
    const cfgs = SIMPLE_FORMS.filter((c) => c.file === file);
    const bodies = cfgs.map((c) => renderSimpleSectionBody(c, draftPack, evalResult, cfgs.length > 1));
    if (cfgs.length < 2) return bodies.join('');
    return renderStepGroup(file, cfgs.map((c, i) => [c.id, c.heading, bodies[i]]));
  };

  const tabs = SETUP_PANELS.map((p) => `
    <button type="button" class="setup-tab${p.key === active ? ' is-active' : ''}"
      data-setup-tab="${p.key}"${p.key === active ? ' aria-current="true"' : ''}>${icon(p.ico)}${escapeHtml(p.label)}</button>`).join('');

  return `
    <div class="setup-view">
      ${renderUnrecognisedNotice(draftPack)}
      <nav class="setup-tabs" aria-label="Pack file">${tabs}</nav>
      ${panel('truth.md', active, renderTruthSection(draftPack, evalResult))}
      ${panel('sell-kit', active, renderSellKitImport(safeFiles['sell-kit.md']))}
      ${panel('motte.md', active, renderFileGroup('motte.md — what cannot be confiscated', 'What you hold, and what you still want.', stepsFor('motte.md')))}
      ${panel('bailey.md', active, renderFileGroup('bailey.md — rented ground', 'What is active, and what you excluded and why.', stepsFor('bailey.md')))}
      ${panel('recon.md', active, renderFileGroup('recon.md — who hurts, and where', 'No gate of its own — but skipping it means your agent guesses.', stepsFor('recon.md')))}
      ${panel('asymmetry.md', active, renderFileGroup('asymmetry.md — ground they cannot hold', 'Internal only — never published, never a real competitor name.', stepsFor('asymmetry.md')))}
      ${panel('campaign.md', active, renderCampaignSection(draftPack, evalResult))}
      ${renderSaveBar(safeFiles)}
    </div>`;
}

// mountSetup(container, pack, onPackChange) -> void. The thin DOM-touching
// half. `files` is seeded once from pack.raw (or {} with no pack loaded —
// this door needs no pack to work at all) and mutated only through the pure
// helpers above; every successful Add/Save re-parses it and calls
// onPackChange(newPack) so Door 2/3 see the work in progress immediately,
// then repaints this container from the same renderSetupHTML() the tests
// exercise. Re-rendering happens only after a successful Add/Save, never on
// a keystroke — see rule 1 in the header for why that matters here.
export function mountSetup(container, pack, onPackChange, openPanel) {
  const files = pack ? { ...pack.raw } : {};

  function notifyChange() {
    if (onPackChange) onPackChange(parsePack(files));
  }

  // Which file panel is showing. Survives paint() so an Add never throws the
  // founder back to truth.md from wherever they were working. Seeded from
  // openPanel so the home screen's "let an agent do it" route lands on the
  // kickoff prompt rather than on the forms it exists to replace.
  let activePanel = openPanel;

  function paint() {
    container.innerHTML = renderSetupHTML(files, activePanel);
    wire();
  }

  // Tab clicks only toggle a class — no repaint, so a half-typed field in
  // another panel is still there when they come back to it.
  function wireTabs() {
    const show = (key) => {
      activePanel = key;
      container.querySelectorAll('[data-setup-panel]').forEach((el) => {
        el.classList.toggle('is-active', el.dataset.setupPanel === key);
      });
      container.querySelectorAll('[data-setup-tab]').forEach((el) => {
        const on = el.dataset.setupTab === key;
        el.classList.toggle('is-active', on);
        if (on) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
    };
    container.querySelectorAll('[data-setup-tab]').forEach((btn) => {
      btn.addEventListener('click', () => { show(btn.dataset.setupTab); sizeKickoff(); });
    });
  }

  function val(id) {
    const el = container.querySelector(`#${id}`);
    return el ? el.value : '';
  }

  function checked(id) {
    const el = container.querySelector(`#${id}`);
    return el ? el.checked : false;
  }

  function showError(key, message) {
    const el = container.querySelector(`[data-setup-error="${key}"]`);
    if (el) el.textContent = message;
  }

  // A field with no showWhen is always shown; one with it is shown only while
  // its controlling field holds the stated value. Read live off the DOM so
  // there is one answer for both "is this required" and "does this go into
  // the entry line".
  function fieldIsShown(cfg, f) {
    if (!f.showWhen) return true;
    return showWhenValues(f.showWhen).includes(val(`${cfg.id}-${f.showWhen.field}`));
  }

  // Show or hide every conditional field whenever the field it depends on
  // changes. Values are left alone while hidden — a founder who flips back
  // to `partial` finds what they typed still there — but a hidden field's
  // value never reaches the pack (see wireSimple).
  function wireConditionals(cfg) {
    const conditional = cfg.fields.filter((f) => f.showWhen);
    if (!conditional.length) return;
    const sync = () => {
      for (const f of conditional) {
        const row = container.querySelector(`[for="${cfg.id}-${f.key}"]`);
        if (row) row.hidden = !fieldIsShown(cfg, f);
      }
    };
    const controllers = new Set(conditional.map((f) => f.showWhen.field));
    for (const key of controllers) {
      const el = container.querySelector(`#${cfg.id}-${key}`);
      if (el) el.addEventListener('change', sync);
    }
    sync();
  }

  // sizeKickoff: the copy-prompt box gets exactly the height its text needs,
  // never more than the page can spare. A fixed rows= or vh height is wrong
  // both ways round: too short and the box scrolls inside itself, too tall
  // and it pushes the page into scrolling. Measured after paint because the
  // text is only known then.
  function sizeKickoff() {
    const ta = container.querySelector('.setup-kickoff-prompt');
    if (!ta) return;
    const body = ta.closest('.scroll-body');
    if (!body) { ta.style.height = 'auto'; return; }
    // Geometry, not scrollHeight. The scroll region here is a stretched flex
    // child, so its scrollHeight equals its clientHeight whatever the box
    // does — subtracting one from the other always says "no room" and the
    // box collapses. What is actually available is the distance from the top
    // of the box to the bottom of the region, less whatever sits below it.
    ta.style.height = 'auto';
    const needed = ta.scrollHeight + 4;
    const below = container.querySelector('.setup-save-bar');
    const reserve = below ? below.offsetHeight + 24 : 16;
    const available = Math.round(body.getBoundingClientRect().bottom
      - ta.getBoundingClientRect().top - reserve);
    ta.style.height = `${Math.max(80, Math.min(needed, available))}px`;
  }

  // campaign.md's four steps. Toggling a class only, like the file tabs, so
  // a half-typed answer in another step survives moving between them.
  // Every step key is namespaced "<group>:<step>" (see renderStepGroup), so
  // one handler serves all five groups without a group's Next button ever
  // reaching into another file's panel.
  function wireSteps() {
    // activateStep, not a local copy: the copy in the app shell was the one
    // that was missing, which is how Door 4's strip shipped dead.
    const show = (key) => activateStep(container, key);
    container.querySelectorAll('[data-setup-step]').forEach((b) => {
      b.addEventListener('click', () => show(b.dataset.setupStep));
    });
    container.querySelectorAll('[data-setup-step-go]').forEach((b) => {
      b.addEventListener('click', () => show(b.dataset.setupStepGo));
    });
  }

  // The delivery check's one text field asks two different questions —
  // what you checked, or what is still unverified — depending on the box
  // above it. Same rule as the conditional fields: the screen only ever
  // shows the question that currently applies.
  function wireDeliveryHelp() {
    const box = container.querySelector('#campaign-delivery-confirmed');
    const help = container.querySelector('[data-delivery-help]');
    if (!box || !help) return;
    const sync = () => {
      const q = box.checked ? help.dataset.helpConfirmed : help.dataset.helpUnconfirmed;
      help.placeholder = q;
      help.title = q;
    };
    box.addEventListener('change', sync);
    sync();
  }

  function wireSimple(cfg) {
    const btn = container.querySelector(`[data-setup-add="${cfg.id}"]`);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const primary = val(`${cfg.id}-primary`);
      if (!primary.trim()) {
        showError(cfg.id, `Add the ${cfg.primaryLabel.toLowerCase()} first.`);
        return;
      }
      const pairs = [];
      for (const f of cfg.fields) {
        if (!fieldIsShown(cfg, f)) continue;
        const v = val(`${cfg.id}-${f.key}`);
        if (f.required && !v.trim()) {
          showError(cfg.id, `"${f.label}" is required — leave the whole entry for later if you can't answer it yet.`);
          return;
        }
        pairs.push([f.wireLabel || f.key, v]);
      }
      const line = buildEntryLine(primary, pairs);
      files[cfg.file] = appendBulletToFile(files[cfg.file], cfg.heading, line);
      notifyChange();
      paint();
    });
  }

  function wireTruth() {
    const addBtn = container.querySelector('[data-setup-add="truth"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const result = classifyTruthEntry({
          claim: val('truth-claim'), source: val('truth-source'), reason: val('truth-reason'),
        });
        if (!result.ok) { showError('truth', result.error); return; }
        files['truth.md'] = appendBulletToFile(files['truth.md'], result.heading, result.line);
        notifyChange();
        paint();
      });
    }
    const saveBtn = container.querySelector('[data-setup-save="truth-canonical"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const v = val('truth-canonical-source').trim();
        if (!v) return;
        files['truth.md'] = setSectionText(files['truth.md'], 'Canonical source', v);
        notifyChange();
        paint();
      });
    }
  }

  function wireCampaignExtras() {
    const whyBtn = container.querySelector('[data-setup-save="campaign-why"]');
    if (whyBtn) {
      whyBtn.addEventListener('click', () => {
        const v = val('campaign-why').trim();
        if (!v) return;
        files['campaign.md'] = setSectionText(files['campaign.md'], 'Why this stage', v);
        notifyChange();
        paint();
      });
    }
    const deliveryBtn = container.querySelector('[data-setup-save="campaign-delivery"]');
    if (deliveryBtn) {
      deliveryBtn.addEventListener('click', () => {
        const details = val('campaign-delivery-details').trim();
        const isConfirmed = checked('campaign-delivery-confirmed');
        if (!details && !isConfirmed) return;
        const today = new Date().toISOString().slice(0, 10);
        const prefix = isConfirmed ? `confirmed ${today}` : 'unverified';
        const line = details ? `${prefix} — ${details}` : prefix;
        files['campaign.md'] = setPreambleLine(
          files['campaign.md'], /^\*\*Delivery check:\*\*/i, `**Delivery check:** ${line}`,
        );
        notifyChange();
        paint();
      });
    }
  }

  function wireKickoff() {
    const btn = container.querySelector('[data-setup-action="copy-kickoff"]');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const prompt = buildKickoffPrompt(files);
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(prompt);
        }
      } catch {
        // Clipboard permission denied — the textarea above still holds the
        // full prompt text, selectable by hand. Not fatal.
      }
    });
  }

  function wireDownload() {
    const btn = container.querySelector('[data-setup-action="download"]');
    if (!btn) return;
    const note = container.querySelector('[data-setup-note="download"]');
    btn.addEventListener('click', () => {
      const names = Object.keys(files);
      try {
        downloadPack(files);
        if (note) {
          note.textContent = names.length
            ? `Saved ${names.join(', ')}. ${DOWNLOAD_DESTINATION_TEXT}`
            : 'Nothing to download yet — add something first.';
        }
      } catch {
        // downloadPack only throws outside a browser (see fs.js) — nothing
        // useful to show the user in that case; the failure is structural,
        // not something a retry fixes.
      }
    });
  }

  function wire() {
    wireTabs();
    sizeKickoff();
    wireTruth();
    for (const cfg of SIMPLE_FORMS) { wireSimple(cfg); wireConditionals(cfg); }
    wireCampaignExtras();
    wireSteps();
    wireDeliveryHelp();
    wireKickoff();
    wireDownload();
  }

  paint();

  // One listener for the life of the page. It no-ops once this container is
  // gone, so leaving the door does not leave a handler measuring a detached
  // element.
  window.addEventListener('resize', () => {
    if (container.isConnected) sizeKickoff();
  });
}
