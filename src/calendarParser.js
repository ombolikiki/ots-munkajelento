// A naptáresemények értelmezése (docs/NAPTAR_JELOLESEK.md, a Mac-alkalmazás CalendarParser.swift megfelelője).
// Tiszta függvények: nem használ naptár-API-t, ezért valódi naptár nélkül tesztelhető. A napokat `ÉÉÉÉ-HH-NN` szövegként kezeli.
import { lookupByCode, hasQuantity, isTravel, isWholeDay } from "./types.js";
import { toYMD, addDays, hhmmss, parseYMD } from "./dates.js";
import { uuid } from "./csv.js";

/** Egy naptáresemény az értelmezőnek: {id, title, location, notes, start, end (ms), isAllDay, isDeclined, isCancelled}. */
export const eventInput = (o) => ({ id: "", title: "", location: "", notes: "", start: 0, end: 0, isAllDay: false, isDeclined: false, isCancelled: false, ...o });

export const PROBLEM_TEXT = {
  missingWorkplace: "Nincs megadva a munkahely (Helyszín mező vagy @Település).",
  missingActivity: "Az Utazásnál a Tevékenység (az út célja) kötelező.",
  missingDeparture: "Nincs megadva az Indulás, és nincs székhely sem a Beállításokban.",
  multipleAddresses: "Több cím szerepel a Helyszínben; válaszd ki a munkahelyet.",
  wholeDayNotAllowed: "Egész napos eseményként csak a Szabadság, a Szabadnap és a Munkaszüneti nap értelmezett.",
  noDuration: "Az esemény időtartama nulla vagy negatív.",
  tooLong: "Az esemény túl hosszú (több mint 31 nap).",
};

// ---------- Típusnevek ----------

const TYPE_NAMES = [
  ["Istentisztelet", "PREACHING"], ["Látogatás", "VISITING"], ["Missziós látogatás", "MISSION_VISITING"],
  ["Ügyintézés", "OFFICE_WORK"], ["Ügy", "OFFICE_WORK"], ["Értekezlet", "MEETING"], ["Ért", "MEETING"],
  ["Evangelizáció", "EVANGELISATION"], ["Evang", "EVANGELISATION"], ["Bibliaóra", "BIBLE_HOUR"], ["Bibl", "BIBLE_HOUR"],
  ["Továbbképzés", "TRAINING"], ["Képzés", "TRAINING"], ["Tartott képzés", "HELD_TRAINING"], ["Tartott továbbképzés", "HELD_TRAINING"],
  ["Adminisztráció", "ADMINISTRATION"], ["Admin", "ADMINISTRATION"], ["Felkészülés", "PREPARING"], ["Felk", "PREPARING"],
  ["Utazás", "TRAVEL"], ["Utaz", "TRAVEL"], ["Szabadság", "HOLIDAY"], ["Szabadnap", "DAY_OFF"],
  ["Munkaszüneti nap", "PUBLIC_HOLIDAY"], ["Munkaszüneti", "PUBLIC_HOLIDAY"],
];

const isLetterOrNumber = (c) => /[\p{L}\p{N}]/u.test(c);
const isDigit = (c) => /\p{N}/u.test(c);

/** Karakterenkénti kisbetű- és ékezetfüggetlen forma (a hosszt megtartja). */
export const foldChars = (chars) => chars.map((c) => (/\s/.test(c) ? " " : c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()));
export const normalizeSpaces = (s) => String(s ?? "").split(/\s+/).filter(Boolean).join(" ");
/** Kisbetű- és ékezetfüggetlen, egyszerűsített szóközű forma (összehasonlításhoz). */
export const fold = (s) => foldChars(Array.from(String(s ?? ""))).join("").split(" ").filter(Boolean).join(" ");

const FOLDED_TYPE_NAMES = TYPE_NAMES.map(([name, code]) => ({ chars: foldChars(Array.from(name)), code }))
  .sort((a, b) => b.chars.length - a.chars.length);

