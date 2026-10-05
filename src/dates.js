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
