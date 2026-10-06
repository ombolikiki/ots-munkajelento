// Kézi felvitel az OTS-be: számítások (a natív app OTSManual megfelelője, a skill szabályaival egyezően:
// napi összegzés típusonként, a napi óraösszeg felfelé kerekítése, fő/alkalom darabszám, Munkahely lista).
import { UNIT, lookupByCode, isCustomCode, isTravel } from "./types.js";
import { monthDays, isSaturday, isSunday, parseYMD } from "./dates.js";
import { dueDatesBetween } from "./dates.js";
import { place, fold } from "./calendarParser.js";

/** Az OTS Havi munkajelentő számoszlopai, a táblázat sorrendjében. */
export const COLUMN_CODES = [
  "PREACHING", "VISITING", "OFFICE_WORK", "MEETING", "EVANGELISATION", "BIBLE_HOUR", "MISSION_VISITING",
  "TRAINING", "HELD_TRAINING", "ADMINISTRATION", "PREPARING", "TRAVEL",
];
export const columns = () => COLUMN_CODES.map((c) => lookupByCode(c)).filter(Boolean);
export const MAX_VALUE = 8;

const sameText = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const splitList = (text) => String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Időrend: az időponttal rendelkezők kezdés szerint, utánuk az időpont nélküliek, egyébként az eredeti sorrend. */
export function chronological(entries) {
  return entries.map((e, i) => ({ e, i })).sort((a, b) => {
    const sa = a.e.start, sb = b.e.start;
    if (sa && sb) return sa === sb ? a.i - b.i : sa < sb ? -1 : 1;
    if (sa && !sb) return -1;
    if (!sa && sb) return 1;
    return a.i - b.i;
  }).map((x) => x.e);
}

/** Az útvonal pontjai: Indulás, Munkahely(ek), Érkezés. Az üres Indulás/Érkezés helyére a székhely kerül, az egymás melletti azonos pontok összevonódnak. */
export function routePoints(e, home) {
  const dep = String(e.departure ?? "").trim(), arr = String(e.arrival ?? "").trim();
  const points = [];
  for (const p of [dep || home, ...splitList(e.workplace), arr || home]) {
    const t = String(p ?? "").trim();
    if (!t) continue;
    if (points.length && sameText(points[points.length - 1], t)) continue;
    points.push(t);
  }
  return points;
}

/**
 * Az útvonal pontjai pontos címekkel: a Munkahely(ek) pontjaihoz a bejegyzés `Cím` mezőjének azonos településű címei kerülnek (sorrendben,
 * egy cím egyszer); az Indulás és az Érkezés pontját a saját `Indulás cím` és `Érkezés cím` mezője adja. Az azonos nevű szomszédos pontok
 * összevonódnak, ha a későbbinek nincs külön címe. Visszatér [{name, address}].
 */
export function routeDetail(e, home) {
  const dep = String(e.departure ?? "").trim(), arr = String(e.arrival ?? "").trim();
  const pool = String(e.address ?? "").split(" - ").map((s) => s.trim()).filter(Boolean);
  const points = [];
  const add = (p) => {
    if (!p.name) return;
    const last = points[points.length - 1];
    if (last && !p.address && sameText(last.name, p.name)) return;   // az azonos nevű szomszédos pont összevonódik, ha a későbbinek nincs külön címe
    points.push(p);
  };
  add({ name: dep || home, address: dep ? e.departureAddress || null : null });
  for (const m of splitList(e.workplace)) {
    const i = pool.findIndex((a) => { const s = place(a).settlement; return s && fold(s) === fold(m); });
    add({ name: m, address: i >= 0 ? pool.splice(i, 1)[0] : null });
  }
  add({ name: arr || home, address: arr ? e.arrivalAddress || null : null });
  return points;
}

/** Munkahely mező: a nap bejegyzéseinek különböző helyei időrendben (az Utazás Munkahely(ek) elemei külön-külön). */
export function workplaceList(entries) {
  const places = [];
  for (const e of chronological(entries)) {
    // Utazásnál a Munkahely(ek) lista, vagy ha a munkahely az Indulás volt (Munkahely helye = indulás), az Indulás.
    const parts = isTravel({ code: e.type }) ? (e.workplaceIsDeparture ? [String(e.departure ?? "").trim()] : splitList(e.workplace)) : [String(e.workplace ?? "").trim()];
    for (const p of parts) if (p && !places.some((x) => sameText(x, p))) places.push(p);
  }
  return places;
}

