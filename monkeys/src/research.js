// research.js — giving the agent hands to look things up.
//
// WHY THIS EXISTS. The console had exactly one way to reach the live web:
// OpenRouter's provider-side `plugins: [{id:'web'}]`. Every other provider was
// treated as "cannot browse", which was wrong in the same way I have been
// wrong about this twice now — a model's ability to browse is not a property
// of the model or of the provider. It is whether somebody handed it TOOLS.
// DeepSeek browses fine anywhere it is given a search tool and a read tool.
// So here they are, and any provider that speaks OpenAI tool-calling gets them.
//
// WHY NODE AND NOT THE BROWSER. This one really is a hard limit, and it is not
// the same claim: a page served from localhost cannot fetch duckduckgo.com or
// a competitor's pricing page, because those hosts do not send CORS headers to
// it. Node has no such rule. That is why research lives on the CLI side, which
// is also where this project already puts every capability that needs real
// hands — the browser plans, the CLI acts.
//
// NO DEPENDENCIES. The console has to stay installable by unzipping it, so
// search is DuckDuckGo's HTML endpoint parsed with a regex and read is fetch
// plus tag-stripping. Both are crude on purpose. A brittle parser that fails
// loudly is a better trade here than a dependency tree.
//
// WHAT THIS IS NOT ALLOWED TO DO, and it is the whole point:
// A finding is a CANDIDATE, never a cleared claim. Nothing here writes to
// truth.md. Research produces "here is a statement and here is the URL it came
// from"; a human decides whether that source clears it. An agent that could
// promote its own findings would be an agent that launders generated text into
// the one register that exists to keep generated text out.

const UA = 'Mozilla/5.0 (compatible; MonkeyConsole/1.0; +https://ryan-heltemes.com/mavericks-monkeys.html)';

// ---------------------------------------------------------------------------
// The tools, in OpenAI tool-calling shape. DeepSeek, OpenAI, Groq and
// OpenRouter all speak this; a provider that does not will fail on the first
// call with a clear error rather than silently answering from memory.
// ---------------------------------------------------------------------------

export const TOOLS = Object.freeze([
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the live web. Returns titles, URLs and snippets. Use this before answering anything about the outside world.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'What to search for' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_read',
      description: 'Fetch one URL and return its readable text. Use this to actually read a page found by web_search, rather than trusting the snippet.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'The full URL to read' } },
        required: ['url'],
      },
    },
  },
]);

// ---------------------------------------------------------------------------
// web_search — DuckDuckGo's HTML endpoint. No key, no account, no quota to
// hand a stranger. DDG wraps every result in a redirect (/l/?uddg=...), so the
// real URL has to be pulled back out or every citation would point at DDG.
// ---------------------------------------------------------------------------

function unwrapDuckUrl(href) {
  const m = /[?&]uddg=([^&]+)/.exec(href || '');
  if (m) { try { return decodeURIComponent(m[1]); } catch { /* fall through */ } }
  return href || '';
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d))
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function webSearch(query, fetchImpl, limit = 6) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ q: String(query || '') }).toString(),
  });
  if (!res.ok) throw new Error(`search failed: HTTP ${res.status}`);
  const html = await res.text();

  const out = [];
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < limit) {
    const url = unwrapDuckUrl(m[1]);
    const title = stripTags(m[2]);
    if (url && title) out.push({ title, url });
  }

  // Snippets are a separate element; matched independently and zipped by
  // order, which is what DDG's markup actually gives us.
  const snips = [];
  const sre = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let s;
  while ((s = sre.exec(html)) && snips.length < limit) snips.push(stripTags(s[1]));
  out.forEach((r, i) => { r.snippet = snips[i] || ''; });

  return out;
}

// ---------------------------------------------------------------------------
// web_read — fetch a page and hand back readable text. Capped, because an
// un-capped page can be most of a context window and the model does not need
// the navigation.
// ---------------------------------------------------------------------------

