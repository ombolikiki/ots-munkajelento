import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/entries.js";
import * as P from "../src/calendarParser.js";
import * as M from "../src/manual.js";

const now = new Date(2026, 9, 5, 15, 0, 0);   // 2026-10-05 15:00
const draft = (o = {}) => ({ ...E.emptyDraft(), ...o });

test("kötelező mezők: a Tevékenység csak az Utazásnál kötelező", () => {
  assert.match(E.missingHint(draft()), /típus/);
  assert.equal(E.missingHint(draft({ typeCode: "MEETING", workplace: "Győr" })), null);
  assert.match(E.missingHint(draft({ typeCode: "MEETING" })), /Munkahely/);
  assert.equal(E.missingHint(draft({ typeCode: "HOLIDAY" })), null);
  const travel = { typeCode: "TRAVEL", destination: "Tata", departure: "Győr", activity: "" };
  assert.match(E.missingHint(draft(travel)), /Tevékenység/);
  assert.equal(E.missingHint(draft({ ...travel, activity: "Hittan" })), null);
  assert.match(E.missingHint(draft({ ...travel, activity: "x", departure: "" })), /Kiindulás/);
  assert.match(E.missingHint(draft({ ...travel, activity: "x", destination: " , " })), /Cél/);
});

test("kézi bevitel: jövő tiltása és tól–ig szabályok", () => {
  const d = draft({ typeCode: "MEETING", workplace: "Győr" });
  const ok = E.manualEntry(d, { day: "2026-10-05", mode: "range", from: "09:00", to: "10:30", now });
  assert.ok(ok.ok); assert.equal(ok.entry.durationSeconds, 5400); assert.equal(ok.entry.start, "09:00:00"); assert.equal(ok.entry.end, "10:30:00");
  assert.equal(E.manualEntry(d, { day: "2026-10-06", mode: "range", from: "09:00", to: "10:00", now }).ok, false);   // holnap
  assert.match(E.manualEntry(d, { day: "2026-10-05", mode: "range", from: "14:00", to: "16:00", now }).error, /Jövőbeli/);  // ma, még nem volt
  assert.ok(E.manualEntry(d, { day: "2026-10-05", mode: "range", from: "14:00", to: "15:00", now }).ok);
  assert.match(E.manualEntry(d, { day: "2026-10-04", mode: "range", from: "10:00", to: "09:00", now }).error, /után/);
  assert.match(E.manualEntry(d, { day: "2026-10-04", mode: "range", from: "", to: "09:00", now }).error, /időpont/);
  assert.equal(E.manualEntry(d, { day: "2026-02-30", mode: "range", from: "09:00", to: "10:00", now }).ok, false);
});

test("kézi bevitel: óraszám, mennyiség, egész napos", () => {
  const d = draft({ typeCode: "OFFICE_WORK", workplace: "Győr" });
  const r = E.manualEntry(d, { day: "2026-10-04", mode: "duration", hours: 2, minutes: 15, now });
  assert.equal(r.entry.durationSeconds, 8100); assert.equal(r.entry.start, null);
  assert.equal(E.manualEntry(d, { day: "2026-10-04", mode: "duration", hours: 0, minutes: 0, now }).ok, false);
  const v = E.manualEntry(draft({ typeCode: "VISITING", workplace: "Mór", quantity: 3 }), { day: "2026-10-04", mode: "duration", now });
  assert.equal(v.entry.quantity, 3); assert.equal(v.entry.durationSeconds, 0);
  const h = E.manualEntry(draft({ typeCode: "HOLIDAY" }), { day: "2026-10-04", now });
  assert.equal(h.entry.workplace, "SZABADSÁG"); assert.equal(h.entry.unit, "egesz_nap");
  assert.equal(E.manualEntry(draft({ typeCode: "HOLIDAY" }), { day: "2026-10-09", now }).ok, false);
});

test("időmérős bejegyzés: nap, idők, időtartam", () => {
  const d = draft({ typeCode: "PREPARING", workplace: "Győr", activity: " Prédikáció " });
  const s = new Date(2026, 9, 5, 8, 0, 0).getTime();
  const e = E.timedEntry(d, s, s + 95 * 60 * 1000);
  assert.equal(e.date, "2026-10-05"); assert.equal(e.start, "08:00:00"); assert.equal(e.end, "09:35:00");
  assert.equal(e.durationSeconds, 5700); assert.equal(e.activity, "Prédikáció"); assert.equal(e.source, "timer");
});

