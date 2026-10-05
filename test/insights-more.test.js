import test from "node:test";
import assert from "node:assert/strict";
import * as I from "../src/insights.js";

const e = (date, o = {}) => ({ id: date + (o.type || "") + Math.random(), date, type: "MEETING", unit: "ora", durationSeconds: 3600, quantity: null, ...o });

test("visszatekintés kezdőnapja: 7/14/30 nap, e hónap, előző hónap (évhatáron is)", () => {
  assert.equal(I.lookbackStart("7", "2026-10-15"), "2026-10-08");
  assert.equal(I.lookbackStart("14", "2026-01-05"), "2025-12-22");
  assert.equal(I.lookbackStart("30", "2026-03-10"), "2026-02-08");
  assert.equal(I.lookbackStart("thisMonth", "2026-10-15"), "2026-10-01");
  assert.equal(I.lookbackStart("prevMonth", "2026-10-15"), "2026-09-01");
  assert.equal(I.lookbackStart("prevMonth", "2026-01-15"), "2025-12-01");
  assert.equal(I.lookbackStart("x", "2026-10-15"), "2026-09-15");   // hibás érték: 30 nap
  assert.equal(I.normalizeLookback("?"), "thisMonth");
});

test("kitöltetlen napok: vasárnap is, a mai nap nem", () => {
  const dates = new Set(["2026-10-01", "2026-10-02", "2026-10-06"]);
  const m = I.missingDaysFor(dates, "thisMonth", "2026-10-08");
  assert.deepEqual(m, ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-07"]);   // 10-04 vasárnap
  assert.deepEqual(I.missingDaysFor(new Set(), "7", "2026-10-02"), ["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]);
});

test("hiányos napok: csak a múltbeli hétköznap, szabadság és hétvége mentes", () => {
  const by = I.groupByDate([e("2026-10-05", { durationSeconds: 3 * 3600 }), e("2026-10-06", { durationSeconds: 8 * 3600 }),
    e("2026-10-07", { durationSeconds: 3600 }), e("2026-10-07", { type: "HOLIDAY", unit: "egesz_nap", durationSeconds: 0 }),
    e("2026-10-10", { durationSeconds: 3600 }), e("2026-10-08", { type: "PREACHING", unit: "alkalom", quantity: 8, durationSeconds: 0 }),
    e("2026-10-09", { type: "EGYEDI_X", durationSeconds: 8 * 3600 })]);
  assert.deepEqual(I.shortDays(by, "thisMonth", "2026-10-12", 8), ["2026-10-05", "2026-10-09"]);   // 10-09: a saját kategória nem számít
  assert.deepEqual(I.shortDays(by, "thisMonth", "2026-10-12", 3), ["2026-10-09"]);
});

test("egymást követő kitöltetlen napok és az emlékeztető", () => {
  assert.equal(I.consecutiveMissingDays(new Set(), "2026-10-20"), 0);   // nincs mire emlékeztetni
  assert.equal(I.consecutiveMissingDays(new Set(["2026-10-19"]), "2026-10-20"), 0);
  assert.equal(I.consecutiveMissingDays(new Set(["2026-10-10"]), "2026-10-20"), 9);
  assert.equal(I.consecutiveMissingDays(new Set(["2026-10-20"]), "2026-10-20", 30), 30);   // a mai bejegyzés nem számít: tegnaptól számol
  assert.equal(I.consecutiveMissingDays(new Set(["2020-01-01"]), "2026-10-20", 30), 30);   // korlát
});
