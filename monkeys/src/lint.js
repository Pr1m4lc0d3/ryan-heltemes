// lint.js — claim linter. JS port of
// FORTRESS/skills/fortress-truth/assets/claim_lint.py
//
// The linter flags claim-shaped LANGUAGE. The register ARBITRATES.
// No script can know whether "fastest" is true — only whether it is sourced.
//
// THIS IS A SECOND IMPLEMENTATION OF ONE QUESTION. That is the duplication that
// drifts. The defence is tests/lint-vectors.json: one shared spec file that both
// this module and claim_lint.py are asserted against. A vector added for a bug
// found on one side becomes a regression test on the other. Do not fix a
// disagreement by editing a vector — a disagreement means one implementation is
// wrong, and finding out which is the point of the file existing.
//
// PYTHON-REGEX EQUIVALENCE. Python's `re` on str is Unicode-aware; JavaScript's
// is not, and every one of those gaps opens the same way — JS matching LESS than
// Python means a claim slips through unflagged. So the shorthands are rebuilt
// explicitly below and the patterns are composed from them:
//   \w -> [\p{L}\p{N}_]      \d -> [\p{Nd}]      \s -> the Python space set
//   \b -> an explicit two-sided lookaround (JS \b is ASCII-only)
//   .  -> [^\n]              (JS . also excludes \r, U+2028, U+2029)
//   (?m:^...) -> (?<![^\n])  (JS ^ under /m also fires after \r)
// Requires lookbehind: V8/Chromium since 62, Firefox 78, and Safari only since
// 16.4 (Mar 2023). There is no equivalent that is genuinely equivalent, and an
// approximation here is a false negative, so the module needs a modern engine.

// ---------------------------------------------------------------------------
// Python character-class equivalents
// ---------------------------------------------------------------------------

// Python's `re` \s on str: ASCII whitespace plus the Unicode space characters.
const SPACE_CHARS = ' \\t\\n\\r\\f\\v\\x1c-\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const S = `[${SPACE_CHARS}]`;
const NS = `[^${SPACE_CHARS}]`;

// Python's \w on str: alphanumeric (str.isalnum) plus underscore.
const W_CHARS = '\\p{L}\\p{N}_';
const W = `[${W_CHARS}]`;

// Python's \d on str: any Unicode decimal digit, not just 0-9.
const D_CHARS = '\\p{Nd}';
const D = `[${D_CHARS}]`;

// Python's \b: a position with a word char on exactly one side.
const B = `(?:(?<=${W})(?!${W})|(?<!${W})(?=${W}))`;
// Python's \B: the complement.
const NB = `(?:(?<=${W})(?=${W})|(?<!${W})(?!${W}))`;

const SPACE_RUN_RE = new RegExp(`${S}+`, 'gu');
const TRIM_RE = new RegExp(`^${S}+|${S}+$`, 'gu');
const NONSPACE_RE = new RegExp(NS, 'gu');

// ---------------------------------------------------------------------------
// Word lists
// ---------------------------------------------------------------------------

const MONTH_NAMES = (
  'January February March April May June July August September October ' +
  'November December Jan Feb Mar Apr Jun Jul Aug Sept Sep Oct Nov Dec'
).split(' ');

// Number words, longest first so the alternation prefers "seventeen" over
// "seven". Both Array#sort and Python's sorted() are stable, so equal-length
// words keep their source order in both implementations.
const NUMBER_WORDS = (
  'one two three four five six seven eight nine ten eleven twelve ' +
  'thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty ' +
  'thirty forty fifty sixty seventy eighty ninety'
).split(' ').sort((a, b) => b.length - a.length);

// "one" and "two" are ordinary prose words ("one place", "two halves") and are
// excluded from the bare-count branch below, which would otherwise fire on most
// English sentences. They are still matched in front of an explicit magnitude
// word, where "one million users" is unambiguously a quantity claim.
const AMBIGUOUS_NUMBER_WORDS = ['one', 'two'];
const COUNTABLE_NUMBER_WORDS = NUMBER_WORDS.filter((w) => !AMBIGUOUS_NUMBER_WORDS.includes(w));

const MAGNITUDE_WORDS = ['hundred', 'thousand', 'million', 'billion', 'trillion'];

const MONTHS = MONTH_NAMES.join('|');
const NUMS = NUMBER_WORDS.join('|');
const COUNTABLE_NUMS = COUNTABLE_NUMBER_WORDS.join('|');
const MAGS = MAGNITUDE_WORDS.join('|');

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