test("éjfélen átnyúló időmérés a kezdés napjára kerül", () => {
  const d = draft({ typeCode: "MEETING", workplace: "Győr" });
  const s = new Date(2026, 9, 5, 23, 30, 0).getTime();
  const e = E.timedEntry(d, s, s + 60 * 60 * 1000);
  assert.equal(e.date, "2026-10-05"); assert.equal(e.start, "23:30:00"); assert.equal(e.end, "00:30:00"); assert.equal(e.durationSeconds, 3600);
});

test("helyszínek tanulása", () => {
  const e = { unit: "ora", workplace: "Tata, győr", departure: "Győr", arrival: "Mór" };   // Mór az Érkezésből is tanulható
  assert.deepEqual(E.learnPlaces(["Győr"], e), ["Győr", "Tata", "Mór"]);
  assert.deepEqual(E.learnPlaces(["A"], { unit: "egesz_nap", workplace: "SZABADSÁG" }), ["A"]);
});

test("egyesítés azonosító szerint", () => {
  const a = { id: "a", date: "2026-10-05", start: "09:00:00" }, b = { id: "b", date: "2026-10-04", start: null };
  const r = E.mergeEntries([a], [a, b]);
  assert.equal(r.added, 1); assert.equal(r.skipped, 1);
  assert.deepEqual(r.entries.map((x) => x.id), ["b", "a"]);
});

test("a Start/Rögzítés gomb állapota beíráskor változik", () => {
  const d = draft({ typeCode: "MEETING" });
  assert.deepEqual(E.gate("timer", d), { disabled: true, text: "A Munkahely mező kötelező." });
  d.workplace = "Új település";                          // beírás után a gomb engedélyezett
  assert.deepEqual(E.gate("timer", d), { disabled: false, text: "" });
  assert.deepEqual(E.gate("manual", d), { disabled: false, text: "" });
  assert.equal(E.gate("timer", draft({ typeCode: "HOLIDAY" })).disabled, true);   // egész napos: az Időzítőn nem
  assert.equal(E.gate("manual", draft({ typeCode: "HOLIDAY" })).disabled, false);
  assert.equal(E.gate("timer", draft()).disabled, true);
});

const travel = (o = {}) => draft({ typeCode: "TRAVEL", destination: "Tata", activity: "Kiszállás", departure: "Győr", ...o });
const entryOf = (d) => E.manualEntry(d, { day: "2026-10-04", mode: "duration", hours: 0, minutes: 30, now }).entry;
const pts = (e) => M.routePoints(e, "X");
const S = (settlement, address = null) => ({ settlement, address });

test("beírt hely: település, település és cím, fordított sorrend, irányítószám, hibás", () => {
  const pp = P.parsePlace;
  assert.deepEqual(pp("Tata"), S("Tata"));
  assert.deepEqual(pp("Tata, Fő út 1."), S("Tata", "Fő út 1., Tata"));
  assert.deepEqual(pp("Tata, Fő út 1., I. emelet"), S("Tata", "Fő út 1., I. emelet, Tata"));
  assert.deepEqual(pp("Fő út 1., Tata"), S("Tata", "Fő út 1., Tata"));
  assert.equal(pp("9021 Győr, Fő u. 3.").settlement, "Győr"); assert.equal(pp("Fő u. 3., 9021 Győr, Magyarország").settlement, "Győr");
  assert.deepEqual(pp("Tata, Fő út"), S("Tata", "Fő út, Tata"));
  assert.equal(pp("Győr-Moson").settlement, "Győr-Moson");
  for (const bad of ["", "  ,  ", "12", "Fő utca 3", "Fő út 1.", null, undefined]) assert.equal(pp(bad), null, String(bad));
  assert.equal(pp("Tata, Mór"), null);   // egyetlen helyből nem lesz több
});

