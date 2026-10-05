import { UNIT, isCustomCode } from "./types.js";
import { addDays, isWeekday, parseYMD, monthStart, shiftMonth, ymd } from "./dates.js";

/** Az összesítésben beszámított másodperc: az óra típusoknál az időtartam, a fő és az alkalom darabonként 1 óra. */
export function creditSeconds(e) {
  if (e.unit === UNIT.HOURS) return Math.max(0, e.durationSeconds || 0);
  if (e.unit === UNIT.OCCASIONS || e.unit === UNIT.PEOPLE) return Math.max(1, e.quantity ?? 1) * 3600;
  return 0;
}

/** Az OTS-be kerülő idő: a saját (EGYEDI_) kategóriák nem számítanak bele. */
export function officialSeconds(entries) {
  return entries.reduce((sum, e) => (isCustomCode(e.type) ? sum : sum + creditSeconds(e)), 0);
}

export const hasWholeDay = (entries) => entries.some((e) => e.unit === UNIT.WHOLE_DAY);

/** exempt | reached | inProgress | short */
export function targetState(day, entries, today, targetHours) {
  if (day > today || !isWeekday(day) || hasWholeDay(entries)) return "exempt";
  if (officialSeconds(entries) >= Math.max(1, targetHours) * 3600) return "reached";
  return day === today ? "inProgress" : "short";
}

/** A hónap eleje és a tegnap közötti napok, amelyekhez nincs bejegyzés (a vasárnapot is beleértve). */
export function missingDays(entryDates, today, from = monthStart(today)) {
  const result = [];
  if (!parseYMD(from) || !parseYMD(today)) return result;
  let d = from, guard = 0;
  while (d < today && guard++ < 800) {
    if (!entryDates.has(d)) result.push(d);
    d = addDays(d, 1);
  }
  return result;
}

/** Mentési emlékeztető: ha még nem volt exportálás, akkor akkor kell, ha az első bejegyzés legalább egy hete van; egyébként két hét után. */
export function needsBackupReminder(entries, lastExport, today, nowMs = Date.now()) {
  if (!entries.length) return false;
  if (lastExport) return nowMs - lastExport > 14 * 86400000;
  const oldest = entries.reduce((m, e) => (e.date < m ? e.date : m), entries[0].date);
  return oldest <= addDays(today, -7);
}

// ---------- Visszatekintés, hiányos napok, emlékeztetők (a natív app Insights bővítései) ----------
export const LOOKBACKS = ["7", "14", "30", "prevMonth", "thisMonth"];
export const LOOKBACK_TITLES = { "7": "Elmúlt 7 nap", "14": "Elmúlt 2 hét", "30": "Elmúlt 30 nap", prevMonth: "Előző hónap elejétől", thisMonth: "E hónap elejétől" };
export const LOOKBACK_SHORT = { "7": "elmúlt 7 nap", "14": "elmúlt 2 hét", "30": "elmúlt 30 nap", prevMonth: "előző hónaptól", thisMonth: "e hónaptól" };
export const normalizeLookback = (v) => (LOOKBACKS.includes(String(v)) ? String(v) : "thisMonth");

/** A visszatekintési időszak első napja. */
export function lookbackStart(lookback, today) {
  const p = parseYMD(today);
  if (!p) return today;
  if (lookback === "prevMonth") { const s = shiftMonth(p.y, p.m, -1); return ymd(s.y, s.m, 1); }
  if (lookback === "thisMonth") return ymd(p.y, p.m, 1);
  const n = Number(lookback);
  return addDays(today, -(Number.isFinite(n) && n > 0 ? Math.trunc(n) : 30));
}

/** A tartományba (a mai napot nem számítva) eső napok, amelyekhez nincs bejegyzés (a vasárnapot is beleértve). */
export function missingDaysFor(entryDates, lookback, today) {
  return missingDays(entryDates, today, lookbackStart(lookback, today));
}

/** Múltbeli napok a tartományban, amelyeken van bejegyzés, de nincs meg az elvárt óraszám. */
export function shortDays(entriesByDate, lookback, today, targetHours) {
  const out = [];
  if (!parseYMD(today)) return out;
  let d = lookbackStart(lookback, today), guard = 0;
  while (d < today && guard++ < 800) {
    const list = entriesByDate.get(d);
    if (list && list.length && targetState(d, list, today, targetHours) === "short") out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

/** Hány egymást követő, bejegyzés nélküli nap van tegnapig (a vasárnapot is számolva); bejegyzés nélkül 0. */
export function consecutiveMissingDays(entryDates, today, maxDays = 366) {
  if (!entryDates.size || !parseYMD(today)) return 0;
  let count = 0, d = addDays(today, -1);
  while (count < maxDays) {
    if (entryDates.has(d)) return count;
    count += 1;
    d = addDays(d, -1);
  }
  return count;
}

export const groupByDate = (entries) => {
  const map = new Map();
  for (const e of entries) { const l = map.get(e.date); if (l) l.push(e); else map.set(e.date, [e]); }
  return map;
};
