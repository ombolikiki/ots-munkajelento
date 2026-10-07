// Az alkalmazás állapota és tárolása. A böngésző tárhelye (localStorage) a gyorsítótár; ha az adatmappa ki van választva,
// a bejegyzések, a létszámjelentések és a mutatófájl automatikusan a mappába is íródnak (lásd folder.js).
import { emptyDraft, draftType, missingHint, timedEntry, learnPlaces, sortEntries, mergeEntries, applyType, clearedDraft, migrateDraft, clampStart, wholeDayEntry } from "./entries.js";
import { parseYMD } from "./dates.js";
import { lastEndKm, kmValue, kmProblem, monthKm } from "./entries.js";
import { isWholeDay, configureTypes, lookupByCode, BUILTIN_TYPES, makeCustomCode, normalizeHex, UNIT } from "./types.js";
import { encodeBytes, decode } from "./csv.js";
import * as ATT from "./attendance.js";
import { FILES, pointerJson, stamp } from "./folder.js";
import { normalizeLookback } from "./insights.js";
import * as P from "./pomodoro.js";
import { todayYMD } from "./dates.js";

export const KEYS = {
  entries: "ots.entries", settings: "ots.settings", draft: "ots.draft", timer: "ots.timer", places: "ots.places",
  meta: "ots.meta", attendance: "ots.attendance", pomo: "ots.pomo", done: "ots.done",
};

export const PALETTES = ["blue", "green", "purple", "amber"];
export const APPEARANCES = ["system", "light", "dark"];
export const SITES = ["det", "tet"];
export const SKILL_TASKS = ["havi", "koltseg", "nevsor", "hittan", "latogatottsag"];
export const SKILL_TARGETS = ["claude", "codex", "antigravity"];
export const OTS_DATASETS = ["work", "cost", "attendance"];
export const OTS_VIEWS = ["calendar", "list", "table"];

export const DEFAULT_SETTINGS = {
  home: "", targetHours: 8, appearance: "system", palette: "blue",
  lookback: "thisMonth", reminderEnabled: true, reminderDays: 7,
  calStartHour: 7, calEndHour: 20, weekStart: 2,
  pomo: P.POMO_DEFAULTS, soundPomoEnd: "glass", soundBreakEnd: "ping", notifications: true,
  attendanceEnabled: false, congregations: [],
  customCategories: [], hiddenTypes: [], categoryColors: {},
  suggestions: true, kmTrack: false, otsRules: false, otsDataset: "work", otsView: "table",
  dataPath: "",
  syncEnabled: false, syncCalendars: [], syncDays: 60, syncDismissed: [],
  skill: { userName: "", site: "det", home: "", congregations: "", tasks: [], targets: ["claude"], os: "" },
};

const int = (v, lo, hi, fb) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fb; };
const oneOf = (v, list, fb) => (list.includes(v) ? v : fb);
const str = (v) => (typeof v === "string" ? v.trim() : "");
const strList = (v) => [...new Set((Array.isArray(v) ? v : []).filter((x) => typeof x === "string" && x))].sort();