test("helyek a Célban: vesszős lista, cím a megelőző településhez, fordított cím, elválasztók", () => {
  const pl = P.parsePlaces;
  assert.deepEqual(pl("Tata, Mór"), [S("Tata"), S("Mór")]);
  assert.deepEqual(pl("Tata, Fő út 1., Mór"), [S("Tata", "Fő út 1., Tata"), S("Mór")]);
  assert.deepEqual(pl("Tata, Fő út 1., Mór, Kossuth u. 5."), [S("Tata", "Fő út 1., Tata"), S("Mór", "Kossuth u. 5., Mór")]);
  assert.deepEqual(pl("Tata, Mór, Kossuth u. 5."), [S("Tata"), S("Mór", "Kossuth u. 5., Mór")]);
  assert.deepEqual(pl("Tata - Mór u. 5., Mór").map((p) => p.settlement), ["Tata", "Mór"]);
  assert.deepEqual(pl("Tata, Fő út 1.; Mór").map((p) => p.settlement), ["Tata", "Mór"]);
  assert.deepEqual(pl("Tata, Fő út 1., Kossuth u. 5., Mór"), [S("Tata", "Fő út 1., Tata"), S("Mór", "Kossuth u. 5., Mór")]);
  assert.deepEqual(pl("Tata – Mór").map((p) => p.settlement), ["Tata", "Mór"]);   // a „–” is elválaszt
  assert.deepEqual(pl("Tata, Fő út 1., II. emelet 3., Mór"), [S("Tata", "Fő út 1., II. emelet 3., Tata"), S("Mór")]);   // az emelet/ajtó a cím folytatása
  for (const bad of ["", "  ,  ", "12", "Fő utca 3", "Fő út 1."]) assert.equal(pl(bad), null, bad);
});

