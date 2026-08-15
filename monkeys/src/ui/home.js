// home.js — the app shell: the opening screen (the three-door chooser), the
// pack loader, and the app-level router between the three doors. See
// design.md §6B and plan Task 5.
//
// Same split as today.js: every render*HTML function below is PURE — a
// string in, a string out, no DOM, no globals — so tests/render.mjs can
// exercise the chooser and the "needs a pack" prompts headlessly. mountApp()
// is the one place in this file that touches window/document, and it does
// so only inside function bodies (never at module load), matching src/fs.js's
// own house rule so this module still imports cleanly under plain Node.
//
// Door 1 (src/ui/setup.js, Task 7) needs no pack to work at all, so it is
// never a dead button — an unloaded pack just means every guided form
// starts from nothing. Unlike today.js/check.js, setup.js's own mountSetup
// is called directly here (see render(), below) rather than through a pure
// render*HTML() call inside view(): it owns many more fields than a single
// caret-preserving textarea, so it manages its own state and its own
// listeners inside its own #setup-mount container, only notifying this
// file's state.pack via a callback so Door 2/3 see work in progress
// immediately. Door 3 (src/ui/check.js, Task 6) needs a pack to lint
// anything — it shows the "needs a pack" prompt when none is loaded, and
// the real check-before-publish view, driven by state.checkDraft, once one
// is.

import { parsePack, serialise } from '../pack.js';
import {
  capabilities, packFromFileList, openDirectory, readPackFromDirectory, PACK_FILES,
} from '../fs.js';
import {
  storageAvailable, savePack, loadSavedPack, clearSavedPack, formatSavedAt,
} from '../storage.js';
import {
  renderLoaderControls, renderPackStatus, renderPersistenceNote,
  renderNeedsPackHTML, emptyLoadMessage, renderOnboardingHTML, renderPackToggleHTML,
  renderSampleBannerHTML,
} from './loader.js';
import { renderTodayHTML, TODAY_NEEDS_PACK_REASON } from './today.js';
import { renderCheckHTML, CHECK_NEEDS_PACK_REASON } from './check.js';
import { icon } from './icons.js';
import { activateStep } from './steps.js';
import { buildDraftPrompt, callProvider, loadAgentConfig, saveAgentConfig, listModels, providerById, providerFor, PROVIDERS, supportsSearch } from '../agent.js';
import { buildGuidePrompt, openingLine } from '../guide.js';
import { renderSidebarHTML, tickElapsed } from './sidebar.js';
import { evaluate } from '../stages.js';
import { mountSetup, renderKickoffCallout, appendBulletToFile } from './setup.js';
import { planImport, applyImport, toKitMarkdown } from '../sellkit.js';
import { readKitFile } from '../kitfile.js';
import { SAMPLE_PACK_FILES } from './sample-pack.js';
import { currentStep, STEPS } from './steps-model.js';
import { renderStepScreenHTML } from './step-view.js';

// Re-exported unchanged: the loader markup moved to ./loader.js so today.js
// and check.js can render it without importing this file (which imports
// them), but this remains its public address.
export { renderNeedsPackHTML };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// WHICH DOORS ARE OFFERED depends on what the pack already contains.
//
// REPORTED, after loading a complete pack: "There are four different buttons
// and none of them do anything I would expect." The chooser was a fixed list
// that never once read the pack sitting next to it. With a finished pack the
// FIRST card was "Start here", whose own body text offers to "interview you
// until you have one fact you can prove" — against a register holding seven,
// behind a button needing an API key that was not set. The one door that
// answers the question a person actually arrives with, "what do I do today",
// was third.
//
// A door that proposes work already finished is worse than a missing door: it
// makes the reader doubt the tool knows anything about their situation, and
// here the tool knew exactly — the sidebar beside it was correctly reporting
// the open stage and the closed gate at the same moment.
const DOORS = [
  // Kickoff is where someone with NOTHING starts, so it leads while that is
  // true and is dropped the moment it stops being true. See doorsFor().
  { id: 'kickoff', title: 'Start here', blurb: 'The agent interviews you' },
  // ⚠ The blurb names the Sell-Kit import ON PURPOSE. Once a pack exists the
  // home screen folds the onboarding routes away, so this door card is the
  // only visible route to importing a kit — and "Build your pack" gave a
  // person holding an Idea Forge Pro download no reason to open it.
  { id: 'setup', title: 'Set up my ground', blurb: 'Build your pack, or import a Sell-Kit' },
  { id: 'today', title: 'What do I do today', blurb: 'Stage, actions, blockers' },
  { id: 'check', title: 'Check before I publish', blurb: 'Lint a draft against truth.md' },
];

/** The first fact is what kickoff exists to get. Once one exists, it is done. */
export function hasFirstFact(pack) {
  return Boolean(pack?.truth?.cleared?.length);
}

/** The doors worth offering for this pack. */
export function doorsFor(pack) {
  return hasFirstFact(pack) ? DOORS.filter((d) => d.id !== 'kickoff') : DOORS;
}

/** Where a person should LAND, rather than what they should choose from.
 *
 *  A chooser is the right screen when the console cannot know what you need.
 *  Once a pack is loaded it does know: it has already computed the open stage
 *  and the condition closing the next gate. Landing on the chooser then asks
 *  the reader to guess which of four buttons leads to an answer the app is
 *  already holding. Land on the answer; "← All doors" is in the page header of
 *  every door, so nothing becomes unreachable.
 */
export function landingViewFor() {
  // ALWAYS the step screen, pack or no pack.
  //
  // This returned 'home' with no pack, so a first-time visitor got the old
  // chooser and never saw a single thing built for them. Reported, accurately,
  // as "I do not see how the monkey console has changed at all": the whole
  // redesign lived behind a pack they did not have.
  //
  // It was the wrong model as well as the wrong gate. Having no pack is not an
  // empty state needing a menu of ways to begin. It means step 1 is not done.
  // The pack is what the steps PRODUCE, not what you must bring to see them,
  // and currentStep(null) already returns step 1 without being asked to.
  return 'step';
}

