import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../src/importReview.js";
import * as C from "../src/csv.js";
import { createStore } from "../src/store.js";
import { fakeDir, memoryStorage as memory, memoryHandleStore } from "./fakefs.js";
import { createFolder } from "../src/folder.js";

const NOW = new Date(2026, 9, 27, 15, 0, 0).getTime();   // 2026-10-27 15:00
const base = { date: "2026-10-26", start: "09:00:00", end: "10:00:00", durationSeconds: 3600, workplace: "Székesfehérvár", type: "ADMINISTRATION", typeLabel: "Adminisztráció", unit: "ora",
  quantity: null, activity: "Levelezés", source: "ai", departure: null, arrival: null, address: null, calendarID: null, departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false, startKm: null, endKm: null };
let n = 0;
const mk = (o = {}) => ({ ...base, id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, "0")}`, ...o });
const problems = (e, existing = []) => R.check(e, existing, NOW).problems;

test("ellenőrzés: jövő, időtartam, hiányzó munkahely, Utazás kötelező mezői, km", () => {
  assert.deepEqual(problems(mk()), []);
  assert.match(problems(mk({ date: "2026-10-28" }))[0], /Jövőbeli napra/);
  assert.match(problems(mk({ date: "2026-10-27", start: "14:00:00", end: "16:00:00", durationSeconds: 7200 })).join(), /Jövőbeli időpont/);
  assert.deepEqual(problems(mk({ date: "2026-10-27", start: "13:00:00", end: "15:00:00", durationSeconds: 7200 })), []);   // „most”-ig tart: még rendben
  assert.match(problems(mk({ start: "10:00:00", end: "09:00:00", durationSeconds: 0 })).join(), /vég legyen a kezdés után/);
  assert.match(problems(mk({ start: null, end: null, durationSeconds: 0 })).join(), /Nincs időtartam/);
  assert.deepEqual(problems(mk({ start: null, end: null, durationSeconds: 7200 })), []);   // csak óraszám: rendben
  assert.deepEqual(problems(mk({ start: "22:00:00", end: "00:00:00", durationSeconds: 7200, date: "2026-10-26" })), []);   // a nap végi vég
  assert.match(problems(mk({ workplace: "" })).join(), /Hiányzik a Munkahely/);
  assert.deepEqual(problems(mk({ type: "HOLIDAY", typeLabel: "Szabadság", unit: "egesz_nap", workplace: "", start: null, end: null, durationSeconds: 0 })), []);   // egész napos: nem kell
  const trip = { type: "TRAVEL", typeLabel: "Utazás", departure: "Győr", workplace: "Tata", arrival: "Győr", activity: "Kiszállás" };
  assert.deepEqual(problems(mk(trip)), []);
  for (const [k, re] of [["departure", /Kiindulás/], ["workplace", /Cél/], ["arrival", /Érkezés/], ["activity", /Tevékenység/]]) assert.match(problems(mk({ ...trip, [k]: "" })).join(), re, k);
  assert.match(problems(mk({ ...trip, startKm: 100, endKm: 100 })).join(), /érkező km legyen nagyobb/);
  assert.deepEqual(problems(mk({ ...trip, startKm: 100, endKm: 160 })), []);
  assert.deepEqual(problems(mk({ ...trip, startKm: 100, endKm: null })), []);
});

test("figyelmeztetések: duplikátum, átfedés, saját kategória, km nem Utazásnál (elfogadhatók)", () => {
  const ex = [mk({ start: "09:30:00", end: "10:30:00", type: "MEETING", typeLabel: "Értekezlet", workplace: "Mór", activity: "x" })];
  const r = R.check(mk(), ex, NOW);
  assert.deepEqual(r.problems, []); assert.equal(r.duplicate, false); assert.match(r.warnings.join(), /Átfed egy meglévő bejegyzéssel \(Értekezlet\)/);
  const same = mk(); const d = R.check(same, [{ ...same, id: "x" }], NOW);
  assert.equal(d.duplicate, true); assert.match(d.warnings.join(), /Már van ilyen bejegyzés/); assert.equal(d.problems.length, 0);
  assert.match(R.check(mk({ type: "EGYEDI_X", typeLabel: "X" }), [], NOW).warnings.join(), /Saját kategória/);
  assert.match(R.check(mk({ startKm: 1, endKm: 2 }), [], NOW).warnings.join(), /km-állás csak Utazásnál/);
});

test("az importfájlból az áttekintendő bejegyzések: ismétlődő azonosító új azonosítót kap, a Forrás (ai) megmarad, hibás sor jelzett", () => {
  const a = mk(), b = mk({ id: a.id, activity: "Más" }), bad = mk({ workplace: "" });
  const existing = [{ ...a, source: "manual" }];
  const text = C.encodeText([a, b, bad]);
  const r = R.items(text, existing, NOW);
  assert.equal(r.items.length, 3);
  assert.equal(new Set(r.items.map((i) => i.entry.id)).size, 3); assert.ok(r.items.every((i) => i.entry.id !== existing[0].id));
  assert.deepEqual(r.items.map((i) => i.entry.source), ["ai", "ai", "ai"]);
  assert.deepEqual(r.items.map((i) => i.acceptable), [true, true, false]);
  assert.equal(r.items[0].duplicate, true);   // az első azonos egy meglévővel
  assert.deepEqual(R.items("", [], NOW), { items: [], notes: [] });
  assert.match(R.items("Valami;más\r\n1;2\r\n", [], NOW).notes[0], /Hiányzik/);
});

test("áttekintés: beolvasás az adatmappa melletti fájlból, elfogadás és elvetés a fájlt is frissíti, üres fájl törlődik", async () => {
  const dir = fakeDir();
  const s = createStore(memory(), { folder: createFolder({ handleStore: memoryHandleStore(), picker: async () => dir }) });
  assert.equal((await s.chooseFolder()).ok, true);
  const a = mk(), b = mk({ activity: "Második" }), bad = mk({ workplace: "" });
  dir.put(R.IMPORT_FILE, "﻿" + C.encodeText([a, b, bad]));
  const r1 = await s.refreshImport();
  assert.deepEqual([r1.changed, r1.grew, s.state.imports.items.length], [true, true, 3]);
  assert.deepEqual(await s.refreshImport(), { changed: false, grew: false });   // változatlan fájl: nincs újraolvasás
  // elfogadás: a hibás nem fogadható el
  assert.equal(await s.acceptImport([a.id, bad.id]), 1);
  assert.equal(s.state.entries.length, 1); assert.equal(s.state.entries[0].source, "ai"); assert.equal(s.state.entries[0].activity, "Levelezés");
  const left = C.decode(dir.text(R.IMPORT_FILE)).entries;
  assert.deepEqual(left.map((e) => e.id).sort(), [b.id, bad.id].sort());   // az elfogadott kikerült a fájlból
  assert.equal(s.state.imports.items.length, 2);
  await s.discardImport([bad.id]);
  assert.deepEqual(C.decode(dir.text(R.IMPORT_FILE)).entries.map((e) => e.id), [b.id]);
  await s.discardImport([b.id]);
  assert.equal(dir.text(R.IMPORT_FILE), null);   // az üres fájl törlődik
  assert.deepEqual([s.state.imports.items.length, s.state.imports.notes.length], [0, 0]);
  assert.equal(dir.text("bejegyzesek.csv") === null || !dir.text("bejegyzesek.csv").includes("Második"), true);   // az elvetett nem került az adatok közé
  // az éles adatfájlhoz az import nem nyúl: csak az elfogadás után kerül bele (a mentés az adatfájlba)
  await s.flush();
  assert.ok(C.decode(dir.text("bejegyzesek.csv")).entries.some((e) => e.activity === "Levelezés"));
  // a fájl eltűnik: a lista kiürül
  dir.put(R.IMPORT_FILE, C.encodeText([mk()])); await s.refreshImport({ force: true }); assert.equal(s.state.imports.items.length, 1);
  await dir.removeEntry(R.IMPORT_FILE); const r2 = await s.refreshImport(); assert.deepEqual([r2.changed, s.state.imports.items.length], [true, 0]);
});

test("áttekintés: mappa nélkül nincs import (a lista üres)", async () => {
  const s = createStore(memory());
  assert.deepEqual(await s.refreshImport(), { changed: false, grew: false });
  assert.deepEqual(s.state.imports.items, []);
});
