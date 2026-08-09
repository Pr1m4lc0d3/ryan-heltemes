// agent.js — the drafting agent. The console collects a pack; this is the
// half that does something with it.
//
// SPLIT, same house rule as the ui/ modules: buildDraftPrompt() is PURE
// (a pack in, two strings out, no DOM, no network) so tests can hold it to
// the discipline below without a key. Only callProvider() touches the
// network, and only ever the endpoint the user typed in themselves.
//
// WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
// This one drafts; it does not research, and that is a CHOICE rather than a
// limit. The sidebar agent (guide.js) can search the live web where the
// provider supports it — see supportsSearch below — but a draft must assert
// only what truth.md already cleared, so handing the drafter fresh unsourced
// findings would be handing it exactly the material it is forbidden to use.
// Research belongs upstream, where a finding can be checked and written into
// the register with its source.
//
// FIVE RULES THIS FILE EXISTS TO ENFORCE. Every one is stated to the model
// in the system prompt AND left checkable afterwards by Door 3's linter, so
// a model that ignores an instruction still gets caught before anything is
// sent:
//   1. ONLY CLEARED CLAIMS. truth.md ## Cleared is the entire set of facts
//      the draft may assert. Uncleared entries are handed over as an
//      explicit do-not-say list rather than simply withheld, because a model
//      told nothing about a claim will cheerfully reinvent it.
//   2. NO INVENTED NUMBERS, NAMES, QUOTES OR TESTIMONIALS. Not one, not
//      "for illustration", not with a placeholder.
//   3. NO RIVAL IS EVER NAMED. asymmetry.md is internal ammunition; naming
//      an incumbent in public copy is a RAID violation in its own right, so
//      the incumbents section is never sent to the model at all. Only "our
//      ground" — what you can say — crosses over.
//   4. VOICE COMES FROM voice.md OR NOWHERE. An invented house style is a
//      fabrication that merely fails less visibly than an invented figure,
//      because no reader can check a tone against a source. With no
//      voice.md the draft says so rather than picking a personality.
//   5. IT NEVER SENDS. The output is a draft for a human to read, edit and
//      post. Nothing here has a publish path, by construction.

const MAX_ENTRIES = 40;

// ---------------------------------------------------------------------------
// Providers. Nobody should have to go and find a base URL.
//
// Every entry is an OpenAI-compatible /chat/completions endpoint, which is
// why one code path serves all of them. `note` carries the one thing that
// actually bites in a browser: some providers do not send CORS headers, so a
// key that works fine from a server fails here. Saying which is which up
// front is cheaper than letting someone debug "Failed to fetch".
//
// Model ids are deliberately NOT hard-coded per provider. They change without
// notice — a default that has since been retired is worse than no default,
// because it fails at the first call with an error about a model the user
// never chose. Use listModels() instead: it asks the provider what it has.
// ---------------------------------------------------------------------------

export const PROVIDERS = Object.freeze([
  {
    id: 'openrouter',
    label: 'OpenRouter — works in the browser, can search',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'One key, most models, and the only one here that can search the live web.',
    search: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    note: '',
  },
  {
    id: 'groq',
    label: 'Groq — fast, free tier',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    note: '',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek — cheap',
    baseUrl: 'https://api.deepseek.com',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    // VERIFIED 2026-08-09 against api.deepseek.com from a browser origin:
    // a POST to /chat/completions and a GET to /models both return a 401
    // whose body the page can READ, which a browser only permits when the
    // server has allowed the origin. This note used to say DeepSeek 'may
    // refuse browser calls' — it does not, and saying so sent people to a
    // provider they did not need. Check before restoring a warning here.
    note: 'Works in the browser. Cannot search the live web — OpenRouter can.',
  },
  {
    id: 'custom',
    label: 'Something else',
    baseUrl: '',
    keyUrl: '',
    note: 'Any endpoint that speaks the OpenAI chat format.',
  },
]);

// Can this provider run a live web search on our behalf?
//
// A BROWSER cannot fetch a competitor's page — cross-origin blocks it, and no
// amount of wanting changes that. But the PROVIDER is a server, and some of
// them will run a search and hand back the results with citations. Those are
// two different questions, and conflating them is why this console claimed
// for a while that it could not research anything.
export function supportsSearch(providerId) {
  const p = providerById(providerId);
  return Boolean(p && p.search);
}

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id);
}

// Best-effort: which preset does this saved config look like? Used to select
// the right option on load without storing a provider id, so a config saved
// before presets existed still shows the right one.
export function providerFor(baseUrl) {
  const b = String(baseUrl || '').replace(/\/+$/, '');
  return PROVIDERS.find((p) => p.baseUrl && p.baseUrl.replace(/\/+$/, '') === b) || providerById('custom');
}

