# assets — drop files here

The page already expects the filenames below. **Drop a file in with the right
name and it appears on the site. No code change needed.**

Nothing here is required. Every slot renders as a labelled blank plate until
its file exists — the page uses CSS `background-image`, never `<img>`, so a
missing file never shows a broken-image icon. An empty site looks deliberate.

## What goes where

| Put the file here | Shows up as |
|---|---|
| `portrait/ryan.webp` | the portrait beside the headline (Fig. A) |
| `works/deliberon.webp` | the plate on the Deliberon entry |
| `works/madame-whisper.webp` | Madame Whisper |
| `works/stealthfyre.webp` | StealthFyre |
| `works/glowmark-path.webp` | Glowmark Path |
| `works/idea-forge-pro.webp` | Idea Forge Pro |
| `works/kisystem.webp` | KiSYSTEM |
| `works/black-timber.webp` | Black Timber Apothecary |
| `works/books.webp` | Books |
| `og/og-card.jpg` | the preview card when the link is shared |

Adding a project later? Add its entry in `index.html` and drop
`works/<its-slug>.webp` in here. Keep the slug and the filename identical.

## Format and size

- **`.webp`** for everything on the page. Real photographs, screenshots and
  product shots all behave well in it, and the files are a fraction of a PNG.
  If a file is already a `.jpg` or `.png`, either convert it or change the
  extension in `index.html` to match — the page does not guess.
- **Work plates** are cropped to **4:3**. Aim for about **1600 × 1200**.
- **The portrait plate** is **3:4**. Aim for about **1200 × 1600**.
- **The share card** must be **1200 × 630** and stay a `.jpg` — several
  platforms will not render a `.webp` preview.
- Anything wider than ~2400px is wasted bytes on a page this simple.

Plates crop from the centre. Leave a little air around the subject so nothing
important sits at the very edge.

## Swapping the portrait

Alternates already sit in `portrait/`: `alt-fence-v1.webp`, `alt-mountain.webp`,
`alt-cowboy.webp`, `alt-illustration.webp`. To use one, change the single
filename in the hero `<div class="plate plate--portrait">` in `index.html`.

### Generating a better likeness

Two things every generated portrait so far has got wrong: **the beard comes out
longer than it is, and the beard bead comes out far too big.**

Write the correction as a **positive description**, never as a negation. Image
models have no negative channel, so "no large beard bead" reliably *draws* a
large beard bead. Say what IS there:

> *a short, close-trimmed beard; hair loose, with a small plain cord*

rather than "not a long beard, no big bead."

## Full-size originals

Anything you drop here gets converted down for the web. **The untouched
originals live in `../../_source-assets/`** — outside `site/`, so they are never
served to visitors, but still committed, because a 3 MB PNG in the deploy folder
is 3 MB every visitor downloads for a picture shown at 368 px wide.

## A note on what to shoot

The page is organised by *material* — software, steel, chemistry, botany,
prose. Images that show the **stuff itself** (a folded panel, a glowing marker,
a jar, a screen) do more work here than logos do. A logo on a plate just
repeats the title directly above it.
