// Pomodoro állapotgép (a natív app AppModel pomodoro-logikája, tesztelhetően, az időt paraméterként kapva).

export const POMO_DEFAULTS = { work: 25, short: 5, long: 15, every: 4, autoBreak: true, autoWork: false };
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
  };
}

export const idleState = () => ({ phase: "idle", start: 0, end: 0, done: 0 });

/** A tárolt állapot ellenőrzése. */
export function normalizeState(s) {
  const ok = s && ["idle", "work", "shortBreak", "longBreak"].includes(s.phase) && Number.isFinite(s.start) && Number.isFinite(s.end);
  return ok ? { phase: s.phase, start: s.start, end: s.end, done: Math.max(0, Math.trunc(s.done) || 0) } : idleState();
}

export const isActive = (s) => s.phase !== "idle";
export const remainingSeconds = (s, nowMs) => Math.max(0, Math.ceil((s.end - nowMs) / 1000));
const phaseMinutes = (phase, cfg) => (phase === "work" ? cfg.work : phase === "shortBreak" ? cfg.short : cfg.long);

/** Szakasz kezdése. */
export function begin(s, phase, nowMs, cfg) {
  return { ...s, phase, start: nowMs, end: nowMs + phaseMinutes(phase, cfg) * 60000 };
}

/** A kör (gyűrű) kitöltöttsége 0–1. */
export function progress(s, nowMs, cfg) {
  if (!isActive(s)) return 0;
  const total = phaseMinutes(s.phase, cfg) * 60;
  return total > 0 ? Math.min(1, Math.max(0, 1 - remainingSeconds(s, nowMs) / total)) : 0;
}

/**
 * Egy másodperces léptetés. Visszatér {state, entry?: {start, end}, notify?: {title, body, sound}}.
 * A munkaszakasz végén `entry` jelzi a mentendő időt (ha az űrlap kitöltött: `fieldsComplete`).
 */
export function tick(s, nowMs, cfg, fieldsComplete) {
  if (!isActive(s) || nowMs < s.end) return { state: s };
  if (s.phase === "work") {
    const done = s.done + 1;
    const nextBreak = done % cfg.every === 0 ? "longBreak" : "shortBreak";
    const out = {
      entry: fieldsComplete ? { start: s.start, end: s.end } : null,
      notify: { title: "Pomo vége", body: nextBreak === "longBreak" ? "Hosszú szünet jön." : "Rövid szünet jön.", sound: "pomoEnd" },
    };
    const base = { ...s, done };
    return { state: cfg.autoBreak ? begin(base, nextBreak, nowMs, cfg) : { ...base, phase: "idle" }, ...out };
  }
  const out = { notify: { title: "A szünet véget ért", body: "Mehet a következő pomo.", sound: "breakEnd" } };
  return { state: cfg.autoWork ? begin(s, "work", nowMs, cfg) : { ...s, phase: "idle" }, ...out };
}

/** Leállítás: a félbehagyott pomo eltelt ideje is bekerül (30 másodperc alatt nem). */
export function stop(s, nowMs, fieldsComplete) {
  const entry = s.phase === "work" && (nowMs - s.start) / 1000 >= MIN_SAVE_SECONDS && fieldsComplete ? { start: s.start, end: nowMs } : null;
  return { state: { ...s, phase: "idle" }, entry };
}

/** Szünet kihagyása. */
export function skipBreak(s, cfg, nowMs) {
  if (s.phase !== "shortBreak" && s.phase !== "longBreak") return s;
  const idle = { ...s, phase: "idle" };
  return cfg.autoWork ? begin(idle, "work", nowMs, cfg) : idle;
}

export const phaseTitle = (phase) => ({ idle: "Nem fut", work: "Pomo", shortBreak: "Rövid szünet", longBreak: "Hosszú szünet" }[phase] || "");
