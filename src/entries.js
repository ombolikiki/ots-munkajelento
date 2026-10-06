// Bejegyzések létrehozása és az űrlap szabályai (tiszta függvények, tesztelhetők).
import { UNIT, isTravel, isWholeDay, hasQuantity, lookupByCode } from "./types.js";
import { uuid } from "./csv.js";
import { parsePlace, parsePlaces } from "./calendarParser.js";
import { toYMD, hhmmss, todayYMD, parseTime, parseYMD, pad } from "./dates.js";

export const emptyDraft = () => ({
  typeCode: "", workplace: "", activity: "", departure: "", destination: "", roundTrip: true, workplaceIsDeparture: false, quantity: 1,
});

export const draftType = (d) => lookupByCode(d.typeCode);

/** Típusváltás az űrlapon (a natív app szabályai): mennyiség nélküli típusnál 1; Utazásnál az üres Kiindulás a székhely. */
export function applyType(d, code, home = "") {
  const next = { ...d, typeCode: code };
  const type = lookupByCode(code);
  if (!hasQuantity(type)) next.quantity = 1;
  if (isTravel(type)) {
    const h = String(home ?? "").trim();
    if (!next.departure) next.departure = h;
  }
  return next;
}

/** Az űrlap kiürítése rögzítés után (az Oda-vissza jelölő újra bejelölt, a Munkahely a Cél, mint a natív appban). */
export const clearedDraft = () => emptyDraft();

/** Munkahely(ek) szövege -> tiszta lista. */
export const workplaceList = (text) =>
  String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const ORIGIN_HINT = "Kiindulás: egyetlen hely (település, vagy település és cím vesszővel, például Tata, Fő út 1.).";
const DEST_HINT = "Cél: egy vagy több hely vesszővel (település, vagy település és cím, például Tata, Kossuth u. 5., Mór).";

/** Régebbi (Indulás / Munkahely(ek) / Érkezés) piszkozat átvétele az új Kiindulás / Cél űrlapra. */
export function migrateDraft(d, stored) {
  const out = { ...d };
  delete out.arrival;
  if (stored.destination === undefined) {
    out.destination = stored.typeCode === "TRAVEL" ? String(stored.workplace ?? "") : "";
    out.roundTrip = true;
  }
  out.workplaceIsDeparture = !!out.workplaceIsDeparture;
  return out;
}

/** Az Időzítő kezdése: jövőbeli nem lehet, és legfeljebb a mai nap elejéig mehet vissza. Visszatér ezredmásodperc. */
export function clampStart(startMs, nowMs) {
  const n = new Date(nowMs), dayStart = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.min(nowMs, Math.max(dayStart, startMs));
}

/** Hiányzó kötelező mezők szövege, vagy null, ha az űrlap rendben van. */
export function missingHint(d) {
  const type = draftType(d);
  if (!type) return "Válassz tevékenység-típust.";
  if (isWholeDay(type)) return null;
  if (isTravel(type)) {
    const miss = [];
    if (!d.departure.trim()) miss.push("Kiindulás");
    if (!d.destination.trim()) miss.push("Cél");
    if (!d.activity.trim()) miss.push("Tevékenység");
    if (miss.length) return "Kötelező mező: " + miss.join(", ") + ".";
    if (!parsePlace(d.departure)) return ORIGIN_HINT;
    if (!parsePlaces(d.destination)) return DEST_HINT;
    return null;
  }
  return d.workplace.trim() ? null : "A Munkahely mező kötelező.";
}

/** Az indító (Időzítő) vagy mentő (Bevitel) gomb tiltása és a figyelmeztetés szövege az űrlap állapotából. */
export function gate(tab, d) {
  const type = draftType(d);
  if (tab === "timer" && type && isWholeDay(type)) return { disabled: true, text: "Ez a típus csak a Kézi bevitelnél használható." };
  const hint = missingHint(d);
  return { disabled: !!hint, text: hint || "" };
}

/**
 * Az Utazás összeállított terve a bejegyzéshez (a natív app TravelPlan megfelelője): Kiindulás (egy hely), Cél (egy vagy több hely, vesszővel),
 * mindegyik település vagy település és pontos cím. Null, ha nem állapítható meg.
 */
