import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";
import { createFolder, pointerJson, FILES } from "../src/folder.js";
import { encodeBytes, decode } from "../src/csv.js";
import { configureTypes } from "../src/types.js";
import { fakeDir, memoryStorage, memoryHandleStore } from "./fakefs.js";

test.afterEach(() => configureTypes({}));

const e = (id, date, o = {}) => ({ id, date, type: "MEETING", typeLabel: "Értekezlet", unit: "ora", start: null, end: null, durationSeconds: 3600, quantity: null, workplace: "Győr", activity: "", source: "manual", departure: null, arrival: null, ...o });
const ID1 = "11111111-1111-4111-8111-111111111111", ID2 = "22222222-2222-4222-8222-222222222222", ID3 = "33333333-3333-4333-8333-333333333333";
const wait = (ms = 330) => new Promise((r) => setTimeout(r, ms));

function setup({ dir = fakeDir(), storage = memoryStorage(), picker } = {}) {
  const handleStore = memoryHandleStore();
  const folder = createFolder({ handleStore, picker: picker || (async () => dir) });
  const store = createStore(storage, { folder });
  return { dir, storage, folder, store, handleStore };
}

test("az automatikus mentés a mappába ír (CSV BOM-mal, CRLF, a natív formátummal azonos), a változás után röviddel", async () => {
  const { dir, store } = setup();
  assert.deepEqual(await store.chooseFolder().then((r) => r.ok), true);
  assert.ok(dir.files.has(FILES.entries)); assert.ok(dir.files.has(FILES.pointer));   // az üres fájl is létrejön
  store.addEntry(e(ID1, "2026-10-05"));
  assert.equal(decode(dir.text(FILES.entries).slice(1)).entries.length, 0);   // az írás késleltetett
  await wait();
  const bytes = dir.files.get(FILES.entries).bytes;
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  assert.deepEqual(decode(new TextDecoder().decode(bytes)).entries.map((x) => x.id), [ID1]);
  assert.ok(new TextDecoder().decode(bytes).includes("\r\n"));
  assert.equal(store.state.meta.dirty, false);
  store.deleteEntry(ID1); await wait();
  assert.equal(decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries.length, 0);
});

test("az első összekapcsoláskor a mappa adatai és a helyi adatok összefésülődnek (nem vész el egyik sem)", async () => {
  const dir = fakeDir();
  dir.put(FILES.entries, encodeBytes([e(ID1, "2026-10-01"), e(ID2, "2026-10-02")]));
  const storage = memoryStorage();
  const local = createStore(storage); local.addEntry(e(ID3, "2026-10-03")); local.addEntry(e(ID1, "2026-10-01", { workplace: "ez a helyi, a fájl a mérvadó" }));
  const { store } = setup({ dir, storage });
  const r = await store.chooseFolder();
  assert.ok(r.ok);
  assert.deepEqual(store.state.entries.map((x) => x.id).sort(), [ID1, ID2, ID3]);
  assert.equal(store.state.entries.find((x) => x.id === ID1).workplace, "Győr");
  assert.equal(decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries.length, 3);   // az összefésült állapot a fájlba is kiíródik
});

test("összekapcsolás után a fájl a mérvadó: a mappában (Excelben, a skillel, a natív appban) módosított adat betöltődik", async () => {
  const { dir, store } = setup();
  await store.chooseFolder();
  store.addEntry(e(ID1, "2026-10-05")); await wait();
  dir.put(FILES.entries, encodeBytes([e(ID2, "2026-10-06")]));   // külső módosítás
  assert.equal(await store.reloadIfChanged(), true);
  assert.deepEqual(store.state.entries.map((x) => x.id), [ID2]);
  assert.equal(await store.reloadIfChanged(), false);   // nincs újabb változás
});

test("hibás sorok: figyelmeztetés, és a mentés előtt másolat készül a fájlról", async () => {
  const dir = fakeDir();
  const good = new TextDecoder().decode(encodeBytes([e(ID1, "2026-10-01")]));
  dir.put(FILES.entries, "\uFEFF" + good + "nem dátum;x;;;0;;;Mór;;MEETING;Értekezlet;ora;;;manual\r\n");
  const { store } = setup({ dir });
  await store.chooseFolder();
  assert.match(store.state.sync.warning, /1 sor kimaradt/);
  assert.equal(store.state.entries.length, 1);
  const backups = [...dir.files.keys()].filter((k) => k.startsWith("bejegyzesek.hibas-"));
  assert.equal(backups.length, 1);   // az első mentés előtt másolat készült
  assert.ok(dir.text(backups[0]).includes("nem dátum"));
});

test("olvashatatlan adatfájl (nem UTF-8, hiányzó oszlop) nem íródik felül másolat nélkül", async () => {
  const dir = fakeDir();
  dir.put(FILES.entries, new Uint8Array([0xFF, 0xFE, 0x41, 0x80, 0x81]));
  const { store } = setup({ dir });
  await store.chooseFolder();
  assert.match(store.state.sync.warning, /nem UTF-8|másolat készült/);
  assert.ok([...dir.files.keys()].some((k) => k.startsWith("bejegyzesek.hibas-")));
  const dir2 = fakeDir(); dir2.put(FILES.entries, "Valami;Más\r\n1;2\r\n");
  const s2 = setup({ dir: dir2 }).store; await s2.chooseFolder();
  assert.match(s2.state.sync.warning, /Hiányzik/);
  assert.ok([...dir2.files.keys()].some((k) => k.startsWith("bejegyzesek.hibas-")));
});