test("Utazás: Kiindulás, Cél, oda-vissza (alapból), egyirányú", () => {
  assert.equal(E.emptyDraft().roundTrip, true); assert.equal(E.emptyDraft().workplaceIsDeparture, false);
  let e = entryOf(travel());
  assert.deepEqual(pts(e), ["Győr", "Tata", "Győr"]); assert.ok(e.departure === "Győr" && e.arrival === "Győr" && e.workplace === "Tata" && !e.workplaceIsDeparture);
  e = entryOf(travel({ destination: "Tata, Mór" }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór", "Győr"]); assert.equal(e.workplace, "Tata, Mór");
  e = entryOf(travel({ destination: "Tata, Mór", roundTrip: false }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór"]); assert.equal(e.arrival, "Mór");
  e = entryOf(travel({ roundTrip: false }));
  assert.deepEqual(pts(e), ["Győr", "Tata"]); assert.equal(e.workplace, "Tata");
});

test("Utazás: pontos címek csak az egyik oldalon, vagy mindkettőn; az OTS útvonal települések, a térkép címekkel", () => {
  let e = entryOf(travel({ departure: "Győr, Fő út 1." }));
  assert.ok(e.departure === "Győr" && e.departureAddress === "Fő út 1., Győr" && e.arrivalAddress === "Fő út 1., Győr" && e.address === null);
  e = entryOf(travel({ destination: "Tata, Kossuth u. 5." }));
  assert.ok(e.departureAddress === null && e.arrivalAddress === null && e.address === "Kossuth u. 5., Tata" && e.workplace === "Tata");
  e = entryOf(travel({ departure: "Győr, Fő út 1.", destination: "Tata, Kossuth u. 5., Mór" }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór", "Győr"]);
  assert.deepEqual(M.routeDetail(e, "Győr").map((p) => p.address), ["Fő út 1., Győr", "Kossuth u. 5., Tata", null, "Fő út 1., Győr"]);
  e = entryOf(travel({ departure: "Győr, Fő út 1.", destination: "Tata, Kossuth u. 5., Mór", roundTrip: false }));
  const rd = M.routeDetail(e, "Győr");   // egyirányú útnál az utolsó cél nem duplázódik
  assert.deepEqual(rd.map((p) => p.name), ["Győr", "Tata", "Mór"]); assert.deepEqual(rd.map((p) => p.address), ["Fő út 1., Győr", "Kossuth u. 5., Tata", null]);
  assert.equal(e.arrivalAddress, null);
  const plain = entryOf(draft({ typeCode: "MEETING", workplace: "Győr" }));
  assert.ok(plain.departure === null && plain.departureAddress === null && plain.arrivalAddress === null && plain.address === null && plain.workplaceIsDeparture === false);
});

test("Utazás: hibás űrlap nem rögzíthető", () => {
  assert.match(E.missingHint(travel({ destination: "5" })), /Cél/);
  assert.match(E.missingHint(travel({ departure: "Győr, Mór" })), /Kiindulás/);   // a Kiindulás csak egy hely lehet
  assert.match(E.missingHint(travel({ departure: "" })), /Kiindulás/);
  assert.match(E.missingHint(travel({ destination: "" })), /Cél/);
  assert.match(E.missingHint(travel({ activity: "" })), /Tevékenység/);
  assert.equal(E.missingHint(travel()), null);
});

test("Utazás: Munkahely a Kiindulás — a bejegyzés jelöli, az útvonal változatlan, az OTS Munkahelye az Indulás", () => {
  const e = entryOf(travel({ destination: "Tata, Mór", workplaceIsDeparture: true }));
  assert.ok(e.workplaceIsDeparture && pts(e).join() === "Győr,Tata,Mór,Győr" && e.workplace === "Tata, Mór");
  assert.deepEqual(M.workplaceList([e]), ["Győr"]);
  assert.deepEqual(M.workplaceList([entryOf(travel({ destination: "Tata, Mór" }))]), ["Tata", "Mór"]);
  assert.equal(entryOf(draft({ typeCode: "MEETING", workplace: "Győr", workplaceIsDeparture: true })).workplaceIsDeparture, false);   // nem Utazásnál nincs
});

test("Utazás: mentés és újraolvasás CSV-n át (cím, Munkahely helye)", async () => {
  const { encodeText, decode } = await import("../src/csv.js");
  const e = entryOf(travel({ departure: "Győr, Fő út 1.", destination: "Tata, Kossuth u. 5.", workplaceIsDeparture: true }));
  const back = decode(encodeText([e])).entries[0];
  assert.ok(back.departureAddress === "Fő út 1., Győr" && back.address === "Kossuth u. 5., Tata" && back.workplaceIsDeparture && back.workplace === "Tata" && back.departure === "Győr");
});

test("Google Maps: a Kiindulás és a Cél pontos címe az útvonalba kerül", () => {
  const e = entryOf(travel({ departure: "Győr, Fő út 1.", destination: "Tata, Kossuth u. 5.", roundTrip: false }));
  const url = M.mapsURL(M.routeDetail(e, "Győr"));
  assert.equal(url, "https://www.google.com/maps/dir/" + ["F\u0151 \u00FAt 1., Gy\u0151r", "Kossuth u. 5., Tata"].map(encodeURIComponent).join("/"));
});

test("a Cél kiegészítése és a hely szövege az űrlapon", () => {
  assert.equal(E.placeText("Tata", "Fő út 1., Tata"), "Tata, Fő út 1.");
  assert.equal(E.placeText("Tata", null), "Tata");
  assert.equal(E.placeText("Tata", "Fő út 1., II. emelet, Tata"), "Tata, Fő út 1., II. emelet");
});

// ---------- Kilométeróra ----------
const tripEntry = (id, date, s, en) => ({ id, date, type: "TRAVEL", startKm: s, endKm: en });

test("km-érték: üres rendben, szóköz megengedett, hibás érték jelzett", () => {
  assert.deepEqual(E.kmValue(""), { value: null, valid: true });
  assert.deepEqual(E.kmValue("  "), { value: null, valid: true });
  assert.deepEqual(E.kmValue("123 456"), { value: 123456, valid: true });
  assert.deepEqual(E.kmValue("0"), { value: 0, valid: true }); assert.deepEqual(E.kmValue("9999999"), { value: 9999999, valid: true });
  for (const bad of ["abc", "-1", "1e99", "inf", "nan", "10000000", "12x"]) assert.equal(E.kmValue(bad).valid, false, bad);
});

test("km-ellenőrzés: az érkező nagyobb az indulónál, az induló nem kisebb az előző út végállásánál", () => {
  assert.equal(E.kmProblem(1000, 1060, null), null);
  assert.equal(E.kmProblem(null, null, 1000), null);   // mindkettő opcionális
  assert.match(E.kmProblem(1000, 1000, null), /nagyobbnak kell lennie/); assert.match(E.kmProblem(1000, 900, null), /nagyobbnak kell lennie/);
  assert.match(E.kmProblem(900, 950, 1000), /Az induló km-állás \(900\) kisebb, mint az előző út érkező állása \(1000\)\./);
  assert.equal(E.kmProblem(1000, 1050, 1000), null);   // az egyenlő rendben van
  assert.match(E.kmProblem(null, 1000, 1000), /Az érkező km-állás \(1000\) nem lehet kisebb/); assert.equal(E.kmProblem(null, 1001, 1000), null);
});

test("km: előző út a napig (bezárólag), előtöltés, az Utazás űrlap hibája és a rögzítés tiltása", () => {
  const list = [tripEntry("a", "2026-10-01", 1000, 1060), tripEntry("b", "2026-10-03", 1060, 1100), { id: "m", date: "2026-10-04", type: "MEETING", startKm: null, endKm: null }, tripEntry("c", "2026-10-05", 1100, null)];
  assert.equal(E.lastEndKm(list), 1100); assert.equal(E.lastEndKm([]), null);
  assert.equal(E.previousEndKm(list, "2026-10-04"), 1100); assert.equal(E.previousEndKm(list, "2026-10-02"), 1060); assert.equal(E.previousEndKm(list, "2026-09-30"), null);
  assert.equal(E.previousEndKm(list, "2026-10-09", "b"), 1060);   // a javított bejegyzés nélkül
  const d = (o) => travel({ startKm: "", endKm: "", ...o });
  assert.equal(E.missingHint(d({ startKm: "1100", endKm: "1180" }), { entries: list, day: "2026-10-06" }), null);
  assert.equal(E.missingHint(d({}), { entries: list, day: "2026-10-06" }), null);   // üresen rendben
  assert.equal(E.missingHint(d({ startKm: "12a" }), { entries: list, day: "2026-10-06" }), "A km-állás egész szám legyen.");
  assert.match(E.missingHint(d({ startKm: "1000" }), { entries: list, day: "2026-10-06" }), /kisebb, mint az előző út/);
  assert.match(E.missingHint(d({ startKm: "1000" }), { entries: list, day: "2026-10-02" }), /kisebb, mint az előző út érkező állása \(1060\)/);   // az akkori előző állás 1060
  assert.equal(E.missingHint(d({ startKm: "1060" }), { entries: list, day: "2026-10-02" }), null);
  assert.match(E.missingHint(d({ endKm: "1100" }), { entries: list, day: "2026-10-06" }), /Az érkező km-állás \(1100\) nem lehet kisebb/);   // csak az érkező van meg
  const bad = E.manualEntry(d({ startKm: "1200", endKm: "1100" }), { day: "2026-10-04", mode: "duration", hours: 0, minutes: 30, now, existing: list });
  assert.equal(bad.ok, false); assert.match(bad.error, /nagyobbnak/);
  const ok = E.manualEntry(d({ startKm: "1 200", endKm: "1260" }), { day: "2026-10-05", mode: "duration", hours: 0, minutes: 30, now, existing: list });
  assert.ok(ok.ok, ok.error); assert.deepEqual([ok.entry.startKm, ok.entry.endKm, E.kmDriven(ok.entry)], [1200, 1260, 60]);
  assert.deepEqual([E.kmDriven({ startKm: 5, endKm: null }), E.kmDriven({ startKm: 9, endKm: 5 }), E.kmDriven({ startKm: 5, endKm: 9 })], [null, null, 4]);
  const plain = E.manualEntry(draft({ typeCode: "MEETING", workplace: "Győr", startKm: "1", endKm: "2" }), { day: "2026-10-04", mode: "duration", hours: 1, minutes: 0, now }).entry;
  assert.deepEqual([plain.startKm, plain.endKm], [null, null]);   // nem Utazás soha nem kap km-et
  assert.deepEqual(E.monthKm([...list, tripEntry("z", "2026-11-02", 1, 5)], "2026-10-15"), { km: 100, incomplete: 1 });
  assert.equal(E.gate("manual", d({ startKm: "x" }), { entries: list, day: "2026-10-06" }).disabled, true);
});
