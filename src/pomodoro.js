// Pomodoro állapotgép (a natív app AppModel pomodoro-logikája, tesztelhetően, az időt paraméterként kapva).
// Munkamenet (1.7.0): az első pomo indításától a végéig tartó szakasz; a pomók és a szünetek együtt EGYETLEN bejegyzést adnak (a szünet is munkaidő).
// A munkamenet végét az `endSession` (ezredmásodperc) jelzi a visszatérő értékben; a bejegyzéseket a `sessionEntries` állítja elő.
import { toYMD, hhmmss } from "./dates.js";
import { uuid } from "./csv.js";

export const POMO_DEFAULTS = { work: 25, short: 5, long: 15, every: 4, autoBreak: true, autoWork: false, merge: true };
export const MIN_SAVE_SECONDS = 30;   // ennél rövidebb félbehagyott pomót véletlen kattintásnak veszünk

const clampInt = (v, lo, hi, fallback) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; };

/** A beállítások érvényesítése (hibás tárolt értékre alapérték). */
export function normalizePomo(cfg = {}) {
  return {
    work: clampInt(cfg.work, 1, 180, POMO_DEFAULTS.work),
    short: clampInt(cfg.short, 1, 60, POMO_DEFAULTS.short),
    long: clampInt(cfg.long, 1, 120, POMO_DEFAULTS.long),
    every: clampInt(cfg.every, 2, 12, POMO_DEFAULTS.every),
    autoBreak: cfg.autoBreak === undefined ? POMO_DEFAULTS.autoBreak : !!cfg.autoBreak,
    autoWork: cfg.autoWork === undefined ? POMO_DEFAULTS.autoWork : !!cfg.autoWork,
    merge: cfg.merge === undefined ? POMO_DEFAULTS.merge : !!cfg.merge,   // a szünet is munkaidő, a munkamenet egy bejegyzés
  };
}

export const idleState = () => ({ phase: "idle", start: 0, end: 0, done: 0, session: null });

/** A tárolt munkamenet ellenőrzése: {start, lastAlive, template} vagy null. */
function normalizeSession(x) {
  return x && Number.isFinite(x.start) && Number.isFinite(x.lastAlive) && x.template && typeof x.template === "object" && !Array.isArray(x.template)
    ? { start: x.start, lastAlive: x.lastAlive, template: x.template } : null;
}

/** A tárolt állapot ellenőrzése. */
export function normalizeState(s) {
  const ok = s && ["idle", "work", "shortBreak", "longBreak"].includes(s.phase) && Number.isFinite(s.start) && Number.isFinite(s.end);
  if (!ok) return idleState();
  return { phase: s.phase, start: s.start, end: s.end, done: Math.max(0, Math.trunc(s.done) || 0), session: s.phase === "idle" ? null : normalizeSession(s.session) };
}

export const isActive = (s) => s.phase !== "idle";
export const remainingSeconds = (s, nowMs) => Math.max(0, Math.ceil((s.end - nowMs) / 1000));
const phaseMinutes = (phase, cfg) => (phase === "work" ? cfg.work : phase === "shortBreak" ? cfg.short : cfg.long);
const toIdle = (s) => ({ ...s, phase: "idle", session: null });

/** Szakasz kezdése (az új szakasz kezdete az előző tervezett vége, hogy ne csússzon az idő). */
export function begin(s, phase, atMs, cfg) {
  return { ...s, phase, start: atMs, end: atMs + phaseMinutes(phase, cfg) * 60000 };
}

/** Az első pomo indítása: kapcsolt (merge) módban munkamenet kezdődik, a bejegyzés-sablon a kezdéskor megadott mezőkkel. */
export function start(s, nowMs, cfg, template) {
  const st = begin(s, "work", nowMs, cfg);
  return { ...st, session: cfg.merge && template ? { start: nowMs, lastAlive: nowMs, template } : null };
}

/** Életjel: a futó munkamenet legutóbbi életjelének frissítése (az összeomlás utáni helyreállításhoz). */
export const alive = (s, nowMs) => (s.session ? { ...s, session: { ...s.session, lastAlive: nowMs } } : s);

/** A kör (gyűrű) kitöltöttsége 0–1. */
export function progress(s, nowMs, cfg) {
  if (!isActive(s)) return 0;
  const total = phaseMinutes(s.phase, cfg) * 60;
  return total > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds(s, nowMs) / total)) : 0;
}

/** A munkamenet eddigi ideje másodpercben (nincs munkamenet: null). */
export const sessionElapsed = (s, nowMs) => (s.session ? Math.max(0, Math.floor((nowMs - s.session.start) / 1000)) : null);

/**
 * Egy másodperces léptetés. Visszatér {state, entry?, endSession?, notify?}.
 * Régi módban (nincs munkamenet) a munkaszakasz végén `entry` jelzi a mentendő időt (ha az űrlap kitöltött: `fieldsComplete`).
 * Munkamenetben nincs `entry`; a munkamenet végét `endSession` (ms) jelzi: a hosszú szünet vége, az automatikus indítás nélküli szünet vége,
 * vagy a pomo vége, ha az automatikus szünet ki van kapcsolva.
 */
