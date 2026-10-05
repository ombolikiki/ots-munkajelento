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
  const travel = { typeCode: "TRAVEL", workplace: "Tata", departure: "Győr", arrival: "Győr", activity: "" };
  assert.match(E.missingHint(draft(travel)), /Tevékenység/);
  assert.equal(E.missingHint(draft({ ...travel, activity: "Hittan" })), null);
  assert.match(E.missingHint(draft({ ...travel, activity: "x", arrival: "" })), /Érkezés/);
  assert.equal(E.missingHint(draft({ ...travel, activity: "x", arrival: "", roundTrip: true })), null);
  assert.match(E.missingHint(draft({ ...travel, activity: "x", departure: "" })), /Indulás/);
  assert.match(E.missingHint(draft({ ...travel, activity: "x", workplace: " , " })), /Munkahely/);
});

test("oda-vissza út: az Érkezés az Indulás, a beírt Érkezés utolsó Munkahelyként szerepel (A - B - C - A)", () => {
  const d = draft({ typeCode: "TRAVEL", workplace: "Tata,  Mór ", departure: "Győr", arrival: "Pápa", roundTrip: true, activity: "Út" });
  const res = E.manualEntry(d, { day: "2026-10-05", mode: "duration", hours: 1, minutes: 0, now });
  assert.ok(res.ok, res.error);
  assert.equal(res.entry.arrival, "Győr");
  assert.equal(res.entry.departure, "Győr");
  assert.equal(res.entry.workplace, "Tata, Mór, Pápa");
  d.roundTrip = false;
  const r2 = E.manualEntry(d, { day: "2026-10-05", mode: "duration", hours: 1, minutes: 0, now }).entry;
  assert.equal(r2.arrival, "Pápa"); assert.equal(r2.workplace, "Tata, Mór");
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
  const e = { unit: "ora", workplace: "Tata, győr", departure: "Győr", arrival: "Mór" };
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

const travel = (o = {}) => draft({ typeCode: "TRAVEL", workplace: "Tata", activity: "Kiszállás", departure: "Győr", arrival: "Mór", ...o });
const entryOf = (d) => E.manualEntry(d, { day: "2026-10-04", mode: "duration", hours: 0, minutes: 30, now }).entry;
const pts = (e) => M.routePoints(e, "X");

test("beírt hely: település, település és cím, fordított sorrend, irányítószám, hibás", () => {
  const pp = P.parsePlace;
  assert.deepEqual(pp("Tata"), { settlement: "Tata", address: null });
  assert.deepEqual(pp("Tata, Fő út 1."), { settlement: "Tata", address: "Fő út 1., Tata" });
  assert.deepEqual(pp("Tata, Fő út 1., I. emelet"), { settlement: "Tata", address: "Fő út 1., I. emelet, Tata" });
  assert.deepEqual(pp("Fő út 1., Tata"), { settlement: "Tata", address: "Fő út 1., Tata" });
  assert.equal(pp("9021 Győr, Fő u. 3.").settlement, "Győr"); assert.equal(pp("Fő u. 3., 9021 Győr, Magyarország").settlement, "Győr");
  assert.deepEqual(pp("Tata, Fő út"), { settlement: "Tata", address: "Fő út, Tata" });
  assert.equal(pp("Győr-Moson").settlement, "Győr-Moson");
  for (const bad of ["", "  ,  ", "12", "Fő utca 3", null, undefined]) assert.equal(pp(bad), null, String(bad));
});

test("Utazás: Indulás és Érkezés település vagy pontos cím, külön-külön", () => {
  let e = entryOf(travel());
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór"]); assert.ok(e.arrival === "Mór" && e.departureAddress === null && e.arrivalAddress === null && e.address === null);
  e = entryOf(travel({ departure: "Győr, Fő út 1." }));
  assert.ok(e.departure === "Győr" && e.departureAddress === "Fő út 1., Győr" && e.arrival === "Mór" && e.arrivalAddress === null);
  e = entryOf(travel({ arrival: "Mór, Kossuth u. 5." }));
  assert.ok(e.arrival === "Mór" && e.arrivalAddress === "Kossuth u. 5., Mór" && e.departureAddress === null);
  e = entryOf(travel({ departure: "Győr, Fő út 1.", arrival: "Mór, Kossuth u. 5." }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór"]);   // az OTS útvonal települések
  assert.deepEqual(M.routeDetail(e, "Győr").map((p) => p.address), ["Fő út 1., Győr", null, "Kossuth u. 5., Mór"]);
  assert.match(E.missingHint(travel({ arrival: "5" })), /Érkezés/); assert.match(E.missingHint(travel({ departure: "Fő utca 3" })), /Indulás/);
  assert.equal(E.missingHint(travel()), null);
  const plain = entryOf(draft({ typeCode: "MEETING", workplace: "Győr" }));
  assert.ok(plain.departure === null && plain.departureAddress === null && plain.arrivalAddress === null && plain.address === null);
});

test("oda-vissza út: az Érkezés mező írható, az útvonal végére az Indulás kerül", () => {
  let e = entryOf(travel({ roundTrip: true }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Mór", "Győr"]); assert.ok(e.departure === "Győr" && e.arrival === "Győr" && e.workplace === "Tata, Mór");
  e = entryOf(travel({ roundTrip: true, arrival: "Győr" }));
  assert.deepEqual(pts(e), ["Győr", "Tata", "Győr"]); assert.equal(e.workplace, "Tata");   // az Indulással egyező, cím nélküli Érkezés nem kerül kétszer
  e = entryOf(travel({ roundTrip: true, arrival: "" }));
  assert.ok(E.missingHint(travel({ roundTrip: true, arrival: "" })) === null && pts(e).join() === "Győr,Tata,Győr");   // az Érkezés nem kötelező
  e = entryOf(travel({ roundTrip: true, arrival: "Mór, Kossuth u. 5." }));
  const rd = M.routeDetail(e, "Győr");
  assert.ok(e.address === "Kossuth u. 5., Mór" && e.workplace === "Tata, Mór" && rd.map((p) => p.name).join() === "Győr,Tata,Mór,Győr" && rd[2].address === "Kossuth u. 5., Mór" && rd[3].address === null);
  e = entryOf(travel({ roundTrip: true, departure: "Győr, Fő út 1.", arrival: "Mór" }));
  const rd3 = M.routeDetail(e, "Győr");
  assert.ok(rd3.length === 4 && rd3[0].address === "Fő út 1., Győr" && rd3[3].address === "Fő út 1., Győr");   // a visszaút az Indulás pontos címére megy
  assert.equal(entryOf(travel({ roundTrip: true, departure: "Győr", arrival: "Győr", workplace: "Tata" })).workplace, "Tata");   // az alapértelmezett Érkezés nem duplázódik
  e = entryOf(travel({ workplace: "Tata, Mór", roundTrip: true, arrival: "Győr" }));
  assert.ok(e.workplace === "Tata, Mór" && pts(e).join() === "Győr,Tata,Mór,Győr");
});

test("Google Maps: az Indulás/Érkezés pontos címe az útvonalba kerül", () => {
  const e = entryOf(travel({ departure: "Győr, Fő út 1.", arrival: "Mór, Kossuth u. 5." }));
  const url = M.mapsURL(M.routeDetail(e, "Győr"));
  assert.equal(url, "https://www.google.com/maps/dir/" + ["F\u0151 \u00FAt 1., Gy\u0151r", "Tata", "Kossuth u. 5., M\u00F3r"].map(encodeURIComponent).join("/"));
});