// Genuine DATE FORMATS only. A bare year is a claim ("Founded in 2024" is a
// factual assertion about a company) and is deliberately NOT ignored: the old
// \b(?:19|20)\d{2}\b exempted every integer from 1900 to 2099, so "Over 2000
// people signed up" passed clean — exactly the shape an invented stat takes.
const DATE_FORMS =
  `${B}${D}{4}-${D}{2}-${D}{2}${B}` +
  `|${B}(?:${D}{1,2}${S}+)?(?:${MONTHS})\\.?${S}+(?:${D}{1,2},?${S}+)?${D}{4}${B}`;

const MAGNITUDE_PATTERN =
  // "forty thousand", "one million", "twenty-five thousand" — one span.
  `${B}(?:${NUMS})(?:[${SPACE_CHARS}-]+(?:${NUMS}))?${S}+(?:${MAGS})s?${B}` +
  // "hundreds of teams", "millions of requests", "thousands rely on us".
  `|${B}(?:${MAGS})s(?:${S}+of)?${B}` +
  // Vague magnitude quantifiers.
  `|${B}dozens(?:${S}+of)?${B}|${B}a${S}+dozen${B}|${B}scores${S}+of${B}` +
  `|${B}a${S}+handful${S}+of${B}` +
  `|${B}(?:countless|numerous)${B}` +
  // A number word quantifying a plural noun within a couple of words:
  // "forty paying customers".
  `|${B}(?:${COUNTABLE_NUMS})${S}+(?:${W}+${S}+){0,1}${W}{3,}s${B}`;

const TESTIMONIAL_PATTERN =
  // Straight or curly double quotes.
  '["“][^"”]{20,}["”]' +
  // A markdown blockquote line with 20+ characters of text. (?<![^\n]) is
  // Python's MULTILINE ^ exactly: start of string, or immediately after \n.
  `|(?<![^\\n])[ \\t]{0,3}>[ \\t]*${NS}[^\\n]{19,}` +
  // Single-quoted spans. The lookaround keeps an apostrophe inside a word
  // ("doesn't ... you're") from being read as an opening quote.
  `|(?<![${W_CHARS}'’])'[^'’\\n]{20,}'(?!${W})` +
  `|(?<![${W_CHARS}'’])‘[^’\\n]{20,}’(?!${W})`;

// Frozen: `patterns` is not user-overridable (see mergeConfig).
export const DEFAULT_CONFIG = {
  patterns: {
    number: `${B}${D}[${D_CHARS},]*(?:\\.${D}+)?%?${B}`,
    magnitude: MAGNITUDE_PATTERN,
    superlative:
      `${B}(?:the${S}+)?(?:best|worst|fastest|slowest|cheapest|only|first|` +
      `largest|smallest|most|least|leading|number${S}+one)${B}` +
      `|(?<!${W})#1(?!${W})`,
    comparative:
      `${B}(?:better|faster|cheaper|stronger|safer)${S}+than${B}` +
      `|${B}more${S}+${W}+${S}+than${B}|${B}unlike${B}|${B}compared${S}+to${B}` +
      `|${B}outperforms${B}`,
    absolute: `${B}(?:never|always|guaranteed|nobody|no${S}+one|everyone|zero)${B}`,
    testimonial: TESTIMONIAL_PATTERN,
  },
  severity: {
    number: 'error',
    magnitude: 'error',
    superlative: 'error',
    comparative: 'error',
    testimonial: 'error',
    absolute: 'warn',
  },
  ignore: [DATE_FORMS],
};

// The built-in ignore patterns are written natively for THIS engine (\p{Nd}
// here, \d in claim_lint.py): the same rule expressed twice in two languages,
// not a shared string that has to survive both. ONLY these exact strings are
// exempt from the portability gate. Anything else in an ignore list arrived
// from a user's truth.config.json, is read by both implementations, and must
// mean the same thing to each.
const NATIVE_IGNORES = new Set(DEFAULT_CONFIG.ignore);

const CATCH_ALL_IGNORES = new Set(['.*', '.+', '^.*$', '(.*)']);
const VALID_SEVERITIES = ['error', 'warn'];
const SOURCE_SUFFIX = ' — source:';
const WINDOW_WORDS = 3;