/** For the visitor who ALREADY has files. One line, under the step.
 *
 *  This replaces the three-column chooser as the first thing anyone saw. Two
 *  of its three routes were ways to begin, which step 1 now is, and the third
 *  was a file picker for people who had files already. That third case is real
 *  and rare, so it gets a line rather than a third of the screen.
 */
function renderStartHereHTML(state) {
  return `
    <div class="step-have-pack">
      <p class="step-sample">
        <button type="button" class="btn btn-link" data-action="load-sample">See a finished example</button>
        for a made-up product, so you can look around before starting.
      </p>
      <details class="loader-bar loader-bar-folded">
        <summary>Already have a <code>.monkeys/</code> folder?<span class="loader-more">Load it</span></summary>
        ${renderLoaderControls(state.caps || capabilities())}
      </details>
    </div>`;
}

// ---------------------------------------------------------------------------
// The chooser — the opening screen. Pure function of the app state
// {pack, caps, loadError, skippedNote, emptyLoadNote, packSource, savedAt,
// persistenceOff, clearedNote}. A missing `caps` is tolerated (it falls back
// to a live capability check) rather than thrown on: a blank screen is never
// an acceptable answer to a caller's omission.
//
// Two states, never both (FIX 3): with no pack, the onboarding routes are
// the whole screen and no door renders at all — only Door 1 (setup) does
// anything without a pack, and "Set up my ground" is already one of the
// routes, so door markup here was three blocks buying one usable button.
// With a pack loaded, the doors-grid is primary and the routes fold behind
// renderPackToggleHTML()'s collapsed "What is a pack?" disclosure.
// ---------------------------------------------------------------------------

