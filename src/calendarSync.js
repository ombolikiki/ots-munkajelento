// A naptár-szinkron terve és végrehajtása (a Mac-alkalmazás CalendarSync.swift megfelelője).
// A tervező (`plan`) tiszta függvény, naptár nélkül tesztelhető; a `createSyncer` köti össze a naptár-forrással és az adatokkal.
// Szabály: a naptár a mérvadó (módosítás frissít, törlés töröl), de csak a naptárból átvett bejegyzésekre; a kézzel felvitt bejegyzéshez
// a szinkron nem nyúl, és az ablaknál (alapból 60 nap) régebbi bejegyzéshez sem.
import { parseEvent, draftToEntry } from "./calendarParser.js";
import { parseYMD, addDays, toYMD } from "./dates.js";

export const MIN_HELD_DELETIONS = 5;
export const DEFAULT_WINDOW_DAYS = 60;

/** A naptárazonosító alapja: az esemény azonosítója a napi `#YYYY-MM-DD` utótag nélkül. */
export function baseID(calendarID) {
  const s = String(calendarID ?? "");
  const hash = s.lastIndexOf("#");
  if (hash < 0) return s;
  const suffix = s.slice(hash + 1);
  return suffix.length === 10 && parseYMD(suffix) ? s.slice(0, hash) : s;
}

const nn = (v) => (v == null || v === "" ? null : v);

/** Ugyanazt a tartalmat jelenti-e a bejegyzés és a naptárból kapott szelet. */
export function sameContent(e, d) {
  const q = d.type.unit === "alkalom" || d.type.unit === "fo" ? Math.max(1, d.quantity ?? 1) : null;
  return e.date === d.date && nn(e.start) === nn(d.start) && nn(e.end) === nn(d.end) && e.durationSeconds === d.durationSeconds
    && e.workplace === d.workplace && e.type === d.type.code && (e.quantity ?? null) === q && e.activity === d.activity
    && nn(e.departure) === nn(d.departure) && nn(e.arrival) === nn(d.arrival) && nn(e.address) === nn(d.address);
}

/**
 * events: a kiválasztott naptárak eseményei az ablakban; existenceIDs: minden naptár összes eseményének azonosítója (a törlés eldöntéséhez;
 * a naptár kijelölésének megszüntetése nem töröl); existing: a jelenlegi bejegyzések; windowStart: az ablak kezdete (YMD);
 * dismissed: végleg kihagyottnak jelölt események; allowDeletion: hamis, ha a naptár nem volt megbízhatóan olvasható.
 */
export function plan({ events, existenceIDs, existing, now, home, windowStart, dismissed = new Set(), allowDeletion = true }) {
  const out = { toAdd: [], toUpdate: [], toDelete: [], heldDeletions: [], incomplete: [], unrecognized: [] };
  const byCalID = new Map(), resolvedBases = new Set();
  for (const e of existing) {
    if (!e.calendarID) continue;
    if (!byCalID.has(e.calendarID)) byCalID.set(e.calendarID, e);
    resolvedBases.add(baseID(e.calendarID));
  }
  const importedDrafts = new Map(), cancelledBases = new Set(), seenIDs = new Set();
  for (const ev of events) {
    seenIDs.add(ev.id);
    const r = parseEvent(ev, now, home);
    if (r.kind === "imported") {
      importedDrafts.set(ev.id, new Set(r.drafts.map((d) => d.calendarID)));
      for (const d of r.drafts) {
        const ex = byCalID.get(d.calendarID);
        if (ex) { if (!sameContent(ex, d)) out.toUpdate.push({ entryID: ex.id, draft: d }); } else out.toAdd.push(d);
      }
    } else if (r.kind === "incomplete") {
      if (!resolvedBases.has(ev.id) && !dismissed.has(ev.id)) out.incomplete.push({ event: ev, type: r.type, drafts: r.drafts, problems: r.problems });
    } else if (r.kind === "unrecognized") {
      if (!resolvedBases.has(ev.id) && !dismissed.has(ev.id)) out.unrecognized.push({ event: ev, type: null, drafts: [], problems: [] });
    } else if (r.reason === "declined" || r.reason === "cancelled") cancelledBases.add(ev.id);
  }
  // Törlési jelöltek: csak az ablakba eső, naptárból átvett bejegyzések.
  const known = new Set([...existenceIDs, ...seenIDs]);
  const candidates = [];
  let inWindow = 0;
  for (const e of existing) {
    if (!e.calendarID || e.date < windowStart) continue;
    inWindow += 1;
    const base = baseID(e.calendarID);
    if (cancelledBases.has(base)) candidates.push(e.id);
    else if (!known.has(base)) candidates.push(e.id);
    else if (importedDrafts.has(base) && !importedDrafts.get(base).has(e.calendarID)) candidates.push(e.id);   // megrövidült vagy áthelyeződött esemény
  }
  if (allowDeletion && candidates.length) {
    const suspicious = (existenceIDs.size === 0 && seenIDs.size === 0) || candidates.length > Math.max(MIN_HELD_DELETIONS, Math.floor(inWindow / 2));
    if (suspicious) out.heldDeletions = candidates; else out.toDelete = candidates;
  }
  return out;
}