// The portable subset of group constructs — the forms Python's `re` and
// JavaScript's RegExp both read the same way. Anything else after "(?" is
// refused on BOTH sides rather than translated. Mirrors
// PORTABLE_GROUP_PREFIXES in claim_lint.py.
const PORTABLE_GROUP_PREFIXES = ['(?:', '(?=', '(?!', '(?<=', '(?<!', '(?P<'];

export const NONPORTABLE_RULE =
  'An ignore pattern must mean the same thing to every implementation of this ' +
  'linter. console/src/lint.js answers the same question in a browser, and a ' +
  'pattern the two regex engines read differently would blank a different region ' +
  'depending on which one ran — two answers to one question, which is the exact ' +
  'failure this tool exists to prevent.';

// Word for word the same refusal claim_lint.py raises. Two different
// explanations of one rule is a smaller version of the same defect.
export const CLASS_ESCAPE_REFUSAL =
  '\\W, \\D, \\S and \\B inside a character class are not portable between Python ' +
  "and JavaScript: Python's class escapes are Unicode-aware, JavaScript's are " +
  'ASCII-only, and JavaScript cannot negate a class inside a class at all. ' +
  NONPORTABLE_RULE +
  ' Write the characters out explicitly instead — [A-Za-z_] rather than [^\\W\\d].';

export const CONFIG_RULE =
  "A config may set 'severity' and 'ignore' only. Detection patterns are fixed. " +
  'Ignore patterns are printed on every run, so a broad one is visible in the ' +
  'output rather than hidden in a file.';

/** A config that oversteps what a config may set (see CONFIG_RULE). */
export class ConfigRefused extends Error {}

function defaultWarn(message) {
  // eslint-disable-next-line no-console
  console.warn(message);
}

// ---------------------------------------------------------------------------
// Python string-method equivalents
// ---------------------------------------------------------------------------

/** Python str.splitlines(): splits on every Unicode line boundary, and a
 *  trailing boundary does not produce a final empty element. */
function splitLines(text) {
  if (text === '') return [];
  const parts = text.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85\u2028\u2029]/u);
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

/** Python str.strip() with no argument. */
function pyStrip(text) {
  return text.replace(TRIM_RE, '');
}

/** Python str.split() with no argument: split on whitespace runs, no empties. */
function pySplit(text) {
  return text.split(SPACE_RUN_RE).filter((part) => part !== '');
}

/** Every non-whitespace character replaced by a space. Offsets are preserved,
 *  which is what lets line/col from the cleaned text index the original. */
function blankSpan(chunk) {
  return chunk.replace(NONSPACE_RE, ' ');
}

/** Escape for literal use in a JS regex. Python's re.escape additionally
 *  escapes characters that are not special (space, '#', '-'); escaping a
 *  non-special character is a no-op, so the two produce identical matching —
 *  and `\ ` / `\-` are outright invalid under the /u flag. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Count of '\n' in text[0:end] — Python str.count('\n', 0, end). */
function countNewlines(text, end) {
  let count = 0;
  let at = -1;
  for (;;) {
    at = text.indexOf('\n', at + 1);
    if (at === -1 || at >= end) return count;
    count += 1;
  }
}

// ---------------------------------------------------------------------------
// Translating a user-supplied (Python) ignore pattern into an equivalent JS one
// ---------------------------------------------------------------------------

