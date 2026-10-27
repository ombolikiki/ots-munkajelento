import test from "node:test";
import assert from "node:assert/strict";
import * as H from "../src/holidays.js";
import * as D from "../src/dates.js";

const EASTER = { 2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28", 2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21", 2031: "2031-04-13", 2032: "2032-03-28", 2033: "2033-04-17", 2034: "2034-04-09", 2035: "2035-03-25" };

test("a húsvétvasárnap a Gergely-naptár szerint, 2024–2035", () => {
  for (const [y, day] of Object.entries(EASTER)) {
    const e = H.easterSunday(Number(y));
    assert.equal(D.ymd(Number(y), e.month, e.day), day, y);
    assert.equal(D.weekday(day), 0, `${y} vasárnap`);
  }
});

test("minden évben 13 munkaszüneti nap, a húsvét-alapú napok hétköznapjai, a nevek (2024–2035)", () => {
  const names = ["Újév", "Március 15. (nemzeti ünnep)", "Nagypéntek", "Húsvétvasárnap", "Húsvéthétfő", "Május 1. (a munka ünnepe)", "Pünkösdvasárnap", "Pünkösdhétfő", "Augusztus 20. (az államalapítás ünnepe)", "Október 23. (nemzeti ünnep)", "Mindenszentek", "Karácsony", "Karácsony másnapja"];
  for (let y = 2024; y <= 2035; y++) {
    const list = H.holidays(y);
    assert.equal(list.length, 13, String(y));
    assert.deepEqual([...list.map((h) => h.name)].sort(), [...names].sort(), String(y));
    assert.deepEqual(list.map((h) => h.date), [...list.map((h) => h.date)].sort());   // időrend
    assert.equal(new Set(list.map((h) => h.date)).size, 13);
    const by = Object.fromEntries(list.map((h) => [h.name, h.date]));
    assert.equal(by["Húsvétvasárnap"], EASTER[y]);
    assert.equal(D.weekday(by["Nagypéntek"]), 5); assert.equal(D.weekday(by["Húsvéthétfő"]), 1);
    assert.equal(D.weekday(by["Pünkösdvasárnap"]), 0); assert.equal(D.weekday(by["Pünkösdhétfő"]), 1);
    assert.equal(by["Nagypéntek"], D.addDays(EASTER[y], -2)); assert.equal(by["Pünkösdhétfő"], D.addDays(EASTER[y], 50));
    for (const h of list) assert.ok(D.parseYMD(h.date), h.date);
  }
});

test("egy nap ünnepének neve; dec. 24. és a hétköznapok nem ünnepek; érvénytelen bemenet nem omlik össze", () => {
  assert.equal(H.holidayName("2026-10-23"), "Október 23. (nemzeti ünnep)");
  assert.equal(H.holidayName("2026-04-06"), "Húsvéthétfő"); assert.equal(H.holidayName("2026-05-25"), "Pünkösdhétfő");
  assert.equal(H.holidayName("2026-12-24"), null); assert.equal(H.holidayName("2026-10-22"), null);
  for (const bad of ["", "x", null, undefined, "2026-13-40"]) assert.equal(H.holidayName(bad), null, String(bad));
  assert.deepEqual(H.holidays(0), []); assert.deepEqual(H.holidays(NaN), []); assert.deepEqual(H.holidays(1e9), []);
});
