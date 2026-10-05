import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../src/store.js";
import { createFolder, FILES } from "../src/folder.js";
import { createSyncer, baseID, plan, sameContent } from "../src/calendarSync.js";
import { eventInput, parseEvent, draftToEntry } from "../src/calendarParser.js";
import { configureTypes } from "../src/types.js";
import { decode } from "../src/csv.js";
import { fakeDir, memoryStorage, memoryHandleStore } from "./fakefs.js";

test.afterEach(() => configureTypes({}));
const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();
const ev = (id, title, o, s, e) => eventInput({ id, title, start: s, end: e, ...o });
const NOW = at(2026, 10, 10, 12);

function fakeSource() {
  const src = {
    cals: [{ id: "A", title: "OTS Munkajelentő" }, { id: "B", title: "Személyes" }], items: [], granted: true,
    access: () => (src.granted ? "granted" : "denied"),
    async calendars() { return src.cals; },
    async events(ids, from, to) { return src.items.filter((i) => (!ids || ids.has(i.cal)) && i.event.start < to && i.event.end > from).map((i) => i.event); },
    set(cal, e) { src.items = src.items.filter((i) => i.event.id !== e.id); src.items.push({ cal, event: e }); },
    remove(id) { src.items = src.items.filter((i) => i.event.id !== id); },
  };
  return src;
}

async function setup() {
  const dir = fakeDir();
  const folder = createFolder({ handleStore: memoryHandleStore(), picker: async () => dir });
  const store = createStore(memoryStorage(), { folder });
  await store.chooseFolder();
  store.saveSettings({ home: "Győr", syncEnabled: true, syncCalendars: ["A"] });
  const src = fakeSource();
  return { dir, store, src, syncer: createSyncer(store, src) };
}

test("baseID: a napi utótag levágása csak érvényes dátumnál", () => {
  assert.equal(baseID("ABC#2026-10-01"), "ABC"); assert.equal(baseID("ABC|123#2026-10-01"), "ABC|123"); assert.equal(baseID("ABC"), "ABC");
  assert.equal(baseID("A#B"), "A#B"); assert.equal(baseID("A#2026-13-45"), "A#2026-13-45"); assert.equal(baseID("A#2026-1-1"), "A#2026-1-1");
});