export function renderChooserHTML(state) {
  const s = state || {};
  const hasPack = !!s.pack;
  const doorCards = doorsFor(s.pack).map((d) => `
    <button type="button" class="door-card" data-action="navigate" data-door="${d.id}">
      <span class="door-title">${icon(d.id)}${escapeHtml(d.title)}</span>
      <span class="door-blurb">${escapeHtml(d.blurb)}</span>
    </button>`).join('');

  return `
    <div class="chooser">
      <header class="chooser-header">
        <img class="mark" src="assets/mark-combined.png" alt="The Maverick's Monkeys mark">
        <div>
          <h1>Monkey Console</h1>
          <!-- Derived, never a literal. This line said "nine" from before voice.md
               joined the format until 2026-08-14, shipping a wrong count in the
               product whose whole thesis is not shipping wrong numbers.
               tests/run.mjs learned this lesson for the suite; the prose kept the bug. -->
          <p class="tagline">A reader for your <code>.monkeys/</code> pack — ${PACK_FILES.length} markdown files of what you can prove.</p>
        </div>
      </header>

      <div class="scroll-body">
        ${hasPack
          // MEASURED: with a pack loaded this bar was 190px at 1400x700 and
          // 260px at 1100x640 — "how to load a pack", above the doors, on the
          // screen of someone who has already loaded one. That is most of why
          // the hub scrolled. Folded behind its own status line: nothing is
          // removed, every control is one click away, and the doors get the
          // room. Open by default would defeat the point.
          ? `<details class="loader-bar loader-bar-folded">
              <summary>${renderPackStatus(s)}<span class="loader-more">Change pack</span></summary>
              ${renderLoaderControls(s.caps)}
              ${renderPersistenceNote(s)}
            </details>`
          : ''}
        ${renderSampleBannerHTML(s.packSource)}

        ${hasPack
          ? `${renderPackToggleHTML(s)}<nav class="doors-grid">${doorCards}</nav>`
          // ORDER, and why it is this way round. The loader used to sit above
          // this block: the first thing a new visitor met was "point at your
          // .monkeys/ folder" for a folder they did not have and had not yet
          // been told about. Everyone arriving without a pack needs the
          // explanation and the three routes; only a returning visitor with
          // files on disk needs the picker, so it now sits under them as a
          // quiet line rather than the headline action.
          // MEASURED, not reasoned about. Adding the explainer pushed this
          // screen 27px over at 1400x700 and 113px over at 1100x640
          // (tests/noscroll.mjs, 2026-08-14). Folding the loader behind its own
          // summary reclaims 89px of the 111 — the same treatment, and the same
          // reason, as the pack-loaded branch above: "how to load a pack" is not
          // the primary action for someone who does not have one yet.
          : `${renderOnboardingHTML(s)}
            ${/* OUTSIDE the fold, deliberately. renderPackStatus emits nothing
                  when there is no pack and no error, so it costs no height in
                  the normal empty state — but a load error or an empty-folder
                  note must never be hidden behind a collapsed summary the user
                  has no reason to open. Folding it was a regression this
                  suite caught. */''}
            ${renderPackStatus(s)}
            <details class="loader-bar loader-bar-folded">
              <summary>Already have a <code>.monkeys/</code> folder?<span class="loader-more">Load it</span></summary>
              ${renderLoaderControls(s.caps)}
              ${s.persistenceOff ? renderPersistenceNote(s) : ''}
            </details>`}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Door 1 placeholder — superseded by src/ui/setup.js's mountSetup now that
// Task 7 is built (see the 'setup' case in view() below). Left exported and
// untouched: it is still a pre-existing, independently-tested public
// function (tests/render.mjs), and removing it is out of this task's scope
// — same treatment renderCheckPlaceholderHTML already got after Task 6.
// ---------------------------------------------------------------------------

export function renderSetupPlaceholderHTML() {
  return `
    <div class="placeholder-body">
      <p>This door is being built next. It will walk you through truth.md, motte.md, bailey.md, recon.md, asymmetry.md and campaign.md one section at a time — nothing pre-filled, nothing invented.</p>
      <p>It will also offer a kickoff prompt you can hand to your own AI agent for the parts a browser cannot do, like reading a competitor's pricing page.</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Door 3 placeholder — superseded by src/ui/check.js's renderCheckHTML now
// that Task 6 is built (see the 'check' case in view() below). Left exported
// and untouched: it is still a pre-existing, independently-tested public
// function (tests/render.mjs), and removing it is out of this task's scope.
// ---------------------------------------------------------------------------

export function renderCheckPlaceholderHTML() {
  return `
    <div class="placeholder-body">
      <p>This door is being built next. It will take a pasted draft, check every claim against truth.md, and show a claim map, what was avoided and why, a fix plan, and a paste-ready block once the draft is clean.</p>
      <p>Your pack is loaded, so it will be ready to read from as soon as this door is built.</p>
    </div>`;
}

// A thin wrapper every sub-door shares: a back button plus a heading, so the
// door bodies above never have to know they are not the top-level page. The
// back button and heading are the only part that stays fixed (.door-page-head
// — see the no-scroll shell in style.css); the body scrolls on its own
// inside .scroll-body.
function pageShell(title, bodyHtml, { pinned = false, back = true } = {}) {
  // `pinned` turns .scroll-body into a flex column so a body can pin part of
  // itself and scroll the rest. Opt-in per door rather than global: every
  // other door wants the plain block behaviour, and height:100% inside a
  // padded block parent overflows by exactly that padding, which is what it
  // did (99px at every viewport) before this existed.
  return `
    <div class="door-page">
      <div class="door-page-head">
        ${back ? '<button type="button" class="btn btn-back" data-action="back">&larr; Back</button>' : ''}
        ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
      </div>
      <div class="scroll-body${pinned ? ' scroll-body-pinned' : ''}">
        ${bodyHtml}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// mountApp — the only DOM-touching part of this file. One delegated
// click/change listener on `root`, attached once; every render() call only
// replaces root.innerHTML, so the listener never needs re-attaching.
// ---------------------------------------------------------------------------

export function mountApp(root) {
  const state = {
    // view is SEEDED from landingViewFor, not hardcoded.
    //
    // It said 'home' here, and landingViewFor was only ever CALLED on the
    // restore and load paths. A first-time visitor has nothing to restore, so
    // nothing called it and this literal won: they got the old chooser while
    // every test asserting landingViewFor(null) === 'step' passed, because the
    // function was right and unreachable. Reported three times as "I do not see
    // how the console has changed at all", and it was not the cache.
    pack: null, view: landingViewFor(null), loadError: '', skippedNote: '', checkDraft: '',
    // The agent starts closed. It is optional and it cannot act without a key,
    // so it does not get to own the screen until it is asked for.
    agentOpen: false,
    // Which step the reader has clicked to. null means "whichever is next",
    // recomputed from the pack every render.
    stepId: null,
    // The drafting agent's own state. cfg is read from this browser once, on
    // boot; ask/busy/error live only as long as the page does.
    agent: { cfg: loadAgentConfig(), ask: '', busy: false, error: '' },
    // The sidebar agent. history is [{role, text}] oldest first; it is the
    // only conversation state in the app and it lives as long as the page.
    // startedAt is the wait counter's zero. Stamped once when the request
    // goes out and read by the sidebar's ticker, so the number on screen is
    // the real elapsed time rather than a count of how many times the app
    // happened to re-render.
    guide: { history: [], question: '', busy: false, error: '', opening: '', mode: '', startedAt: 0 },
    // The provider's own model list, fetched on request. Empty until then,
    // which is what keeps the model field a text box rather than an empty
    // dropdown offering nothing.
    models: [], modelsLoading: false, modelsError: '',
    // Which provider is SELECTED. Explicit, because inferring it from the
    // saved URL meant choosing "Something else" resolved straight back to
    // whatever the URL still said. Guessed once on boot from a saved config,
    // then owned by the picker. A fresh install starts on the first entry,
    // which is the one that works from a browser.
    providerId: '',
    // Search is OFF by default and deliberately so: it costs extra on every
    // question, including on a free model, and a cost the founder did not
    // choose is worse than a capability they had to switch on.
    searchOn: false,
    emptyLoadNote: '', packSource: '', savedAt: '', clearedNote: '',
    // The Sell-Kit drop. kitError is what went wrong in words a human can act
    // on; kitNote says which of Idea Forge Pro's three files we read it as, so
    // an import is never silent about what it took.
    kitBusy: false, kitError: '', kitNote: '', kitResult: null,
    persistenceOff: !storageAvailable(),
  };

  // Restore whatever this browser was holding, before the first paint. A
  // corrupt or absent value simply yields null — see storage.js rule 2.
  const restored = loadSavedPack();
  if (restored) {
    state.pack = parsePack(restored.files);
    state.packSource = 'restored';
    state.savedAt = formatSavedAt(restored.savedAt);
    // Land on the answer, not the chooser. See landingViewFor().
    state.view = landingViewFor(state.pack);
  }

  // Called after every change to state.pack. Best effort by definition: a
  // browser that refuses the write flips the console to "persistence is off"
  // and everything else keeps working. This writes NO file on disk — saving
  // to the user's folder stays the explicit, manual act it always was.
  function persist() {
    if (state.persistenceOff) return;
    if (!state.pack) return;
    const result = savePack(serialise(state.pack));
    if (result.ok) {
      state.savedAt = formatSavedAt(result.savedAt);
    } else {
      state.persistenceOff = true;
    }
  }

  function skippedMessage(skipped) {
    if (!skipped || !skipped.length) return '';
    return `${skipped.length} file${skipped.length === 1 ? '' : 's'} in that selection ${skipped.length === 1 ? 'is' : 'are'} not part of the pack format and ${skipped.length === 1 ? 'was' : 'were'} left out: ${skipped.join(', ')}`;
  }

  function view() {
    const caps = capabilities();
    switch (state.view) {
      case 'step': {
        // The console's real screen: the first unfinished step, alone. Which
        // step is NOT stored — it is computed from the pack every render, so
        // it cannot disagree with the files, and editing a file elsewhere
        // moves you without anything needing to be told.
        const step = state.stepId
          ? (STEPS.find((x) => x.id === state.stepId) || currentStep(state.pack))
          : currentStep(state.pack);
        return pageShell('',
          // The persistence warning shows with or without a pack: it matters
          // MOST before any work exists, because it is the warning that the
          // next refresh will lose whatever you are about to type.
          // The sample banner travels too. It only ever rendered in the
          // chooser, so loading the example on the step screen showed
          // somebody else's product with nothing saying it was not theirs.
          `${renderSampleBannerHTML(state.packSource)}${renderPackStatus(state)}${(state.pack || state.persistenceOff) ? renderPersistenceNote(state) : ''}`
          + renderStepScreenHTML(state.pack, step, { agentOpen: state.agentOpen, caps })
          + (state.pack ? '' : renderStartHereHTML(state)),
        { pinned: true, back: false });
      }
      case 'today':
        // The pack's identity travels with the landing screen. Loading now
        // lands here rather than on the chooser, and the chooser was the only
        // place that said WHICH pack is open, how complete it is, when it was
        // saved and how to clear it. Landing somewhere that does not say those
        // things would trade one confusion for another. renderPackStatus emits
        // nothing when there is nothing to report, so it costs no height on a
        // door opened with no pack.
        return pageShell('What do I do today', state.pack
          ? `${renderPackStatus(state)}${renderPersistenceNote(state)}${renderTodayHTML(state.pack)}`
          : renderNeedsPackHTML('This door', TODAY_NEEDS_PACK_REASON, caps, state.emptyLoadNote, state),
        { pinned: Boolean(state.pack) });
      case 'kickoff':
        return pageShell('Start here', renderKickoffCallout(state.pack ? state.pack.raw : {}));
      case 'setup':
        return pageShell('Set up my ground', '<div id="setup-mount"></div>');
      case 'check':
        return pageShell('Check before I publish', state.pack
          ? renderCheckHTML(state.pack, state.checkDraft, state.agent)
          : renderNeedsPackHTML('This door', CHECK_NEEDS_PACK_REASON, caps, state.emptyLoadNote, state));
      default:
        return renderChooserHTML({ ...state, caps });
    }
  }

  // Called by setup.js after every successful Add/Save, so Door 2/3 read the
  // work in progress immediately without the user having to re-load a file.
  // Never triggers a render() itself — setup.js already repaints its own
  // #setup-mount container; re-rendering the whole shell here would tear
  // that container down and remount it, for no benefit.
  function handleSetupPackChange(newPack) {
    state.pack = newPack;
    if (!state.packSource) state.packSource = 'setup';
    state.emptyLoadNote = '';
    persist();
  }

  // One reader for the provider box, because the URL field is a visible
  // input for a custom endpoint and a hidden one for a preset — reading it
  // in two places is how the two get out of step.
  function readProviderBox() {
    const val = (sel) => (root.querySelector(sel) || {}).value || '';
    return {
      baseUrl: val('#write-url'),
      model: val('#write-model'),
      apiKey: val('#write-key'),
    };
  }

  // Ask the provider what models it has. This is what turns "type an exact
  // id you had to go and look up" into a dropdown, and it is why no model id
  // is hard-coded anywhere: ids are retired without notice.
  async function loadModelList() {
    state.agent.cfg = readProviderBox();
    state.modelsLoading = true;
    state.modelsError = '';
    render();
    try {
      state.models = await listModels(state.agent.cfg);
      if (!state.agent.cfg.model && state.models.length) {
        state.agent.cfg.model = state.models[0];
      }
      saveAgentConfig(state.agent.cfg);
    } catch (err) {
      state.modelsError = err && err.message ? err.message : 'Could not list models.';
    }
    state.modelsLoading = false;
    render();
  }

  // Write the import. Every line goes through appendBulletToFile, which is
  // the pack's only writer — so the never-destroy-existing-data rule holds
  // here exactly as it does for a hand-typed entry, and an import lands
  // alongside existing work rather than over it.
  // Pressing "Import into my pack" used to change nothing you could see: the
  // same grading table, the same button, the same screen. The claims DID land
  // in truth.md and recon.md, but nothing said so, so the only way to find out
  // was to press it again — which appended every claim a SECOND time. Both
  // halves of that are fixed here: it reports what it wrote, and a line
  // already in a file is never written twice.
  function applySellKit() {
    if (!state.pack) return;
    const files = { ...state.pack.raw };
    const plan = planImport(files['sell-kit.md']);
    if (plan.blocked) return;
    const today = new Date().toISOString().slice(0, 10);

    // ⛔ COMPARE WITHOUT THE DATE STAMP. Every written line ends in
    // " — imported: <today>", so comparing whole lines would dedupe a second
    // press today and duplicate the same claim tomorrow. The claim is the
    // part in front of the stamp.
    const body = (line) => String(line).split(' — imported:')[0].trim();

    const touched = new Map();
    let already = 0;
    for (const w of applyImport(plan, today)) {
      const existing = files[w.file] || '';
      if (existing.split('\n').some((l) => body(l.replace(/^-\s*/, '')) === body(w.line))) {
        already += 1;
        continue;
      }
      files[w.file] = appendBulletToFile(files[w.file], w.heading, w.line);
      touched.set(w.file, (touched.get(w.file) || 0) + 1);
    }

    // What landed, in the words of the files it landed in. Read by the panel
    // so the button has a visible consequence.
    state.kitResult = {
      wrote: [...touched.entries()].map(([file, n]) => `${n} into ${file}`),
      already,
      when: today,
    };
    state.pack = parsePack(files);
    state.packSource = 'setup';
    // persist() is the one saver: it serialises, handles a storage refusal by
    // flipping persistenceOff, and updates the "saved at" line. Calling
    // savePack directly skipped all three.
    persist();
    render();
  }

  // Kickoff, as a conversation rather than a prompt to paste somewhere else.
  // Puts the agent in interview mode and asks the first question on the
  // founder's behalf, because "press a button and it starts talking to you"
  // is a lower bar than "work out what to type".
  function startKickoff() {
    state.guide.mode = 'kickoff';
    state.guide.error = '';
    state.guide.question = 'I am starting from nothing. Interview me.';
    askGuide();
  }

  // Ask the sidebar agent. The stage is computed here and handed over, never
  // derived by the model: a model asked to assess progress grades generously,
  // and the stage is the one number the founder acts on.
  async function askGuide() {
    const q = state.guide.question.trim();
    // Kickoff ends when it has succeeded: once a pack exists the interview
    // brief is no longer what the founder needs, and leaving it on would have
    // the agent re-interviewing someone who has already answered.
    if (state.pack && state.guide.mode === 'kickoff') state.guide.mode = '';
    // AND IT BEGINS BY BEING ASKED. With no pack the ask box says "Ask me how
    // to start" — and answering that invitation used to get "Load a pack
    // first", which is the agent refusing the exact question it just offered
    // to take. Reported as "the agent doesn't answer, instead I get a message
    // to set up the tool". Someone with no pack is precisely who kickoff is
    // for: it interviews them until there is one.
    if (!state.pack && !state.guide.mode) state.guide.mode = 'kickoff';
    const canSearch = state.searchOn && supportsSearch(state.providerId);
    const prompt = buildGuidePrompt(state.pack, evaluate(state.pack || {}), state.guide.history, q, state.guide.mode, canSearch);
    if (prompt.blocked) { state.guide.error = prompt.blocked; render(); return; }
    state.guide.history.push({ role: 'user', text: q });
    state.guide.question = '';
    state.guide.busy = true;
    state.guide.startedAt = Date.now();
    state.guide.error = '';
    render();
    try {
      const reply = await callProvider(state.agent.cfg, prompt, undefined, { search: canSearch });
      state.guide.history.push({ role: 'agent', text: reply });
    } catch (err) {
      state.guide.error = err && err.message ? err.message : 'The request failed.';
    }
    state.guide.busy = false;
    state.guide.startedAt = 0;
    render();
  }

  // Ask the agent for a draft. buildDraftPrompt decides whether the pack can
  // support one at all — refusing here costs nothing, where asking a model to
  // write from an empty register costs a call and returns something invented.
  // Whatever comes back lands in state.checkDraft, which is the same box a
  // pasted draft goes into, so the linter reads it on the next render. A
  // generated draft gets no shortcut past the check.
  async function writeDraft() {
    const prompt = buildDraftPrompt(state.pack, state.agent.ask);
    if (prompt.blocked) { state.agent.error = prompt.blocked; render(); return; }
    state.agent.busy = true;
    state.agent.error = '';
    render();
    try {
      state.checkDraft = await callProvider(state.agent.cfg, prompt);
    } catch (err) {
      state.agent.error = err && err.message ? err.message : 'The request failed.';
    }
    state.agent.busy = false;
    render();
  }

  // Seeded once. A saved config from before presets existed still lands on
  // the right entry; an empty one lands on the first, which is the provider
  // that actually works from a browser.
  if (!state.providerId) {
    state.providerId = state.agent.cfg.baseUrl ? providerFor(state.agent.cfg.baseUrl).id : PROVIDERS[0].id;
    if (!state.agent.cfg.baseUrl) state.agent.cfg.baseUrl = PROVIDERS[0].baseUrl;
  }

  // A RE-RENDER MUST NOT COST YOU YOUR PLACE.
  //
  // render() replaces root.innerHTML wholesale, which is what makes the
  // rendering functions pure and testable — but every replacement threw away
  // three things the browser was holding for the user: which <details> were
  // open, what had focus, and where the caret was. Choosing a provider closed
  // the API-key panel the user was standing in, so setting up a key meant
  // clicking back in after every single field. Reported as "the entire page
  // refreshes and I have to click back in to settings", and it made the agent
  // look broken: picking a provider clears the model by design, and the panel
  // where you would choose a new one had just shut.
  //
  // Door 3's textarea already restored its own caret by hand. This does it for
  // everything, so the next field that needs it does not have to remember.
  // Guarded, and not only for the tests: this is a convenience layer over the
  // browser's own bookkeeping, and losing a caret is a papercut where a thrown
  // exception is a blank screen. Anything absent means "nothing to restore",
  // never "stop rendering" — the same no-blank-screen rule the renderers hold.
  function captureUiState() {
    if (!root || typeof root.querySelectorAll !== 'function') return null;
    const active = root.ownerDocument && root.ownerDocument.activeElement;
    const canSelect = active && typeof active.selectionStart === 'number';
    return {
      // Identify by id where there is one. The provider panel's CLASS changes
      // the moment a key is entered (guide-provider-unset -> guide-provider),
      // so a class-keyed restore would drop it open-state exactly at the step
      // where the user is mid-setup — the one moment it matters most.
      openDetails: [...root.querySelectorAll('details')]
        .filter((d) => d.open)
        .map((d) => (d.id ? `#${d.id}` : (d.className ? `.${d.className.trim().split(/\s+/)[0]}` : '')))
        .filter(Boolean),
      focusId: active && active.id ? active.id : '',
      selStart: canSelect ? active.selectionStart : null,
      selEnd: canSelect ? active.selectionEnd : null,
    };
  }

  function restoreUiState(before) {
    if (!before || typeof root.querySelector !== 'function') return;
    for (const sel of before.openDetails) {
      const d = root.querySelector(`details${sel}`) || root.querySelector(sel);
      if (d) d.open = true;
    }
    if (!before.focusId) return;
    const safeId = (typeof CSS !== 'undefined' && CSS.escape)
      ? CSS.escape(before.focusId) : before.focusId;
    const el = root.querySelector(`#${safeId}`);
    if (!el) return;
    el.focus();
    if (before.selStart !== null && typeof el.setSelectionRange === 'function') {
      try { el.setSelectionRange(before.selStart, before.selEnd); } catch { /* not a text field */ }
    }
  }

  // THE WAIT COUNTER'S HEARTBEAT, and the reason it is a timer rather than a
  // re-render: render() replaces root.innerHTML wholesale, so ticking the
  // clock through it would throw away focus and the caret once a second, for
  // the whole length of every wait. This touches one text node instead.
  //
  // One timer, ever. It is started when a counter appears and stopped the
  // moment tickElapsed reports none left, so a finished answer never leaves
  // an interval running behind it.
  let waitTimer = null;
  function syncWaitCounter() {
    const stop = () => {
      if (waitTimer !== null && typeof clearInterval === 'function') clearInterval(waitTimer);
      waitTimer = null;
    };
    if (!tickElapsed(root)) { stop(); return; }
    if (waitTimer !== null || typeof setInterval !== 'function') return;
    waitTimer = setInterval(() => { if (!tickElapsed(root)) stop(); }, 1000);
  }

  function render() {
    // Main pane and sidebar, side by side. The sidebar is on every screen:
    // the agent's whole job is knowing what to do next, which is a question
    // you have from inside a door as often as from the hub.
    const uiBefore = captureUiState();
    state.guide.opening = openingLine(state.pack, evaluate(state.pack || {}));
    const cfg = state.agent.cfg;
    // AGENT OPEN/CLOSED. It was a permanent 280px minimum rail — at an 800px
    // window, 35% of the screen, holding a 175px input and a fixed 67px
    // button, for a panel that can do nothing at all without a key. Closed it
    // is a single line at the foot; open it takes the screen, which is the
    // only honest shape for a conversation.
    root.innerHTML = `<div class="shell${state.agentOpen ? ' shell-agent-open' : ''}"><div class="shell-main">${view()}</div>`
      + ((state.view === 'step' && !state.agentOpen) ? '' : renderSidebarHTML({
        pack: state.pack,
        guide: state.guide,
        agentCfg: cfg,
        providerId: state.providerId,
        searchOn: state.searchOn && supportsSearch(state.providerId),
        models: state.models,
        modelsLoading: state.modelsLoading,
        modelsError: state.modelsError,
        agentConfigured: Boolean(cfg.baseUrl && cfg.apiKey && cfg.model),
        agentOpen: state.agentOpen,
      }))
      + '</div>';
    if (state.view === 'setup') {
      const mount = root.querySelector('#setup-mount');
      if (mount) mountSetup(mount, state.pack, handleSetupPackChange, state.openPanel, state);
    }
    restoreUiState(uiBefore);
    syncWaitCounter();
  }

  // A selection with none of our nine names in it is NOT a loaded pack —
  // "Pack loaded — 0 of 9 files present" said two contradictory things at
  // once and taught a first-time founder that they were at stage zero rather
  // than that they had picked the wrong folder. Anything already in memory is
  // left exactly as it was; an empty selection replaces nothing.
  function applyLoad(files, skipped) {
    if (Object.keys(files).length === 0) {
      state.emptyLoadNote = emptyLoadMessage();
      state.skippedNote = skippedMessage(skipped);
      return;
    }
    state.emptyLoadNote = '';
    state.pack = parsePack(files);
    state.packSource = 'loaded';
    state.clearedNote = '';
    state.skippedNote = skippedMessage(skipped);
    // The point of loading a pack is to find out what to do with it.
    state.view = landingViewFor(state.pack);
    persist();
  }

  async function doOpenFolder() {
    state.loadError = '';
    try {
      const handle = await openDirectory();
      const { files, skipped } = await readPackFromDirectory(handle);
      applyLoad(files, skipped);
    } catch (err) {
      state.loadError = err.message || 'Could not open that folder.';
    }
    render();
  }

  async function doFileInputChange(fileList) {
    state.loadError = '';
    try {
      const { files, skipped } = await packFromFileList(fileList);
      applyLoad(files, skipped);
    } catch (err) {
      state.loadError = err.message || 'Could not read those files.';
    }
    render();
  }

  // Taking an Idea Forge Pro export. The whole route from a downloaded file
  // to a pack the console can work on.
  //
  // ⛔ IT NEVER REPLACES A PACK. The kit lands as sell-kit.md and nothing
  // else is touched, so dropping a kit onto work already in progress cannot
  // erase any of it. The kit's claims only move into truth.md / recon.md /
  // motte.md when the human presses the confirm button, after reading the
  // grading table — importing a file and accepting its claims stay two
  // separate acts, which is the entire point of the grading.
  // Takes a File, never a FileList — see the change listener for why that
  // distinction is the whole bug this function once had.
  async function doKitFile(file) {
    if (!file) return;
    state.kitError = '';
    state.kitNote = '';
    state.kitBusy = true;
    render();
    try {
      const text = await file.text();
      const read = readKitFile(file.name, text);
      if (read.blocked) {
        state.kitError = read.blocked;
      } else {
        // A forge.json becomes the markdown a sell-kit.md already is, so the
        // pack holds one kind of file whichever one was dropped.
        const markdown = read.kind === 'forge-json'
          ? toKitMarkdown(read.fields, file.name)
          : text;
        const files = { ...(state.pack ? state.pack.raw : {}) };
        files['sell-kit.md'] = markdown;
        state.pack = parsePack(files);
        state.packSource = state.packSource || 'setup';
        state.kitNote = read.note;
        // A new kit means a new plan to review, so the previous import's
        // receipt must go — otherwise dropping a second file shows the first
        // one's result and no table.
        state.kitResult = null;
        // ⛔ GO TO THE REVIEW. Without this the import "did nothing": storing
        // the kit gave the app a pack, so the home screen swapped the
        // onboarding routes for the door cards, and every word about the kit
        // — the note, the grading table, the button that actually imports it
        // — was left inside the collapsed "What is a pack?" disclosure or two
        // clicks deep in Door 2. A founder picked a file, watched the screen
        // change into something unrelated, and was right to call it broken.
        //
        // Reading a kit and accepting its claims stay two separate acts; this
        // only carries you to the screen where you make the second one.
        state.view = 'setup';
        state.openPanel = 'sell-kit';
        persist();
      }
    } catch (err) {
      state.kitError = err.message || 'Could not read that file.';
    }
    state.kitBusy = false;
    render();
  }

  // The one click that erases the browser-held copy. It removes this
  // console's own localStorage key and the pack in memory with it — leaving
  // one behind to be re-saved a second later would make the button a lie.
  // Nothing on disk is touched, and the note says so.
  function doClearSaved() {
    clearSavedPack();
    state.pack = null;
    state.packSource = '';
    state.savedAt = '';
    state.emptyLoadNote = '';
    state.checkDraft = '';
    state.clearedNote = 'Erased from this browser. Files already on your disk are untouched.';
    render();
  }

  // The "just want to look around?" answer (see loader.js's renderSampleLoaderHTML).
  // Guarded by state.pack even though the button that triggers this only ever
  // renders in the empty-state to begin with — belt-and-braces against a
  // stale click reaching here after something else has since loaded. Never
  // persisted (no persist() call) and never restored on boot: an example is a
  // same-session look-around, not something a refresh should bring back as if
  // it were real data — see "the sample is never loaded automatically" in
  // tests/render.mjs.
  function doLoadSample() {
    if (state.pack) return;
    state.pack = parsePack(SAMPLE_PACK_FILES);
    state.packSource = 'sample';
    state.loadError = '';
    state.emptyLoadNote = '';
    state.clearedNote = '';
    render();
  }

  // The one click loader.js's sample banner promises. Nothing was ever
  // persisted for the sample, so there is nothing on disk or in this
  // browser's storage to touch — this only ever clears in-memory state.
  function doClearSample() {
    state.pack = null;
    state.packSource = '';
    state.checkDraft = '';
    render();
  }

  async function doCopyPasteBlock() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(state.checkDraft);
      }
    } catch {
      // Clipboard permission denied — the paste block is still on screen and
      // selectable by hand. Not fatal, same as Door 1's Copy prompt.
    }
  }

  /** Write one step's answers into the pack. The thing every screen before
   *  this told you to do and gave you no way to do.
   *
   *  Refuses on an empty field rather than writing a half line: a malformed
   *  entry is worse than a missing one, because pack.js drops it and the
   *  reader is left believing they recorded something.
   */
  function saveStepEntry(stepId) {
    const step = STEPS.find((x) => x.id === stepId);
    const form = root.querySelector(`[data-step-form="${stepId}"]`);
    if (!step || !step.form || !form) return;
    const note = form.querySelector('[data-sf-note]');
    const values = {};
    for (const f of step.form.fields) {
      const input = form.querySelector(`[data-field="${f.key}"]`);
      values[f.key] = (input?.value || '').trim();
    }
    const missing = step.form.fields.filter((f) => !values[f.key]);
    if (missing.length) {
      if (note) {
        note.textContent = `Fill in ${missing.map((f) => f.label.toLowerCase()).join(' and ')} first.`;
        note.classList.remove('is-saved');
      }
      return;
    }
    if (!step.form.compose || !step.form.heading) {
      if (note) {
        note.textContent = 'This step is recorded by hand for now. Open the file and add it.';
        note.classList.remove('is-saved');
      }
      return;
    }
    const files = { ...(state.pack ? state.pack.raw : {}) };
    files[step.writesTo] = appendBulletToFile(files[step.writesTo] || '', step.form.heading, step.form.compose(values));
    state.pack = parsePack(files);
    state.packSource = state.packSource === 'sample' ? 'setup' : (state.packSource || 'setup');
    // STAY ON THIS STEP. Saving marks it finished, so the "first unfinished
    // step" rule would otherwise throw the reader forward the instant they
    // recorded anything — they never see the entry land, and adding a SECOND
    // fact means navigating back to a step the console says is done. Moving on
    // is the reader's decision, not the pack's.
    state.stepId = stepId;
    persist();
    render();
    const after = root.querySelector(`[data-step-form="${stepId}"] [data-sf-note]`);
    if (after) { after.textContent = 'Saved.'; after.classList.add('is-saved'); }
  }

  root.addEventListener('click', (event) => {
    // Step strips first, and NOT via data-action: they are pure view state,
    // so routing them through the action switch would put a case in it that
    // does not change any application state.
    //
    // This is the handler whose absence made Door 4's strip dead in the
    // running app. setup.js wires its own inside mountSetup; check.js and
    // today.js are rendered straight into this shell and had nobody.
    const step = event.target.closest('[data-setup-step], [data-setup-step-go]');
    if (step) {
      activateStep(root, step.dataset.setupStep || step.dataset.setupStepGo);
      return;
    }

    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'pick-provider') return; // handled on change, below
    if (action === 'load-models') {
      loadModelList();
      return;
    }
    if (action === 'apply-import') {
      applySellKit();
      return;
    }
    if (action === 'copy-kickoff') {
      const box = root.querySelector('.setup-kickoff-prompt');
      if (box) {
        box.select();
        navigator.clipboard?.writeText(box.value).catch(() => {});
      }
      return;
    }
    if (action === 'start-kickoff') {
      startKickoff();
      return;
    }
    if (action === 'guide-ask') {
      const box = root.querySelector('#guide-question');
      if (box) state.guide.question = box.value;
      askGuide();
      return;
    }
    if (action === 'write-draft') {
      writeDraft();
      return;
    }
    if (action === 'save-agent-key') {
      state.agent.cfg = readProviderBox();
      saveAgentConfig(state.agent.cfg);
      state.agent.error = '';
      render();
      return;
    }
    if (action === 'navigate') {
      state.view = el.dataset.door;
      // Optional: which panel of that door to open on. Two of the three
      // "how to get a pack" routes used to land on the identical screen
      // with no way to tell them apart; this is what makes them different
      // places.
      state.openPanel = el.dataset.panel || '';
      state.loadError = '';
      render();
    } else if (action === 'save-step') {
      saveStepEntry(el.dataset.step);
    } else if (action === 'go-step') {
      state.stepId = el.dataset.step || null;
      state.view = 'step';
      render();
    } else if (action === 'toggle-agent') {
      state.agentOpen = !state.agentOpen;
      render();
    } else if (action === 'back') {
      state.view = 'home';
      state.loadError = '';
      state.clearedNote = '';
      render();
    } else if (action === 'open-folder') {
      doOpenFolder();
    } else if (action === 'choose-files') {
      const input = root.querySelector('#file-input');
      if (input) input.click();
    } else if (action === 'see-truth') {
      state.openPanel = 'truth.md';
      render();
      // ⛔ AND OPEN THE STEP THE CLAIMS ARE ON. The truth panel renders three
      // steps and shows the FIRST, which is the "Add a claim" form. Landing
      // there after an import means being handed an empty form instead of the
      // claims you just imported — the same "it did nothing" the receipt above
      // exists to answer. Must run AFTER render(): mountSetup rebuilds the
      // panel and resets the strip to step one.
      activateStep(root, 'truth:cleared');
    } else if (action === 'choose-kit') {
      const input = root.querySelector('#kit-input');
      if (input) input.click();
    } else if (action === 'clear-saved') {
      doClearSaved();
    } else if (action === 'load-sample') {
      doLoadSample();
    } else if (action === 'clear-sample') {
      doClearSample();
    } else if (action === 'copy-paste-block') {
      doCopyPasteBlock();
    }
  });

  root.addEventListener('change', (event) => {
    if (!event.target) return;
    if (event.target.id === 'file-input') {
      doFileInputChange(event.target.files);
    } else if (event.target.id === 'kit-input') {
      // 🚨 TAKE THE FILE OUT FIRST. `input.files` is a LIVE FileList, and
      // setting `input.value = ''` EMPTIES IT — so holding a reference to the
      // list and clearing the input afterwards handed doKitFile an empty list
      // and it returned silently. Picking a file did nothing at all, with no
      // error anywhere: reported as "it's just a dead interface", and it was.
      //
      // ⛔ Never pass the FileList here. The File object survives the clear;
      // the list does not.
      const file = event.target.files && event.target.files[0];
      // Cleared so choosing the SAME file again still fires a change event.
      // Without this, re-picking the file you just fixed does nothing.
      event.target.value = '';
      doKitFile(file);
    }
  });

  // ENTER SENDS. A chat box where Enter does nothing and you must aim for a
  // button is a chat box that does not work — and this one is used by someone
  // who cannot always look at the screen while typing, so hunting for a target
  // costs more here than it would elsewhere. Shift+Enter still makes a newline,
  // which is the convention every other chat box has taught.
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const el = event.target;
    if (!el || !el.id) return;
    if (el.id === 'guide-question') {
      event.preventDefault();
      state.guide.question = el.value;
      askGuide();
      return;
    }
    if (el.id === 'write-ask') {
      event.preventDefault();
      state.agent.ask = el.value;
      writeDraft();
    }
  });

  // Door 3's draft textarea (src/ui/check.js) re-lints on every keystroke.
  // render() replaces root.innerHTML wholesale (this file's one render
  // path — see the header), which would otherwise reset the caret to the
  // end on every character typed; the caret position is saved and restored
  // around the re-render so a slow, two-finger typist never loses their
  // place mid-sentence.
  // The ask box updates state WITHOUT a re-render: repainting on every
  // keystroke is what the caret-restoring dance below exists to survive, and
  // this field needs no repaint at all.
  // Choosing a provider fills its URL and drops any model list belonging to
  // the previous one — offering another provider's models is worse than
  // offering none, because the failure arrives at the first real call.
  root.addEventListener('change', (event) => {
    const el = event.target;
    if (el && el.id === 'guide-search') {
      state.searchOn = el.checked;
      render();
      return;
    }
    if (!el || el.id !== 'write-provider') return;
    const preset = providerById(el.value);
    if (!preset) return;
    const box = readProviderBox();
    state.providerId = preset.id;
    // A preset supplies its own URL; "Something else" keeps whatever is in
    // the box so a half-typed custom endpoint is not wiped by a stray change.
    state.agent.cfg = {
      ...box,
      baseUrl: preset.id === 'custom' ? box.baseUrl : preset.baseUrl,
      model: '',
    };
    state.models = [];
    state.modelsError = '';
    // A provider that cannot search must not leave the toggle reading "on":
    // the label would be a claim the request cannot honour.
    if (!supportsSearch(preset.id)) state.searchOn = false;
    render();
  });

  root.addEventListener('input', (event) => {
    if (event.target && event.target.id === 'write-ask') {
      state.agent.ask = event.target.value;
      return;
    }
    if (event.target && event.target.id === 'guide-question') {
      state.guide.question = event.target.value;
      return;
    }
    if (!(event.target && event.target.id === 'check-draft')) return;
    const el = event.target;
    state.checkDraft = el.value;
    const selStart = el.selectionStart;
    const selEnd = el.selectionEnd;
    render();
    const fresh = root.querySelector('#check-draft');
    if (fresh) {
      fresh.focus();
      fresh.setSelectionRange(selStart, selEnd);
    }
  });

  render();
}
