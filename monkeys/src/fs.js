// fs.js — file access, both tiers. Gets the {filename: text} shape that
// src/pack.js's parsePack()/serialise() speak in on and off the user's disk.
// Nothing else: no parsing, no DOM rendering, no stage logic, no linting.
// See design.md §6B for the two-tier rationale and plan Task 4 for the
// contract this file implements.
//
// Two tiers, feature-detected, one codebase:
//   BASE     — <input type=file multiple> in / individual downloads out.
//              Works in every browser, every device.
//   ENHANCED — File System Access API: open a folder, read and write in
//              place. Chromium desktop only. capabilities().directoryAccess
//              tells a caller which tier it has.
//
// This module must import cleanly under plain Node (tests/run.mjs does
// exactly that) even though `window`, `document`, `File`, and the
// FileSystemDirectoryHandle family do not exist there. Every browser-only
// call is guarded behind a capability check *inside* a function body — never
// at module top level — so `node --check`/`import` never throws. The
// browser-only functions (downloadPack, openDirectory) are exercised in
// this file's own tests only as "throws the intended clear error when the
// capability is absent" — their actual browser behaviour is UNVERIFIED; see
// the Task 4 report.
//
// Five rules this file exists to uphold (plan Task 4 + design.md §6B):
//   1. NEVER WRITE A FILE THE USER DID NOT CHANGE. writeChangedFiles writes
//      exactly the names in `dirty` and nothing else; diffPack is the pure
//      helper that decides `dirty` from two {filename: text} snapshots.
//   2. IGNORE WHAT ISN'T OURS. Only PACK_FILES and briefings/<date>.md are
//      ever read or written. Everything else in a directory or file
//      selection is reported in `skipped`, never touched.
//   3. ABSENT IS NOT AN ERROR. A directory or selection with no pack files
//      yields {files:{}, skipped:[...]}, matching parsePack's own "absent
//      is not an error" rule — never a throw.
//   4. NEVER DELETE ANYTHING, on any path, ever. There is no delete call
//      anywhere in this file. See "Removal semantics" below.
//   5. PERMISSION CAN LAPSE. writeChangedFiles re-requests permission via
//      queryPermission/requestPermission before writing and fails with a
//      message the UI can show, never a raw browser exception.
//
// Removal semantics (rule 4, spelled out): if a file the console once read
// is no longer present in the in-memory `files` object passed to
// writeChangedFiles — the human deleted its content in the UI, or it simply
// isn't tracked any more — that is NOT a delete instruction. diffPack still
// reports the name as changed (its text went from something to undefined),
// because the console genuinely needs to know a section disappeared from
// memory. But writeChangedFiles only ever calls createWritable() on names
// it can find real text for in `files`; a dirty name with no corresponding
// entry is silently skipped — never turned into a removeEntry() call. The
// file, if any exists on disk, is left exactly as it was. "Removed from the
// console's memory" and "deleted from disk" are deliberately different
// things, and this file only ever does the first.

// ---------------------------------------------------------------------------
// The pack file surface — rule 2.
// ---------------------------------------------------------------------------

// The nine canonical top-level pack files (design.md §6's table). Frozen so
// no caller can mutate the list a running console checks against.
// design.md §6's table, in its order. voice.md was missing from this list
// while being one of the files the format defines and RAID's kickoff
// creates — so the folder loader skipped it on the way in, parsePack never
// cached its text, and serialise() dropped it on the way out. A founder
// could load a pack with a voice.md, press Download pack files, and get
// back a pack without one. Silent data loss, in the module whose stated
// rule is that it never clobbers what it finds.
export const PACK_FILES = Object.freeze([
  'truth.md',
  'motte.md',
  'bailey.md',
  'recon.md',
  'research-dump.md',
  'asymmetry.md',
  'voice.md',
  'campaign.md',
  'numbers.md',
  'sell-kit.md',
  'scars.md',
]);

// Matches pack.js's own BRIEFING_FILE_RE shape exactly: briefings are the
// one file kind that is not a fixed top-level name.
const BRIEFING_PATH_RE = /^briefings\/\d{4}-\d{2}-\d{2}\.md$/;

// isPackFile(name) -> boolean. True for exactly the nine PACK_FILES names
// and briefings/<date>.md; false for everything else — a founder's own
// notes, a README, .git/*, anything. This is the single gate both readers
// (packFromFileList, readPackFromDirectory) and the writer
// (writeChangedFiles) consult, so "what we touch" is decided in one place.
export function isPackFile(name) {
  return PACK_FILES.includes(name) || BRIEFING_PATH_RE.test(name);
}

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