export function travelPlan(d) {
  const origin = parsePlace(d.departure), stops = parsePlaces(d.destination);
  return origin && stops ? { origin, stops } : null;
}

/**
 * Az Utazás CSV-leképezése (a skill és a régi fájlok változtatás nélkül működjenek): Indulás = a Kiindulás települése; Munkahely = a Cél helyeinek
 * települései; Érkezés = oda-vissza útnál a Kiindulás, egyirányúnál a Cél utolsó helye; Cím = a Cél pontos címei; Indulás cím = a Kiindulás címe;
 * Érkezés cím = oda-vissza útnál a Kiindulás címe.
 */
function travelFields(d) {
  const plan = travelPlan(d);
  if (!plan) return { departure: d.departure.trim(), arrival: d.departure.trim(), workplace: d.destination.trim(), address: null, departureAddress: null, arrivalAddress: null };
  const last = plan.stops[plan.stops.length - 1];
  const stopAddresses = plan.stops.map((p) => p.address).filter(Boolean);
  return {
    departure: plan.origin.settlement,
    arrival: d.roundTrip ? plan.origin.settlement : last.settlement,
    workplace: plan.stops.map((p) => p.settlement).join(", "),
    address: stopAddresses.length ? stopAddresses.join(" - ") : null,
    departureAddress: plan.origin.address,
    arrivalAddress: d.roundTrip ? plan.origin.address : null,
  };
}

/** Közös bejegyzés-mezők a piszkozatból. */
function base(d, type, source) {
  const travel = isTravel(type);
  const t = travel ? travelFields(d) : null;
  return {
    id: uuid(), date: "", start: null, end: null, durationSeconds: 0,
    workplace: travel ? t.workplace : d.workplace.trim(),
    type: type.code, typeLabel: type.label, unit: type.unit,
    quantity: hasQuantity(type) ? Math.min(999, Math.max(1, Math.trunc(d.quantity) || 1)) : null,
    activity: d.activity.trim(), source,
    departure: t ? t.departure : null,
    arrival: t ? t.arrival : null,
    address: t ? t.address : null,
    departureAddress: t ? t.departureAddress : null,
    arrivalAddress: t ? t.arrivalAddress : null,
    workplaceIsDeparture: travel && !!d.workplaceIsDeparture,
  };
}

/** Egész napos bejegyzés (Szabadság, Szabadnap, Munkaszüneti nap). */
export function wholeDayEntry(d, day) {
  const type = draftType(d);
  const e = base(d, type, "manual");
  e.date = day;
  e.workplace = type.shortLabel.toUpperCase();
  return e;
}

/** Időmérővel rögzített bejegyzés (a kezdés és a vég valós időpont). */
export function timedEntry(d, startMs, endMs, source = "timer") {
  const type = draftType(d);
  const e = base(d, type, source);
  const s = new Date(startMs), en = new Date(endMs);
  e.date = toYMD(s);
  e.start = hhmmss(s);
  e.end = hhmmss(en);
  e.durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  return e;
}

/**
 * Kézi bevitel ellenőrzése és létrehozása.
 * opts: {day, mode: "range"|"duration", from: "HH:mm", to: "HH:mm", hours, minutes, now, existing: a már rögzített bejegyzések}
 * Visszatér: {ok:true, entry} vagy {ok:false, error}
 */
