// campaign-css.js -- the campaign sheet's stylesheet, as a string.
//
// A STRING and not a rule block in style.css, for one reason: the sheet is
// DOWNLOADABLE. A file saved to disk and opened tomorrow has no style.css
// beside it, so the rules have to travel inside the document. Keeping a second
// copy in style.css would mean the screen and the saved file drifted apart the
// first time either was edited alone, and the drift would stay invisible until
// somebody printed the wrong one.
//
// So: one definition. home.js injects SHEET_CSS into <head> at mount for the
// screen, and campaignDocument() inlines the same string into the download.
//
// STANDALONE_CSS is the extra only the saved file needs: the design tokens and
// the page frame that index.html otherwise provides.

export const STANDALONE_CSS = `:root { --ink: #1a1a1a; --bone: #fdfcf8; --muted: #6b6b6b; }
body { margin: 0; background: var(--bone); color: var(--ink);
  font-family: Georgia, 'Times New Roman', serif; }
.cs-page { max-width: 52rem; margin: 0 auto; padding: 2rem 1.5rem; }
`;

export const SHEET_CSS = `/* ── The campaign sheet ───────────────────────────────────────────────────
   The console's actual output. Set for PAPER first and screen second: the
   question that produced it was "where is the actionable plan I can print out
   and work from", and a sheet that reads well on a monitor and badly in the
   hand would be answering a question nobody asked. */
.cs-page { max-width: 52rem; margin: 0 auto; padding-bottom: 2rem; }
.cs-toolbar { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0 1rem; }

.campaign-sheet { font-size: 1rem; line-height: 1.5; }
.cs-head { border-bottom: 3px solid var(--ink); padding-bottom: 0.6rem; margin-bottom: 1.2rem; }
.cs-head h1 { font-size: 2rem; margin: 0; }
.cs-stage { margin: 0.2rem 0 0; font-weight: 600; }
.cs-date { margin: 0.1rem 0 0; font-size: 0.85rem; color: var(--muted); }

/* Delivery rides above everything because it is the only condition here that
   rots without anyone touching a file. */
.cs-delivery { border: 2px solid var(--ink); padding: 0.7rem 0.9rem; margin-bottom: 1.4rem; }
.cs-delivery-stale, .cs-delivery-never { border-width: 3px; }
.cs-delivery-head { margin: 0; font-weight: 700; }
.cs-delivery-line { margin: 0.3rem 0 0; font-size: 0.88rem; color: var(--muted); }

.cs-section { margin-bottom: 1.6rem; break-inside: auto; }
.cs-section h2 {
  font-size: 1.15rem; margin: 0 0 0.5rem;
  border-bottom: 1px solid var(--muted); padding-bottom: 0.2rem;
}
.cs-note { margin: 0 0 0.6rem; font-size: 0.85rem; color: var(--muted); }

/* A real box, because this is worked from with a pen. */
.cs-box {
  flex: none; display: inline-block; width: 1.05rem; height: 1.05rem;
  border: 2px solid var(--ink); margin-top: 0.2rem;
}
.cs-actions, .cs-blocked { list-style: none; margin: 0; padding: 0; }
.cs-action, .cs-blocked > li {
  display: flex; gap: 0.7rem; padding: 0.55rem 0;
  border-bottom: 1px dotted var(--muted); break-inside: avoid;
}
.cs-action-what, .cs-block-what { margin: 0; font-weight: 600; }
.cs-n { display: inline-block; min-width: 1.6rem; font-weight: 700; }
.cs-action-meta { margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.2rem 1.2rem; }
.cs-action-meta b { color: var(--ink); font-weight: 600; }

.cs-room { padding: 0.6rem 0; border-bottom: 1px dotted var(--muted); break-inside: avoid; }
.cs-room h3 { font-size: 1rem; margin: 0; display: flex; align-items: baseline; gap: 0.6rem; }
.cs-standing { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid var(--ink); padding: 0 0.3rem; }
.cs-standing-cold { opacity: 0.75; }
.cs-room-who { margin: 0.2rem 0; font-size: 0.9rem; }
.cs-room-rule { margin: 0.15rem 0; font-size: 0.85rem; color: var(--muted); }
.cs-room-rule b { color: var(--ink); font-weight: 600; }
.cs-room-warn { margin: 0.25rem 0 0; font-size: 0.85rem; font-weight: 600; }

.cs-claims { list-style: none; margin: 0; padding: 0; }
.cs-claims > li { padding: 0.3rem 0; border-bottom: 1px dotted var(--muted); break-inside: avoid; }
.cs-claim { display: block; }
.cs-src { display: block; font-size: 0.8rem; color: var(--muted); word-break: break-word; }
.cs-banned .cs-claim { text-decoration: line-through; }

.cs-numbers { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.cs-numbers th, .cs-numbers td { text-align: left; padding: 0.3rem 0.5rem 0.3rem 0; border-bottom: 1px solid var(--muted); }
.cs-numbers .cs-num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }

@media print {
  /* The shell pins the app to the viewport so nothing scrolls on screen. On
     paper that would clip the sheet to one page and silently drop the rest,
     which is the worst possible failure for a document whose whole purpose is
     to leave the machine. Every height cap comes off. */
  html, body { height: auto !important; overflow: visible !important; }
  .shell, .shell-main, .door-page, .scroll-body, .scroll-body-pinned, .cs-page {
    height: auto !important; max-height: none !important; overflow: visible !important;
    display: block !important; padding: 0 !important; margin: 0 !important;
  }
  .no-print, .door-page-head, .step-chrome, .sidebar, .build-stamp { display: none !important; }
  .campaign-sheet { font-size: 11pt; }
  .cs-section { page-break-inside: auto; }
  a { text-decoration: none; color: inherit; }
}`;