// capabilities() -> {directoryAccess: boolean}. The only place this module
// looks at `window`, and only from inside a function body — never at module
// load, which is what keeps `import` safe under Node.
export function capabilities() {
  return {
    directoryAccess: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  };
}

// ---------------------------------------------------------------------------
// Pure helper — the dirty-tracking decision, rule 1.
// ---------------------------------------------------------------------------

// diffPack(before, after) -> string[], sorted. Every filename whose text
// differs between the two {filename: text} snapshots — added, changed, or
// missing from `after` (a "removed" entry; see the Removal semantics note
// above for what that does and does not do downstream). Identical packs
// (including two empty ones) yield []. Pure: no I/O, testable everywhere.
export function diffPack(before, after) {
  before = before || {};
  after = after || {};
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [];
  for (const name of names) {
    if (before[name] !== after[name]) changed.push(name);
  }
  return changed.sort();
}

// ---------------------------------------------------------------------------
// Base tier — load/save as files. Every browser, every device.
// ---------------------------------------------------------------------------

// Strip a webkitRelativePath's leading directory segment, e.g.
// "mypack/briefings/2026-08-06.md" -> "briefings/2026-08-06.md". A flat
// multi-file selection (no directory picked) has no such path; the file's
// own .name is used as-is in that case.
function relativePackPath(file) {
  if (!file.webkitRelativePath) return file.name;
  const parts = file.webkitRelativePath.split('/');
  return parts.slice(1).join('/');
}

// packFromFileList(fileList) -> Promise<{files, skipped}>. Reads a
// multi-file (or directory, via webkitRelativePath) selection into the
// {filename: text} shape parsePack expects. Unknown names — rule 2 — are
// never read; they land in `skipped` by name only. An empty selection
// resolves to {files:{}, skipped:[]}, not an error — rule 3.
//
// UNVERIFIED IN A REAL BROWSER: this function's logic (which names are
// accepted, how paths are derived) is exercised in tests/run.mjs against
// mock File-shaped objects. The actual behaviour of a browser's FileList /
// File.text() / webkitRelativePath has not been exercised against a real
// <input type=file> selection — see the Task 4 report.
export async function packFromFileList(fileList) {
  const files = {};
  const skipped = [];
  for (const file of Array.from(fileList)) {
    const name = relativePackPath(file);
    if (!isPackFile(name)) {
      skipped.push(name);
      continue;
    }
    files[name] = await file.text();
  }
  return { files, skipped };
}

