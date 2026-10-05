import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/dates.js";

test("a hét kezdőnapja hétfő és vasárnap szerint, évhatáron és szökőnapon át", () => {
  assert.equal(D.startOfWeek("2026-10-07", 2), "2026-10-05");   // szerda -> hétfő
  assert.equal(D.startOfWeek("2026-10-07", 1), "2026-10-04");   // szerda -> vasárnap
  assert.equal(D.startOfWeek("2026-10-04", 2), "2026-09-28");   // vasárnap a hétfői héten
  assert.equal(D.startOfWeek("2026-10-04", 1), "2026-10-04");
  assert.equal(D.startOfWeek("2027-01-01", 2), "2026-12-28");   // évhatár
  assert.equal(D.startOfWeek("2028-03-01", 2), "2028-02-28");   // szökőév
  assert.equal(D.startOfWeek("nincs", 2), "nincs");
  for (let y = 2024; y <= 2035; y++) for (let m = 1; m <= 12; m++) for (const d of D.monthDays(y, m)) {
    const mon = D.startOfWeek(d, 2), sun = D.startOfWeek(d, 1);
    assert.equal(D.weekday(mon), 1, d); assert.equal(D.weekday(sun), 0, d);
    assert.ok(mon <= d && D.addDays(mon, 6) >= d); assert.ok(sun <= d && D.addDays(sun, 6) >= d);
  }
});

test("hónapléptetés", () => {
  assert.deepEqual(D.shiftMonth(2026, 1, -1), { y: 2025, m: 12 });
  assert.deepEqual(D.shiftMonth(2026, 12, 1), { y: 2027, m: 1 });
  assert.deepEqual(D.shiftMonth(2026, 3, -15), { y: 2024, m: 12 });
  assert.deepEqual(D.shiftMonth(2026, 13, 1), { y: 2026, m: 13 });
});

test("a létszámjelentő esedékes napjai: minden negyedév második és hetedik szombatja, 2024–2035", () => {
  assert.deepEqual(D.dueDatesOfQuarter(2026, 3), ["2026-07-11", "2026-08-15"]);
  assert.deepEqual(D.dueDatesOfQuarter(2026, 4), ["2026-10-10", "2026-11-14"]);
  assert.deepEqual(D.dueDatesOfQuarter(2027, 1), ["2027-01-09", "2027-02-13"]);
  for (let y = 2024; y <= 2035; y++) for (let q = 1; q <= 4; q++) {
    const sats = D.saturdays(y, q), due = D.dueDatesOfQuarter(y, q);
    assert.ok(sats.length >= 12 && sats.length <= 14, `${y} Q${q}: ${sats.length}`);
    assert.ok(sats.every((s) => D.isSaturday(s) && D.quarterOf(s).q === q && D.quarterOf(s).y === y));
    assert.deepEqual(due, [sats[1], sats[6]]);
    assert.ok(due.every((s) => D.isDueDay(s)));
    assert.equal(D.isDueDay(D.addDays(due[0], 1)), false);
  }
  assert.deepEqual(D.saturdays(2026, 5), []); assert.deepEqual(D.dueDatesOfQuarter(2026, 0), []);
});

test("esedékes napok egy tartományban (negyedév- és évhatáron át)", () => {
  assert.deepEqual(D.dueDatesBetween("2026-10-01", "2026-10-31"), ["2026-10-10"]);
  assert.deepEqual(D.dueDatesBetween("2026-08-01", "2027-02-28"), ["2026-08-15", "2026-10-10", "2026-11-14", "2027-01-09", "2027-02-13"]);
  assert.deepEqual(D.dueDatesBetween("2026-10-10", "2026-10-10"), ["2026-10-10"]);   // a határnapok beleszámítanak
  assert.deepEqual(D.dueDatesBetween("2026-10-11", "2026-10-10"), []);
  assert.deepEqual(D.dueDatesBetween("rossz", "2026-10-10"), []);
});

test("segédek: percek és nevek", () => {
  assert.equal(D.minutesOfDay("09:30:15"), 570); assert.equal(D.minutesOfDay("25:00"), null); assert.equal(D.minutesOfDay(""), null);
  assert.equal(D.hmFromMinutes(615), "10:15");
  assert.equal(D.formatMonth(2026, 10), "2026. október");
  assert.equal(D.dayOfMonth("2026-10-05"), 5);
  assert.equal(D.dayName("2026-10-05"), "H");
});