/** A cím elején álló típus és a maradék szöveg; null, ha nincs ismert típus. */
export function matchType(title) {
  const chars = Array.from(normalizeSpaces(title));
  const folded = foldChars(chars);
  for (const t of FOLDED_TYPE_NAMES) {
    const n = t.chars.length;
    if (folded.length < n || !t.chars.every((c, i) => folded[i] === c)) continue;
    if (n < chars.length && isLetterOrNumber(chars[n])) continue;   // szóhatár: „Ügyes” nem „Ügy”
    return { type: lookupByCode(t.code), rest: chars.slice(n).join("") };
  }
  return null;
}

// ---------- Címek ----------

const COUNTRIES = new Set(["magyarorszag", "hungary", "hu"]);
const DASHES = "-–—";

/** A Helyszín mező szétvágása ` - ` (szóközzel körülvett kötőjel; a telefonok „–” és „—” jele is) mentén. */
export function splitLocations(s) {
  const chars = Array.from(String(s ?? ""));
  const parts = [];
  let cur = "", i = 0;
  while (i < chars.length) {
    if (/\s/.test(chars[i]) && i + 2 < chars.length && DASHES.includes(chars[i + 1]) && /\s/.test(chars[i + 2])) { parts.push(cur); cur = ""; i += 3; }
    else { cur += chars[i]; i += 1; }
  }
  parts.push(cur);
  return parts.map(normalizeSpaces).filter(Boolean);
}

function stripPostalCode(p) {
  const chars = Array.from(p);
  let i = 0;
  while (i < chars.length && isDigit(chars[i])) i += 1;
  if (i > 0 && i < chars.length && chars[i] === " ") return normalizeSpaces(chars.slice(i + 1).join(""));
  return p;
}

/** Egy helyszín településének és pontos címének kinyerése: {settlement, address}. */
export function place(raw) {
  const parts = String(raw ?? "").split(",").map(normalizeSpaces).filter(Boolean);
  if (!parts.length) return { settlement: null, address: null };
  const usable = [...parts];
  if (usable.length > 1 && COUNTRIES.has(fold(usable[usable.length - 1]))) usable.pop();
  let settlement = null;
  for (const p of [...usable].reverse()) {
    const s = stripPostalCode(p);
    if (s && !Array.from(s).some(isDigit)) { settlement = s; break; }
  }
  return { settlement, address: parts.length >= 2 ? parts.join(", ") : null };
}

const STREET_WORDS = new Set(["ut", "utca", "u", "ter", "korut", "krt", "setany", "koz", "dulo", "sor", "fasor", "rakpart", "liget", "major",
  "emelet", "em", "ajto", "fszt", "lepcsohaz", "epulet", "ep", "hrsz"]);
/** A cím folytatása (az utcarész után): emelet, ajtó stb.; ezek nem új cím. */
const CONTINUATION_WORDS = new Set(["emelet", "em", "ajto", "fszt", "lepcsohaz", "epulet", "ep", "hrsz"]);
const wordsOf = (t) => fold(t).split(" ").map((w) => w.replace(/^[.,;]+|[.,;]+$/g, "")).filter(Boolean);
const isStreetLike = (t) => Array.from(t).some(isDigit) || wordsOf(t).some((w) => STREET_WORDS.has(w));
const isContinuation = (t) => wordsOf(t).some((w) => CONTINUATION_WORDS.has(w));

/**
 * Egy vagy több beírt hely (az Utazás Kiindulás és Cél mezője): „Tata”, „Tata, Fő út 1.”, „Tata, Mór”, „Tata, Fő út 1., Mór”.
 * A vesszővel elválasztott részek közül az utcára/házszámra utaló rész a megelőző településhez tartozó cím (település elöl); ha még nincs
 * település, a következőhöz (a fordított „Fő út 1., Tata” is érthető). Minden más rész új település. A helyeket ` - ` vagy `;` is elválaszthatja.
 * Az irányítószám és a záró „Magyarország” elmarad. Visszatér [{settlement, address}] (a cím utcával elöl, településsel a végén), vagy null,
 * ha üres, vagy egy cím mellé nem kerül település.
 */