/** A beállítások érvényesítése: hibás vagy hiányzó érték helyére alapérték kerül (a tárolt adat sérült is lehet). */
export function sanitizeSettings(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const start = int(r.calStartHour, 0, 22, d.calStartHour);
  let end = int(r.calEndHour, 1, 24, d.calEndHour);
  if (end <= start) end = Math.min(24, start + 1);
  const hidden = (Array.isArray(r.hiddenTypes) ? r.hiddenTypes : []).filter((c) => BUILTIN_TYPES.some((t) => t.code === c));
  const colors = {};
  if (r.categoryColors && typeof r.categoryColors === "object" && !Array.isArray(r.categoryColors)) {
    for (const [k, v] of Object.entries(r.categoryColors)) { const h = normalizeHex(v); if (h) colors[k] = h; }
  }
  const custom = [];
  for (const c of Array.isArray(r.customCategories) ? r.customCategories : []) {
    if (c && typeof c.code === "string" && typeof c.label === "string" && c.code && c.label.trim()) {
      custom.push({ code: c.code.toUpperCase(), label: c.label.trim(), unit: oneOf(c.unit, ["hours", "occasions", "people"], "hours") });
    }
  }
  const sk = r.skill && typeof r.skill === "object" ? r.skill : {};
  return {
    home: str(r.home), targetHours: int(r.targetHours, 1, 16, d.targetHours),
    appearance: oneOf(r.appearance, APPEARANCES, d.appearance), palette: oneOf(r.palette, PALETTES, d.palette),
    lookback: normalizeLookback(r.lookback), reminderEnabled: r.reminderEnabled === undefined ? d.reminderEnabled : !!r.reminderEnabled,
    reminderDays: int(r.reminderDays, 2, 60, d.reminderDays),
    calStartHour: start, calEndHour: end, weekStart: r.weekStart === 1 ? 1 : 2,
    pomo: P.normalizePomo(r.pomo), soundPomoEnd: str(r.soundPomoEnd) || d.soundPomoEnd, soundBreakEnd: str(r.soundBreakEnd) || d.soundBreakEnd,
    notifications: r.notifications === undefined ? d.notifications : !!r.notifications,
    attendanceEnabled: !!r.attendanceEnabled, congregations: ATT.cleanCongregations(r.congregations),
    customCategories: custom, hiddenTypes: hidden, categoryColors: colors,
    suggestions: r.suggestions === undefined ? d.suggestions : !!r.suggestions, kmTrack: !!r.kmTrack, otsRules: !!r.otsRules, otsDataset: oneOf(r.otsDataset, OTS_DATASETS, d.otsDataset), otsView: oneOf(r.otsView, OTS_VIEWS, d.otsView),
    dataPath: str(r.dataPath),
    syncEnabled: !!r.syncEnabled, syncCalendars: strList(r.syncCalendars), syncDays: int(r.syncDays, 1, 730, d.syncDays), syncDismissed: strList(r.syncDismissed),
    skill: {
      userName: str(sk.userName), site: oneOf(sk.site, SITES, "det"), home: str(sk.home), congregations: str(sk.congregations),
      tasks: (Array.isArray(sk.tasks) ? sk.tasks : []).filter((t) => SKILL_TASKS.includes(t)),
      targets: (Array.isArray(sk.targets) ? sk.targets : d.skill.targets).filter((t) => SKILL_TARGETS.includes(t)),
      os: oneOf(sk.os, ["windows", "mac", ""], ""),
    },
  };
}