export function manualEntry(d, opts) {
  const now = opts.now ?? new Date();
  const hint = missingHint(d);
  if (hint) return { ok: false, error: hint };
  if (!parseYMD(opts.day)) return { ok: false, error: "Érvénytelen nap." };
  if (opts.day > todayYMD(now)) return { ok: false, error: "Jövőbeli napra nem lehet bejegyzést felvenni." };
  const type = draftType(d);
  if (isWholeDay(type)) {
    if ((opts.existing ?? []).some((x) => x.date === opts.day && x.type === type.code)) return { ok: false, error: "Erre a napra már van ilyen bejegyzés." };
    return { ok: true, entry: wholeDayEntry(d, opts.day) };
  }
  const e = base(d, type, "manual");
  e.date = opts.day;
  if (type.unit !== UNIT.HOURS) return { ok: true, entry: e };   // alkalom, fő: csak mennyiség
  if (opts.mode === "range") {
    const f = parseTime(opts.from), t = parseTime(opts.to);
    if (f == null || t == null) return { ok: false, error: "Add meg a „Tól” és az „Ig” időpontot." };
    if (t <= f) return { ok: false, error: "Az „Ig” időpont legyen a „Tól” után." };
    if (opts.day === todayYMD(now)) {
      const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      if (t > nowSecs) return { ok: false, error: "Jövőbeli időpont nem rögzíthető." };
    }
    const c = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    e.start = c(f); e.end = c(t);
    e.durationSeconds = t - f;
    e.source = "manual";
    return { ok: true, entry: e };
  }
  const secs = Math.max(0, Math.trunc(opts.hours || 0)) * 3600 + Math.max(0, Math.trunc(opts.minutes || 0)) * 60;
  if (secs <= 0) return { ok: false, error: "Az időtartam legyen legalább 1 perc." };
  e.durationSeconds = Math.min(secs, 24 * 3600);
  return { ok: true, entry: e };
}

/**
 * A Naptárban húzással kijelölt idősáv rögzítése (forrás: calendar). Ellenőrzi a jövőt és az egész napos duplikátumot.
 * Visszatér: {ok:true, entry} vagy {ok:false, error}
 */
export function slotEntry(d, day, startMin, endMin, now = new Date(), existing = []) {
  const hint = missingHint(d);
  if (hint) return { ok: false, error: hint };
  if (!parseYMD(day)) return { ok: false, error: "Érvénytelen nap." };
  if (day > todayYMD(now)) return { ok: false, error: "Jövőbeli napra nem lehet bejegyzést felvenni." };
  const type = draftType(d);
  if (isWholeDay(type)) {
    if (existing.some((x) => x.date === day && x.type === type.code)) return { ok: false, error: "Erre a napra már van ilyen bejegyzés." };
    return { ok: true, entry: wholeDayEntry(d, day) };
  }
  if (day === todayYMD(now) && endMin * 60 > now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) {
    return { ok: false, error: "Jövőbeli időpontra nem lehet bejegyzést felvenni." };
  }
  const c = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
  const e = base(d, type, "calendar");
  e.date = day; e.start = c(startMin); e.end = c(endMin);
  e.durationSeconds = Math.max(0, (endMin - startMin) * 60);
  return { ok: true, entry: e };
}

/** A bejegyzés helyszíneinek tanulása: új, még nem mentett nevek hozzáfűzése (kis- és nagybetűtől függetlenül). */
export function learnPlaces(places, entry) {
  if (entry.unit === UNIT.WHOLE_DAY) return places;
  const out = [...places];
  const names = [...workplaceList(entry.workplace), entry.departure, entry.arrival];
  for (const raw of names) {
    const n = String(raw ?? "").trim();
    if (n && !out.some((p) => p.toLowerCase() === n.toLowerCase())) out.push(n);
  }
  return out;
}

const sortKey = (e) => `${e.date}T${e.start ?? "00:00:00"}`;
export function sortEntries(list) {
  return [...list].sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));
}

/** Importált bejegyzések egyesítése azonosító szerint (a meglévő nem íródik felül). */
export function mergeEntries(existing, incoming) {
  const ids = new Set(existing.map((e) => e.id));
  const added = incoming.filter((e) => !ids.has(e.id));
  return { entries: sortEntries([...existing, ...added]), added: added.length, skipped: incoming.length - added.length };
}

/** Egy hely az űrlap szövegében: „Tata” vagy „Tata, Fő út 1.” (a tárolt „Fő út 1., Tata” cím településes alakból). */
export function placeText(settlement, address) {
  const st = String(settlement ?? "").trim();
  if (!address) return st;
  const suffix = ", " + st;
  const street = address.endsWith(suffix) ? address.slice(0, -suffix.length) : address;
  return `${st}, ${street}`;
}
