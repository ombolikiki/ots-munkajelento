// Gyülekezeti létszámjelentő: adatok, a `letszamjelentesek.csv` formátuma (a Mac-alkalmazással azonos) és az esedékesség.
import { quote, parseRecords, detectDelimiter, parseDateLoose, number } from "./csv.js";
import { dueDatesBetween, isDueDay, parseYMD } from "./dates.js";

export const ATT_COLUMNS = [
  "Dátum", "Gyülekezet",
  "Szombatiskola gyermek", "Szombatiskola felnőtt adventista", "Szombatiskola felnőtt vendég",
  "Istentisztelet gyermek", "Istentisztelet felnőtt adventista", "Istentisztelet felnőtt vendég",
];
export const MAX_COUNT = 99999;

export const emptyCounts = () => ({ children: 0, adults: 0, guests: 0 });
export const emptyReport = (date, congregation) => ({ date, congregation, sabbathSchool: emptyCounts(), worship: emptyCounts() });
export const reportId = (r) => `${r.date}|${r.congregation}`;
export const clampCount = (v) => { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? Math.min(MAX_COUNT, Math.max(0, n)) : 0; };

const sameName = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const byKey = (a, b) => (a.date + "|" + a.congregation < b.date + "|" + b.congregation ? -1 : a.date + "|" + a.congregation > b.date + "|" + b.congregation ? 1 : 0);

/** Jelentések -> CSV szöveg (BOM nélkül). */
export function encodeText(reports) {
  const lines = [ATT_COLUMNS.map(quote).join(";")];
  for (const r of [...reports].sort(byKey)) {
    lines.push([
      r.date, r.congregation,
      r.sabbathSchool.children, r.sabbathSchool.adults, r.sabbathSchool.guests,
      r.worship.children, r.worship.adults, r.worship.guests,
    ].map((v) => quote(String(v))).join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

export function encodeBytes(reports) {
  const body = new TextEncoder().encode(encodeText(reports));
  const out = new Uint8Array(3 + body.length);
  out.set([0xEF, 0xBB, 0xBF], 0);
  out.set(body, 3);
  return out;
}

/** CSV szöveg -> {reports, warnings}. Hibás sort kihagy; ugyanarra a dátumra és gyülekezetre csak egy jelentés marad. */
export function decode(input) {
  let text = String(input ?? "");
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const records = parseRecords(text, detectDelimiter(text));
  if (!records.length) return { reports: [], warnings: [] };
  const norm = (s) => String(s).trim().normalize("NFC").toLowerCase();
  const header = records.shift().map(norm);
  const idx = (name) => { const i = header.indexOf(norm(name)); return i < 0 ? null : i; };
  const iDate = idx("Dátum"), iCong = idx("Gyülekezet");
  if (iDate == null || iCong == null) throw new Error("A létszámjelentő fájlból hiányzik a „Dátum” vagy a „Gyülekezet” oszlop.");
  const cols = ATT_COLUMNS.slice(2).map(idx);
  const reports = [], warnings = [];
  records.forEach((row, n) => {
    const line = n + 2;
    const cell = (i) => (i == null || i >= row.length ? "" : String(row[i]).trim());
    if (row.every((c) => String(c).trim() === "")) return;
    const date = parseDateLoose(cell(iDate));
    if (!date) { warnings.push(`${line}. sor: hibás dátum („${cell(iDate)}”)`); return; }
    const cong = cell(iCong);
    if (!cong) { warnings.push(`${line}. sor: nincs gyülekezet`); return; }
    const num = (k) => clampCount(number(cell(cols[k])) ?? 0);
    const r = emptyReport(date, cong);
    r.sabbathSchool = { children: num(0), adults: num(1), guests: num(2) };
    r.worship = { children: num(3), adults: num(4), guests: num(5) };
    const dup = reports.findIndex((x) => x.date === r.date && sameName(x.congregation, r.congregation));
    if (dup >= 0) reports.splice(dup, 1);
    reports.push(r);
  });
  return { reports, warnings };
}

/** A regisztrált gyülekezetek tisztítása: üres elemek és kis-nagybetű szerinti duplikátumok nélkül. */
export function cleanCongregations(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).map((s) => String(s ?? "").trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

/** Egy nap jelentései a regisztrált gyülekezetek sorrendjében. */
export const reportsOn = (reports, day, congregations) =>
  congregations.map((c) => reports.find((r) => r.date === day && sameName(r.congregation, c))).filter(Boolean);

/** Egy nap jelentéseinek mentése: a megadott gyülekezetek régi jelentését lecseréli. */
export function saveDayReports(reports, day, newOnes) {
  const kept = reports.filter((r) => !(r.date === day && newOnes.some((n) => sameName(n.congregation, r.congregation))));
  return [...kept, ...newOnes.map((r) => ({ ...r, date: day }))].sort(byKey);
}

/** A tartományba eső esedékes napok (a mai nap is), amelyekhez nincs minden gyülekezetre jelentés. */
export function pendingAttendance(reports, congregations, from, today) {
  if (!congregations.length || !parseYMD(from) || !parseYMD(today)) return [];
  return dueDatesBetween(from, today).filter((day) => {
    const have = new Set(reports.filter((r) => r.date === day).map((r) => r.congregation.toLowerCase()));
    return !congregations.every((c) => have.has(c.toLowerCase()));
  });
}

export { isDueDay };