test("a szinkron végig: átvétel, módosítás, törlés, kézi bejegyzés védelme, másolat", async () => {
  const { dir, store, src, syncer } = await setup();
  assert.equal(await syncer.sync(NOW) !== null, true);   // üres naptár: fut, nincs változás
  store.saveSettings({ syncEnabled: false }); assert.equal(await syncer.sync(NOW), null);
  store.saveSettings({ syncEnabled: true, syncCalendars: [] }); assert.equal(await syncer.sync(NOW), null);
  store.saveSettings({ syncCalendars: ["A"] }); src.granted = false; assert.equal(await syncer.sync(NOW), null); src.granted = true;

  const manual = { id: "00000000-0000-4000-8000-000000000001", date: "2026-10-05", start: null, end: null, durationSeconds: 3600, workplace: "Tata", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, activity: "kézi", source: "manual", departure: null, arrival: null };
  store.addEntry(manual);
  src.set("A", ev("e1", "Értekezlet: Heti", { location: "Fő utca 3., Győr" }, at(2026, 10, 5, 9), at(2026, 10, 5, 10)));
  src.set("A", ev("e2", "Szabadság", { isAllDay: true }, at(2026, 10, 6), at(2026, 10, 7, 23, 59)));
  src.set("A", ev("e3", "Fogorvos", {}, at(2026, 10, 6, 9), at(2026, 10, 6, 10)));
  src.set("A", ev("e4", "Értekezlet: helyszín nélkül", {}, at(2026, 10, 6, 11), at(2026, 10, 6, 12)));
  src.set("B", ev("e5", "Értekezlet: másik naptár", { location: "Győr" }, at(2026, 10, 6, 13), at(2026, 10, 6, 14)));
  src.set("A", ev("e6", "Értekezlet: jövő", { location: "Győr" }, at(2026, 10, 20, 9), at(2026, 10, 20, 10)));

  let r = await syncer.sync(NOW);
  assert.deepEqual([r.added, r.updated, r.deleted], [3, 0, 0]);
  assert.deepEqual(syncer.state.incomplete.map((i) => i.event.id), ["e4"]); assert.deepEqual(syncer.state.unrecognized.map((i) => i.event.id), ["e3"]);
  const cals = () => store.state.entries.filter((e) => e.calendarID);
  assert.ok(!cals().some((e) => /^e[56]/.test(e.calendarID)));   // a másik naptár és a jövő kimarad
  const e1 = cals().find((e) => e.calendarID === "e1#2026-10-05");
  assert.ok(e1.source === "calendar" && e1.address === "Fő utca 3., Győr" && e1.workplace === "Győr");
  assert.ok(dir.files.has("bejegyzesek.naptar-elotti.csv"));   // biztonsági másolat

  r = await syncer.sync(NOW); assert.deepEqual([r.added, r.updated, r.deleted, r.heldDeletions], [0, 0, 0, 0]);
  await new Promise((res) => setTimeout(res, 330));
  // a CSV-ből visszaolvasott állapottal sincs változás (a mentett forma egyezik)
  const back = decode(new TextDecoder().decode(dir.files.get(FILES.entries).bytes)).entries;
  assert.ok(back.filter((e) => e.calendarID).every((e) => sameContent(e, parseEvent(src.items.map((i) => i.event).find((x) => e.calendarID.startsWith(x.id + "#")), NOW, "Győr").drafts.find((d) => d.calendarID === e.calendarID))));

  src.set("A", ev("e1", "Értekezlet: Átírt cím", { location: "Fő utca 3., Győr" }, at(2026, 10, 5, 9), at(2026, 10, 5, 11)));
  r = await syncer.sync(NOW);
  const e1b = cals().find((e) => e.calendarID === "e1#2026-10-05");
  assert.ok(r.updated === 1 && r.added === 0 && e1b.id === e1.id && e1b.activity === "Átírt cím" && e1b.durationSeconds === 7200);

  src.set("A", ev("e2", "Szabadság", { isAllDay: true }, at(2026, 10, 6), at(2026, 10, 6, 23, 59)));   // megrövidült
  r = await syncer.sync(NOW); assert.ok(r.deleted === 1 && cals().filter((e) => e.calendarID.startsWith("e2#")).length === 1);

  src.remove("e1");   // törölt esemény
  r = await syncer.sync(NOW); assert.ok(r.deleted === 1 && !cals().some((e) => e.calendarID.startsWith("e1#")));
  assert.ok(store.state.entries.some((e) => e.id === manual.id));   // a kézi bejegyzés érintetlen

  src.set("B", ev("e2", "Szabadság", { isAllDay: true }, at(2026, 10, 6), at(2026, 10, 6, 23, 59)));   // másik, nem kiválasztott naptárba került: marad
  r = await syncer.sync(NOW); assert.ok(r.deleted === 0 && cals().some((e) => e.calendarID === "e2#2026-10-06"));

  src.set("A", eventInput({ id: "e2", title: "Szabadság", isAllDay: true, isCancelled: true, start: at(2026, 10, 6), end: at(2026, 10, 6, 23, 59) }));
  r = await syncer.sync(NOW); assert.ok(r.deleted === 1 && !cals().some((e) => e.calendarID.startsWith("e2#")));   // lemondott

  assert.deepEqual(syncer.state.incomplete.map((i) => i.event.id), ["e4"]);
  store.addEntry({ ...manual, id: "00000000-0000-4000-8000-000000000002", date: "2026-10-06", start: "11:00:00", end: "12:00:00", workplace: "Mór", activity: "javított", source: "calendar", calendarID: "e4#2026-10-06" });
  r = await syncer.sync(NOW);
  assert.ok(r.incomplete === 0 && r.updated === 0 && store.state.entries.find((e) => e.calendarID === "e4#2026-10-06").activity === "javított");   // a megoldott hiányos nem tér vissza
  syncer.dismiss("e3");
  assert.ok(syncer.state.unrecognized.length === 0); await syncer.sync(NOW); assert.equal(syncer.state.unrecognized.length, 0);

  store.addEntry({ ...manual, id: "00000000-0000-4000-8000-000000000003", date: "2026-01-02", activity: "régi", source: "calendar", calendarID: "old#2026-01-02" });
  r = await syncer.sync(NOW); assert.ok(r.deleted === 0 && r.heldDeletions === 0 && store.state.entries.some((e) => e.calendarID === "old#2026-01-02"));   // az ablakon kívüli régi érintetlen

  for (let i = 1; i <= 8; i++) src.set("A", ev("m" + i, "Értekezlet: tömeges " + i, { location: "Győr" }, at(2026, 10, 8, 8 + (i % 4)), at(2026, 10, 8, 9 + (i % 4))));
  r = await syncer.sync(NOW); assert.equal(r.added, 8);
  const before = store.state.entries.length;
  for (let i = 1; i <= 8; i++) src.remove("m" + i);
  r = await syncer.sync(NOW);   // védelem: sok törlés megerősítés nélkül nem fut le
  assert.ok(r.deleted === 0 && r.heldDeletions === 8 && store.state.entries.length === before && syncer.state.heldDeletions.length === 8);
  assert.equal(await syncer.confirmHeldDeletions(), true);
  assert.ok(store.state.entries.length === before - 8 && syncer.state.heldDeletions.length === 0);
  assert.ok(store.state.entries.some((e) => e.id === manual.id));

  src.items = [];   // üresnek látszó naptár
  r = await syncer.sync(NOW);
  assert.ok(r.deleted === 0 && r.heldDeletions > 0);
  syncer.discardHeldDeletions(); assert.equal(syncer.state.heldDeletions.length, 0);
});