const JS_VALID_ESCAPES = new Set([
  '^', '$', '\\', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '/', '-',
  'n', 'r', 't', 'f', 'v', 'x', 'u', 'c', 'p', 'P', 'k', '0',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

/** Rewrite a Python regex source so it means the same thing to JS.
 *
 *  `ignore` patterns come from a user's truth.config.json and are written as
 *  Python regexes. Compiled verbatim by JS they change meaning — \d and \w go
 *  ASCII-only, \b stops seeing non-ASCII letters as word characters — and every
 *  one of those shifts can widen what an ignore blanks. A widened ignore is a
 *  silenced finding, so the shorthands are rewritten rather than trusted.
 *
 *  Constructs with no JS equivalent are refused loudly rather than approximated.
 *  The one that bites in practice is \D, \W, \S or \B INSIDE a character class
 *  — the `[^\W\d]` idiom for "a letter". JS accepts that source text, so it
 *  would compile silently and mean something different, and a class cannot nest
 *  a negated class without the /v flag. claim_lint.py accepts such a config and
 *  this module refuses it: a KNOWN, deliberate divergence, and the only safe
 *  one, because the alternative is an ignore pattern that blanks a different
 *  region in the browser than it does on the command line.
 */
export function pythonRegexToJs(source) {
  let out = '';
  let inClass = false;
  let classOpenedAt = -1; // Python reads a ']' in first position as a literal
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      const next = source[i + 1];
      i += 1;
      if (next === undefined) throw new ConfigRefused(`trailing backslash in pattern ${JSON.stringify(source)}`);
      if (next === 'd') out += inClass ? D_CHARS : D;
      else if (next === 'w') out += inClass ? W_CHARS : W;
      else if (next === 's') out += inClass ? SPACE_CHARS : S;
      else if (next === 'D' || next === 'W' || next === 'S' || next === 'B') {
        if (inClass) {
          throw new ConfigRefused(
            `ignore pattern ${JSON.stringify(source)} uses \\${next} inside a ` +
            `character class. ${CLASS_ESCAPE_REFUSAL}`);
        }
        out += next === 'D' ? `[^${D_CHARS}]` : next === 'W' ? `[^${W_CHARS}]` : next === 'S' ? NS : NB;
      } else if (next === 'p' || next === 'P') {
        // Consume \p{...} as ONE unit. Scanning it character by character left
        // the closing brace exposed, so "\p{L}+" was reported as a possessive
        // "}+" — a refusal for a reason that had nothing to do with the input.
        // Only engine-native defaults reach here; a user pattern is refused by
        // assertPortableIgnore before translation.
        const close = source[i + 1] === '{' ? source.indexOf('}', i + 2) : -1;
        if (close === -1) {
          throw new ConfigRefused(
            `ignore pattern ${JSON.stringify(source)} has a \\${next} escape with no ` +
            `{...} property name. ${CONFIG_RULE}`);
        }
        out += source.slice(i - 1, close + 1);
        i = close;
      } else if (next === 'b') out += inClass ? '\\b' : B; // \b inside a class is backspace in both
      else if (next === 'A') out += '^';
      else if (next === 'Z' || next === 'z') out += '$';
      else if (JS_VALID_ESCAPES.has(next)) out += `\\${next}`;
      else if (/[a-zA-Z]/.test(next)) {
        throw new ConfigRefused(`unsupported escape \\${next} in pattern ${JSON.stringify(source)}`);
      } else out += next; // re.escape escapes punctuation JS rejects escaping
      continue;
    }
    if (inClass) {
      const firstPosition = i === classOpenedAt + 1
        || (i === classOpenedAt + 2 && source[classOpenedAt + 1] === '^');
      if (ch === ']' && firstPosition) { out += '\\]'; continue; }
      if (ch === ']') inClass = false;
      out += ch;
      continue;
    }
    if (ch === '[') { inClass = true; classOpenedAt = i; out += ch; continue; }
    // Python's `.` excludes only \n; JS's also excludes \r and the line seps.
    if (ch === '.') { out += '[^\\n]'; continue; }
    // Python's `$` without MULTILINE also matches before a single trailing \n.
    if (ch === '$') { out += '(?=\\n?$)'; continue; }
    if (source.startsWith('(?', i)
        && !PORTABLE_GROUP_PREFIXES.some((prefix) => source.startsWith(prefix, i))) {
      throw new ConfigRefused(
        `ignore pattern ${JSON.stringify(source)} uses the group construct ` +
        `${JSON.stringify(source.slice(i, i + 4))}, which is not portable between ` +
        `Python and JavaScript. ${NONPORTABLE_RULE} Use (?:...) or one of the ` +
        'lookaround forms both engines share.');
    }
    if ('*+?}'.includes(ch) && source[i + 1] === '+') {
      throw new ConfigRefused(
        `ignore pattern ${JSON.stringify(source)} uses the possessive quantifier ` +
        `${JSON.stringify(source.slice(i, i + 2))}, which is not portable between ` +
        'Python and JavaScript: JavaScript has no possessive quantifiers and ' +
        `refuses to compile it. ${NONPORTABLE_RULE} Use a plain or lazy quantifier ` +
        'instead.');
    }
    if (source.startsWith('(?P<', i)) { out += '(?<'; i += 3; continue; }
    out += ch;
  }
  if (inClass) throw new ConfigRefused(`unterminated character class in ${JSON.stringify(source)}`);
  return out;
}