export function parsePlaces(raw) {
  const groups = String(raw ?? "").split(";").flatMap(splitLocations);
  if (!groups.length) return null;
  const out = [];
  for (const g of groups) {
    const tokens = g.split(",").map(normalizeSpaces).filter(Boolean);
    if (tokens.length > 1 && COUNTRIES.has(fold(tokens[tokens.length - 1]))) tokens.pop();
    let pending = [], current = null;
    const flush = () => {
      if (current) { out.push({ settlement: current.settlement, address: current.street.length ? [...current.street, current.settlement].join(", ") : null }); current = null; }
    };
    for (const t of tokens) {
      const core = stripPostalCode(t);
      if (!core) continue;
      if (isStreetLike(core)) {
        if (current) {
          if (!current.street.length || isContinuation(core)) current.street.push(core);
          else { flush(); pending = [core]; }   // új, utcával kezdődő cím
        } else pending.push(core);
      } else if (!pending.length) { flush(); current = { settlement: core, street: [] }; }
      else { out.push({ settlement: core, address: [...pending, core].join(", ") }); pending = []; }
    }
    flush();
    if (pending.length) return null;
  }
  return out.length ? out : null;
}

/** Egyetlen beírt hely (például a Kiindulás); null, ha több helyet adtak meg, vagy hibás. */
export function parsePlace(raw) {
  const list = parsePlaces(raw);
  return list && list.length === 1 ? list[0] : null;
}

// ---------- Cím (típus utáni rész) ----------

const QTY_X = /(?<![\p{L}\p{N}])[×x]\s*(\d{1,3})(?![\p{L}\p{N}])/giu;
const QTY_WORD = /(?<![\p{L}\p{N}])(\d{1,3})\s*(?:fő|fo|alkalom)(?![\p{L}])/giu;

/** Kinyeri az utolsó mennyiség-jelölést (×3, x3, 3 fő, 3 alkalom), és kivágja a szövegből. */
function extractQuantity(s) {
  let best = null;
  for (const re of [QTY_X, QTY_WORD]) {
    for (const m of s.matchAll(re)) {
      if (!best || m.index > best.index) best = { index: m.index, len: m[0].length, value: Number(m[1]) || 1 };
    }
  }
  if (!best) return { rest: s, quantity: null };
  return { rest: normalizeSpaces(s.slice(0, best.index) + " " + s.slice(best.index + best.len)), quantity: Math.min(999, Math.max(1, best.value)) };
}

/** A típus utáni szöveg szétvágása: [@Település] [mennyiség] [: vagy - Tevékenység]. */
function splitRest(rest, wantsQuantity) {
  const chars = Array.from(rest);
  let head = rest, tail = "", hasSeparator = false;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === ":") { head = chars.slice(0, i).join(""); tail = chars.slice(i + 1).join(""); hasSeparator = true; break; }
    if (/\s/.test(chars[i]) && i + 2 < chars.length && DASHES.includes(chars[i + 1]) && /\s/.test(chars[i + 2])) {
      head = chars.slice(0, i).join(""); tail = chars.slice(i + 3).join(""); hasSeparator = true; break;
    }
  }
  let quantity = null;
  if (wantsQuantity) { const r = extractQuantity(head); head = r.rest; quantity = r.quantity; }
  let settlement = null;
  const at = head.indexOf("@");
  if (at >= 0) {
    const s = normalizeSpaces(head.slice(at + 1));
    settlement = s || null;
    head = normalizeSpaces(head.slice(0, at));
  }
  head = normalizeSpaces(head);
  let activity = normalizeSpaces(tail);
  if (!hasSeparator) activity = head;
  else if (!activity) activity = head;
  if (wantsQuantity && quantity == null) { const r = extractQuantity(activity); activity = r.rest; quantity = r.quantity; }
  return { settlement, quantity, activity };
}

