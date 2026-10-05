import test from "node:test";
import assert from "node:assert/strict";
import * as I from "../src/insights.js";

const e = (type, over = {}) => ({ type, unit: "ora", durationSeconds: 0, quantity: null, ...over });
const meeting = (h) => e("MEETING", { durationSeconds: h * 3600 });

test("fő és alkalom 1 óra, a saját kategória nem számít, az egész napos 0", () => {
  const day = [meeting(5), e("MISSION_VISITING", { unit: "fo", quantity: 2 }), e("PREACHING", { unit: "alkalom", quantity: 1 })];
  assert.equal(I.officialSeconds(day), 8 * 3600);
  assert.equal(I.officialSeconds([meeting(1), e("EGYEDI_X", { durationSeconds: 7200 })]), 3600);
  assert.equal(I.officialSeconds([e("HOLIDAY", { unit: "egesz_nap" })]), 0);
  assert.equal(I.creditSeconds(e("VISITING", { unit: "fo", quantity: null })), 3600);
});

test("napi elvárás állapotai", () => {
  const mon = "2026-10-05", sat = "2026-10-10", today = "2026-10-07";
  assert.equal(I.targetState(mon, [meeting(8)], today, 8), "reached");
  assert.equal(I.targetState(mon, [meeting(3)], today, 8), "short");
  assert.equal(I.targetState(mon, [], today, 8), "short");
  assert.equal(I.targetState(sat, [], "2026-10-14", 8), "exempt");
  assert.equal(I.targetState("2026-10-11", [], "2026-10-14", 8), "exempt");
  assert.equal(I.targetState(mon, [e("HOLIDAY", { unit: "egesz_nap" })], today, 8), "exempt");
  assert.equal(I.targetState(today, [meeting(1)], today, 8), "inProgress");
  assert.equal(I.targetState("2026-10-08", [], today, 8), "exempt");
  assert.equal(I.targetState(mon, [meeting(6)], today, 6), "reached");
});

test("kitöltetlen napok (vasárnap is)", () => {
  const have = new Set(["2026-10-01", "2026-10-03"]);
  assert.deepEqual(I.missingDays(have, "2026-10-06"), ["2026-10-02", "2026-10-04", "2026-10-05"]);
  assert.deepEqual(I.missingDays(new Set(), "2026-10-01"), []);
  assert.deepEqual(I.missingDays(have, "hibás"), []);
});

test("mentési emlékeztető", () => {
  const day = (d) => ({ date: d });
  assert.equal(I.needsBackupReminder([], null, "2026-10-05"), false);
  assert.equal(I.needsBackupReminder([day("2026-10-05")], null, "2026-10-05"), false);   // friss adat
  assert.equal(I.needsBackupReminder([day("2026-09-28")], null, "2026-10-05"), true);    // egy hete gyűlik
  const now = Date.UTC(2026, 9, 5);
  assert.equal(I.needsBackupReminder([day("2026-09-01")], now - 3 * 86400000, "2026-10-05", now), false);
  assert.equal(I.needsBackupReminder([day("2026-09-01")], now - 20 * 86400000, "2026-10-05", now), true);
});
