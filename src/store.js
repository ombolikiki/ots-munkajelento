// Helyi tárolás (localStorage) és az alkalmazás állapota. Minden adat csak ezen a készüléken marad.
import { emptyDraft, draftType, missingHint, timedEntry, learnPlaces, sortEntries, mergeEntries } from "./entries.js";
import { isWholeDay } from "./types.js";

export const KEYS = {
  entries: "ots.entries", settings: "ots.settings", draft: "ots.draft",
  timer: "ots.timer", places: "ots.places", meta: "ots.meta",
};

export const DEFAULT_SETTINGS = { home: "", targetHours: 8 };

function read(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function createStore(storage) {
  let lastError = null;
  const write = (key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); lastError = null; return true; }
    catch (e) { lastError = "A mentés nem sikerült (megtelt a tárhely, vagy a böngésző nem engedi). Exportálj CSV-t, hogy ne vesszenek el az adatok."; return false; }
  };

  const asArray = (v) => (Array.isArray(v) ? v : []);
  const state = {
    entries: sortEntries(asArray(read(storage, KEYS.entries, []))),
    places: asArray(read(storage, KEYS.places, [])).filter((p) => typeof p === "string"),
    settings: { ...DEFAULT_SETTINGS, ...(read(storage, KEYS.settings, {}) || {}) },
    draft: { ...emptyDraft(), ...(read(storage, KEYS.draft, {}) || {}) },
    timer: read(storage, KEYS.timer, null),
    meta: { lastExport: null, ...(read(storage, KEYS.meta, {}) || {}) },
  };
  if (!state.timer || typeof state.timer.startMs !== "number") state.timer = null;

  const api = {
    state,
    get error() { return lastError; },

    saveDraft() { write(KEYS.draft, state.draft); },
    resetDraft() { state.draft = emptyDraft(); write(KEYS.draft, state.draft); },

    saveSettings(patch) {
      const t = Number(patch.targetHours ?? state.settings.targetHours);
      state.settings = {
        home: String(patch.home ?? state.settings.home).trim(),
        targetHours: Number.isFinite(t) ? Math.min(12, Math.max(1, Math.round(t))) : 8,
      };
      write(KEYS.settings, state.settings);
    },

    addEntry(entry) {
      state.places = learnPlaces(state.places, entry);
      state.entries = sortEntries([...state.entries, entry]);
      write(KEYS.places, state.places);
      return write(KEYS.entries, state.entries);
    },

    deleteEntry(id) {
      state.entries = state.entries.filter((e) => e.id !== id);
      return write(KEYS.entries, state.entries);
    },

    setPlaces(list) {
      const seen = new Set();
      state.places = list.map((p) => String(p).trim()).filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
      write(KEYS.places, state.places);
    },

    importEntries(incoming) {
      const r = mergeEntries(state.entries, incoming);
      state.entries = r.entries;
      for (const e of incoming) state.places = learnPlaces(state.places, e);
      write(KEYS.places, state.places);
      write(KEYS.entries, state.entries);
      return r;
    },

    markExported(nowMs = Date.now()) { state.meta.lastExport = nowMs; write(KEYS.meta, state.meta); },

    /** Időmérő indítása: csak kitöltött, nem egész napos űrlappal. */
    startTimer(nowMs = Date.now()) {
      const type = draftType(state.draft);
      if (state.timer || !type || isWholeDay(type) || missingHint(state.draft)) return false;
      state.timer = { startMs: nowMs };
      return write(KEYS.timer, state.timer);
    },

    /** Leállítás: elmenti a bejegyzést, és kiüríti az űrlapot. Visszatér a bejegyzéssel (vagy null). */
    stopTimer(nowMs = Date.now()) {
      if (!state.timer) return null;
      if (missingHint(state.draft)) return null;
      const entry = timedEntry(state.draft, state.timer.startMs, Math.max(nowMs, state.timer.startMs));
      state.timer = null;
      write(KEYS.timer, null);
      api.addEntry(entry);
      api.resetDraft();
      return entry;
    },

    discardTimer() {
      state.timer = null;
      write(KEYS.timer, null);
      api.resetDraft();
    },

    /** Az összes adat törlése (a beállítások és a helyszínek is). */
    resetAll() {
      for (const k of Object.values(KEYS)) { try { storage.removeItem(k); } catch { /* nem baj */ } }
      state.entries = []; state.places = []; state.settings = { ...DEFAULT_SETTINGS };
      state.draft = emptyDraft(); state.timer = null; state.meta = { lastExport: null };
    },
  };
  return api;
}