export function tick(s, nowMs, cfg, fieldsComplete) {
  if (!isActive(s) || nowMs < s.end) return { state: s };
  const merged = !!s.session;
  if (s.phase === "work") {
    const done = s.done + 1;
    const nextBreak = done % cfg.every === 0 ? "longBreak" : "shortBreak";
    const out = {
      entry: !merged && fieldsComplete ? { start: s.start, end: s.end } : null,
      notify: { title: "Pomo vége", body: nextBreak === "longBreak" ? "Hosszú szünet jön." : "Rövid szünet jön.", sound: "pomoEnd" },
    };
    const base = { ...s, done };
    if (cfg.autoBreak) return { state: begin(base, nextBreak, s.end, cfg), ...out };
    return { state: toIdle(base), ...out, ...(merged ? { endSession: s.end } : {}) };
  }
  const out = { notify: { title: "A szünet véget ért", body: "Mehet a következő pomo.", sound: "breakEnd" } };
  if (merged) {
    if (s.phase === "shortBreak" && cfg.autoWork) return { state: begin(s, "work", s.end, cfg), ...out };
    return { state: toIdle(s), ...out, endSession: s.end };
  }
  return { state: cfg.autoWork ? begin(s, "work", nowMs, cfg) : toIdle(s), ...out };
}

/**
 * Leállítás (a gomb, vagy altatás: `nowMs` az altatás pillanata): munkamenetben a munkamenet véget ér (pomo és szünet közben is, `endSession`);
 * régi módban a félbehagyott pomo eltelt ideje bekerül (30 másodperc alatt nem).
 */
export function stop(s, nowMs, fieldsComplete) {
  if (s.session) return { state: toIdle(s), entry: null, endSession: nowMs };
  const entry = s.phase === "work" && (nowMs - s.start) / 1000 >= MIN_SAVE_SECONDS && fieldsComplete ? { start: s.start, end: nowMs } : null;
  return { state: toIdle(s), entry };
}

/** Elvetés (pomo közben): az éppen futó pomo nem kerül be; a munkamenet korábbi pomói és szünetei igen (vége = az éppen futó pomo kezdete). */
export function discard(s) {
  return s.session ? { state: toIdle(s), endSession: s.start } : { state: toIdle(s) };
}

/** Szünet kihagyása: a szünet addig eltelt része beszámít; rövid szünetnél automatikus indítással a munkamenet folytatódik, egyébként véget ér. */
export function skipBreak(s, cfg, nowMs) {
  if (s.phase !== "shortBreak" && s.phase !== "longBreak") return { state: s };
  if (s.session) {
    if (s.phase === "shortBreak" && cfg.autoWork) return { state: begin(s, "work", nowMs, cfg) };
    return { state: toIdle(s), endSession: nowMs };
  }
  return { state: cfg.autoWork ? begin(toIdle(s), "work", nowMs, cfg) : toIdle(s) };
}

/** Induláskor: a mentett munkamenet a legutóbbi életjelig (legfeljebb „most”) rögzítendő. Visszatér {state, recover?: {session, endMs}}. */
export function recover(s, nowMs) {
  if (!s.session) return { state: s };
  return { state: toIdle(s), recover: { session: s.session, endMs: Math.min(s.session.lastAlive, nowMs) } };
}

/** A [start, end] tartomány a helyi időzóna éjfeleinél darabolva (a nyári időszámítás is helyes). */
export function segments(startMs, endMs) {
  const out = [];
  let cur = startMs, guard = 0;
  while (cur < endMs && guard++ < 14) {   // egy munkamenet nem tart két hétig
    const d = new Date(cur);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const segEnd = Math.min(endMs, Math.max(next, cur + 1000));
    out.push({ start: cur, end: segEnd });
    cur = segEnd;
  }
  return out;
}

/**
 * A munkamenetből készülő bejegyzések: egy, vagy éjfélen átnyúlás esetén több (mindegyik a saját napján, saját időtartammal; a nap végi vég
 * „00:00:00”). A 30 másodpercnél rövidebb munkamenetből nincs bejegyzés; az 1 másodpercnél rövidebb darab elmarad.
 */
export function sessionEntries(template, startMs, endMs) {
  if ((endMs - startMs) / 1000 < MIN_SAVE_SECONDS) return [];
  const out = [];
  for (const seg of segments(startMs, endMs)) {
    const secs = Math.round((seg.end - seg.start) / 1000);
    if (secs < 1) continue;
    out.push({ ...template, id: uuid(), date: toYMD(new Date(seg.start)), start: hhmmss(new Date(seg.start)), end: hhmmss(new Date(seg.end)), durationSeconds: secs, source: "pomodoro" });
  }
  return out;
}

export const phaseTitle = (phase) => ({ idle: "Nem fut", work: "Pomo", shortBreak: "Rövid szünet", longBreak: "Hosszú szünet" }[phase] || "");