/** Refuse a USER-SUPPLIED ignore pattern the two engines do not read alike.
 *
 *  Twin of claim_lint.assert_portable_ignore. The class-escape and group rules
 *  live in pythonRegexToJs (they apply wherever a Python-authored pattern is
 *  translated); this adds the one rule that must NOT apply to the built-in
 *  default — \p{...}. DEFAULT_CONFIG.ignore is written natively for this engine
 *  (\p{Nd} here, \d in claim_lint.py): the same rule expressed twice, not a
 *  shared string that has to survive both engines. A pattern arriving from a
 *  user's truth.config.json is a shared string, and must survive both.
 *
 *  This direction is the one that bites: JavaScript compiles \p{L} happily and
 *  Python's re refuses it outright, so without this check the console would lint
 *  using an ignore the CLI cannot even load — blanking regions, and dropping
 *  findings, that the command line would never drop.
 */
export function assertPortableIgnore(pattern) {
  const property = /\\[pP]\{/.exec(pattern);
  if (property) {
    throw new ConfigRefused(
      `ignore pattern ${JSON.stringify(pattern)} uses the Unicode property escape ` +
      `${property[0]}...}, which is not portable between Python and JavaScript: ` +
      'JavaScript compiles it and Python\'s re module cannot. ' +
      `${NONPORTABLE_RULE} Write the characters out explicitly instead.`);
  }
  pythonRegexToJs(pattern); // the shared class-escape and group-construct rules
}

/** Compile one ignore pattern into the two forms find_claims needs: a global
 *  matcher for blanking regions, and an anchored one for the span fullmatch. */
function compileIgnore(source) {
  const translated = pythonRegexToJs(source);
  try {
    return {
      all: new RegExp(translated, 'giu'),
      full: new RegExp(`^(?:${translated})$`, 'iu'),
    };
  } catch (err) {
    throw new ConfigRefused(`invalid ignore pattern ${JSON.stringify(source)}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// The register
// ---------------------------------------------------------------------------

/** Return the lowercased 'Cleared' lines of a truth register, given its text.
 *
 *  A Cleared bullet without a ' — source:' suffix is MALFORMED and is excluded.
 *  An unsourced register entry must not be able to source anything — otherwise
 *  the register becomes a place to launder a number by writing it down.
 */
export function loadRegister(markdown, onWarning = defaultWarn) {
  const cleared = [];
  if (!markdown) return cleared;
  const seen = new Set();
  let section = null;
  const lines = splitLines(markdown);
  for (let index = 0; index < lines.length; index += 1) {
    const line = pyStrip(lines[index]);
    if (line.toLowerCase().startsWith('## ')) {
      section = pyStrip(line.slice(3)).toLowerCase();
      continue;
    }
    if (section === 'cleared' && line.startsWith('- ')) {
      const entry = pyStrip(line.slice(2));
      if (!entry.toLowerCase().includes(SOURCE_SUFFIX.toLowerCase())) {
        onWarning(
          `claim-lint: WARNING: line ${index + 1}: malformed Cleared entry, no ` +
          "'source:' suffix (the template's em-dash form); IGNORED, it sources " +
          `nothing: ${JSON.stringify(entry)}`);
        continue;
      }
      const lowered = entry.toLowerCase();
      if (!seen.has(lowered)) { seen.add(lowered); cleared.push(lowered); }
    }
  }
  return cleared;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** Blank out fenced code, inline code and URLs, preserving offsets.
 *
 *  Fences are paired EXPLICITLY. An unterminated fence must not blank the rest
 *  of the document: a single typo would otherwise switch the gate off for
 *  everything after it and still report all-clear.
 */
export function stripNoise(text, onWarning = defaultWarn) {
  const markers = [];
  for (let at = text.indexOf('```'); at !== -1; at = text.indexOf('```', at + 3)) {
    markers.push(at);
  }
  if (markers.length % 2) {
    const line = countNewlines(text, markers[markers.length - 1]) + 1;
    onWarning(
      `claim-lint: WARNING: unterminated code fence at line ${line}; ` +
      'the text after it is being SCANNED, not treated as code.');
  }
  const chunks = [];
  let cursor = 0;
  for (let pair = 0; pair < Math.floor(markers.length / 2); pair += 1) {
    const start = markers[2 * pair];
    const end = markers[2 * pair + 1] + 3;
    chunks.push(text.slice(cursor, start));
    chunks.push(blankSpan(text.slice(start, end)));
    cursor = end;
  }
  chunks.push(text.slice(cursor));
  let out = chunks.join('');
  out = out.replace(/`[^`\n]*`/g, blankSpan);
  out = out.replace(new RegExp(`https?://${NS}+`, 'gu'), blankSpan);
  return out;
}

/** True if needle appears in haystack not flanked by word characters. */
function containsBounded(haystack, needle) {
  return new RegExp(`(?<!${W})${escapeRegExp(needle)}(?!${W})`, 'u').test(haystack);
}

/** Word-bounded containment: the claim text must appear inside a cleared entry.
 *
 *  ONE DIRECTION ONLY, and both halves of that are load-bearing:
 *
 *  - Boundaries are mandatory. Plain substring matching lets an unsourced "49"
 *    hide inside a cleared "149".
 *  - The reverse direction is forbidden. If a cleared entry were allowed to
 *    match inside the claim text, a short cleared fragment would vouch for a
 *    long line carrying other unsourced claims.
 *
 *  Both are the same false negative.
 */
function isSourced(text, register) {
  const needle = pyStrip(text).toLowerCase().replace(/\.+$/u, '');
  if (!needle) return false;
  for (const cleared of register) {
    if (containsBounded(cleared, needle)) return true;
  }
  return false;
}

/** The span plus the next few words on its line, whitespace-normalised.
 *
 *  A BARE span is not evidence of sourcing. The token "97" sits inside a cleared
 *  "97 downloads all-time" no matter what the draft says next to it, so checking
 *  the token alone lets "97 million requests a day" ride in on it. Only the span
 *  IN CONTEXT may vouch for itself.
 *
 *  THE INVARIANT: the window is only ever NARROWER THAN THE LINE and WIDER THAN
 *  THE SPAN. When it cannot be both — the offset does not line up, or the span
 *  is the last token on its line and no word follows it — the fallback is the
 *  WHOLE LINE, the strict check. Never the bare span: a number ending a line, a
 *  heading, or a list item is ordinary copy, and degrading to the token there
 *  would reopen exactly the hole this function exists to close.
 */
function spanWindow(line, col, span) {
  if (col < 0 || line.slice(col, col + span.length) !== span) return line;
  const following = pySplit(line.slice(col + span.length)).slice(0, WINDOW_WORDS);
  if (following.length === 0) return line;
  return pySplit(span).concat(following).join(' ');
}

/** Blank every region matching an ignore pattern, preserving offsets.
 *
 *  An ignore is applied to the TEXT, not only to a finished span. A span-only
 *  check cannot express a multi-token exemption: the number detector splits
 *  '2026-08-04' into the three spans '2026', '08' and '04', so no pattern
 *  fullmatching the whole date could ever silence it. Blanking the region does.
 *  The span-level fullmatch is kept as well, so an anchored pattern that only
 *  makes sense against a span still works.
 */
function blankIgnored(text, ignores) {
  let out = text;
  for (const ignore of ignores) {
    ignore.all.lastIndex = 0;
    out = out.replace(ignore.all, blankSpan);
  }
  return out;
}

export function findClaims(text, config, onWarning = defaultWarn) {
  const findings = [];
  const ignores = (config.ignore || []).map(compileIgnore);
  const cleaned = blankIgnored(stripNoise(text, onWarning), ignores);
  for (const [category, pattern] of Object.entries(config.patterns)) {
    const severity = Object.prototype.hasOwnProperty.call(config.severity || {}, category)
      ? config.severity[category]
      : 'error';
    const re = new RegExp(pattern, 'giu');
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      const span = match[0];
      if (span === '') re.lastIndex += 1; // as Python's finditer advances
      if (ignores.some((ig) => ig.full.test(span))) continue;
      const line = countNewlines(cleaned, match.index) + 1;
      const previousNewline = match.index === 0 ? -1 : cleaned.lastIndexOf('\n', match.index - 1);
      findings.push({
        line,
        col: match.index - (previousNewline + 1),
        category,
        span,
        severity,
      });
    }
  }
  return findings;
}

/** Return findings whose containing line is not sourced in the register. */
export function lint(text, register, config = DEFAULT_CONFIG, onWarning = defaultWarn) {
  const cleared = Array.isArray(register) ? register : Array.from(register || []);
  const lines = splitLines(text);
  const out = [];
  for (const finding of findClaims(text, config, onWarning)) {
    const sourceLine = finding.line <= lines.length ? lines[finding.line - 1] : '';
    const window = spanWindow(sourceLine, finding.col, finding.span);
    if (isSourced(sourceLine, cleared) || isSourced(window, cleared)) continue;
    out.push(finding);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Refuse the config shapes that turn the gate off outright.
 *
 *  Scope, stated honestly because the alternative is a false claim inside a tool
 *  about false claims: this refuses a config that can never fail and a severity
 *  map that is nonsense. It does NOT — and cannot — decide whether a given
 *  ignore REGEX is too broad. `\d+` silences the number category as surely as
 *  `.*` silences everything. That is why every ignore pattern is echoed on every
 *  run: the defence against a too-broad ignore is that you can SEE it, not that
 *  the linter second-guessed it.
 */
export function validateConfig(config) {
  for (const pattern of config.ignore || []) {
    // The portability gate belongs on EVERY path that accepts a config, not
    // just on mergeConfig. It lived only there until a probe of refusal
    // REASONS showed \p{L} sailing through here while \p{L}+ was refused for
    // the wrong reason (a "possessive }+" that is nothing of the kind) — a rule
    // that never fired, hidden behind two neighbours that did.
    if (!NATIVE_IGNORES.has(pattern)) assertPortableIgnore(pattern);
    let matchesEmpty;
    try {
      matchesEmpty = new RegExp(`^(?:${pythonRegexToJs(pattern)})$`, 'u').test('');
    } catch (err) {
      if (err instanceof ConfigRefused) throw err;
      throw new ConfigRefused(`invalid ignore pattern ${JSON.stringify(pattern)}: ${err.message}`);
    }
    if (CATCH_ALL_IGNORES.has(pattern.trim()) || matchesEmpty) {
      throw new ConfigRefused(
        `catch-all ignore pattern ${JSON.stringify(pattern)} would suppress every ` +
        `finding. ${CONFIG_RULE}`);
    }
  }
  const severity = config.severity || {};
  const values = Object.values(severity);
  for (const [category, value] of Object.entries(severity)) {
    if (!VALID_SEVERITIES.includes(value)) {
      throw new ConfigRefused(
        `invalid severity ${JSON.stringify(value)} for category ${JSON.stringify(category)}; ` +
        `expected one of ${VALID_SEVERITIES.join(', ')}. ${CONFIG_RULE}`);
    }
  }
  if (values.length > 0 && values.every((value) => value === 'warn')) {
    throw new ConfigRefused(
      "every category is set to 'warn', so the run can never fail. " + CONFIG_RULE);
  }
}

/** Merge a loaded truth.config.json over the defaults — the pure half of
 *  claim_lint.load_config, with the file reading left to the caller. */
export function mergeConfig(loaded) {
  if (!loaded) {
    validateConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
  if (Object.prototype.hasOwnProperty.call(loaded, 'patterns')) {
    throw new ConfigRefused(
      "'patterns' is not user-overridable: a config that could rewrite a " +
      'detection pattern could switch a category off with a regex that never ' +
      "matches, such as '$^'. A config may set 'severity' and 'ignore' only.");
  }
  for (const pattern of loaded.ignore || []) assertPortableIgnore(pattern);
  const merged = { ...DEFAULT_CONFIG, ...loaded };
  if (Object.prototype.hasOwnProperty.call(loaded, 'severity')) {
    merged.severity = { ...DEFAULT_CONFIG.severity, ...loaded.severity };
  }
  merged.patterns = DEFAULT_CONFIG.patterns;
  validateConfig(merged);
  return merged;
}

/** One line naming what the gate is actually set to for this run.
 *
 *  The ignore patterns are printed IN FULL, not counted. An ignore regex can
 *  silence an entire category — `\d+` retires every number — and no validator
 *  can judge that for you. Printing the patterns is the only honest defence:
 *  the weakening is visible in the same output as the verdict it produced.
 */
export function describeConfig(config, source) {
  const categories = Object.keys(config.patterns)
    .sort()
    .map((name) => `${name}=${config.severity[name] ?? 'error'}`)
    .join(', ');
  const ignores = [...(config.ignore || [])];
  const shown = ignores.length ? ignores.join('; ') : '(none)';
  return (
    `claim-lint: config: ${source} | categories: ${categories} ` +
    `| ignore patterns: ${ignores.length}: ${shown}`
  );
}
