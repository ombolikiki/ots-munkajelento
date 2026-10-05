// Védett dátumkezelés. A napokat mindig `ÉÉÉÉ-HH-NN` szövegként tároljuk (helyi nap), és soha nem a
// `new Date("ÉÉÉÉ-HH-NN")` formát használjuk (az UTC-ként értelmeződne, és időzónától függően az előző napra eshetne).

export const pad = (n, w = 2) => String(Math.trunc(n)).padStart(w, "0");

export function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return 0;
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** `ÉÉÉÉ-HH-NN` -> {y, m, d}; érvénytelen dátumra (pl. február 30.) null. */
export function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export const ymd = (y, m, d) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Date -> helyi nap szövege. */
export function toYMD(date) {
  return ymd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Nap szövege -> Date (a nap dél 12:00-kor, így a nyári időszámítás váltása nem tolja át a napot). */
export function fromYMD(s) {
  const p = parseYMD(s);
  return p ? new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0) : null;
}

export function addDays(s, n) {
  const d = fromYMD(s);
  if (!d) return s;
  d.setDate(d.getDate() + n);
  return toYMD(d);
}

/** 0 = vasárnap … 6 = szombat; érvénytelen napra -1. */
export function weekday(s) {
  const d = fromYMD(s);
  return d ? d.getDay() : -1;
}

export const isSaturday = (s) => weekday(s) === 6;
export const isSunday = (s) => weekday(s) === 0;
export const isWeekday = (s) => { const w = weekday(s); return w >= 1 && w <= 5; };

export const todayYMD = (now = new Date()) => toYMD(now);
export const isFutureDay = (s, now = new Date()) => s > todayYMD(now);

export function monthDays(y, m) {
  const n = daysInMonth(y, m);
  return Array.from({ length: n }, (_, i) => ymd(y, m, i + 1));
}

/** A nap hónapjának első napja. */
export function monthStart(s) {
  const p = parseYMD(s);
  return p ? ymd(p.y, p.m, 1) : s;
}

const HU_LONG = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
const HU_SHORT = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", weekday: "short" });
export const formatLong = (s) => { const d = fromYMD(s); return d ? HU_LONG.format(d) : String(s); };
export const formatShort = (s) => { const d = fromYMD(s); return d ? HU_SHORT.format(d) : String(s); };

/** Date -> `HH:mm:ss` (helyi idő). */
export const hhmmss = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** `HH:mm[:ss]` -> másodperc éjféltől; érvénytelenre null. */
export function parseTime(s) {
  const nums = String(s ?? "").split(/\D+/).filter(Boolean).map(Number);
  if (nums.length < 2) return null;
  const [h, m, sec = 0] = nums;
  if (!(h >= 0 && h <= 23 && m >= 0 && m <= 59 && sec >= 0 && sec <= 59)) return null;
  return h * 3600 + m * 60 + sec;
}

/** Másodperc -> `ó:pp` (az óra nem kitöltött). */
export function formatHM(seconds) {
  const s = Math.max(0, Math.trunc(Number(seconds) || 0));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}`;
}

/** Másodperc -> `pp:mm` vagy `ó:pp:mm` (stopper). */
export function formatClock(seconds) {
  const s = Math.max(0, Math.trunc(Number(seconds) || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// ---------- Hét, hónap, negyedév (a natív app DateUtil/AttendanceSchedule megfelelői) ----------

/** A hét első napja (1 = vasárnap, 2 = hétfő, mint a natív appban) a nap hetére. */
export function startOfWeek(s, firstWeekday = 2) {
  if (!parseYMD(s)) return s;
  const first = firstWeekday === 1 ? 0 : 1;           // 0 = vasárnap, 1 = hétfő (JS-számozás)
  const back = (weekday(s) - first + 7) % 7;
  return addDays(s, -back);
}

/** A következő/előző hónap (év, hó) párja; érvénytelen bemenetre változatlan. */
export function shiftMonth(y, m, delta) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return { y, m };
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

/** (év, negyedév 1–4) a naphoz; érvénytelen napra null. */
export function quarterOf(s) {
  const p = parseYMD(s);
  return p ? { y: p.y, q: Math.floor((p.m - 1) / 3) + 1 } : null;
}

/** A negyedév összes szombatja időrendben. */
export function saturdays(y, q) {
  if (!Number.isInteger(y) || !Number.isInteger(q) || q < 1 || q > 4) return [];
  const out = [];
  for (let m = (q - 1) * 3 + 1; m <= q * 3; m++) {
    for (const d of monthDays(y, m)) if (isSaturday(d)) out.push(d);
  }
  return out;
}

/** A gyülekezeti létszámjelentő esedékes napjai: minden negyedév második és hetedik szombatja. */
export const DUE_ORDINALS = [2, 7];
export function dueDatesOfQuarter(y, q) {
  const sats = saturdays(y, q);
  return DUE_ORDINALS.filter((n) => n <= sats.length).map((n) => sats[n - 1]);
}

/** Az [from, to] zárt tartományba eső esedékes napok, időrendben. */
export function dueDatesBetween(from, to) {
  const a = quarterOf(from), b = quarterOf(to);
  if (!a || !b || from > to) return [];
  const out = [];
  let y = a.y, q = a.q, guard = 0;
  while ((y < b.y || (y === b.y && q <= b.q)) && guard++ < 400) {
    for (const d of dueDatesOfQuarter(y, q)) if (d >= from && d <= to) out.push(d);
    q += 1;
    if (q > 4) { q = 1; y += 1; }
  }
  return out;
}

export function isDueDay(s) {
  const qt = quarterOf(s);
  return !!qt && dueDatesOfQuarter(qt.y, qt.q).includes(s);
}

/** Hónap neve és évszáma: „2026. október”. */
const HU_MONTH = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long" });
export const formatMonth = (y, m) => { const d = fromYMD(ymd(y, m, 1)); return d ? HU_MONTH.format(d) : `${y}. ${m}.`; };

const HU_DAYNAME = new Intl.DateTimeFormat("hu-HU", { weekday: "short" });
const HU_CHIP = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", weekday: "short" });
const HU_DAYNUM = new Intl.DateTimeFormat("hu-HU", { day: "numeric", weekday: "short" });
export const dayName = (s) => { const d = fromYMD(s); return d ? HU_DAYNAME.format(d).replace(".", "") : ""; };
export const formatChip = (s) => { const d = fromYMD(s); return d ? HU_CHIP.format(d) : String(s); };
export const formatDayNum = (s) => { const d = fromYMD(s); return d ? HU_DAYNUM.format(d) : String(s); };
export const dayOfMonth = (s) => parseYMD(s)?.d ?? 0;

/** Hány perc telt el éjféltől a `HH:mm[:ss]` időponttól; érvénytelenre null. */
export function minutesOfDay(t) {
  const secs = parseTime(t);
  return secs == null ? null : Math.floor(secs / 60);
}

/** Perc éjféltől -> `HH:mm`. */
export const hmFromMinutes = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