// listModels(config, fetchImpl) -> Promise<string[]>
//
// The standard OpenAI-compatible /models endpoint. Asking the provider what
// it has is the only way to offer a correct list, and it is what turns "type
// an exact model id you have to go and look up" into a dropdown.
//
// Sorted with chat-shaped ids first: a raw list from a large provider is
// mostly embeddings, audio and image models, any of which fail on the first
// chat call. Nothing is hidden — this app points at arbitrary endpoints, so
// demoting is honest where filtering would be a guess.
export async function listModels(config, fetchImpl) {
  const cfg = config || {};
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Pick a provider first.');
  if (!cfg.apiKey) throw new Error('Enter your API key first.');
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) throw new Error('This browser cannot make the request.');

  const res = await doFetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) throw new Error(`${res.status} from the provider when listing models.`);
  const data = await res.json();
  const ids = (data?.data || []).map((m) => m && m.id).filter((id) => typeof id === 'string');
  if (!ids.length) throw new Error('The provider returned no models.');

  const NOT_CHAT = /embed|whisper|tts|audio|speech|dall-e|image|moderation|rerank|vision-encoder/i;
  const chat = ids.filter((id) => !NOT_CHAT.test(id)).sort();
  const other = ids.filter((id) => NOT_CHAT.test(id)).sort();
  return chat.concat(other);
}

function lines(entries, render) {
  return (entries || []).slice(0, MAX_ENTRIES).map(render).filter(Boolean);
}

function block(title, items) {
  if (!items.length) return '';
  return `\n${title}\n${items.map((l) => `- ${l}`).join('\n')}\n`;
}

// The house rules, sent every time. Written as prohibitions with the reason
// attached: a rule whose reason is stated survives paraphrase better than a
// bare "do not".
export const DRAFT_SYSTEM = [
  'You write short marketing copy for a founder with no budget. You are handed a fact register.',
  '',
  'HARD RULES. Breaking any one of these makes the draft unusable:',
  '',
  '1. You may assert ONLY facts listed under CLEARED. Those are the claims this founder can hand a',
  '   stranger a source for. Anything else about the product, the company, its results, its customers',
  '   or its history is off limits, including anything you believe you know independently.',
  '2. Invent NOTHING: no statistic, no percentage, no revenue figure, no customer count, no date, no',
  '   testimonial, no quote, no named person, no case study. Not as an example, not as a placeholder,',
  '   not "to be filled in". If a persuasive line needs a number you were not given, write the line',
  '   without the number or leave the line out.',
  '3. Name no competitor, no rival product and no rival company, ever. Not to compare, not to',
  '   contrast, not favourably.',
  '4. Do not claim urgency, scarcity, popularity or momentum unless a CLEARED fact establishes it.',
  '5. Never say or imply that the product does something the register does not establish.',
  '',
  'If the register cannot support the piece you were asked for, say so plainly and write the largest',
  'honest fragment you can, rather than filling the gap. A short true post beats a long unusable one.',
  '',
  'Return the draft text only. No preamble, no explanation, no options, no commentary.',
].join('\n');

