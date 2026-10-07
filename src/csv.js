// A `bejegyzesek.csv` formátuma: pontosvesszővel tagolt, UTF-8 BOM-mal, CRLF sorvéggel; a Mac-alkalmazással azonos.
import { UNIT, lookupByCode, lookupByLabel, customType, hasQuantity } from "./types.js";
import { parseTime, formatHM, pad, daysInMonth } from "./dates.js";

export const COLUMNS = [
  "Azonosító", "Dátum", "Kezdés", "Vége", "Időtartam (mp)", "Időtartam (óó:pp)",
  "Indulás", "Munkahely", "Érkezés",
  "Típus kód", "Típus", "Egység", "Mennyiség", "Tevékenység", "Forrás",
  "Cím", "Naptár azonosító", "Indulás cím", "Érkezés cím", "Munkahely helye", "Induló km", "Érkező km",   // a naptárintegrációhoz és az Utazáshoz; a régi, ezek nélküli fájlok olvashatók maradnak
];

export function quote(s) {
  const t = String(s ?? "");
  return /[;"\n\r]/.test(t) ? '"' + t.replaceAll('"', '""') + '"' : t;
}

const clock = (secs) => `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;

/** Bejegyzések -> CSV szöveg (BOM nélkül; a fájlba írásnál kerül elé a BOM). */
export function encodeText(entries) {
  const lines = [COLUMNS.map(quote).join(";")];
  for (const e of entries) {
    lines.push([
      e.id, e.date, e.start ?? "", e.end ?? "",
      String(e.durationSeconds ?? 0),
      e.unit === UNIT.HOURS ? formatHM(e.durationSeconds) : "",
      e.departure ?? "", e.workplace ?? "", e.arrival ?? "",
      e.type, e.typeLabel, e.unit,
      e.quantity == null ? "" : String(e.quantity),
      e.activity ?? "", e.source ?? "manual",
      e.address ?? "", e.calendarID ?? "", e.departureAddress ?? "", e.arrivalAddress ?? "", e.workplaceIsDeparture ? "indulás" : "", e.startKm == null ? "" : String(e.startKm), e.endKm == null ? "" : String(e.endKm),
    ].map(quote).join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

/** Bejegyzések -> fájltartalom (UTF-8 BOM-mal). */
export function encodeBytes(entries) {
  const body = new TextEncoder().encode(encodeText(entries));
  const out = new Uint8Array(3 + body.length);
  out.set([0xEF, 0xBB, 0xBF], 0);
  out.set(body, 3);
  return out;
}

/** Szöveg -> egész szám; hibás vagy extrém érték (pl. „inf”, „1e99”) nem okozhat hibát. */
export function number(s) {
  const d = Number(String(s ?? "").trim().replace(",", "."));
  if (String(s ?? "").trim() === "" || !Number.isFinite(d) || Math.abs(d) >= 1e9) return null;
  return Math.round(d);
}

export function detectDelimiter(text) {
  const first = text.split(/\r\n|\n|\r/)[0] || "";
  const counts = [";", ",", "\t"].map((c) => [c, first.split(c).length - 1]);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ";";
}

export function parseRecords(text, delimiter) {
  const records = [];
  let row = [], field = "", inQuotes = false;
  const chars = Array.from(text + "\n");
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (inQuotes) {
      if (c === '"') {
        if (chars[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delimiter) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && chars[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (!(row.length === 1 && row[0] === "")) records.push(row);
      row = [];
    } else field += c;
  }
  return records;
}

/** Elfogadja: 2026-10-03, 2026. 10. 03., 2026.10.03, 03/10/2026 (táblázatkezelő átírhatja). */
export function parseDateLoose(s) {
  const nums = String(s ?? "").split(/\D+/).filter(Boolean).map(Number);
  if (nums.length < 3) return null;
  let y, m, d;
  if (nums[0] > 31) [y, m, d] = nums; else if (nums[2] > 31) [d, m, y] = nums; else return null;
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m))) return null;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

const uuid = () => (globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));
export { uuid };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CSV szöveg -> {entries, warnings}. Hibás sort kihagy, de nem hibázik. */
export function decode(input) {
  let text = String(input ?? "");
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const records = parseRecords(text, detectDelimiter(text));
  if (!records.length) return { entries: [], warnings: [] };
  const norm = (s) => String(s).trim().normalize("NFC").toLowerCase();
  const header = records.shift().map(norm);
  const idx = (name) => { const i = header.indexOf(norm(name)); return i < 0 ? null : i; };
  const iDate = idx("Dátum"), iType = idx("Típus kód"), iTypeLabel = idx("Típus");
  if (iDate == null) throw new Error("Hiányzik a „Dátum” oszlop az adatfájlból.");
  if (iType == null && iTypeLabel == null) throw new Error("Hiányzik a „Típus kód” (vagy „Típus”) oszlop az adatfájlból.");
  const iId = idx("Azonosító"), iStart = idx("Kezdés"), iEnd = idx("Vége"), iSecs = idx("Időtartam (mp)");
  const iUnit = idx("Egység"), iDep = idx("Indulás"), iArr = idx("Érkezés"), iWork = idx("Munkahely");
  const iQty = idx("Mennyiség"), iAct = idx("Tevékenység"), iSrc = idx("Forrás"), iAddr = idx("Cím"), iCal = idx("Naptár azonosító"), iDepAddr = idx("Indulás cím"), iArrAddr = idx("Érkezés cím"), iWpl = idx("Munkahely helye"), iKm0 = idx("Induló km"), iKm1 = idx("Érkező km");

  const entries = [], warnings = [];
  records.forEach((row, n) => {
    const line = n + 2;
    const cell = (i) => (i == null || i >= row.length ? "" : String(row[i]).trim());
    if (row.every((c) => String(c).trim() === "")) return;
    const date = parseDateLoose(cell(iDate));
    if (!date) { warnings.push(`${line}. sor: hibás dátum („${cell(iDate)}”)`); return; }
    const codeText = cell(iType), labelText = cell(iTypeLabel);
    let type = lookupByCode(codeText) || lookupByLabel(labelText || codeText);
    if (!type) {
      const name = labelText || codeText;
      if (!name) { warnings.push(`${line}. sor: nincs megadva típus`); return; }
      type = customType(name, codeText, cell(iUnit));
    }
    let start = null, end = null;
    const st = parseTime(cell(iStart)), en = parseTime(cell(iEnd));
    if (st != null && en != null) { start = clock(st); end = clock(en); }
    let duration = 0;
    if (start != null && end != null) {
      if (en === st) {   // azonos kezdés és vég: nulla, vagy egy egész nap (0:00–0:00), amit az időtartam oszlop jelez
        const d = number(cell(iSecs));
        duration = d != null && d > 0 && d <= 86400 ? d : 0;
      } else duration = en > st ? en - st : en + 86400 - st;   // éjfélen átnyúló bejegyzés (a nap végi vég „00:00:00”)
    } else {
      const d = number(cell(iSecs));
      if (d != null) duration = Math.max(0, d);
    }
    if (type.unit === UNIT.WHOLE_DAY) duration = 0;
    const km = (i) => { const v = number(cell(i)); return v != null && v >= 0 && v <= 9_999_999 ? v : null; };   // hibás érték üresnek számít, a sor megmarad
    const qtyN = number(cell(iQty));
    const id = UUID_RE.test(cell(iId)) ? cell(iId).toLowerCase() : uuid();
    entries.push({
      id, date, start, end, durationSeconds: duration,
      workplace: cell(iWork), type: type.code, typeLabel: type.label, unit: type.unit,
      quantity: hasQuantity(type) ? Math.min(999, Math.max(1, qtyN ?? 1)) : null,
      activity: cell(iAct), source: cell(iSrc) || "manual",
      departure: cell(iDep) || null, arrival: cell(iArr) || null,
      address: cell(iAddr) || null, calendarID: cell(iCal) || null,
      departureAddress: cell(iDepAddr) || null, arrivalAddress: cell(iArrAddr) || null,
      workplaceIsDeparture: cell(iWpl).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "indulas",
      startKm: km(iKm0), endKm: km(iKm1),
    });
  });
  return { entries, warnings };
}
