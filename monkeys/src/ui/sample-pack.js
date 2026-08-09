// sample-pack.js — the one-click "look around" example, wired to
// data-action="load-sample" in src/ui/home.js. See design.md's onboarding
// note and the console-onboarding brief: a first-time visitor facing an
// empty loader with no idea what a pack even looks like is the console's
// biggest usability failure, and a labelled example they can load and clear
// with one click each is the fix for "what if I just want to look around?".
//
// The content below is a plain copy of tests/pack-fixtures/mid/ — a
// deliberately fictional tea company ("Thistledown Tea") already used
// throughout this project's own test suite, so it carries no real product,
// person, or company. It is embedded as a JS string, the same reason
// tests/fixtures.mjs embeds the same fixture rather than fetching it: this
// console makes no network requests of any kind, not even to its own sibling
// files, so there is no fetch() path available here at all — see fs.js's own
// header on the console's two-tier, network-free design.
//
// Kept in sync BY HAND with tests/pack-fixtures/mid/*.md (same discipline as
// tests/fixtures.mjs's own header) — if one changes, update the other.
//
// NEVER loaded automatically. src/ui/home.js only reaches this module from
// one place: the explicit "Load a sample pack" click in the empty-state,
// never from mountApp's boot sequence and never merged into anything a real
// pack already holds — see doLoadSample()'s own guard in home.js.

export const SAMPLE_PACK_SOURCE = 'sample';

// A short, honest label for the fictional product this data describes, used
// wherever the console needs to say "this is an example", never "this is
// yours".
export const SAMPLE_PRODUCT_NAME = 'Thistledown Tea (a made-up tea company)';