function read(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

const asArray = (v) => (Array.isArray(v) ? v : []);
const isEntry = (e) => e && typeof e === "object" && typeof e.date === "string" && typeof e.type === "string";
const isReport = (r) => r && typeof r.date === "string" && typeof r.congregation === "string" && r.sabbathSchool && r.worship;

export function createStore(storage, { folder = null, onSyncChange = () => {} } = {}) {
  let lastError = null;
  const write = (key, value) => {
    try { storage.setItem(key, JSON.stringify(value)); lastError = null; return true; }
    catch { lastError = "A mentés a böngészőbe nem sikerült (megtelt a tárhely, vagy a böngésző nem engedi). Exportálj CSV-t, hogy ne vesszenek el az adatok."; return false; }
  };

  const state = {
    entries: sortEntries(asArray(read(storage, KEYS.entries, [])).filter(isEntry)),
    attendance: asArray(read(storage, KEYS.attendance, [])).filter(isReport),
    places: asArray(read(storage, KEYS.places, [])).filter((p) => typeof p === "string"),
    settings: sanitizeSettings(read(storage, KEYS.settings, {})),
    draft: migrateDraft({ ...emptyDraft(), ...(read(storage, KEYS.draft, {}) || {}) }, read(storage, KEYS.draft, {}) || {}),
    timer: read(storage, KEYS.timer, null),
    pomo: P.normalizeState(read(storage, KEYS.pomo, null)),
    done: (() => { const d = read(storage, KEYS.done, {}); return d && typeof d === "object" && !Array.isArray(d) ? d : {}; })(),
    meta: { lastExport: null, dirty: false, entriesMod: null, attMod: null, ...(read(storage, KEYS.meta, {}) || {}) },
    sync: { error: null, warning: null },
  };
  if (!state.timer || typeof state.timer.startMs !== "number") state.timer = null;
  state.draft.quantity = int(state.draft.quantity, 1, 99, 1);
  state.draft.startKm = String(state.draft.startKm ?? ""); state.draft.endKm = String(state.draft.endKm ?? "");
  configureTypes({ custom: state.settings.customCategories, hidden: state.settings.hiddenTypes, colors: state.settings.categoryColors });

  let lastPomoTickMs = null;
  const SLEEP_GAP_MS = 120000, HEARTBEAT_MS = 10000;
  const kmCtx = (day) => ({ entries: state.entries, day: day || todayYMD() });
  const fieldsComplete = (day) => !missingHint(state.draft, kmCtx(day));
  /** Az induló km az utolsó rögzített érkező km-mel töltődik elő (ha a mező üres). */
  const prefillKm = () => {
    if (state.draft.startKm) return;
    const k = lastEndKm(state.entries);
    if (k != null) { state.draft.startKm = String(k); write(KEYS.draft, state.draft); }
  };
  prefillKm();
  /** Ha az induló km a (régi) utolsó érkező állás előtöltése volt, a változás után az újjal frissül; kézzel írt érték marad. */
  const refreshKmPrefill = (oldLast) => {
    if (state.draft.startKm === "" || state.draft.startKm === String(oldLast ?? "")) {
      const k = lastEndKm(state.entries);
      state.draft.startKm = k == null ? "" : String(k);
      write(KEYS.draft, state.draft);
    }
  };
  let needsBackup = false;

  // ---------- Mappa-szinkron ----------
  let chain = Promise.resolve();
  let timerHandle = null;
  const queue = (fn) => (chain = chain.then(fn, fn));

  const syncChanged = () => onSyncChange();
  const saveMeta = () => write(KEYS.meta, state.meta);

  async function writePointerFile() {
    if (!folder || !folder.ready) return;
    try { await folder.write(FILES.pointer, new TextEncoder().encode(pointerJson(state.settings.dataPath))); } catch { /* a mutatófájl nem kritikus */ }
  }

  async function flushNow() {
    if (!folder || !folder.ready) return false;
    try {
      if (needsBackup && (await folder.exists(FILES.entries))) {
        const backupName = `bejegyzesek.hibas-${stamp()}.csv`;
        await folder.copy(FILES.entries, backupName);
        needsBackup = false;
        const note = `A hibás adatfájlról másolat készült: ${backupName}.`;
        state.sync.warning = state.sync.warning ? `${state.sync.warning} ${note}` : (state.sync.error ? `${state.sync.error} ${note}` : note);
      }
      state.meta.entriesMod = await folder.write(FILES.entries, encodeBytes(state.entries));
      if (state.attendance.length || (await folder.exists(FILES.attendance))) {
        state.meta.attMod = await folder.write(FILES.attendance, ATT.encodeBytes(state.attendance));
      }
      state.meta.dirty = false; saveMeta();
      state.sync.error = null; syncChanged();
      return true;
    } catch (e) {
      state.sync.error = `Mentési hiba az adatmappába: ${e?.message || e}`;
      if (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) { await folder.refreshPermission(); }
      state.meta.dirty = true; saveMeta(); syncChanged();
      return false;
    }
  }

  /** Mentés ütemezése: a változás után röviddel (több gyors módosítás egy írás). */
  function scheduleFlush(delay = 250) {
    if (!folder || !folder.ready) { state.meta.dirty = true; saveMeta(); return; }
    clearTimeout(timerHandle);
    state.meta.dirty = true;
    timerHandle = setTimeout(() => { queue(flushNow); }, delay);
  }

  /** Beolvasás a mappából. Az első összekapcsoláskor és mentetlen változásnál összefésüli (nem veszhet el adat). */
  async function loadFromFolder() {
    const messages = [];
    state.sync.warning = null;
    try {
      const ef = await folder.read(FILES.entries);
      if (ef) {
        let text;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(ef.bytes); }
        catch { needsBackup = true; state.sync.error = "Az adatfájl nem olvasható: nem UTF-8 kódolású. A következő mentés előtt másolat készül róla."; text = null; }
        if (text != null) {
          try {
            const { entries, warnings } = decode(text);
            if (warnings.length) {
              needsBackup = true;
              state.sync.warning = `${warnings.length} sor kimaradt az adatfájlból: ${warnings.slice(0, 3).join("; ")}`;
            } else needsBackup = false;
            const neverSynced = state.meta.entriesMod == null;
            if (neverSynced || state.meta.dirty) {
              const r = mergeEntries(entries, state.entries);   // a fájl a mérvadó, a helyi csak kiegészíti
              state.entries = r.entries;
              if (r.added) messages.push(`${r.added} helyi bejegyzés hozzáadva a mappa adataihoz.`);
              state.meta.dirty = true;
            } else state.entries = sortEntries(entries);
            for (const e of state.entries) state.places = learnPlaces(state.places, e);
            prefillKm();
            state.meta.entriesMod = ef.modified;
            state.sync.error = null;
          } catch (e) {
            needsBackup = true;
            state.sync.error = `Az adatfájl nem olvasható: ${e?.message || e}. A következő mentés előtt másolat készül róla.`;
          }
        }
      } else state.meta.dirty = true;   // nincs még fájl: az első mentés létrehozza

      const af = await folder.read(FILES.attendance);
      if (af) {
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(af.bytes);
          const { reports, warnings } = ATT.decode(text);
          if (warnings.length) state.sync.warning = (state.sync.warning ? state.sync.warning + " " : "") + `${warnings.length} sor kimaradt a létszámjelentő fájlból.`;
          const neverSynced = state.meta.attMod == null;
          if (neverSynced || state.meta.dirty) {
            let merged = reports;
            for (const r of state.attendance) if (!merged.some((x) => x.date === r.date && x.congregation.toLowerCase() === r.congregation.toLowerCase())) merged = [...merged, r];
            state.attendance = merged.sort((a, b) => (a.date + a.congregation < b.date + b.congregation ? -1 : 1));
          } else state.attendance = reports;
          state.meta.attMod = af.modified;
        } catch (e) { state.sync.error = `A létszámjelentő fájl nem olvasható: ${e?.message || e}`; }
      }
    } catch (e) {
      state.sync.error = `Az adatmappa nem olvasható: ${e?.message || e}`;
    }
    write(KEYS.entries, state.entries); write(KEYS.attendance, state.attendance); write(KEYS.places, state.places); saveMeta();
    return messages;
  }

  const api = {
    state,
    get error() { return lastError; },
    get folder() { return folder; },
    fieldsComplete,

    // ---------- Űrlap ----------
    saveDraft() { write(KEYS.draft, state.draft); },
    setDraftType(code) { state.draft = applyType(state.draft, code, state.settings.home); write(KEYS.draft, state.draft); },
    resetDraft() { state.draft = clearedDraft(state.draft, ""); prefillKm(); write(KEYS.draft, state.draft); },

    // ---------- Beállítások ----------
    saveSettings(patch) {
      const before = state.settings;
      state.settings = sanitizeSettings({ ...before, ...patch });
      write(KEYS.settings, state.settings);
      configureTypes({ custom: state.settings.customCategories, hidden: state.settings.hiddenTypes, colors: state.settings.categoryColors });
      if (state.settings.dataPath !== before.dataPath) queue(writePointerFile);
      if (state.draft.typeCode && !lookupByCode(state.draft.typeCode)) { state.draft = { ...state.draft, typeCode: "" }; write(KEYS.draft, state.draft); }
      else if (state.draft.typeCode && state.settings.hiddenTypes.includes(state.draft.typeCode)) { state.draft = { ...state.draft, typeCode: "" }; write(KEYS.draft, state.draft); }
    },

    // ---------- Bejegyzések ----------
    addEntry(entry) {
      state.places = learnPlaces(state.places, entry);
      state.entries = sortEntries([...state.entries, entry]);
      write(KEYS.places, state.places);
      const ok = write(KEYS.entries, state.entries);
      scheduleFlush();
      return ok;
    },
    /**
     * Egész napos Szabadnap bejegyzés egy ÜRES, MÚLTBELI napra (a kitöltetlen napok listájából). Visszatér {ok, entry} vagy {ok:false, error}.
     * Jövőbeli napot, olyat, amelyen már van bejegyzés, és ugyanazt a napot kétszer nem jelöli.
     */
    markDayOff(day, today = todayYMD()) {
      if (!parseYMD(day)) return { ok: false, error: "Érvénytelen nap." };
      if (day >= today) return { ok: false, error: "Jövőbeli vagy mai napot nem lehet szabadnapnak jelölni." };
      if (state.entries.some((e) => e.date === day)) return { ok: false, error: "Erre a napra már van bejegyzés." };
      const entry = wholeDayEntry({ ...emptyDraft(), typeCode: "DAY_OFF" }, day);
      api.addEntry(entry);
      return { ok: true, entry };
    },
    /**
     * Egy már rögzített út km-állásának javítása. Hibás értéknél a hibaüzenetet adja vissza (és nem módosít), siker esetén null.
     * Az „előző út” a lista e bejegyzés előtti utolsó érkező km-es eleme.
     */
    updateKm(id, startText, endText) {
      const i = state.entries.findIndex((e) => e.id === id);
      if (i < 0) return "A bejegyzés nem található.";
      if (state.entries[i].type !== "TRAVEL") return "Csak az Utazás bejegyzéshez adható km-állás.";
      const s = kmValue(startText), e = kmValue(endText);
      if (!s.valid || !e.valid) return "A km-állás egész szám legyen.";
      let previous = null;
      for (let k = i - 1; k >= 0; k--) if (state.entries[k].endKm != null) { previous = state.entries[k].endKm; break; }
      const problem = kmProblem(s.value, e.value, previous);
      if (problem) return problem;
      const oldLast = lastEndKm(state.entries);
      state.entries = state.entries.map((x, k) => (k === i ? { ...x, startKm: s.value, endKm: e.value } : x));
      refreshKmPrefill(oldLast);
      write(KEYS.entries, state.entries);
      scheduleFlush();
      return null;
    },
    /** A hónap (a megadott napé) autós km-ei: az utak összege (csak a mindkét állással rögzítettek), és hány útból hiányzik valamelyik állás. */
    monthKm(day) { return monthKm(state.entries, day); },
    deleteEntry(id) {
      const oldLast = lastEndKm(state.entries);
      state.entries = state.entries.filter((e) => e.id !== id);
      refreshKmPrefill(oldLast);
      const ok = write(KEYS.entries, state.entries);
      scheduleFlush();
      return ok;
    },
    importEntries(incoming) {
      const r = mergeEntries(state.entries, incoming);
      state.entries = r.entries;
      for (const e of incoming) state.places = learnPlaces(state.places, e);
      write(KEYS.places, state.places); write(KEYS.entries, state.entries);
      scheduleFlush();
      return r;
    },

    /**
     * Naptár-szinkron változásai egyben: add (új bejegyzések), update (azonos azonosítójú bejegyzések cseréje), remove (törlendő azonosítók).
     * A módosítás előtt másolat készül az adatfájlról (`bejegyzesek.naptar-elotti.csv`, mindig felülírva).
     */
    async applyCalendarChanges({ add = [], update = [], remove = new Set() }) {
      if (!add.length && !update.length && !remove.size) return { ok: true };
      if (folder && folder.ready) {
        try { await queue(async () => { if (await folder.exists(FILES.entries)) await folder.copy(FILES.entries, "bejegyzesek.naptar-elotti.csv"); }); }
        catch (e) { return { ok: false, error: `A szinkron előtti másolat nem készült el, ezért nem módosítottam az adatokat: ${e?.message || e}` }; }
      }
      const upd = new Map(update.map((e) => [e.id, e]));
      let list = state.entries.filter((e) => !remove.has(e.id)).map((e) => (upd.has(e.id) ? { ...upd.get(e.id), startKm: e.startKm ?? null, endKm: e.endKm ?? null } : e));   // a kézzel rögzített km-állás megmarad
      for (const e of add) state.places = learnPlaces(state.places, e);
      state.entries = sortEntries([...list, ...add]);
      write(KEYS.places, state.places);
      const ok = write(KEYS.entries, state.entries);
      scheduleFlush();
      return { ok, error: ok ? null : lastError };
    },

    // ---------- Helyszínek ----------
    setPlaces(list) {
      const seen = new Set();
      state.places = list.map((p) => String(p).trim()).filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
      write(KEYS.places, state.places);
    },
    addPlace(name) { api.setPlaces([...state.places, name]); },
    removePlace(name) { api.setPlaces(state.places.filter((p) => p !== name)); },

    // ---------- Kategóriák ----------
    addCategory(name, unit) {
      const label = String(name ?? "").trim();
      if (!label || !["hours", "occasions", "people"].includes(unit)) return false;
      const code = makeCustomCode(label, state.settings.customCategories.map((c) => c.code));
      api.saveSettings({ customCategories: [...state.settings.customCategories, { code, label, unit }] });
      return true;
    },
    renameCategory(code, name) {
      const label = String(name ?? "").trim();
      if (!label) return false;
      api.saveSettings({ customCategories: state.settings.customCategories.map((c) => (c.code === code ? { ...c, label } : c)) });
      return true;
    },
    removeCategory(code) {
      api.saveSettings({ customCategories: state.settings.customCategories.filter((c) => c.code !== code) });
    },
    setBuiltinHidden(code, hidden) {
      const set = new Set(state.settings.hiddenTypes);
      if (hidden) set.add(code); else set.delete(code);
      api.saveSettings({ hiddenTypes: [...set] });
    },
    setCategoryColor(code, hex) {
      const colors = { ...state.settings.categoryColors };
      const h = hex == null ? null : normalizeHex(hex);
      if (h) colors[code] = h; else delete colors[code];
      api.saveSettings({ categoryColors: colors });
      return hex == null || !!h;
    },

    // ---------- Gyülekezeti létszámjelentő ----------
    addCongregation(name) {
      api.saveSettings({ congregations: [...state.settings.congregations, name] });
    },
    removeCongregation(name) { api.saveSettings({ congregations: state.settings.congregations.filter((c) => c !== name) }); },
    moveCongregation(name, delta) {
      const list = [...state.settings.congregations], i = list.indexOf(name), j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      api.saveSettings({ congregations: list });
    },
    saveReports(day, reports) {
      if (day > todayYMD()) return false;
      state.attendance = ATT.saveDayReports(state.attendance, day, reports);
      write(KEYS.attendance, state.attendance);
      scheduleFlush();
      return true;
    },

    // ---------- „Felvittem” jelölések (Kézi felvitel az OTS-be) ----------
    isDone: (key, sig) => state.done[key] === sig,
    setDone(key, sig, on) { if (on) state.done[key] = sig; else delete state.done[key]; write(KEYS.done, state.done); },

    markExported(nowMs = Date.now()) { state.meta.lastExport = nowMs; saveMeta(); },

    // ---------- Időmérő ----------
    /** plannedMs: előre megadott, korábbi kezdés (legfeljebb a mai nap elejéig, jövőbeli nem lehet). */
    startTimer(nowMs = Date.now(), plannedMs = null) {
      const type = draftType(state.draft);
      if (state.timer || P.isActive(state.pomo) || !type || isWholeDay(type) || missingHint(state.draft, kmCtx())) return false;
      state.timer = { startMs: plannedMs == null ? nowMs : clampStart(plannedMs, nowMs) };
      return write(KEYS.timer, state.timer);
    },
    /** A futó időzítő kezdésének javítása (a szabályok ugyanazok: legfeljebb a mai nap eleje, jövőbeli nem). */
    setTimerStart(startMs, nowMs = Date.now()) {
      if (!state.timer) return false;
      state.timer = { ...state.timer, startMs: clampStart(startMs, nowMs) };
      return write(KEYS.timer, state.timer);
    },
    stopTimer(nowMs = Date.now()) {
      if (!state.timer || missingHint(state.draft, kmCtx())) return null;
      const entry = timedEntry(state.draft, state.timer.startMs, Math.max(nowMs, state.timer.startMs));
      state.timer = null;
      write(KEYS.timer, null);
      api.addEntry(entry);
      api.resetDraft();
      return entry;
    },
    discardTimer() { state.timer = null; write(KEYS.timer, null); api.resetDraft(); },

    // ---------- Pomodoro ----------
    /** A munkamenet bejegyzéseinek felvétele; visszatér az összegzéssel {typeLabel, durationSeconds, entries} (nincs bejegyzés: null). */
    _finishSession(session, endMs) {
      const entries = P.sessionEntries(session.template, session.start, endMs);
      for (const e of entries) api.addEntry(e);
      return entries.length ? { ...entries[0], durationSeconds: entries.reduce((n, e) => n + e.durationSeconds, 0), entries } : null;
    },
    startPomo(nowMs = Date.now()) {
      const type = draftType(state.draft);
      if (state.timer || P.isActive(state.pomo) || !type || isWholeDay(type) || missingHint(state.draft, kmCtx())) return false;
      // a mezők a munkamenet elején rögzülnek: ekkor készül el a bejegyzés-sablon, a lezáráskor csak az idő mezői íródnak bele
      state.pomo = P.start(state.pomo, nowMs, state.settings.pomo, timedEntry(state.draft, nowMs, nowMs, "pomodoro"));
      lastPomoTickMs = nowMs;
      return write(KEYS.pomo, state.pomo);
    },
    /** Az `r` (P.stop/discard/skipBreak/tick) eredményének érvényesítése: állapot, a munkamenet bejegyzései, régi módban az egyedi pomo. */
    _apply(r, before) {
      state.pomo = r.state;
      let saved = null;
      if (r.endSession != null && before.session) saved = api._finishSession(before.session, r.endSession);
      else if (r.entry) { const e = timedEntry(state.draft, r.entry.start, r.entry.end, "pomodoro"); api.addEntry(e); saved = { ...e, entries: [e] }; }
      write(KEYS.pomo, state.pomo);
      return saved;
    },
    /** Leállítás: a munkamenet (régi módban a félbehagyott pomo) eltelt ideje bekerül (30 másodperc alatt nem); az űrlap kiürül. */
    stopPomo(nowMs = Date.now()) {
      const before = state.pomo, saved = api._apply(P.stop(before, nowMs, fieldsComplete()), before);
      api.resetDraft();
      return saved;
    },
    /** A gép altatása: a munkamenet az altatás pillanatával lezárul és rögzül; az űrlap mezői megmaradnak, új pomo indítható. */
    sleepPomo(atMs) {
      if (!P.isActive(state.pomo)) return null;
      const before = state.pomo;
      return api._apply(P.stop(before, atMs, fieldsComplete()), before);
    },
    /** Elvetés (pomo közben): a futó pomo nem kerül be, a munkamenet korábbi része igen. */
    discardPomo() {
      const before = state.pomo, saved = api._apply(P.discard(before), before);
      api.resetDraft();
      return saved;
    },
    skipPomoBreak(nowMs = Date.now()) { const before = state.pomo; return api._apply(P.skipBreak(before, state.settings.pomo, nowMs), before); },
    resetPomoCounter() { state.pomo = { ...state.pomo, done: 0 }; write(KEYS.pomo, state.pomo); },
    /**
     * Másodpercenkénti léptetés: a szakaszváltás, az életjel (kb. 10 másodpercenként) és az időugrás-észlelés. Az altatás a böngészőben nem érzékelhető
     * közvetlenül: ha két ütem között (falióra szerint) 120 másodpercnél nagyobb az ugrás, a munkamenet a legutóbbi ütemnél ér véget.
     * Visszatér a jelzéssel (hang, értesítés, bejegyzés, altatás), ha volt.
     */
    tickPomo(nowMs = Date.now()) {
      if (!P.isActive(state.pomo)) { lastPomoTickMs = null; return null; }
      const last = lastPomoTickMs;
      lastPomoTickMs = nowMs;
      if (last != null && nowMs - last > SLEEP_GAP_MS) {
        lastPomoTickMs = null;
        return { notify: null, entry: api.sleepPomo(last), slept: true };
      }
      const before = state.pomo;
      const r = P.tick(before, nowMs, state.settings.pomo, fieldsComplete());
      if (r.state !== before) {
        const entry = api._apply(r, before);
        if (state.pomo.session) { state.pomo = P.alive(state.pomo, nowMs); write(KEYS.pomo, state.pomo); }
        return { notify: r.notify || null, entry };
      }
      if (before.session && nowMs - before.session.lastAlive >= HEARTBEAT_MS) { state.pomo = P.alive(before, nowMs); write(KEYS.pomo, state.pomo); }
      return null;
    },

    // ---------- Adatmappa ----------
    async connectFolder() {
      if (!folder || !folder.ready) return [];
      const messages = await queue(() => loadFromFolder());
      await queue(flushNow);
      await queue(writePointerFile);
      return messages || [];
    },
    async chooseFolder() {
      if (!folder) return { ok: false, error: "Nem támogatott." };
      const r = await folder.choose();
      if (r.ok) { state.meta.entriesMod = null; state.meta.attMod = null; saveMeta(); r.messages = await api.connectFolder(); }
      return r;
    },
    async grantFolder() {
      if (!folder) return false;
      const ok = await folder.grant();
      if (ok) await api.connectFolder();
      return ok;
    },
    async forgetFolder() {
      if (!folder) return;
      await folder.forget();
      state.meta.entriesMod = null; state.meta.attMod = null; state.sync = { error: null, warning: null }; saveMeta();
    },
    async startSync() {
      if (!folder) return;
      await folder.init();
      if (folder.ready) await api.connectFolder();
    },
    /** A mappában közben (Excelben, a natív appban, a skillel) módosított fájl újraolvasása. Igaz, ha változott az adat. */
    async reloadIfChanged() {
      if (!folder || !folder.ready) return false;
      return queue(async () => {
        const em = await folder.modified(FILES.entries), am = await folder.modified(FILES.attendance);
        if ((em != null && em !== state.meta.entriesMod) || (am != null && am !== state.meta.attMod)) {
          await loadFromFolder();
          if (state.meta.dirty) await flushNow();
          return true;
        }
        return false;
      });
    },
    /** Függő mentés azonnali elvégzése (lapelhagyáskor): csak ha van mentetlen változás. */
    flush() { clearTimeout(timerHandle); return queue(async () => { if (state.meta.dirty && folder && folder.ready) await flushNow(); }); },

    /**
     * Az összes bevitt adat törlése (bejegyzések, létszámjelentések, helyszínek, saját kategóriák, elrejtett kategóriák, űrlap, futó időmérők).
     * A többi beállítás megmarad. Az adatmappában előtte másolat készül (`….torles-elotti.csv`); ha ez nem sikerül, nem töröl.
     */
    async resetAll() {
      if (folder && folder.ready) {
        try {
          await queue(async () => {
            if (await folder.exists(FILES.entries)) await folder.copy(FILES.entries, "bejegyzesek.torles-elotti.csv");
            if (await folder.exists(FILES.attendance)) await folder.copy(FILES.attendance, "letszamjelentesek.torles-elotti.csv");
          });
        } catch (e) { return { ok: false, error: `A törlés előtti másolat nem készült el, ezért nem töröltem: ${e?.message || e}` }; }
      }
      state.entries = []; state.attendance = []; state.places = []; state.timer = null; state.pomo = P.idleState(); state.done = {};
      state.draft = emptyDraft();
      needsBackup = false;
      api.saveSettings({ customCategories: [], hiddenTypes: [] });
      write(KEYS.entries, state.entries); write(KEYS.attendance, state.attendance); write(KEYS.places, state.places);
      write(KEYS.timer, null); write(KEYS.pomo, state.pomo); write(KEYS.done, state.done); write(KEYS.draft, state.draft);
      if (folder && folder.ready) await queue(flushNow); else { state.meta.dirty = true; saveMeta(); }
      return { ok: true };
    },
  };
  // Induláskor: ha van mentett munkamenet (a fül vagy a böngésző bezárása, összeomlás után), a legutóbbi életjelig rögzül, majd a mentés törlődik.
  {
    const r = P.recover(state.pomo, Date.now());
    if (r.recover) { state.pomo = r.state; api._finishSession(r.recover.session, r.recover.endMs); write(KEYS.pomo, state.pomo); }
  }
  return api;
}
