// storage.js — keeping the working pack alive across a refresh, and nothing
// else. No parsing, no DOM, no stage logic. The console's own answer to the
// cold run's verdict: it earned trust in seven minutes and lost it in three,
// when a founder pressed Ctrl+R and found nothing saved.
//
// Four rules this file exists to uphold:
//   1. THIS BROWSER ONLY. localStorage, never a network call. There is no
//      fetch/XHR/beacon anywhere in this project and this file does not
//      introduce one. What is stored is the pack's own {filename: text}
//      snapshot — the same shape serialise() hands back.
//   2. BEST EFFORT, NEVER FATAL. Private browsing, a disabled store, a full
//      quota, a corrupt value someone else wrote — every one of those is
//      caught and reported as {ok:false}, never thrown. A console with no
//      persistence still works; it just says so.
//   3. THIS TOUCHES NO FILE ON DISK. Saving here is not saving to the user's
//      folder. Writing to disk stays explicit and manual (the download
//      button, or the File System Access writer in fs.js) — see rule 1 of
//      that file.
//   4. ONE KEY, VERSIONED. If the stored shape ever changes, the version in
//      the key changes with it, so an old value is ignored rather than
//      misread.

export const STORAGE_KEY = 'monkey-console:pack:v1';

// The store, or null. Reading `window.localStorage` can itself throw (some
// browsers throw on access, not on use, when storage is disabled), which is
// why even the lookup is wrapped.
function store() {
  try {
    if (typeof localStorage === 'undefined') return null;
    // A probe write: a store that exists but refuses writes (Safari private
    // mode, a full quota) must read as unavailable BEFORE a real save fails.
    const probe = `${STORAGE_KEY}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

// storageAvailable() -> boolean. Used once at mount so the console can say
// "persistence is off" up front rather than after the first lost refresh.
export function storageAvailable() {
  return store() !== null;
}

// formatSavedAt(iso) -> "2026-08-06 at 14:32 UTC", or '' for anything
// unparseable. Deterministic (UTC, not locale) so a render is testable and
// two machines describe the same save the same way.
export function formatSavedAt(iso) {
  if (typeof iso !== 'string' || iso.length < 16) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = d.toISOString();
  return `${s.slice(0, 10)} at ${s.slice(11, 16)} UTC`;
}

// savePack(files, nowIso) -> {ok, error}. Stores the {filename: text}
// snapshot plus the moment it was taken. Never throws — a quota failure
// comes back as {ok:false} for the caller to surface as "persistence is off".
export function savePack(files, nowIso) {
  const s = store();
  if (!s) return { ok: false, error: 'This browser has no usable local storage.' };
  try {
    const savedAt = nowIso || new Date().toISOString();
    s.setItem(STORAGE_KEY, JSON.stringify({ savedAt, files: files || {} }));
    return { ok: true, savedAt };
  } catch {
    return { ok: false, error: 'This browser refused to store the pack — it may be full.' };
  }
}

// loadSavedPack() -> {files, savedAt} | null. null covers every failure the
// same way: nothing stored, a value this version cannot read, a value that is
// not the shape it should be. A bad value is never half-restored.
export function loadSavedPack() {
  const s = store();
  if (!s) return null;
  let text;
  try {
    text = s.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    const files = value.files;
    if (!files || typeof files !== 'object' || Array.isArray(files)) return null;
    const clean = {};
    for (const [name, body] of Object.entries(files)) {
      if (typeof body === 'string') clean[name] = body;
    }
    if (Object.keys(clean).length === 0) return null;
    return { files: clean, savedAt: typeof value.savedAt === 'string' ? value.savedAt : '' };
  } catch {
    return null;
  }
}

// clearSavedPack() -> boolean. Removes this console's key and nothing else.
// Never throws.
export function clearSavedPack() {
  const s = store();
  if (!s) return false;
  try {
    s.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