export const SAMPLE_PACK_FILES = {
  'truth.md': `# Truth Register

Every public claim traces to a line under **Cleared**, or it does not ship.
Keep the format exactly — the gates read these headings.

## Cleared

- Thistledown Tea has shipped over 400 mail-order tea tins since opening in 2024 — source: internal fulfillment log, reviewed 2026-07-01
- Every blend is packed within 48 hours of a batch roast — source: packing floor SOP, v3

## Uncleared

- Thistledown Tea is the most flavorful loose-leaf brand in the region — reason: unverifiable superlative, no independent taste panel
- Customer retention after the first box exceeds 60% — reason: cohort not yet tracked past month two

## Canonical source

thistledowntea.example/about
`,
  'motte.md': `# Motte — what cannot be confiscated

## Held

- thistledowntea.example (the domain) — control: full — grows by: renewed annually, no dispute history
- the mailing list of past box subscribers — control: full — grows by: every checkout opts customers in with consent

## Wanted

- a self-hosted blend-recommendation quiz — keeps a subscriber's taste profile off any platform we don't own
`,
  'bailey.md': `# Bailey — rented ground

## Active

- a regional tea-and-coffee forum — account: u/thistledown_tea — joined: 2026-05-12 — standing: warming — links allowed: no
- a local makers' marketplace listing — account: Thistledown Tea (stall 14) — joined: 2026-06-01 — standing: established — links allowed: yes

## Excluded

- a general recipe-sharing subreddit — reason: audience skews savory cooking, not tea; poor fit for the pain we solve
`,
  'recon.md': `# Recon — who hurts, and where

## Pains

- "I can never tell if a tin is actually fresh until I open it and it's already stale" — heard in: regional tea-and-coffee forum, thread on shelf life — verified: yes
- "Subscription boxes always send me flavors I never asked for" — heard in: local makers' marketplace, conversation at the stall — verified: yes

## Rooms

- regional tea-and-coffee forum — audience: home brewers and small tea shops within a three-state radius — rules: no direct sales links outside the monthly vendor thread — entry cost: read the pinned etiquette post and introduce yourself before posting
- local makers' marketplace — audience: shoppers looking for small-batch goods at weekend markets — rules: booth fee required, no online-only sellers — entry cost: a paid stall booking
`,
  'asymmetry.md': `# Asymmetry — ground they cannot hold

## Incumbents

- a national grocery-aisle tea brand — revenue model: high-volume retail margin on shelf-stable blends — therefore cannot say: this tin was roasted in the last two weeks

## Our ground

- every tin is dated to the week it was roasted, and we can say so because we ship in small batches — because: their shelf-stable retail model requires long stability windows, ours doesn't
`,
  'voice.md': `# Voice

## Sounds like

- short sentences, no adjectives stacked up — because: our buyers read on a phone between jobs
- says the batch date out loud — because: it is the thing we can actually prove

## Never says

- artisanal — because: every tin on the shelf says it, so it says nothing
- revolutionary — because: it is tea

## Proof available

- a photograph of the roast log for any tin — shows: the date on the label matches the batch
`,
  'campaign.md': `# Campaign

**Stage:** 2 — First artifacts
**Opened:** 2026-07-20
**Delivery check:** confirmed 2026-07-20 — a test order placed through the storefront arrived within 4 days with the blend as described

## Why this stage
Two cleared facts exist in truth.md and the local makers' marketplace account reads standing: established, so stage 1's gate is open. motte.md's Held section still needs a non-empty entry paired with a passed delivery check before stage 3 can open, and that delivery check has now been confirmed once — the remaining gap is publishing something substantial on owned ground.

## Open now
- write a long-form tasting-notes page for the new autumn blend and publish it on thistledowntea.example — skill: raid-multiply — done when: the page is live on the owned domain
- cut the tasting-notes page into three shorter posts for the regional tea-and-coffee forum's monthly vendor thread — skill: raid-multiply — done when: three cuts exist, none yet posted

## Closed, and what opens it
- **Stage 3 — First links** — blocked by: no artifact has been published on owned ground yet
- **Stage 4 — Prune** — blocked by: numbers.md has only one dated row of kind motte, gate needs at least two

## Blocked on a human decision
- whether to raise the price of the starter tin from $14 to $16 — why it blocks: the tasting-notes page would need to state a live price — who: the founder

## Drift
- 2026-07-28 — first briefing on file; nothing to compare against yet
`,
  'numbers.md': `# Numbers

Written by whoever has the credentials. Never fetched by a skill.
An empty table is honest; an invented row is not.

| Date | Metric | Kind | Value | Source |
|---|---|---|---|---|
| 2026-07-22 | mailing list signups this week | motte | 9 | list provider dashboard |
`,
  'sell-kit.md': `# Sell-Kit — the founder's own pre-build test

Imported from: thistledown-tea-sell-kit.md — on: 2026-07-15
Nothing here was verified by this run. It is what the founder brought, recorded so it
is not re-decided from memory. An absent field is left out, never filled in.

- The ask: pre-order the autumn blend starter tin before it ships
- PASS if: at least 25 pre-orders are placed by the by-when date
- KILL if: fewer than 5 pre-orders are placed by the by-when date
- By when: 2026-09-01
- Commitment signal: a completed pre-order payment, not a waitlist signup
- What this test CAN prove: whether strangers will pay before the blend exists
- What this test CANNOT prove: whether they will reorder a second time
- Stop condition: fewer than 5 pre-orders after two full posting cycles in the regional forum
`,
  'scars.md': `# Scars — what we learned the hard way

| Incident | Damage | Rule |
|---|---|---|
| posted a discount code directly in the regional forum's general chat, not the monthly vendor thread | account flagged by a moderator, warned once | links or offers only go in the room's designated selling space, never general chat |
`,
  'briefings/2026-07-28.md': `# Briefing — 2026-07-28

**Stage (from campaign.md):** 2 — First artifacts

## Moved
first briefing — nothing to compare against yet

## Today
- write the long-form tasting-notes page for the autumn blend — skill: raid-multiply — done when: the page is live on the owned domain

## Blocked
whether to raise the starter tin price from $14 to $16 — the founder has not decided

## Rot
rot is clear
`,
};
