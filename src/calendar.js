// Heti naptár: sávok, átfedő bejegyzések elrendezése, húzással kijelölt idősáv (a natív app CalendarView logikája).
import { minutesOfDay, addDays, startOfWeek, parseYMD } from "./dates.js";

export const SNAP = 15;
export const snap = (min) => Math.round(min / SNAP) * SNAP;

/** A beállított munkanap sávja (kezdő és záró óra), érvényesítve. */
export function bandHours(startHour, endHour) {
  const s = Number.isFinite(+startHour) ? Math.trunc(+startHour) : 7;
  const e = Number.isFinite(+endHour) ? Math.trunc(+endHour) : 20;
  const lo = Math.min(Math.max(s, 0), 22);
  const hi = Math.min(Math.max(e, lo + 1), 24);
  return { lo, hi };
}

/** A hét 7 napja a hét kezdőnapjától. */
export const weekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
export const weekStartOf = (day, firstWeekday) => startOfWeek(day, firstWeekday);

/** Egy időponttal rendelkező bejegyzés percei a napon (éjfélen átnyúló: a nap végéig). */
export function entryMinutes(e) {
  if (!e.start || !e.end) return null;
  const s = minutesOfDay(e.start), en = minutesOfDay(e.end);
  if (s == null || en == null) return null;
  return { startMin: s, endMin: en > s ? en : 24 * 60 };
}

/** Hány időponttal rögzített bejegyzés lóg ki a látható sávból. */
export function outsideCount(entries, band) {
  return entries.filter((e) => {
    const m = entryMinutes(e);
    return m && (m.startMin < band.lo * 60 || m.endMin > band.hi * 60);
  }).length;
}

/** Az egymást átfedő bejegyzések egymás mellé kerülnek (sávokra osztva). */
export function layoutDay(entries) {
  const base = [];
  for (const e of entries) {
    const m = entryMinutes(e);
    if (!m) continue;
    base.push({ entry: e, startMin: m.startMin, endMin: Math.max(m.endMin, m.startMin + 10), lane: 0, lanes: 1 });
  }
  base.sort((a, b) => a.startMin - b.startMin);
  const result = [];
  let cluster = [], laneEnds = [], clusterEnd = -1;
  const flush = () => { for (const c of cluster) { c.lanes = laneEnds.length; result.push(c); } cluster = []; laneEnds = []; clusterEnd = -1; };
  for (const p of base) {
    if (cluster.length && p.startMin >= clusterEnd) flush();
    const lane = laneEnds.findIndex((end) => end <= p.startMin);
    if (lane >= 0) { laneEnds[lane] = p.endMin; p.lane = lane; }
    else { laneEnds.push(p.endMin); p.lane = laneEnds.length - 1; }
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  flush();
  return result;
}

/** A látható sávra vágott elhelyezés (a teljesen kívül eső nem rajzolódik). */
export function clipToBand(placed, band) {
  const origin = band.lo * 60, total = (band.hi - band.lo) * 60;
  const out = [];
  for (const p of placed) {
    const a = Math.max(p.startMin, origin), b = Math.min(p.endMin, origin + total);
    if (b > a) out.push({ ...p, startMin: a, endMin: b });
  }
  return out;
}

/** Perc a rács y koordinátájából (a sáv kezdetétől), a sávra szorítva. */
export function minutesAt(y, hourHeight, band) {
  const origin = band.lo * 60, total = (band.hi - band.lo) * 60;
  const raw = Math.round((y / hourHeight) * 60) + origin;
  return Math.min(Math.max(raw, origin), origin + total);
}

/**
 * Húzással kijelölt idősáv. a, b: a kezdő és az aktuális pont (perc); nowMin: a mai napon az aktuális perc (null, ha nem ma).
 * Visszatér {startMin, endMin} vagy null (ha a mai napon a jövőbe esne).
 */
export function dragSlot(a, b, band, nowMin = null) {
  const origin = band.lo * 60, total = (band.hi - band.lo) * 60;
  let lo = Math.min(snap(a), snap(b)), hi = Math.max(snap(a), snap(b));
  if (hi - lo < SNAP) hi = lo + SNAP;
  hi = Math.min(hi, origin + total);
  lo = Math.min(lo, hi - SNAP);
  if (nowMin != null) {   // a mai napon a jövőbeli rész nem jelölhető ki
    const limit = Math.floor(nowMin / SNAP) * SNAP;
    hi = Math.min(hi, limit);
    if (hi - lo < SNAP) return null;
  }
  return { startMin: lo, endMin: hi };
}

/** Az idő nélküli bejegyzések (óraszám, alkalom/fő, egész nap) címkéje a nap tetején. */
export function untimedTag(e, typeShort, hm) {
  switch (e.unit) {
    case "ora": return `${hm(e.durationSeconds)} ${typeShort}`;
    case "alkalom": return `${e.quantity ?? 1}× ${typeShort}`;
    case "fo": return `${e.quantity ?? 1} fő`;
    default: return typeShort;
  }
}

export const isValidWeek = (s) => !!parseYMD(s);
