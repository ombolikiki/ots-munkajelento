import { UNIT, isCustomCode } from "./types.js";
import { addDays, isWeekday, parseYMD, monthStart } from "./dates.js";

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