// ---------- Utazás ----------

const commaList = (s) => String(s).split(",").map(normalizeSpaces).filter(Boolean);
const ODA_VISSZA = /oda-vissza/i;
const hasRouteMarker = (s) => s.includes("→") || s.includes("->") || s.includes("⇄") || s.includes("<->") || ODA_VISSZA.test(s);

function parseRoute(s) {
  let marker = null;
  for (const m of ["⇄", "<->"]) { const i = s.indexOf(m); if (i >= 0) { marker = { i, len: m.length }; break; } }
  if (!marker) { const m = ODA_VISSZA.exec(s); if (m) marker = { i: m.index, len: m[0].length }; }
  if (marker) {
    const dep = normalizeSpaces(s.slice(0, marker.i));
    return { departure: dep || null, workplaces: commaList(s.slice(marker.i + marker.len)), arrival: dep || null, roundTrip: true };
  }
  const pieces = s.split("->").join("→").split("→").map(normalizeSpaces);
  const route = { departure: null, workplaces: [], arrival: null, roundTrip: false };
  if (pieces.length < 2) return route;
  route.departure = pieces[0] || null;
  if (pieces.length === 2) route.arrival = pieces[1] || null;   // „A → B”: a munkahely hiányos marad (nem tippelünk)
  else {
    route.arrival = pieces[pieces.length - 1] || null;
    route.workplaces = pieces.slice(1, -1).flatMap(commaList);
  }
  return route;
}

// ---------- Fő belépési pont ----------

const dayStartMs = (ymd) => { const p = parseYMD(ymd); return p ? new Date(p.y, p.m - 1, p.d, 0, 0, 0, 0).getTime() : NaN; };

/**
 * Egy naptáresemény értelmezése. now: a pillanatnyi idő (ms; csak a már lezajlott események kerülnek át), home: a székhely.
 * Visszatér: {kind: "imported", drafts} | {kind: "incomplete", type, drafts, problems} | {kind: "unrecognized", title} | {kind: "skipped", reason}.
 */
