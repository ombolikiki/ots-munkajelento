import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/calendar.js";

const ent = (id, start, end, o = {}) => ({ id, start, end, type: "MEETING", ...o });

test("a munkanap sávja érvényesítve", () => {
  assert.deepEqual(C.bandHours(7, 20), { lo: 7, hi: 20 });
  assert.deepEqual(C.bandHours(23, 5), { lo: 22, hi: 23 });
  assert.deepEqual(C.bandHours(-3, 99), { lo: 0, hi: 24 });
  assert.deepEqual(C.bandHours("x", undefined), { lo: 7, hi: 20 });
  assert.deepEqual(C.bandHours(10, 10), { lo: 10, hi: 11 });
});

test("hét napjai a hét kezdőnapjától, évhatáron át", () => {
  assert.deepEqual(C.weekDays("2026-12-28"), ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"]);
  assert.equal(C.weekStartOf("2026-10-07", 2), "2026-10-05");
});

test("átfedő bejegyzések egymás mellé kerülnek, a külön állók teljes szélességben", () => {
  const placed = C.layoutDay([ent("a", "09:00:00", "11:00:00"), ent("b", "10:00:00", "12:00:00"), ent("c", "10:30:00", "11:00:00"), ent("d", "13:00:00", "14:00:00"), ent("x", null, null)]);
  const by = Object.fromEntries(placed.map((p) => [p.entry.id, p]));
  assert.equal(placed.length, 4);
  assert.deepEqual([by.a.lane, by.b.lane, by.c.lane], [0, 1, 2]); assert.ok([by.a, by.b, by.c].every((p) => p.lanes === 3));
  assert.deepEqual([by.d.lane, by.d.lanes], [0, 1]);
  const seq = C.layoutDay([ent("a", "09:00:00", "10:00:00"), ent("b", "10:00:00", "11:00:00")]);   // egymás után: nem fedik át
  assert.ok(seq.every((p) => p.lane === 0 && p.lanes === 1));
  assert.equal(C.layoutDay([ent("r", "10:00:00", "10:02:00")])[0].endMin, 10 * 60 + 10);   // legalább 10 perces sáv
});

test("éjfélen átnyúló bejegyzés a nap végéig tart", () => {
  const m = C.entryMinutes(ent("n", "23:30:00", "00:30:00"));
  assert.deepEqual(m, { startMin: 23 * 60 + 30, endMin: 24 * 60 });
  assert.equal(C.entryMinutes(ent("x", "bad", "10:00")), null);
});

test("a sávon kívüli bejegyzések jelzése és vágása", () => {
  const band = C.bandHours(7, 20);
  const list = [ent("a", "06:00:00", "07:30:00"), ent("b", "19:30:00", "20:30:00"), ent("c", "09:00:00", "10:00:00"), ent("d", "05:00:00", "06:00:00"), ent("e", null, null)];
  assert.equal(C.outsideCount(list, band), 3);
  const clipped = C.clipToBand(C.layoutDay(list), band);
  assert.deepEqual(clipped.map((p) => [p.entry.id, p.startMin, p.endMin]).sort(), [["a", 420, 450], ["b", 1170, 1200], ["c", 540, 600]]);   // a „d” teljesen kívül: nem rajzolódik
});

test("húzással kijelölt idősáv: 15 perces lépések, minimum 15 perc, a sávra és a jelenre szorítva", () => {
  const band = C.bandHours(7, 20);
  assert.deepEqual(C.dragSlot(9 * 60 + 5, 10 * 60 + 40, band), { startMin: 540, endMin: 645 });
  assert.deepEqual(C.dragSlot(10 * 60 + 40, 9 * 60 + 5, band), { startMin: 540, endMin: 645 });   // fordított irány
  assert.deepEqual(C.dragSlot(9 * 60, 9 * 60 + 3, band), { startMin: 540, endMin: 555 });
  assert.deepEqual(C.dragSlot(19 * 60 + 50, 19 * 60 + 55, band), { startMin: 19 * 60 + 45, endMin: 20 * 60 });   // a sáv végén
  assert.deepEqual(C.dragSlot(9 * 60, 12 * 60, band, 10 * 60 + 20), { startMin: 540, endMin: 615 });   // ma: a jelenig (10:15-ig)
  assert.equal(C.dragSlot(10 * 60 + 5, 12 * 60, band, 10 * 60 + 10), null);   // ma, a jövőbe esne
  assert.equal(C.minutesAt(-50, 28, band), 420); assert.equal(C.minutesAt(28 * 13 + 100, 28, band), 1200); assert.equal(C.minutesAt(14, 28, band), 450);
});

test("időpont nélküli bejegyzések címkéje", () => {
  const hm = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  assert.equal(C.untimedTag({ unit: "ora", durationSeconds: 5400 }, "Ért", hm), "1:30 Ért");
  assert.equal(C.untimedTag({ unit: "alkalom", quantity: 2 }, "Ist", hm), "2× Ist");
  assert.equal(C.untimedTag({ unit: "fo", quantity: 4 }, "Lát", hm), "4 fő");
  assert.equal(C.untimedTag({ unit: "egesz_nap" }, "Szabadság", hm), "Szabadság");
});
