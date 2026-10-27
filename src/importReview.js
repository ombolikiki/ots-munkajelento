// Szabad szöveges rögzítés (Mac 1.8.0): az MI-asszisztens (a skill „Bejegyzések felvitele szabad szövegből” feladata) a felhasználó szövegéből bejegyzéseket
// készít, és az adatfájl melletti `bejegyzesek-import.csv` fájlba írja (ugyanaz a CSV-formátum, `Forrás = ai`). Az alkalmazás ezeket ÁTTEKINTÉSRE mutatja:
// csak a felhasználó jóváhagyása után kerülnek az adatok közé. Az éles adatfájlhoz az asszisztens soha nem nyúl. Tiszta függvények, tesztelhetők.
import { decode, uuid } from "./csv.js";
import { UNIT, isCustomCode } from "./types.js";
import { parseTime, parseYMD, todayYMD } from "./dates.js";

export const IMPORT_FILE = "bejegyzesek-import.csv";

const blank = (s) => !String(s ?? "").trim();

/** Egy időpont ezredmásodperce (helyi idő): nap + „ÓÓ:PP:MM” másodperc a nap kezdetétől. */
function atMs(day, secs) {
  const p = parseYMD(day);
  return p ? new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0).getTime() + secs * 1000 : NaN;
}

/**
 * Egy beolvasott bejegyzés ellenőrzése. Visszatér {problems, warnings, duplicate}.
 * Hiba (nem fogadható el): jövőbeli nap vagy vég; óra típusnál nincs időtartam, vagy a vég nem a kezdés után van; hiányzik a Munkahely (nem egész napos,
 * nem Utazás); Utazásnál hiányzik az Indulás, a Munkahely (Cél), az Érkezés vagy a Tevékenység; az Érkező km nem nagyobb az Induló km-nél.
 * Figyelmeztetés (elfogadható): már van ilyen bejegyzés (duplikátum), átfed egy meglévő időponttal rögzített bejegyzéssel, saját kategória, km nem Utazásnál.
 */
export function check(e, existing, nowMs = Date.now()) {
  const problems = [], warnings = [];
  const today = todayYMD(new Date(nowMs));
  if (e.date > today) problems.push("Jövőbeli napra nem lehet bejegyzést felvenni.");
  const st = e.start ? parseTime(e.start) : null;
  let en = e.end ? parseTime(e.end) : null;
  if (st != null && en != null && en === 0 && st > 0) en = 86400;   // a nap végi vég „00:00:00”
  if (en != null && e.date <= today && atMs(e.date, en) > nowMs + 60000) problems.push("Jövőbeli időpont nem rögzíthető.");
  if (isCustomCode(e.type)) warnings.push("Saját kategória: nem kerül az OTS-be.");

  const whole = e.unit === UNIT.WHOLE_DAY;
  if (e.unit === UNIT.HOURS) {
    if (st != null && en != null) { if (en <= st) problems.push("A vég legyen a kezdés után."); }
    else if (!(e.durationSeconds > 0)) problems.push("Nincs időtartam (kezdés–vég vagy óraszám kell).");
    if (st != null && en != null && !(e.durationSeconds > 0)) problems.push("Nulla időtartam.");
  }
  if (e.type === "TRAVEL") {
    const miss = [];
    if (blank(e.departure)) miss.push("Kiindulás (Indulás)");
    if (blank(e.workplace)) miss.push("Cél (Munkahely)");
    if (blank(e.arrival)) miss.push("Érkezés");
    if (blank(e.activity)) miss.push("Tevékenység (az út célja)");
    if (miss.length) problems.push("Utazásnál kötelező: " + miss.join(", ") + ".");
  } else if (!whole && blank(e.workplace)) problems.push("Hiányzik a Munkahely.");
  if (e.startKm != null && e.endKm != null && e.endKm <= e.startKm) problems.push("Az érkező km legyen nagyobb az induló km-nél.");
  if (e.type !== "TRAVEL" && (e.startKm != null || e.endKm != null)) warnings.push("A km-állás csak Utazásnál használt: nem kerül be.");

  const duplicate = existing.some((x) => x.date === e.date && x.type === e.type && (x.start ?? null) === (e.start ?? null) && (x.end ?? null) === (e.end ?? null)
    && x.durationSeconds === e.durationSeconds && x.workplace === e.workplace && (x.activity ?? "") === (e.activity ?? "") && (x.quantity ?? null) === (e.quantity ?? null));
  if (duplicate) warnings.push("Már van ilyen bejegyzés.");
  if (st != null && en != null && !duplicate) {
    const o = existing.find((x) => x.date === e.date && x.start && x.end && (() => {
      const xs = parseTime(x.start); let xe = parseTime(x.end);
      if (xe === 0 && xs > 0) xe = 86400;
      return xs != null && xe != null && xs < en && xe > st;
    })());
    if (o) warnings.push(`Átfed egy meglévő bejegyzéssel (${o.typeLabel}).`);
  }
  return { problems, warnings, duplicate };
}

/**
 * Az importfájl tartalmából az áttekintendő bejegyzések: [{entry, problems, warnings, duplicate, acceptable}], és a figyelmeztetések (kimaradt sorok).
 * A már szereplő (az adatok között vagy az importban ismétlődő) azonosító új azonosítót kap. A `Forrás` (`ai`) megmarad.
 */
export function items(text, existing, nowMs = Date.now()) {
  let decoded;
  try { decoded = decode(text); } catch (e) { return { items: [], notes: [`Az importfájl nem olvasható: ${e?.message || e}`] }; }
  const seen = new Set(existing.map((e) => e.id));
  const out = [];
  for (let entry of decoded.entries) {
    if (seen.has(entry.id)) entry = { ...entry, id: uuid() };
    seen.add(entry.id);
    const r = check(entry, existing, nowMs);
    out.push({ entry, problems: r.problems, warnings: r.warnings, duplicate: r.duplicate, acceptable: r.problems.length === 0 });
  }
  return { items: out, notes: decoded.warnings };
}

