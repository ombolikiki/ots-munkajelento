import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/entries.js";

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

test("oda-vissza út: az Érkezés az Indulás", () => {
  const d = draft({ typeCode: "TRAVEL", workplace: "Tata,  Mór ", departure: "Győr", arrival: "Pápa", roundTrip: true, activity: "Út" });
  const res = E.manualEntry(d, { day: "2026-10-05", mode: "duration", hours: 1, minutes: 0, now });
  assert.ok(res.ok, res.error);
  assert.equal(res.entry.arrival, "Győr");
  assert.equal(res.entry.departure, "Győr");
  assert.equal(res.entry.workplace, "Tata, Mór");
  d.roundTrip = false;
  assert.equal(E.manualEntry(d, { day: "2026-10-05", mode: "duration", hours: 1, minutes: 0, now }).entry.arrival, "Pápa");
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
