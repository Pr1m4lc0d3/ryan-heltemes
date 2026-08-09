// sidebar.js — where the agent lives. Present on every screen, so the
// founder is never more than one question away from knowing what to do next.
//
// THE TRANSCRIPT IS THE ONE THING IN THIS APP THAT MAY SCROLL, and it is the
// only justified case: a conversation grows without bound, so hiding turns
// behind a disclosure would be losing the thread rather than saving space.
// Everything else stays bounded. The transcript scrolls INSIDE .guide-body;
// the page and the main pane do not, and the sidebar's header and ask box
// stay pinned so the input is never scrolled away from.
//
// PURE. mountApp's delegated listener in home.js drives every data-action
// here, and home.js owns the state.

import { PROVIDERS, providerById, supportsSearch } from '../agent.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Paragraph breaks only. The model is told to answer in two or three
// sentences, so anything richer than this is a sign the instruction is being
// ignored rather than a rendering gap — and a sidebar that renders markdown
// is a sidebar that renders whatever a model decides to emit.
function asParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// The key lives HERE, next to the agent it belongs to, and not in a door.
// It used to sit inside Door 3's write panel, which is unreachable until a
// pack is loaded — so a new founder was told to set a key somewhere they
// could not get to, by an agent that could not answer until they had. The
// sidebar is on every screen, including the empty one, which makes it the
// only correct home for it.
function renderProviderHTML(cfg, configured, models, loading, error, providerId, searchOn) {
  const current = providerById(providerId) || PROVIDERS[0];
  const opts = PROVIDERS.map((p) =>
    `<option value="${p.id}"${p.id === current.id ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('');

  // The model field is a dropdown once the provider has told us what it has,
  // and a text box before that. Nobody should have to go and look up an exact
  // model id, and a hard-coded default is worse than none: model ids are
  // retired without notice, and the failure lands on a name the user never
  // chose.
  const modelField = (models && models.length)
    ? `<select id="write-model" class="setup-select">${
        models.map((m) => `<option value="${escapeHtml(m)}"${m === cfg.model ? ' selected' : ''}>${escapeHtml(m)}</option>`).join('')
      }</select>`
    : `<input type="text" id="write-model" class="setup-input" value="${escapeHtml(cfg.model || '')}" placeholder="press Load models">`;

  return `
    <details id="guide-provider" class="guide-provider${configured ? '' : ' guide-provider-unset'}">
      <summary>${configured ? `Provider: ${escapeHtml(cfg.model)}` : 'Set your API key to talk to the agent'}</summary>

      <label class="setup-field" for="write-provider">
        <span class="setup-field-label">Provider</span>
        <select id="write-provider" class="setup-select" data-action="pick-provider">${opts}</select>
      </label>

      ${current.note ? `<p class="muted-note">${escapeHtml(current.note)}</p>` : ''}

      ${current.id === 'custom' ? `
      <label class="setup-field" for="write-url">
        <span class="setup-field-label">Provider URL</span>
        <input type="text" id="write-url" class="setup-input" value="${escapeHtml(cfg.baseUrl || '')}" placeholder="https://…/v1">
      </label>` : `<input type="hidden" id="write-url" value="${escapeHtml(cfg.baseUrl || '')}">`}

      <label class="setup-field" for="write-key">
        <span class="setup-field-label">API key</span>
        <input type="password" id="write-key" class="setup-input" value="${escapeHtml(cfg.apiKey || '')}" placeholder="paste it here">
      </label>
      ${current.keyUrl ? `<p class="muted-note"><a href="${current.keyUrl}" target="_blank" rel="noopener">Get a key →</a></p>` : ''}

      <label class="setup-field" for="write-model">
        <span class="setup-field-label">Model</span>
        ${modelField}
      </label>

      ${supportsSearch(current.id) ? `
      <label class="guide-search">
        <input type="checkbox" id="guide-search"${searchOn ? ' checked' : ''}>
        <span>Search the live web</span>
      </label>
      <p class="muted-note">Costs a little extra per question, even on a free model. Off, the agent answers only from your pack.</p>
      ` : `<p class="muted-note">This provider cannot search the web. OpenRouter can.</p>`}

      <div class="guide-provider-actions">
        <button type="button" class="btn btn-secondary" data-action="load-models"${loading ? ' disabled' : ''}>${loading ? 'Loading…' : 'Load models'}</button>
        <button type="button" class="btn btn-secondary" data-action="save-agent-key">Save</button>
      </div>
      ${error ? `<p class="load-error">${escapeHtml(error)}</p>` : ''}
      <p class="muted-note">Kept in this browser, sent only to that provider. This app has no server, so there is nowhere else it could go.</p>
    </details>`;
}

function renderTurn(m) {
  const who = m.role === 'user' ? 'You' : 'Agent';
  return `<div class="guide-turn guide-${escapeHtml(m.role)}"><span class="guide-who">${who}</span>${asParagraphs(m.text)}</div>`;
}

// renderSidebarHTML(state) -> string.
// state: { pack, guide: { history, question, busy, error, opening }, agentConfigured }
export function renderSidebarHTML(state) {
  const s = state || {};
  const g = s.guide || {};
  const history = g.history || [];
  // The thinking row lives in the TRANSCRIPT, at the end, exactly where the
  // answer is about to appear — so the eye is already in the right place and
  // the wait reads as progress rather than as nothing happening. A disabled
  // button reading "…" was the only signal before, which is easy to miss and
  // no use at all to someone who looked away after pressing Enter.
  //
  // aria-live so it is announced rather than only shown, and the visible word
  // "Thinking" carries it for anyone who cannot see the dots animate.
  const thinking = g.busy
    ? '<div class="guide-turn guide-agent" aria-live="polite">'
      + '<span class="guide-who">Agent</span>'
      + '<p class="guide-thinking"><span class="guide-dots" aria-hidden="true"><i></i><i></i><i></i></span> Thinking&hellip;</p>'
      + '</div>'
    : '';

  const body = (history.length
    ? history.map(renderTurn).join('')
    : `<p class="guide-opening">${escapeHtml(g.opening || '')}</p>`) + thinking;

  return `
    <aside class="guide" aria-label="Campaign agent">
      <header class="guide-head">
        <h2>Agent</h2>
        ${s.agentConfigured ? '' : '<span class="guide-nokey">no API key</span>'}
        ${s.searchOn ? '<span class="guide-searching" title="Answers are searched against the live web">searching</span>' : ''}
      </header>

      <div class="guide-body">
        ${body}
        ${g.error ? `<p class="load-error">${escapeHtml(g.error)}</p>` : ''}
      </div>

      <form class="guide-ask">
        <input type="text" id="guide-question" class="setup-input" value="${escapeHtml(g.question || '')}"
          placeholder="${s.pack ? 'What should I do next?' : 'Ask me how to start'}"${g.busy ? ' disabled' : ''}>
        <button type="button" class="btn btn-secondary" data-action="guide-ask"${g.busy ? ' disabled' : ''}>${g.busy ? '…' : 'Ask'}</button>
      </form>
      ${renderProviderHTML(s.agentCfg || {}, s.agentConfigured, s.models, s.modelsLoading, s.modelsError, s.providerId, s.searchOn)}
    </aside>`;
}
