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
  assert.equal(I.targetState(sat, [], "2026-10-14", 8), "short");              // az üres hétvége jelez
  assert.equal(I.targetState("2026-10-11", [], "2026-10-14", 8), "short");
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

import * as D from "../src/dates.js";
const entryOn = (type, day, over = {}) => ({ type, date: day, unit: type === "DAY_OFF" ? "egesz_nap" : "ora", durationSeconds: 0, quantity: null, ...over });

test("hétvége: üresen jelez, bármilyen bejegyzés elég, az egész napos kitöltött (2024–2035 minden negyedév)", () => {
  let n = 0;
  for (let y = 2024; y <= 2035; y++) for (let q = 1; q <= 4; q++) for (const sat of D.saturdays(y, q)) {
    const sun = D.addDays(sat, 1), later = D.addDays(sat, 3);
    const ok = I.targetState(sat, [], later, 8) === "short" && I.targetState(sun, [], later, 8) === "short"
      && I.targetState(sat, [entryOn("PREACHING", sat, { unit: "alkalom", quantity: 1 })], later, 8) === "exempt"
      && I.targetState(sun, [entryOn("MEETING", sun, { durationSeconds: 900 })], later, 8) === "exempt"
      && I.targetState(sun, [entryOn("DAY_OFF", sun)], later, 8) === "exempt"
      && I.targetState(sat, [], sat, 8) === "inProgress"
      && I.targetState(sun, [], sat, 8) === "exempt";   // a jövő mentes
    assert.ok(ok, `${y}/Q${q} ${sat}`);
    n++;
  }
  assert.ok(n > 600, String(n));
  assert.equal(I.targetState("2026-10-05", [entryOn("MEETING", "2026-10-05", { durationSeconds: 3 * 3600 })], "2026-10-14", 8), "short");   // hétköznap változatlan
  assert.equal(I.targetState("2026-10-05", [entryOn("MEETING", "2026-10-05", { durationSeconds: 8 * 3600 })], "2026-10-14", 8), "reached");
});

test("a hónap heteinek száma: 28 nap = 4, 29–31 nap = 5 (2024–2035, szökőév is)", () => {
  for (let y = 2024; y <= 2035; y++) for (let m = 1; m <= 12; m++) {
    const days = D.daysInMonth(y, m);
    assert.equal(I.weeksInMonth(y, m), days === 28 ? 4 : 5, `${y}-${m}`);
  }
  assert.ok(I.weeksInMonth(2026, 13) >= 4 && I.weeksInMonth(0, 0) >= 4 && I.weeksInMonth(NaN, 1) >= 4);
});

test("havi korlát figyelmeztetés: szabadnap és munkaszüneti nap külön számít, a rögzítést nem akadályozza", () => {
  const off = (d) => entryOn("DAY_OFF", d), pub = (d) => entryOn("PUBLIC_HOLIDAY", d, { unit: "egesz_nap" });
  const feb = ["2026-02-01", "2026-02-08", "2026-02-15", "2026-02-22"].map(off);   // 28 napos hónap: 4
  assert.equal(I.monthLimitWarning(feb, feb[3]), null);
  const five = [...feb, off("2026-02-03")];
  assert.match(I.monthLimitWarning(five, five[4]), /5 szabadnap.*legfeljebb 4-t/);
  const oct = ["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25", "2026-10-02"].map(off);   // 31 nap: 5
  assert.equal(I.monthLimitWarning(oct, oct[4]), null);
  assert.match(I.monthLimitWarning([...oct, off("2026-10-03")], off("2026-10-03")), /6 szabadnap.*legfeljebb 5-t/);
  const mixed = [...oct, ...["2026-10-05", "2026-10-06"].map(pub)];
  assert.equal(I.monthLimitWarning(mixed, pub("2026-10-06")), null);   // külön számolva
  assert.equal(I.monthLimitWarning(oct, entryOn("MEETING", "2026-10-02")), null);
});