export function parseEvent(event, now, home = "") {
  if (event.isCancelled) return { kind: "skipped", reason: "cancelled" };
  if (event.isDeclined) return { kind: "skipped", reason: "declined" };
  const today = toYMD(new Date(now));
  const startKey = toYMD(new Date(event.start));
  const lastKey = event.end > event.start ? toYMD(new Date(event.end - 1000)) : startKey;
  const wholeDays = [];
  for (let d = startKey, n = 0; d <= lastKey && n < 400; d = addDays(d, 1), n++) wholeDays.push(d);
  if (event.isAllDay) { if (!wholeDays.some((d) => d < today)) return { kind: "skipped", reason: "notFinished" }; }
  else if (Math.max(event.start, event.end) > now) return { kind: "skipped", reason: "notFinished" };

  const m = matchType(event.title);
  if (!m) return { kind: "unrecognized", title: normalizeSpaces(event.title) };
  const { type, rest } = m;
  const problems = [];
  const parts = splitRest(rest, hasQuantity(type));

  const places = splitLocations(event.location).map(place);
  const locationSettlements = places.map((p) => p.settlement).filter(Boolean);
  const exactAddresses = places.map((p) => p.address).filter(Boolean);
  let workplace = "", departure = null, arrival = null, activity = parts.activity, addressList = exactAddresses;

  if (isTravel(type)) {
    let route = { departure: null, workplaces: [], arrival: null, roundTrip: false };
    let goal = activity;
    const bar = activity.indexOf("|");
    if (bar >= 0) {
      const left = normalizeSpaces(activity.slice(0, bar));
      goal = normalizeSpaces(activity.slice(bar + 1));
      if (hasRouteMarker(left)) route = parseRoute(left); else route.workplaces = commaList(left);
    } else if (hasRouteMarker(activity)) { route = parseRoute(activity); goal = ""; }
    if (!goal) goal = String(event.notes ?? "").split(/\r\n|\n|\r/).map(normalizeSpaces).find(Boolean) || "";
    activity = goal;
    if (!route.workplaces.length && parts.settlement) route.workplaces = [parts.settlement];
    if (!route.workplaces.length) route.workplaces = locationSettlements;
    const homeName = normalizeSpaces(home);
    const dep = route.departure || (homeName || null);
    const arr = route.arrival || (route.roundTrip ? dep : (homeName || null));
    departure = dep; arrival = arr;
    workplace = route.workplaces.join(", ");
    if (!dep || !arr) problems.push("missingDeparture");
    if (!workplace) problems.push("missingWorkplace");
    if (!activity) problems.push("missingActivity");
  } else if (!isWholeDay(type)) {
    if (parts.settlement) {
      workplace = parts.settlement;   // a cím csak akkor tartozik hozzá, ha ugyanabban a településben van
      addressList = places.filter((p) => (p.settlement ? fold(p.settlement) : "") === fold(workplace)).map((p) => p.address).filter(Boolean);
    } else if (locationSettlements.length) {
      workplace = locationSettlements[0];
      if (places.length > 1) problems.push("multipleAddresses");
      addressList = places[0].address ? [places[0].address] : [];
    } else problems.push("missingWorkplace");
  } else {
    workplace = parts.settlement || locationSettlements[0] || "";
    if (!workplace) addressList = [];
  }
  const address = addressList.length ? addressList.join(" - ") : null;

  const drafts = [];
  const draft = (day, s, e, secs) => ({
    calendarID: `${event.id}#${day}`, date: day,
    start: s == null ? null : hhmmss(new Date(s)), end: e == null ? null : hhmmss(new Date(e)), durationSeconds: secs,
    type, workplace, address, quantity: hasQuantity(type) ? (parts.quantity ?? 1) : null, activity, departure, arrival,
  });

  if (event.isAllDay || isWholeDay(type)) {
    if (!isWholeDay(type)) problems.push("wholeDayNotAllowed");
    for (const d of event.isAllDay ? wholeDays.filter((x) => x < today) : wholeDays) drafts.push(draft(d, null, null, 0));
  } else {
    const total = Math.round((event.end - event.start) / 1000);
    if (total <= 0 && !hasQuantity(type)) { problems.push("noDuration"); drafts.push(draft(startKey, event.start, event.end, 0)); }
    else if (hasQuantity(type)) drafts.push(draft(startKey, event.start, event.end, Math.max(0, total)));   // alkalom és fő: nem bomlik (a mennyiség nem duplázódhat)
    else if (wholeDays.length > 32) { problems.push("tooLong"); drafts.push(draft(startKey, event.start, event.end, total)); }
    else {
      // Éjfélenként két (vagy több) részre bontjuk: minden nap a saját óraszámát kapja.
      for (let day = startKey, n = 0; dayStartMs(day) < event.end && n < 33; day = addDays(day, 1), n++) {
        const s = Math.max(event.start, dayStartMs(day)), e = Math.min(event.end, dayStartMs(addDays(day, 1)));
        const secs = Math.round((e - s) / 1000);
        if (secs > 0) drafts.push(draft(day, s, e, secs));
      }
    }
  }
  if (!problems.length && drafts.length) return { kind: "imported", drafts };
  return { kind: "incomplete", type, drafts, problems };
}

/** A napi szeletből bejegyzés (forrás: calendar). */
export function draftToEntry(d, id = uuid()) {
  return {
    id, date: d.date, start: d.start, end: d.end, durationSeconds: d.durationSeconds, workplace: d.workplace,
    type: d.type.code, typeLabel: d.type.label, unit: d.type.unit,
    quantity: hasQuantity(d.type) ? Math.max(1, d.quantity ?? 1) : null, activity: d.activity, source: "calendar",
    departure: d.departure, arrival: d.arrival, address: d.address, calendarID: d.calendarID,
  };
}