export async function webRead(url, fetchImpl, maxChars = 6000) {
  const doFetch = fetchImpl || fetch;
  const res = await doFetch(String(url || ''), { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`read failed: HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
    throw new Error(`read refused: content-type ${type || 'unknown'} is not text`);
  }
  const html = await res.text();
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  const text = stripTags(body);
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated at ${maxChars} characters]` : text;
}

// runTool(name, args, fetchImpl) -> string. A failing tool returns its error
// AS TEXT rather than throwing, so the model can read "that page refused" and
// try another source instead of the whole run dying on one dead link.
export async function runTool(name, args, fetchImpl) {
  try {
    if (name === 'web_search') {
      const hits = await webSearch(args.query, fetchImpl);
      if (!hits.length) return 'No results. This is NOT proof the thing does not exist — report it as "searched, nothing found".';
      return hits.map((h, i) => `${i + 1}. ${h.title}\n   ${h.url}\n   ${h.snippet}`).join('\n\n');
    }
    if (name === 'web_read') return await webRead(args.url, fetchImpl);
    return `No such tool: ${name}`;
  } catch (e) {
    return `Tool error: ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// The brief. Carries the same evidence discipline the rest of the system runs
// on, because a research agent is the one most able to launder a guess: it has
// just been to the web, so whatever it says next sounds sourced.
// ---------------------------------------------------------------------------

export const RESEARCH_SYSTEM = [
  'You are researching for a founder with no budget, and your ONLY job is to come back with things',
  'that are true and the URL each one came from.',
  '',
  'HOW TO WORK:',
  '- Search first. Never answer about the outside world from memory; your training data is dated.',
  '- Read the actual page before citing it. A snippet is not a source.',
  '- Two or three searches is usually enough. Stop when you can answer, or when you cannot.',
  '',
  'HARD RULES:',
  '- EVERY factual statement in your answer carries the URL you read it from, inline.',
  '- A statement you cannot attach a URL to does not go in the answer. Not as background, not as',
  '  context, not as "it is generally known that".',
  '- Invent nothing: no statistic, price, number, date, quote or company you did not read.',
  '- A SEARCH THAT RETURNS NOTHING IS NOT PROOF OF ABSENCE. Say "searched, nothing found", which is',
  '  a weaker and different statement than "does not exist". You are FORBIDDEN from telling the',
  '  founder that a company, product or person they named is fictional on the strength of not',
  '  finding it.',
  '- If the sources disagree, say so and give both. Do not average them into one confident number.',
  '',
  'FINISH LIKE THIS, exactly:',
  '',
  'FINDINGS',
  '- <one statement> — source: <url>',
  '- <one statement> — source: <url>',
  '',
  'UNVERIFIED',
  '- <anything you looked for and could not confirm>',
  '',
  'Each FINDINGS line is a CANDIDATE for the claim register, not an entry in it. A human decides',
  'whether that source clears it. Do not say a claim is cleared, proven, or safe to publish.',
].join('\n');

// ---------------------------------------------------------------------------
// researchLoop — the tool-calling loop. Provider-agnostic: anything that
// speaks OpenAI chat completions with tools works, which is the entire point.
//
// `onStep` is called with a short human line per step so the CLI can show work
// as it happens rather than sitting silent for a minute.
// ---------------------------------------------------------------------------

export async function researchLoop({ config, question, fetchImpl, maxSteps = 8, onStep = () => {} }) {
  const cfg = config || {};
  const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No provider URL set.');
  if (!cfg.apiKey) throw new Error('No API key set.');
  if (!cfg.model) throw new Error('No model set.');
  const doFetch = fetchImpl || fetch;

  const messages = [
    { role: 'system', content: RESEARCH_SYSTEM },
    { role: 'user', content: String(question || '') },
  ];
  const used = [];

  for (let step = 0; step < maxSteps; step++) {
    const res = await doFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.2 }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${res.status} from the provider. ${detail.slice(0, 300)}`);
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    if (!msg) throw new Error('The provider returned no message.');
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const text = (msg.content || '').trim();
      if (!text) throw new Error('The provider returned no text and asked for no tool.');
      return { answer: text, sources: used, steps: step + 1 };
    }

    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      const name = call.function?.name;
      onStep(`${name}(${JSON.stringify(args).slice(0, 120)})`);
      const result = await runTool(name, args, doFetch);
      if (name === 'web_read' && args.url) used.push(args.url);
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }

  // Out of steps is a real outcome, and saying so beats returning whatever the
  // model had half-formed as though it were an answer.
  throw new Error(`Stopped after ${maxSteps} steps without a final answer. Ask a narrower question.`);
}