// downloadPack(files) -> void. Triggers a browser save of every entry in
// `files`, one at a time, via a throwaway <a download> per file. Individual
// downloads rather than a zip: bundling would need a zip library, and this
// project's constraint is zero dependencies — "prefer fewer moving parts"
// (plan Task 4). A browser download prompt/folder is the trade-off; it is
// the honest cost of staying dependency-free, not an oversight.
//
// A briefings/<date>.md name contains a "/", which <a download> cannot turn
// into a subdirectory, so it is flattened to "briefings-<date>.md" for the
// saved filename only — the in-memory pack key is untouched.
//
// UNVERIFIED IN A REAL BROWSER: only that this throws the intended clear
// error when `document` is absent (as in Node) has been exercised. The
// actual multi-file download prompt behaviour has not — see the Task 4
// report.
export function downloadPack(files) {
  if (typeof document === 'undefined') {
    throw new Error('downloadPack requires a browser environment.');
  }
  for (const [name, text] of Object.entries(files)) {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.includes('/') ? name.replace(/\//g, '-') : name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Enhanced tier — File System Access API. Chromium desktop only.
// ---------------------------------------------------------------------------

// openDirectory() -> Promise<FileSystemDirectoryHandle>. Fails with a clear,
// UI-showable message when the capability is absent, rather than letting
// `window.showDirectoryPicker` throw a raw ReferenceError.
//
// UNVERIFIED IN A REAL BROWSER: only the absent-capability error path is
// exercised (Node has no `window`). The real picker has not been driven —
// see the Task 4 report.
export async function openDirectory() {
  if (!capabilities().directoryAccess) {
    throw new Error('Directory access is not available in this browser. Use load/save files instead.');
  }
  return window.showDirectoryPicker();
}

// Read one FileSystemDirectoryHandle's "briefings" subdirectory, if present,
// into {briefings/<name>: text} entries plus its own skipped list. Absent
// subdirectory is simply never called — rule 3, handled by the caller only
// invoking this when the "briefings" entry actually turned up.
async function readBriefingsDirectory(dirEntry, files, skipped) {
  for await (const [name, entry] of dirEntry.entries()) {
    const relPath = `briefings/${name}`;
    if (entry.kind === 'file' && isPackFile(relPath)) {
      const file = await entry.getFile();
      files[relPath] = await file.text();
    } else {
      skipped.push(relPath);
    }
  }
}

// readPackFromDirectory(handle) -> Promise<{files, skipped}>. Reads only
// PACK_FILES plus briefings/<date>.md out of the given directory handle;
// everything else present — a founder's own notes, a README, a .git — is
// named in `skipped`, never opened. A directory with nothing of ours in it
// yields {files:{}, skipped:[...]}, not a throw — rule 3.
//
// UNVERIFIED IN A REAL BROWSER: this function's traversal logic is
// exercised in tests/run.mjs against mock handles that satisfy the File
// System Access API's documented async-iterator shape
// (`for await (const [name, entry] of handle.entries())`). A real Chromium
// directory handle has not been driven against it — see the Task 4 report.
export async function readPackFromDirectory(handle) {
  const files = {};
  const skipped = [];
  for await (const [name, entry] of handle.entries()) {
    if (name === 'briefings' && entry.kind === 'directory') {
      await readBriefingsDirectory(entry, files, skipped);
    } else if (entry.kind === 'file' && isPackFile(name)) {
      const file = await entry.getFile();
      files[name] = await file.text();
    } else {
      skipped.push(name);
    }
  }
  return { files, skipped };
}

// Re-request write permission for a directory handle — rule 5. Permission
// can lapse between sessions even for a handle the user picked before;
// queryPermission checks silently, requestPermission may prompt. Returns
// a boolean rather than throwing, so the caller can fail with one clear
// message instead of a raw DOMException surfacing mid-write.
async function ensureWritePermission(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

// Resolve the FileSystemFileHandle for a pack-relative path (either a
// top-level name, or "briefings/<date>.md"), creating intermediate
// directories/files only via the standard {create:true} option — never a
// delete, never anything outside PACK_FILES because callers only ever pass
// isPackFile()-checked names in.
async function getFileHandleForPackPath(dirHandle, path) {
  if (path.startsWith('briefings/')) {
    const briefingsDir = await dirHandle.getDirectoryHandle('briefings', { create: true });
    return briefingsDir.getFileHandle(path.slice('briefings/'.length), { create: true });
  }
  return dirHandle.getFileHandle(path, { create: true });
}

// writeChangedFiles(handle, files, dirty) -> Promise<string[]>. Writes ONLY
// the names listed in `dirty` — rule 1 — and only when three things are all
// true for a given name: it is in `dirty`, it is a known pack file (rule 2,
// belt-and-braces even if a caller's dirty list is sloppy), and it still
// has text in `files` (a name whose text disappeared is a removal, which
// this never turns into a disk delete — see "Removal semantics" above).
// Returns exactly the names it actually wrote.
//
// Re-requests permission before writing anything (rule 5); if that fails,
// throws one clear, UI-showable Error instead of a raw exception mid-loop —
// and writes nothing at all in that case, so a lapsed-permission call never
// writes half the dirty set.
//
// UNVERIFIED IN A REAL BROWSER: this function only calls methods on the
// `handle` argument, so its logic is fully exercised in tests/run.mjs
// against mock handles implementing the documented
// queryPermission/requestPermission/getFileHandle/getDirectoryHandle/
// createWritable contract. A real Chromium permission prompt and real disk
// write have not been exercised — see the Task 4 report.
export async function writeChangedFiles(handle, files, dirty) {
  const granted = await ensureWritePermission(handle);
  if (!granted) {
    throw new Error('Write permission for this folder was not granted. Reopen the folder and allow write access to save changes.');
  }
  const written = [];
  for (const name of new Set(dirty)) {
    if (!isPackFile(name)) continue;
    if (!Object.prototype.hasOwnProperty.call(files, name)) continue;
    const fileHandle = await getFileHandleForPackPath(handle, name);
    const writable = await fileHandle.createWritable();
    await writable.write(files[name]);
    await writable.close();
    written.push(name);
  }
  return written;
}