export const planHasChanges = (p) => p.toAdd.length > 0 || p.toUpdate.length > 0 || p.toDelete.length > 0;

/**
 * Szinkronizáló. source: {access(): "granted"|…, calendars(): Promise<[{id,title}]>, events(calendarIDs|null, fromMs, toMs): Promise<[eventInput]>}.
 * store: createStore() példány (applyCalendarChanges, state.entries, state.settings).
 */
export function createSyncer(store, source) {
  const st = { syncing: false, lastResult: null, incomplete: [], unrecognized: [], heldDeletions: [] };
  const S = () => store.state.settings;
  const api = {
    state: st,
    async sync(now = Date.now()) {
      const s = S();
      if (!s.syncEnabled || st.syncing || !s.syncCalendars.length) return null;
      if (source.access() !== "granted") return null;
      st.syncing = true;
      try {
        const windowStart = addDays(toYMD(new Date(now)), -s.syncDays);
        const from = new Date(parseYMD(windowStart).y, parseYMD(windowStart).m - 1, parseYMD(windowStart).d).getTime();
        const selected = await source.events(new Set(s.syncCalendars), from, now);
        const all = (await source.events(null, from, now + 365 * 86400000, { light: true })).filter((e) => !e.isCancelled);
        const p = plan({ events: selected, existenceIDs: new Set(all.map((e) => e.id)), existing: store.state.entries, now, home: s.home,
          windowStart, dismissed: new Set(s.syncDismissed) });
        const result = { added: p.toAdd.length, updated: p.toUpdate.length, deleted: p.toDelete.length, heldDeletions: p.heldDeletions.length,
          incomplete: p.incomplete.length, unrecognized: p.unrecognized.length, date: now, error: null };
        if (planHasChanges(p)) {
          const r = await store.applyCalendarChanges({ add: p.toAdd.map((d) => draftToEntry(d)), update: p.toUpdate.map((u) => draftToEntry(u.draft, u.entryID)), remove: new Set(p.toDelete) });
          if (!r.ok) result.error = r.error || "A naptár-szinkron mentése nem sikerült.";
        }
        st.incomplete = p.incomplete; st.unrecognized = p.unrecognized; st.heldDeletions = p.heldDeletions; st.lastResult = result;
        return result;
      } finally { st.syncing = false; }
    },
    /** A védelem miatt visszatartott törlések végrehajtása (a felhasználó megerősítése után). */
    async confirmHeldDeletions() {
      if (!st.heldDeletions.length) return false;
      const r = await store.applyCalendarChanges({ add: [], update: [], remove: new Set(st.heldDeletions) });
      if (r.ok) st.heldDeletions = [];
      return r.ok;
    },
    discardHeldDeletions() { st.heldDeletions = []; },
    /** Egy esemény végleges kihagyása (nem kerül többé a listákra). */
    dismiss(eventID) {
      store.saveSettings({ syncDismissed: [...new Set([...S().syncDismissed, eventID])] });
      st.incomplete = st.incomplete.filter((i) => i.event.id !== eventID);
      st.unrecognized = st.unrecognized.filter((i) => i.event.id !== eventID);
    },
  };
  return api;
}
