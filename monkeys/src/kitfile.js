// kitfile.js — reading whatever Idea Forge Pro handed you.
//
// IFP's export button produces three files, and a founder arriving here has
// whichever one they happened to click:
//
//   <base>-forge.json      the whole session snapshot; the only one that
//                          reloads into IFP. Structured, so nothing is lost.
//   <base>-sell-kit.md     the plan itself, for a human or any AI to read.
//   <base>-work-order.md   the handoff to a Deliberon council. NOT a Sell-Kit.
//
// ⛔ THE FILENAME IS NEVER TRUSTED. It is a hint for a tie-break and nothing
// more. People rename downloads, browsers append " (1)", and a file saved out
// of an email attachment can arrive called anything at all. Every decision
// below is made on CONTENT, so a renamed kit still imports and a wrong file
// still gets refused by name of what it actually is.
//
// This module decides WHAT a file is and hands back a field map. It grades
// nothing and writes nothing: sellkit.js owns the rules, and this owns only
// the question "which artifact is this?".

import { fieldsFromKit, parseKitFields } from './sellkit.js';

// The envelope IFP's session writer stamps on every forge file:
//   { _ifp: "idea-forge-pro", v: 1, savedAt: "...", state: { kit: {...} } }
// It also accepts a bare snapshot on the way back in, so we do too.
const FORGE_MARK = 'idea-forge-pro';

// A work order names its own council roles. These are what it says about
// itself, not a guess from its filename.
const WORK_ORDER_RE = /^#\s*Work order\b|^\s*\*\*?(?:Chairman|Council|Seat)\b/im;

// readKitFile(name, text) -> { kind, fields, blocked, note }
//
//   kind    'forge-json' | 'sell-kit' | 'work-order' | 'unknown'
//   fields  { Label: value }, ready for sellkit.js — empty unless it parsed
//   blocked a sentence to show the human; empty when the file is usable
//   note    what we read it as, shown so an import is never silent about
//           which of the three files it took
//
// Nothing here throws. A dropped file is a human action, and an exception is
// a blank screen where a sentence belongs.
export function readKitFile(name, text) {
  const raw = String(text || '');
  const filename = String(name || '').trim();

  if (!raw.trim()) {
    return blocked('unknown', `${label(filename)} is empty.`);
  }

  // JSON first: it is the only one with an unambiguous marker, and it is the
  // preferred artifact when someone has both — the same order RAID and
  // FORTRESS use, and for the same reason. It survives a round trip that
  // copy-pasted markdown does not.
  const parsed = tryJson(raw);
  if (parsed) return fromForgeJson(parsed, filename);

  // A JSON file that would not parse is a truncated or half-copied download,
  // not a markdown kit. Say so, rather than falling through and reporting the
  // markdown parser's "no fields" for a file that is not markdown.
  if (looksLikeJson(raw)) {
    return blocked(
      'unknown',
      `${label(filename)} looks like a .forge.json but will not parse. It is probably a partial download — try exporting it again.`,
    );
  }

  if (WORK_ORDER_RE.test(raw)) {
    return blocked(
      'work-order',
      'That is the Deliberon work order, not the marketing one. Idea Forge Pro saved a -sell-kit.md and a -forge.json next to it in the same folder; either of those is what the console reads.',
    );
  }

  const fields = parseKitFields(raw);
  if (Object.keys(fields).length) {
    return { kind: 'sell-kit', fields, blocked: '', note: `Read ${label(filename)} as a Sell-Kit.` };
  }

  return blocked(
    'unknown',
    `${label(filename)} carried no Sell-Kit fields. A kit's lines look like "- **Buyer:** ...". If you exported this from somewhere else, it is not a kit.`,
  );
}

// A forge snapshot, wrapped or bare. The kit lives at state.kit; state.best
// holds the highest-scoring forge of the session, which is what the founder
// sees on screen at the end, so it is the fallback rather than an error.
function fromForgeJson(parsed, filename) {
  const state = parsed && typeof parsed.state === 'object' && parsed.state ? parsed.state : parsed;
  const kit = pickKit(state);

  if (!kit) {
    // A JSON file that is not a forge at all. Naming what it is missing beats
    // "invalid file", which tells a person nothing they can act on.
    const isForge = parsed && parsed._ifp === FORGE_MARK;
    return blocked(
      'unknown',
      isForge
        ? `${label(filename)} is an Idea Forge Pro save with no kit in it yet — the forge had not produced one when it was saved.`
        : `${label(filename)} is JSON, but not an Idea Forge Pro save.`,
    );
  }

  const fields = fieldsFromKit(kit);
  if (!Object.keys(fields).length) {
    return blocked('forge-json', `${label(filename)} holds a kit, but every field in it is empty.`);
  }
  return { kind: 'forge-json', fields, blocked: '', note: `Read ${label(filename)} as an Idea Forge Pro save.` };
}

function pickKit(state) {
  if (!state || typeof state !== 'object') return null;
  if (state.kit && typeof state.kit === 'object') return state.kit;
  if (state.best && typeof state.best === 'object' && state.best.kit) return state.best.kit;
  return null;
}

function tryJson(raw) {
  if (!looksLikeJson(raw)) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function looksLikeJson(raw) {
  return raw.trim().startsWith('{');
}

function blocked(kind, message) {
  return { kind, fields: {}, blocked: message, note: '' };
}

function label(filename) {
  return filename ? `"${filename}"` : 'That file';
}