test("mappa nélkül a bejegyzések a böngészőben maradnak, és az engedély megadása után kiíródnak", async () => {
  const dir = fakeDir(); dir.permission = "prompt";
  const handleStore = memoryHandleStore(dir);
  const folder = createFolder({ handleStore, picker: async () => dir });
  const store = createStore(memoryStorage(), { folder });
  await store.startSync();
  assert.equal(folder.status, "needs-permission");
  store.addEntry(e(ID1, "2026-10-05")); await wait();
  assert.equal(dir.files.size, 0); assert.equal(store.state.meta.dirty, true);   // semmi sem íródott
  assert.equal(await store.grantFolder(), true);
  assert.deepEqual(decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries.map((x) => x.id), [ID1]);
  assert.equal(store.state.meta.dirty, false);
});

test("a következő indításkor a mentett mappa visszaáll, és az adatok betöltődnek", async () => {
  const { dir, store, handleStore } = setup();
  await store.chooseFolder(); store.addEntry(e(ID1, "2026-10-05")); await wait();
  const folder2 = createFolder({ handleStore, picker: async () => { throw new Error("nem kell"); } });
  const store2 = createStore(memoryStorage(), { folder: folder2 });   // új, üres böngészőtár (például törölt böngészőadatok)
  await store2.startSync();
  assert.equal(folder2.status, "ready"); assert.deepEqual(store2.state.entries.map((x) => x.id), [ID1]);
});

test("mentési hiba jelzése, majd helyreállás", async () => {
  const { dir, store } = setup();
  await store.chooseFolder();
  dir.failWrites.on = true;
  store.addEntry(e(ID1, "2026-10-05")); await wait();
  assert.match(store.state.sync.error, /Mentési hiba/); assert.equal(store.state.meta.dirty, true);
  assert.equal(store.state.entries.length, 1);   // a böngészőben megvan
  dir.failWrites.on = false;
  store.addEntry(e(ID2, "2026-10-06")); await wait();
  assert.equal(store.state.sync.error, null);
  assert.equal(decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries.length, 2);
});

test("létszámjelentések: külön fájl, csak ha van mit menteni", async () => {
  const { dir, store } = setup();
  await store.chooseFolder();
  assert.equal(dir.files.has(FILES.attendance), false);   // üres fájlt nem hoz létre
  const rep = { date: "2026-08-15", congregation: "Mór", sabbathSchool: { children: 1, adults: 2, guests: 3 }, worship: { children: 4, adults: 5, guests: 6 } };
  store.saveReports("2026-08-15", [rep]); await wait();
  assert.ok(dir.text(FILES.attendance).includes("2026-08-15;Mór;1;2;3;4;5;6"));
});

test("törlés: előbb másolat a mappába, hibánál nem töröl", async () => {
  const { dir, store } = setup();
  await store.chooseFolder(); store.addEntry(e(ID1, "2026-10-05")); await wait();
  assert.deepEqual(await store.resetAll(), { ok: true });
  assert.equal(decode(new TextDecoder().decode(dir.files.get("bejegyzesek.torles-elotti.csv").bytes)).entries.length, 1);
  assert.equal(decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries.length, 0);
  const t = setup(); await t.store.chooseFolder(); t.store.addEntry(e(ID1, "2026-10-05")); await wait();
  t.dir.failWrites.on = true;
  const r = await t.store.resetAll();
  assert.equal(r.ok, false); assert.match(r.error, /nem készült el/); assert.equal(t.store.state.entries.length, 1);
});

test("mutatófájl: a mappa teljes útvonalával (Windows és Mac)", async () => {
  const w = JSON.parse(pointerJson("C:\\Users\\Anna\\Documents\\OTS Munkajelentő Tracker\\"));
  assert.equal(w.dataFile, "C:\\Users\\Anna\\Documents\\OTS Munkajelentő Tracker\\bejegyzesek.csv");
  assert.equal(w.attendanceFile, "C:\\Users\\Anna\\Documents\\OTS Munkajelentő Tracker\\letszamjelentesek.csv");
  assert.equal(w.format, "csv"); assert.equal(w.delimiter, ";"); assert.equal(w.formatVersion, 2);
  assert.equal(JSON.parse(pointerJson("/Users/anna/Documents/OTS")).dataFile, "/Users/anna/Documents/OTS/bejegyzesek.csv");
  assert.equal("dataFile" in JSON.parse(pointerJson("")), false);
  const { dir, store } = setup(); await store.chooseFolder();
  store.saveSettings({ dataPath: "C:\\Adatok\\OTS" }); await wait(10);
  assert.equal(JSON.parse(dir.text(FILES.pointer)).dataFile, "C:\\Adatok\\OTS\\bejegyzesek.csv");
});

test("a mappa kiválasztásának megszakítása és a tiltott mappa nem rontja el az állapotot", async () => {
  const abort = Object.assign(new Error("x"), { name: "AbortError" });
  const a = setup({ picker: async () => { throw abort; } });
  assert.deepEqual(await a.store.chooseFolder(), { ok: false, cancelled: true }); assert.equal(a.folder.status, "none");
  const b = setup({ picker: async () => { throw Object.assign(new Error("tiltott"), { name: "SecurityError" }); } });
  const r = await b.store.chooseFolder(); assert.equal(r.ok, false); assert.match(r.error, /rendszermapp/);
  const c = createFolder({ handleStore: memoryHandleStore(), picker: async () => null, supported: false });
  assert.equal(c.status, "unsupported"); assert.equal((await c.choose()).ok, false);
});

test("a mappa elfelejtése után a böngészőben marad az adat", async () => {
  const { store } = setup();
  await store.chooseFolder(); store.addEntry(e(ID1, "2026-10-05")); await wait();
  await store.forgetFolder();
  assert.equal(store.folder.status, "none"); assert.equal(store.state.entries.length, 1);
});