test("a törlés védelme: határértékek", () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: "id" + i, date: "2026-10-05", calendarID: `x${i}#2026-10-05`, type: "MEETING" }));
  const base = { events: [], existenceIDs: new Set(["valami"]), now: NOW, home: "", windowStart: "2026-08-01" };
  assert.equal(plan({ ...base, existing: mk(5) }).toDelete.length, 5);          // 5 törlés még lefut (nem nagyobb, mint 5)
  assert.equal(plan({ ...base, existing: mk(6) }).heldDeletions.length, 6);     // 6 > 5 és az ablakbeli bejegyzések felénél több
  assert.equal(plan({ ...base, existing: mk(6), allowDeletion: false }).toDelete.length, 0);
  const mixed = [...mk(6), ...Array.from({ length: 20 }, (_, i) => ({ id: "k" + i, date: "2026-10-05", calendarID: `keep${i}#2026-10-05`, type: "MEETING" }))];
  const ev2 = Array.from({ length: 20 }, (_, i) => ev("keep" + i, "Értekezlet", { location: "Győr" }, at(2026, 10, 5, 9), at(2026, 10, 5, 10)));
  const p = plan({ ...base, events: ev2, existing: mixed });
  assert.equal(p.toDelete.length, 6); assert.equal(p.heldDeletions.length, 0);   // 6 az ablakbeli 26 felénél kevesebb: lefut
  assert.equal(plan({ ...base, existing: [] }).toDelete.length, 0);
});

test("mentés előtt másolat; mentési hibánál nem módosít", async () => {
  const { dir, store } = await setup();
  const e = (id, over = {}) => ({ id, date: "2026-10-05", start: null, end: null, durationSeconds: 3600, workplace: "Győr", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, activity: "", source: "calendar", departure: null, arrival: null, address: null, calendarID: id + "#2026-10-05", ...over });
  store.addEntry(e("00000000-0000-4000-8000-0000000000aa")); await new Promise((r) => setTimeout(r, 330));
  dir.failWrites.on = true;
  const r = await store.applyCalendarChanges({ add: [e("00000000-0000-4000-8000-0000000000bb")], update: [], remove: new Set() });
  assert.equal(r.ok, false); assert.match(r.error, /másolat nem készült el/); assert.equal(store.state.entries.length, 1);
  dir.failWrites.on = false;
  assert.equal((await store.applyCalendarChanges({ add: [], update: [], remove: new Set() })).ok, true);
});

test("a beállítások érvényesítése: ablak 1–730 nap, naptárlisták tisztítása", () => {
  const s = createStore(memoryStorage());
  s.saveSettings({ syncDays: 9999, syncCalendars: ["B", "A", "A", 5, ""], syncDismissed: ["x", "x"] });
  assert.equal(s.state.settings.syncDays, 730); assert.deepEqual(s.state.settings.syncCalendars, ["A", "B"]); assert.deepEqual(s.state.settings.syncDismissed, ["x"]);
  s.saveSettings({ syncDays: 0 }); assert.equal(s.state.settings.syncDays, 1);
  assert.equal(createStore(memoryStorage()).state.settings.syncDays, 60);
});