/**
 * Egy nap sora a Havi munkajelentőben.
 * rules: a skill kiegészítő szabályai (hétköznap 8 órára kiegészítés az Ügyintézésben, `!!!` jelölés, üres napok:
 * hétköznap és szombat `!!!`, vasárnap SZABADNAP). Szombaton a kiegészítés nem érvényes.
 */
export function workRow(day, dayEntries, rules, today) {
  const row = { key: day, workplace: "", holiday: false, values: {}, hasData: false, notes: [] };
  const custom = dayEntries.filter((e) => isCustomCode(e.type));
  const official = dayEntries.filter((e) => !isCustomCode(e.type));
  const timed = official.filter((e) => e.unit !== UNIT.WHOLE_DAY);
  const whole = official.filter((e) => e.unit === UNIT.WHOLE_DAY);
  if (custom.length) row.notes.push(`${custom.length} saját kategóriás bejegyzés nem vihető az OTS-be`);
  if (day > today) return row;   // jövőbeli nap: üres

  if (whole.some((e) => e.type === "HOLIDAY")) { row.holiday = true; row.hasData = true; }
  if (whole.some((e) => e.type === "DAY_OFF")) { row.workplace = "SZABADNAP"; row.hasData = true; }
  if (whole.some((e) => e.type === "PUBLIC_HOLIDAY")) { row.workplace = "MUNKASZÜNETI NAP"; row.hasData = true; }
  if (row.hasData) return row;

  if (!timed.length) {
    if (rules) {   // OTS-szempontból üres nap
      row.workplace = isSunday(day) ? "SZABADNAP" : "!!!";
      row.notes.push(isSunday(day) ? "üres vasárnap: SZABADNAP" : "üres nap: !!! jelölés");
    }
    return row;
  }

  row.hasData = true;
  const sums = {}, counts = {};
  for (const e of timed) {
    if (e.unit === UNIT.HOURS) sums[e.type] = (sums[e.type] || 0) + Math.max(0, e.durationSeconds || 0);
    else counts[e.type] = (counts[e.type] || 0) + Math.max(1, e.quantity ?? 1);
  }
  const values = {};
  for (const [t, s] of Object.entries(sums)) if (s > 0) values[t] = Math.floor((s + 3599) / 3600);   // a napi összeget kerekítjük felfelé
  for (const [t, c] of Object.entries(counts)) if (c > 0) values[t] = c;
  for (const [t, v] of Object.entries(values)) {
    if (v > MAX_VALUE) {
      row.notes.push(`${lookupByCode(t)?.label ?? t}: ${v} helyett ${MAX_VALUE} (legfeljebb ${MAX_VALUE} vihető fel)`);
      values[t] = MAX_VALUE;
    }
  }

  let places = workplaceList(timed);
  if (rules && !isSaturday(day)) {
    const total = Object.values(values).reduce((a, b) => a + b, 0);
    if (total < MAX_VALUE) {
      const add = MAX_VALUE - total;
      values.OFFICE_WORK = (values.OFFICE_WORK || 0) + add;
      row.notes.push(`Ügyintézés +${add} (8-ra kiegészítve)`);
    }
    if ((values.OFFICE_WORK || 0) > 4) {
      places = ["!!!", ...places];
      row.notes.push("!!! jelölés: az Ügyintézés több mint 4 óra");
    }
  }
  if (places[0] === "!!!") {   // a !!! előtag a Munkahely mező elején áll (pl. "!!! Győr")
    places = places.slice(1);
    row.workplace = places.length ? "!!! " + places.join(", ") : "!!!";
  } else row.workplace = places.join(", ");
  row.values = Object.fromEntries(Object.entries(values).filter(([, v]) => v > 0));
  return row;
}

