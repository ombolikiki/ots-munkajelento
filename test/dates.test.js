import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../src/dates.js";

test("érvénytelen dátum null", () => {
  for (const s of ["2026-02-30", "2026-13-01", "0000-01-01", "2026-1-1", "", null, undefined, "abc", "2027-02-29"]) assert.equal(D.parseYMD(s), null, String(s));
  assert.deepEqual(D.parseYMD("2028-02-29"), { y: 2028, m: 2, d: 29 });
});

test("hónapok napszáma 2024–2035 (szökőév is)", () => {
  for (let y = 2024; y <= 2035; y++) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const exp = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m <= 12; m++) {
      const days = D.monthDays(y, m);
      assert.equal(days.length, exp[m - 1], `${y}-${m}`);
      assert.ok(days.every((s) => D.parseYMD(s)?.m === m));
      assert.equal(days[0], D.ymd(y, m, 1));
    }
  }
  assert.equal(D.daysInMonth(2026, 13), 0);
  assert.deepEqual(D.monthDays(2026, 0), []);
});

test("addDays évhatáron, szökőnapon és nyári időszámítás váltásán át", () => {
  assert.equal(D.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(D.addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(D.addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(D.addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(D.addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(D.addDays("2026-10-24", 2), "2026-10-26");
  assert.equal(D.addDays("2026-03-08", 1), "2026-03-09");   // amerikai váltás
  assert.equal(D.addDays("2026-09-26", 7), "2026-10-03");   // új-zélandi váltás környéke
  assert.equal(D.addDays("hibás", 3), "hibás");
});

test("addDays sosem téveszt egy teljes évben, egymás után", () => {
  let d = "2024-01-01", n = 0;
  while (d < "2036-01-01") { const next = D.addDays(d, 1); assert.ok(next > d, d); d = next; n++; }
  assert.equal(n, 4383);   // 2024–2035 napjainak száma (3 szökőév: 2024, 2028, 2032)
});

test("hét napjai", () => {
  assert.equal(D.weekday("2026-10-05"), 1);          // hétfő
  assert.ok(D.isWeekday("2026-10-05") && D.isWeekday("2026-10-09"));
  assert.ok(D.isSaturday("2026-10-10") && D.isSunday("2026-10-11"));
  assert.ok(!D.isWeekday("2026-10-10") && !D.isWeekday("2026-10-11"));
  assert.equal(D.weekday("hibás"), -1);
});

test("a mai nap helyi nap, a jövő felismerése", () => {
  const now = new Date(2026, 9, 5, 23, 59, 59);
  assert.equal(D.todayYMD(now), "2026-10-05");
  assert.ok(D.isFutureDay("2026-10-06", now) && !D.isFutureDay("2026-10-05", now));
  assert.equal(D.toYMD(new Date(2026, 0, 1, 0, 0, 0)), "2026-01-01");
});

test("idő és időtartam formázás", () => {
  assert.equal(D.parseTime("07:30"), 27000);
  assert.equal(D.parseTime("07:30:15"), 27015);
  for (const s of ["24:00", "12:60", "x", "", null, "12"]) assert.equal(D.parseTime(s), null, String(s));
  assert.equal(D.formatHM(5400), "1:30");
  assert.equal(D.formatHM(-5), "0:00");
  assert.equal(D.formatHM(NaN), "0:00");
  assert.equal(D.formatClock(65), "01:05");
  assert.equal(D.formatClock(3725), "1:02:05");
  assert.equal(D.monthStart("2026-10-17"), "2026-10-01");
});