// buildDraftPrompt(pack, ask) -> { system, user, blocked }
//
// `blocked` is a non-empty string when the pack cannot support a draft at
// all. The caller shows it and does not spend a call: refusing here is
// cheaper and more honest than asking a model to write from nothing and
// then linting whatever it invents.
export function buildDraftPrompt(pack, ask) {
  const want = String(ask || '').trim();
  if (!pack) return { system: DRAFT_SYSTEM, user: '', blocked: 'No pack is loaded.' };
  if (!want) return { system: DRAFT_SYSTEM, user: '', blocked: 'Say what you want written first.' };

  const cleared = lines(pack.truth?.cleared, (e) => e.raw);
  if (!cleared.length) {
    return {
      system: DRAFT_SYSTEM,
      user: '',
      blocked: 'truth.md has no cleared facts yet, so there is nothing this draft would be allowed to say. '
        + 'Add one claim with a source in Door 1 first.',
    };
  }

  const uncleared = lines(pack.truth?.uncleared, (e) => e.raw);
  const ground = lines(pack.asymmetry?.ourGround, (e) => e.raw);
  const held = lines(pack.motte?.held, (e) => e.fields?.asset).filter(Boolean);

  // The destination room, if the founder named one. Its rules and whether
  // this account may post a link are the two things that get a post removed.
  const rooms = lines(pack.bailey?.active, (e) => {
    const f = e.fields || {};
    const bits = [f.channel, f.standing ? `standing: ${f.standing}` : '', f.linksAllowed ? `links allowed: ${f.linksAllowed}` : ''];
    return bits.filter(Boolean).join(' — ');
  });

  // voice.md is passed as its own raw text rather than parsed: the file is
  // short, and a misparse here would silently drop the one thing standing
  // between a draft and an invented personality.
  const voiceRaw = String(pack.raw?.['voice.md'] || '').trim();
  const voice = voiceRaw
    ? `\nHOUSE VOICE — follow this, it is the founder's own:\n${voiceRaw}\n`
    : '\nHOUSE VOICE: none recorded. Write plainly and do not invent a personality, a slogan, or a '
      + 'catchphrase. Say at the end of the draft, on its own line: "(No voice.md yet — this is plain '
      + 'phrasing, not a house style.)"\n';

  const user = [
    `WHAT TO WRITE:\n${want}`,
    block('CLEARED — the only facts you may assert:', cleared),
    uncleared.length
      ? block('UNCLEARED — you may NOT say any of these, in any wording:', uncleared)
      : '',
    ground.length ? block('GROUND YOU CAN HOLD — angles that are safe to take:', ground) : '',
    held.length ? block('OWNED ASSETS you may point people to:', held) : '',
    rooms.length ? block('WHERE THIS GOES — respect standing and link permission:', rooms) : '',
    voice,
  ].filter(Boolean).join('\n');

  return { system: DRAFT_SYSTEM, user, blocked: '' };
}

// ---------------------------------------------------------------------------
// The only network call in the console.
// ---------------------------------------------------------------------------

// callProvider(config, prompt) -> Promise<string>
//
// One POST to an OpenAI-compatible /chat/completions endpoint that the user
// typed in themselves. The key lives in their browser, goes to their
// provider, and is never sent anywhere else — there is nowhere else to send
// it to, since this app has no server of its own.
// opts.search — ask the provider to search the live web before answering.
// OpenRouter's `web` plugin, which returns url_citation annotations alongside
// the reply. Costs extra per request, even on a free model, which is why it
// is opt-in and the UI says so.
export async function callProvider(config, prompt, fetchImpl, opts) {
  const cfg = config || {};
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No provider URL set.');
  if (!cfg.apiKey) throw new Error('No API key set.');
  if (!cfg.model) throw new Error('No model set.');

  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) throw new Error('This browser cannot make the request.');

  const res = await doFetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      ...((opts && opts.search) ? { plugins: [{ id: 'web', max_results: 5 }] } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} from the provider. ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const text = msg?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('The provider returned no text.');
  const cites = citationsFrom(msg);
  return cites.length ? `${text.trim()}\n\n${formatCitations(cites)}` : text.trim();
}

// url_citation annotations, in OpenRouter's standardised shape. Pulled out
// and appended in plain text so the founder can SEE the source of anything
// the agent found — an unsourced research claim is the failure this whole
// system exists to prevent, and a citation the user never sees is unsourced
// as far as they are concerned.
export function citationsFrom(message) {
  const anns = (message && message.annotations) || [];
  const out = [];
  for (const a of anns) {
    const c = a && (a.url_citation || (a.type === 'url_citation' ? a : null));
    if (c && c.url) out.push({ url: String(c.url), title: String(c.title || c.url) });
  }
  // De-duplicated by URL: a model citing the same page four times produces
  // four annotations, and four identical lines reads as four sources.
  const seen = new Set();
  return out.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

export function formatCitations(cites) {
  if (!cites.length) return '';
  return `Sources:\n${cites.map((c) => `- ${c.title} — ${c.url}`).join('\n')}`;
}

// ---------------------------------------------------------------------------
// Where the key is kept: this browser, and nowhere else.
// ---------------------------------------------------------------------------

const KEY = 'monkeys.agent.v1';

export function loadAgentConfig(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return { baseUrl: '', apiKey: '', model: '' };
  try {
    const raw = store.getItem(KEY);
    if (!raw) return { baseUrl: '', apiKey: '', model: '' };
    const v = JSON.parse(raw);
    return { baseUrl: v.baseUrl || '', apiKey: v.apiKey || '', model: v.model || '' };
  } catch {
    return { baseUrl: '', apiKey: '', model: '' };
  }
}

export function saveAgentConfig(config, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return false;
  try {
    store.setItem(KEY, JSON.stringify({
      baseUrl: config.baseUrl || '', apiKey: config.apiKey || '', model: config.model || '',
    }));
    return true;
  } catch {
    return false;
  }
}