/** A nap OTS-sorának szövege: ha változik, a „felvittem” jelölés érvényét veszti. */
export const workSignature = (r) =>
  `${r.workplace}|${r.holiday ? 1 : 0}|` + Object.entries(r.values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join(",");
export const workIsEmpty = (r) => !r.workplace && !r.holiday && !Object.keys(r.values).length;

// ---------- Költségelszámolás ----------

export function costRows(entries, y, m, home) {
  const rows = [];
  for (const day of monthDays(y, m)) {
    const travel = chronological(entries.filter((e) => e.date === day && e.type === "TRAVEL"));
    if (!travel.length) continue;
    const routes = travel.map((e) => routePoints(e, home)).filter((r) => r.length);
    // A Tevékenység mezőt kizárólag az Utazás bejegyzések Tevékenysége adja (más kategóriából nem veszünk át szöveget).
    const texts = [];
    for (const e of travel) { const t = String(e.activity ?? "").trim(); if (t && !texts.includes(t)) texts.push(t); }
    const mapRoutes = travel.filter((e) => routePoints(e, home).length).map((e) => routeDetail(e, home));
    rows.push({ key: day, routes, mapRoutes, activity: texts.join("; ") });
  }
  return rows;
}
export const costRoute = (r) => r.routes.map((p) => p.join(" - ")).join(" ; ");
export const costSignature = (r) => costRoute(r) + "|" + r.activity;

/** Google Maps többpontos útvonal-hivatkozás (autós útvonal, a pontok sorrendjében); 2 pont alatt null. */
export function mapsURL(points) {
  // a pont lehet szöveg (település) vagy {name, address}: a pontos cím az útvonalba kerül, ha van (a Maps maga keresi meg)
  const parts = points.map((p) => encodeURIComponent(String(typeof p === "object" && p ? p.address || p.name : p).trim())).filter(Boolean);
  return parts.length >= 2 ? "https://www.google.com/maps/dir/" + parts.join("/") : null;
}

// ---------- Létszámjelentő ----------

const sameCong = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** A hónap esedékes szombatjai (a regisztrált gyülekezetenként egy-egy sor), a hónapban rögzített, de nem esedékes napi jelentésekkel együtt. */
export function attendanceRows(reports, congregations, y, m) {
  const days = monthDays(y, m);
  if (!days.length) return [];
  const keys = dueDatesBetween(days[0], days[days.length - 1]);
  const prefix = days[0].slice(0, 7);
  for (const r of reports) if (r.date.startsWith(prefix) && !keys.includes(r.date)) keys.push(r.date);
  keys.sort();
  const rows = [];
  for (const k of keys) {
    if (!parseYMD(k)) continue;
    const names = [...congregations];
    for (const r of reports) if (r.date === k && !names.some((n) => sameCong(n, r.congregation))) names.push(r.congregation);
    for (const c of names) rows.push({ key: k, congregation: c, report: reports.find((r) => r.date === k && sameCong(r.congregation, c)) || null });
  }
  return rows;
}
export const attendanceSignature = (r) => (r.report ? [r.report.sabbathSchool.children, r.report.sabbathSchool.adults, r.report.sabbathSchool.guests, r.report.worship.children, r.report.worship.adults, r.report.worship.guests].join(",") : "-");
export const attendanceRowId = (r) => `${r.key}|${r.congregation}`;

/** A hónap havi összesítő sora a Munkajelentő táblázat alján. */
export function workTotals(rows) {
  const parts = [];
  for (const t of columns()) {
    const sum = rows.reduce((a, r) => a + (r.values[t.code] || 0), 0);
    if (sum > 0) parts.push(`${t.shortLabel} ${sum}`);
  }
  return parts.length ? "Összesen: " + parts.join(" · ") : "";
}

/** Hónap elején (10-éig) az előző hónapot kell lezárni: ha annak van adata, azzal indul. */
export function initialMonth(today, entries, reports) {
  const p = parseYMD(today);
  if (!p) return { y: 1970, m: 1 };
  if (p.d <= 10) {
    const prev = p.m === 1 ? { y: p.y - 1, m: 12 } : { y: p.y, m: p.m - 1 };
    const prefix = `${String(prev.y).padStart(4, "0")}-${String(prev.m).padStart(2, "0")}`;
    if (entries.some((e) => e.date.startsWith(prefix)) || reports.some((r) => r.date.startsWith(prefix))) return prev;
  }
  return { y: p.y, m: p.m };
}
