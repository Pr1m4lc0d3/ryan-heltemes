# Getting started

The console opens by asking you to point it at a `.monkeys/` folder. If you're new you don't have one, nothing on that screen says what it is, and the three buttons underneath don't say which one you're supposed to press. That's a failure of explanation, not a failure on your part, and this page is the missing explanation.

Read it once and the tool stops being a puzzle. It takes about five minutes.

## What a pack is

A pack is a folder called `.monkeys/` that sits at the root of whatever you're marketing. Inside it are ten plain markdown files. You can open any of them in Notepad.

The pack exists so an AI agent doing your marketing has somewhere to look instead of guessing. An agent with no pack invents a user count, assumes you own a mailing list you don't have, and suggests posting a link in a forum that will ban you for it. An agent with a pack knows what you can prove, what you own, and where you're allowed to speak.

| File | What it holds |
|---|---|
| `truth.md` | Every fact you can source. Nothing gets published unless it traces to a line in here. |
| `motte.md` | What you own outright, and what you want to own but don't yet. |
| `bailey.md` | Rooms you operate in but don't own, and the standing of your account in each. |
| `recon.md` | Your buyer's pains in their own words, and the rooms they're already in. |
| `asymmetry.md` | Ground a funded competitor can't take, and why it's safe for you to claim. |
| `campaign.md` | What's open to do now, and what's blocked on a decision only you can make. |
| `voice.md` | How you sound, so drafts don't come back in someone else's register. |
| `numbers.md` | Dated results, marked as owned or rented attention. |
| `scars.md` | Things that went wrong, recorded so they don't get re-proposed. |
| `sell-kit.md` | An optional import from Idea Forge Pro, if you have one. |

You fill in six of these by hand. `voice.md`, `numbers.md` and `scars.md` get written by the RAID and FORTRESS skills as you work, so leave them alone at the start.

## You don't fill in all ten

This is the part that makes the tool usable, and the console never says it.

The work runs in five stages, and each stage unlocks when one specific condition is true. You're not filling in a folder. You're opening the next gate.

| Stage | Name | What you do | It opens when |
|---|---|---|---|
| 0 | Foundation | Build the pack. Stand up things you own. Create accounts and leave them cold. No promotion at all. | You start here. No gate. |
| 1 | Standing | Enter rooms and be useful. **Post no links.** | `truth.md` has at least one entry under `## Cleared` |
| 2 | First artifacts | Publish something substantial on land you own. | One account in `bailey.md` reads `standing: warming` or `established` |
| 3 | First links | Share that artifact where it's genuinely on topic. | `motte.md` `## Held` isn't empty, and the delivery check passes |
| 4 | Prune | Kill what produced nothing. Repeat what worked. | `numbers.md` has two dated rows, at least one marked `motte` |

Look at gate 1. One sourced fact in `truth.md` and stage 1 opens. That's your first session's whole job. Not ten files, one line.

The order isn't a preference. There's no standing to earn before you have something you can safely say, and nothing to prune before you have a number to prune against.

## The three doors, in the order you walk them

**Door 1, "Set up my ground."** Where you build the pack. You need this on day one and probably day two. It's a set of guided forms, one file at a time, and it works with no pack loaded and nothing configured.

**Door 2, "What do I do today."** Reads your pack, works out which stage you're in, and lists what's open and what's blocked. Useless until the pack has something in it, which is why it's second.

**Door 3, "Check before I publish."** Paste a draft, and it fails on any claim that doesn't trace to `truth.md`. Use it every time you're about to post something.

There's a fourth thing on the screen, the dark Agent panel on the right. It only does something once you paste in an API key for your own model provider. Without a key it sits there. Skip it until the rest makes sense.

## What each field wants

The forms ask short questions and the answers come from your own head or your own records. None of it needs research.

**`truth.md` → Cleared.** One fact per line, each with a source. "Runs offline with no account" sourced to your own README is a valid line. "Trusted by thousands" is not, because you can't point at where that came from. If you can't source it, leave it out. That's the whole discipline, and it's what stops an agent inventing numbers on your behalf.

**`motte.md` → Held.** Things nobody can confiscate. Your domain, your email list, the product itself. **Wanted** is the same list for things you don't have yet, written down so nobody proposes building them twice.

**`bailey.md` → Active.** Rooms you post in but don't own. A subreddit, a Discord, a marketplace listing. Each line records the account and its standing: `cold` for new, `warming` once you've been useful there, `established` once you're known. You set this yourself, honestly. **Excluded** is for rooms you've ruled out, recorded so they stop coming back up.

**`recon.md` → Pains.** How your buyer describes the problem, in their words, not yours. Copy the phrasing out of a real forum post or a real email. A marketer's paraphrase is worth nothing here. **Rooms** is where those people already gather.

**`asymmetry.md` → Incumbents.** Describe competitors by category, never by name. "A subscription-funded incumbent," not a real company. This file is internal and never published. **Our ground** is what you can honestly say that they structurally can't.

**`campaign.md` → Open now.** Actions, each naming the skill that performs it. **Blocked on a human decision** is for anything waiting on a call only you can make, so an agent stops re-proposing it every session.

## What done looks like

There's no finished. There's a gate that's currently shut and the one thing that opens it.

After your first session, you want one line under `## Cleared` in `truth.md`. Door 2 will then tell you stage 1 is open and stop telling you to build the pack.

After that, be useful in one room until you can honestly write `standing: warming` next to that account, and stage 2 opens.

If Door 2 says you're in an earlier stage than you expected, the gate table above tells you exactly which condition is missing. It's never a judgment about your progress. It's one unmet line in one file.

## When it's wrong

The pack is ten text files you own. If the console computes a stage you disagree with, open the file it's reading and look. Every gate above is a condition you can check by eye in ten seconds, which is the point of keeping it in markdown rather than a database.
