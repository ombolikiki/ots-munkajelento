import test from "node:test";
import assert from "node:assert/strict";
import { createStore, KEYS, sanitizeSettings, DEFAULT_SETTINGS } from "../src/store.js";
import { configureTypes } from "../src/types.js";
import { clampStart } from "../src/entries.js";
import { memoryStorage as memory } from "./fakefs.js";

test.afterEach(() => configureTypes({}));
const fill = (s, o) => Object.assign(s.state.draft, o);

test("sérült tárolt adat nem okoz hibát", () => {
  const st = memory();
  st.setItem(KEYS.entries, "nem json"); st.setItem(KEYS.timer, '{"startMs":"x"}'); st.setItem(KEYS.settings, "[1]"); st.setItem(KEYS.places, '{"a":1}');
  st.setItem(KEYS.attendance, '[{"x":1}, null, 5]'); st.setItem(KEYS.pomo, '{"phase":"work","start":"x"}'); st.setItem(KEYS.done, "[]");
  const s = createStore(st);
  assert.deepEqual(s.state.entries, []); assert.equal(s.state.timer, null); assert.deepEqual(s.state.places, []);
  assert.deepEqual(s.state.attendance, []); assert.equal(s.state.pomo.phase, "idle"); assert.deepEqual(s.state.done, {});
  assert.equal(s.state.settings.targetHours, 8);
  st.setItem(KEYS.entries, '[{"x":1}, null, {"date":"2026-10-05","type":"MEETING","id":"a"}]');
  assert.equal(createStore(st).state.entries.length, 1);   // az értelmetlen elemek kimaradnak
});

test("beállítások érvényesítése: hibás érték alapértékre áll, a határok érvényesek", () => {
  const s = sanitizeSettings({ targetHours: 99, calStartHour: 30, calEndHour: -4, weekStart: 7, palette: "rózsaszín", appearance: "x", lookback: "?",
    reminderDays: 1, congregations: [" Mór ", "mór", ""], hiddenTypes: ["MEETING", "NINCS"], categoryColors: { MEETING: "ff0000", X: "nem" }, customCategories: [{ code: "egyedi_a", label: " A ", unit: "bogus" }, { code: "", label: "x" }],
    skill: { site: "xx", tasks: ["havi", "rossz"], targets: ["rossz"], os: "linux" }, pomo: { work: 0 } });
  assert.equal(s.targetHours, 16); assert.equal(s.calStartHour, 22); assert.equal(s.calEndHour, 23); assert.equal(s.weekStart, 2);
  assert.equal(s.palette, "blue"); assert.equal(s.appearance, "system"); assert.equal(s.lookback, "thisMonth"); assert.equal(s.reminderDays, 2);
  assert.deepEqual(s.congregations, ["Mór"]); assert.deepEqual(s.hiddenTypes, ["MEETING"]); assert.deepEqual(s.categoryColors, { MEETING: "#FF0000" });
  assert.deepEqual(s.customCategories, [{ code: "EGYEDI_A", label: "A", unit: "hours" }]);
  assert.equal(s.skill.site, "det"); assert.deepEqual(s.skill.tasks, ["havi"]); assert.deepEqual(s.skill.targets, []); assert.equal(s.skill.os, ""); assert.equal(s.pomo.work, 1);
  assert.deepEqual(sanitizeSettings(undefined), sanitizeSettings(DEFAULT_SETTINGS));
});

test("időmérő: indítás csak kitöltött űrlappal, leállítás menti és kiüríti az űrlapot (az Oda-vissza újra bejelölt)", () => {
  const st = memory(); const s = createStore(st);
  assert.equal(s.startTimer(1000), false);                               // nincs típus
  fill(s, { typeCode: "HOLIDAY" }); assert.equal(s.startTimer(1000), false);   // egész napos
  fill(s, { typeCode: "MEETING", workplace: "Győr", activity: "", roundTrip: true });
  const start = new Date(2026, 9, 5, 9, 0, 0).getTime();
  assert.equal(s.startTimer(start), true);
  assert.equal(s.startTimer(start + 5), false);                           // már fut
  assert.equal(s.startPomo(start + 5), false);                            // az időmérő alatt a Pomodoro nem indul
  const e = s.stopTimer(start + 3600 * 1000);
  assert.equal(e.durationSeconds, 3600); assert.equal(e.date, "2026-10-05");
  assert.equal(s.state.timer, null); assert.equal(s.state.draft.typeCode, ""); assert.equal(s.state.draft.roundTrip, true);
  assert.equal(s.state.entries.length, 1); assert.deepEqual(s.state.places, ["Győr"]);
});

test("a futó időmérő és az űrlap túléli az újratöltést", () => {
  const st = memory(); const a = createStore(st);
  fill(a, { typeCode: "MEETING", workplace: "Győr" }); a.saveDraft(); a.startTimer(12345);
  const b = createStore(st);
  assert.equal(b.state.timer.startMs, 12345); assert.equal(b.state.draft.workplace, "Győr");
});

test("típusváltás: Utazásnál a székhely az alapérték, mennyiség nélküli típusnál a mennyiség 1", () => {
  const s = createStore(memory());
  s.saveSettings({ home: "Pécs" });
  fill(s, { quantity: 5 }); s.setDraftType("TRAVEL");
  assert.equal(s.state.draft.departure, "Pécs"); assert.equal(s.state.draft.roundTrip, true); assert.equal(s.state.draft.workplaceIsDeparture, false); assert.equal(s.state.draft.quantity, 1);
  fill(s, { departure: "Mór" }); s.setDraftType("MEETING"); s.setDraftType("TRAVEL");
  assert.equal(s.state.draft.departure, "Mór");   // a már kitöltött nem íródik felül
  s.setDraftType("VISITING"); fill(s, { quantity: 4 }); s.setDraftType("VISITING"); assert.equal(s.state.draft.quantity, 4);
});

const T0 = new Date(2026, 9, 5, 9, 0, 0).getTime(), MIN = 60000;
const mkStore = (pomo = {}, st = memory()) => { const s = createStore(st); s.saveSettings({ pomo: { work: 1, short: 1, long: 1, every: 2, ...pomo } }); fill(s, { typeCode: "PREPARING", workplace: "Mór", activity: "Prédikáció" }); return s; };

test("Pomodoro-munkamenet: pomo + szünet egy bejegyzés, a mezők a munkamenet elejéről, zárolás alatt az űrlap megmarad", () => {
  const s = mkStore();
  assert.equal(s.startPomo(T0), true); assert.equal(s.startTimer(T0), false);
  fill(s, { workplace: "Más" });   // a bejegyzés a munkamenet ELEJÉN megadott mezőket kapja
  assert.equal(s.tickPomo(T0 + 1000), null);
  const r = s.tickPomo(T0 + MIN);
  assert.equal(r.notify.title, "Pomo vége"); assert.equal(r.entry, null); assert.equal(s.state.entries.length, 0);   // munkamenet közben még nincs bejegyzés
  assert.equal(s.state.pomo.phase, "shortBreak"); assert.equal(s.state.pomo.done, 1); assert.equal(s.state.draft.typeCode, "PREPARING");
  const b = s.tickPomo(T0 + 2 * MIN);
  assert.equal(b.notify.title, "A szünet véget ért"); assert.equal(s.state.pomo.phase, "idle");
  assert.equal(s.state.entries.length, 1);
  const e = s.state.entries[0];
  assert.deepEqual([e.source, e.unit, e.durationSeconds, e.start, e.end, e.workplace, e.activity, e.typeLabel], ["pomodoro", "ora", 120, "09:00:00", "09:02:00", "Mór", "Prédikáció", "Felkészülés"]);
  assert.equal(s.state.draft.typeCode, "PREPARING");   // természetes lezáráskor a mezők megmaradnak
  s.resetPomoCounter(); assert.equal(s.state.pomo.done, 0);
});

test("Pomodoro-munkamenet: leállítás szünet közben 90 mp, az űrlap kiürül; 30 mp alatt nincs bejegyzés", () => {
  const s = mkStore();
  s.startPomo(T0); s.tickPomo(T0 + MIN);
  const part = s.stopPomo(T0 + MIN + 30_000);
  assert.equal(part.durationSeconds, 90); assert.equal(s.state.entries.length, 1); assert.equal(s.state.draft.typeCode, ""); assert.equal(s.state.pomo.phase, "idle");
  fill(s, { typeCode: "PREPARING", workplace: "Mór" }); s.startPomo(T0 + 99 * MIN);
  assert.equal(s.stopPomo(T0 + 99 * MIN + 20_000), null); assert.equal(s.state.entries.length, 1);
});

test("Pomodoro-munkamenet: automatikus indítással egy bejegyzés 240 mp, a hosszú szünet vége lezár", () => {
  const s = mkStore({ autoWork: true });
  s.startPomo(T0);
  for (let t = T0 + 1000; t <= T0 + 5 * MIN; t += 1000) { s.tickPomo(t); if (!s.state.pomo.session && s.state.pomo.phase === "idle") break; }
  assert.equal(s.state.pomo.phase, "idle"); assert.equal(s.state.entries.length, 1); assert.equal(s.state.entries[0].durationSeconds, 240); assert.equal(s.state.pomo.done, 2);
});

test("Pomodoro-munkamenet: elvetés a 2. pomo közben, altatás (45 mp), időugrás (40 mp + 1 óra)", () => {
  let s = mkStore({ autoWork: true, every: 3 });
  s.startPomo(T0); s.tickPomo(T0 + MIN); s.tickPomo(T0 + 2 * MIN);
  assert.equal(s.state.pomo.phase, "work");
  assert.equal(s.discardPomo().durationSeconds, 120); assert.equal(s.state.entries.length, 1);
  s = mkStore();
  s.startPomo(T0);
  const slept = s.sleepPomo(T0 + 45_000);   // a rendszer altatási jelzése
  assert.equal(slept.durationSeconds, 45); assert.equal(s.state.pomo.phase, "idle"); assert.equal(s.state.draft.typeCode, "PREPARING");   // a mezők megmaradnak
  assert.equal(s.startPomo(T0 + 3600_000), true);   // új pomo indítható
  s = mkStore();
  s.startPomo(T0);
  assert.equal(s.tickPomo(T0 + 40_000), null);
  const j = s.tickPomo(T0 + 40_000 + 3600_000);   // 1 órás ugrás: a munkamenet a legutóbbi ütemnél (40 mp) zárul
  assert.equal(j.slept, true); assert.equal(s.state.entries.length, 1); assert.equal(s.state.entries[0].durationSeconds, 40); assert.equal(s.state.pomo.phase, "idle");
  s = mkStore();
  s.startPomo(T0); for (let t = T0 + 1000; t <= T0 + 200_000; t += 1000) s.tickPomo(t);   // másodpercenkénti ütemek: nincs téves altatás
  assert.equal(s.state.entries.length, 1);
  s = mkStore(); s.startPomo(T0); s.tickPomo(T0 + 20_000);
  assert.equal(s.tickPomo(T0 + 20_000 + 130_000).slept, true); assert.equal(s.state.entries.length, 0);   // az ugrás előtti 20 mp < 30 mp: nem rögzül
});

test("Pomodoro-munkamenet: folyamatos mentés és helyreállítás (a fül bezárása, összeomlás) az életjelig", () => {
  const st = memory(), a = mkStore({}, st);
  a.startPomo(T0);
  for (let t = T0 + 1000; t <= T0 + 55_000; t += 1000) a.tickPomo(t);   // 10 másodpercenként életjel
  assert.ok(JSON.parse(st.getItem(KEYS.pomo)).session.lastAlive >= T0 + 50_000);
  const alive = JSON.parse(st.getItem(KEYS.pomo)).session.lastAlive;
  const b = createStore(st);   // újratöltés: a munkamenet az utolsó életjelig rögzül
  assert.equal(b.state.pomo.phase, "idle"); assert.equal(b.state.pomo.session, null);
  assert.equal(b.state.entries.length, 1); assert.equal(b.state.entries[0].durationSeconds, Math.round((alive - T0) / 1000)); assert.equal(b.state.entries[0].source, "pomodoro");
  assert.equal(createStore(st).state.entries.length, 1);   // a mentés törlődött: nem rögzül kétszer
  const st2 = memory(), c = mkStore({}, st2); c.startPomo(T0); c.tickPomo(T0 + 10_000);   // 30 mp alatt a helyreállításnál sem
  assert.equal(createStore(st2).state.entries.length, 0);
});

test("régi mód: pomónként külön bejegyzés, a szünet nem rögzül, a leállításkor a félbehagyott pomo ideje (30 mp-től); az állapot túléli az újratöltést", () => {
  const st = memory(), s = mkStore({ merge: false }, st);
  s.startPomo(T0);
  const r = s.tickPomo(T0 + MIN);
  assert.equal(r.entry.durationSeconds, 60); assert.equal(r.entry.source, "pomodoro"); assert.equal(r.entry.start, "09:00:00");
  assert.equal(s.tickPomo(T0 + 2 * MIN).entry, null);   // a szünet nem rögzül
  assert.equal(s.state.entries.length, 1);
  s.startPomo(T0 + 10 * MIN);
  assert.equal(s.stopPomo(T0 + 10 * MIN + 29_000), null);
  fill(s, { typeCode: "PREPARING", workplace: "Mór" }); s.startPomo(T0 + 20 * MIN);
  assert.equal(s.sleepPomo(T0 + 20 * MIN + 45_000).durationSeconds, 45);   // az altatás ilyenkor is menti a futó pomót
  fill(s, { typeCode: "PREPARING", workplace: "Mór" }); s.startPomo(T0 + 30 * MIN);
  const b = createStore(st);
  assert.equal(b.state.pomo.phase, "work"); assert.equal(b.state.pomo.start, T0 + 30 * MIN);
});

test("saját kategóriák, elrejtés, színek: mentés és visszatöltés", () => {
  const st = memory(); const s = createStore(st);
  assert.equal(s.addCategory("Önképzés", "hours"), true); assert.equal(s.addCategory("  ", "hours"), false); assert.equal(s.addCategory("X", "egesz_nap"), false);
  s.addCategory("Önképzés", "people");
  assert.deepEqual(s.state.settings.customCategories.map((c) => c.code), ["EGYEDI_ONKEPZES", "EGYEDI_ONKEPZES_2"]);
  s.renameCategory("EGYEDI_ONKEPZES", "Önképzés (új)"); s.removeCategory("EGYEDI_ONKEPZES_2");
  s.setBuiltinHidden("DAY_OFF", true); s.setCategoryColor("MEETING", "#ff0000"); assert.equal(s.setCategoryColor("PREACHING", "szín"), false);
  fill(s, { typeCode: "DAY_OFF" }); s.setBuiltinHidden("HOLIDAY", true);
  const b = createStore(st);
  assert.deepEqual(b.state.settings.customCategories, [{ code: "EGYEDI_ONKEPZES", label: "Önképzés (új)", unit: "hours" }]);
  assert.deepEqual(b.state.settings.hiddenTypes.sort(), ["DAY_OFF", "HOLIDAY"]); assert.deepEqual(b.state.settings.categoryColors, { MEETING: "#FF0000" });
  s.setCategoryColor("MEETING", null); assert.deepEqual(s.state.settings.categoryColors, {});
  fill(s, { typeCode: "EGYEDI_ONKEPZES" }); s.removeCategory("EGYEDI_ONKEPZES"); assert.equal(s.state.draft.typeCode, "");   // a törölt kategória nem marad kiválasztva
});

test("gyülekezetek és létszámjelentések", () => {
  const s = createStore(memory());
  s.addCongregation("Mór"); s.addCongregation("mór"); s.addCongregation("Bicske"); s.addCongregation("Tata");
  assert.deepEqual(s.state.settings.congregations, ["Mór", "Bicske", "Tata"]);
  s.moveCongregation("Tata", -1); s.moveCongregation("Mór", -1); s.moveCongregation("Tata", 5);
  assert.deepEqual(s.state.settings.congregations, ["Mór", "Tata", "Bicske"]);
  s.removeCongregation("Tata");
  const rep = (d, c) => ({ date: d, congregation: c, sabbathSchool: { children: 1, adults: 2, guests: 3 }, worship: { children: 4, adults: 5, guests: 6 } });
  assert.equal(s.saveReports("2026-08-15", [rep("2026-08-15", "Mór")]), true);
  assert.equal(s.saveReports("2999-01-01", [rep("2999-01-01", "Mór")]), false);   // jövőbeli nap
  assert.equal(s.state.attendance.length, 1);
});

test("elvetés, törlés, importálás, a mentett adatok törlése (a beállítások megmaradnak)", async () => {
  const st = memory(); const s = createStore(st);
  s.saveSettings({ home: "Pécs", palette: "green" }); s.addCategory("X", "hours");
  fill(s, { typeCode: "MEETING", workplace: "Győr" }); s.startTimer(1); s.discardTimer();
  assert.equal(s.state.timer, null); assert.equal(s.state.entries.length, 0);
  const e = { id: "x", date: "2026-10-05", type: "MEETING", start: null, workplace: "Mór", unit: "ora", departure: null, arrival: null };
  assert.equal(s.importEntries([e]).added, 1); assert.equal(s.importEntries([e]).added, 0);
  assert.ok(s.state.places.includes("Mór"));
  s.deleteEntry("x"); assert.equal(s.state.entries.length, 0);
  s.importEntries([e]); s.setDone("w|2026-10-05", "sig", true); assert.equal(s.isDone("w|2026-10-05", "sig"), true); assert.equal(s.isDone("w|2026-10-05", "más"), false);
  assert.deepEqual(await s.resetAll(), { ok: true });
  assert.equal(s.state.entries.length, 0); assert.deepEqual(s.state.places, []); assert.deepEqual(s.state.settings.customCategories, []);
  assert.equal(s.state.settings.home, "Pécs"); assert.equal(s.state.settings.palette, "green"); assert.deepEqual(s.state.done, {});
  assert.equal(createStore(st).state.entries.length, 0);
});

test("beállítások korlátozása és a tárhely-hiba jelzése", () => {
  const s = createStore(memory());
  s.saveSettings({ home: "  Győr ", targetHours: 99 }); assert.equal(s.state.settings.home, "Győr"); assert.equal(s.state.settings.targetHours, 16);
  s.saveSettings({ targetHours: "x" }); assert.equal(s.state.settings.targetHours, 8);
  const full = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem() {} };
  const t = createStore(full); fill(t, { typeCode: "MEETING", workplace: "Győr" });
  assert.equal(t.addEntry({ id: "q", date: "2026-10-05", unit: "ora", workplace: "Győr", type: "MEETING" }), false);
  assert.match(t.error, /nem sikerült/);
});

test("a régi (mobilos) beállítások megmaradnak, a megszűnt nézetbeállítás kimarad", () => {
  const st = memory();
  st.setItem(KEYS.settings, JSON.stringify({ home: "Győr", targetHours: 7, layout: "mobile" }));
  const s = createStore(st);
  assert.equal(s.state.settings.home, "Győr"); assert.equal(s.state.settings.targetHours, 7); assert.equal("layout" in s.state.settings, false);
});

test("időmérő: korábbi kezdés (legfeljebb a mai nap elejéig, jövőbeli nem), futás közben is javítható", () => {
  const s = createStore(memory());
  fill(s, { typeCode: "MEETING", workplace: "Győr" });
  const now = new Date(2026, 9, 5, 9, 0, 0).getTime(), dayStart = new Date(2026, 9, 5).getTime();
  assert.equal(clampStart(now + 600000, now), now);                       // jövőbeli nem lehet
  assert.equal(clampStart(dayStart - 3600000, now), dayStart);            // a mai nap elejénél korábbi nem
  assert.equal(clampStart(now - 300000, now), now - 300000);
  assert.equal(s.startTimer(now, now - 600000), true);
  assert.equal(s.state.timer.startMs, now - 600000);
  assert.equal(s.setTimerStart(now - 120000, now), true); assert.equal(s.state.timer.startMs, now - 120000);
  s.setTimerStart(now + 3600000, now); assert.equal(s.state.timer.startMs, now);
  s.setTimerStart(dayStart - 86400000 * 3, now); assert.equal(s.state.timer.startMs, dayStart);
  s.setTimerStart(now - 300000, now);
  const e = s.stopTimer(now);
  assert.equal(e.durationSeconds, 300); assert.equal(e.start, "08:55:00"); assert.equal(e.date, "2026-10-05");
  assert.equal(s.setTimerStart(now, now), false);                         // nem fut időmérő
});

test("a régi (Indulás / Munkahely(ek) / Érkezés) piszkozat átkerül az új Kiindulás / Cél űrlapra", () => {
  const st = memory();
  st.setItem("ots.draft", JSON.stringify({ typeCode: "TRAVEL", workplace: "Tata, Mór", departure: "Győr", arrival: "Győr", roundTrip: false, activity: "x" }));
  const d = createStore(st).state.draft;
  assert.equal(d.destination, "Tata, Mór"); assert.equal(d.departure, "Győr"); assert.equal(d.roundTrip, true); assert.equal("arrival" in d, false);
});

test("Szabadnap egy kattintással: csak üres, múltbeli napra, kétszer nem", () => {
  const s = createStore(memory());
  const today = "2026-10-08";
  const r = s.markDayOff("2026-10-04", today);   // vasárnap
  assert.ok(r.ok); const e = s.state.entries[0];
  assert.ok(e.type === "DAY_OFF" && e.unit === "egesz_nap" && e.workplace === "SZABADNAP" && e.source === "manual" && e.durationSeconds === 0 && e.activity === "" && e.date === "2026-10-04");
  assert.equal(s.markDayOff("2026-10-04", today).ok, false); assert.equal(s.state.entries.length, 1);
  s.addEntry({ id: "z", date: "2026-10-05", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", start: null, end: null, durationSeconds: 3600, quantity: null, workplace: "Győr", activity: "", source: "manual", departure: null, arrival: null });
  assert.equal(s.markDayOff("2026-10-05", today).ok, false);   // van bejegyzés
  assert.equal(s.markDayOff("2026-10-09", today).ok, false);   // jövő
  assert.equal(s.markDayOff("2026-10-08", today).ok, false);   // ma
  assert.equal(s.markDayOff("hibás", today).ok, false);
  assert.equal(s.state.entries.length, 2);
});

test("km: előtöltés az utolsó érkező km-mel, rögzítés után az érkező üres; a javítás ellenőrzéssel", () => {
  const st = memory(); const s = createStore(st);
  const trip = (id, date, a, b) => ({ id, date, type: "TRAVEL", typeLabel: "Utazás", unit: "ora", start: null, end: null, durationSeconds: 1800, quantity: null, workplace: "Tata", activity: "x", source: "manual", departure: "Győr", arrival: "Győr", startKm: a, endKm: b });
  assert.equal(s.state.draft.startKm, "");
  s.addEntry(trip("11111111-1111-4111-8111-111111111111", "2026-10-01", 1000, 1060));
  s.addEntry(trip("22222222-2222-4222-8222-222222222222", "2026-10-02", 1060, 1100));
  fill(s, { typeCode: "TRAVEL", departure: "Győr", destination: "Tata", activity: "x", startKm: "1100", endKm: "1150" });
  s.resetDraft();
  assert.equal(s.state.draft.startKm, "1100"); assert.equal(s.state.draft.endKm, "");
  assert.equal(createStore(st).state.draft.startKm, "1100");   // újratöltéskor is
  // javítás
  assert.equal(s.updateKm("22222222-2222-4222-8222-222222222222", "1070", "1110"), null);
  assert.deepEqual([s.state.entries[1].startKm, s.state.entries[1].endKm], [1070, 1110]);
  assert.match(s.updateKm("22222222-2222-4222-8222-222222222222", "1000", "1110"), /kisebb, mint az előző út/);   // az előző: a lista előző eleme (1060)
  assert.match(s.updateKm("22222222-2222-4222-8222-222222222222", "x", ""), /egész szám/);
  assert.match(s.updateKm("22222222-2222-4222-8222-222222222222", "1200", "1100"), /nagyobbnak/);
  assert.deepEqual([s.state.entries[1].startKm, s.state.entries[1].endKm], [1070, 1110]);   // hiba esetén nem módosít
  assert.equal(s.updateKm("22222222-2222-4222-8222-222222222222", "", ""), null);   // üresen törlődik
  assert.deepEqual([s.state.entries[1].startKm, s.state.entries[1].endKm], [null, null]);
  assert.equal(s.state.draft.startKm, "1060");   // az előtöltés követi a javítást (az utolsó érkező állás most 1060)
  assert.equal(s.updateKm("22222222-2222-4222-8222-222222222222", "1070", "1110"), null);
  assert.equal(s.state.draft.startKm, "1110");
  fill(s, { startKm: "5000" }); s.updateKm("22222222-2222-4222-8222-222222222222", "1070", "1120");
  assert.equal(s.state.draft.startKm, "5000");   // a kézzel írt érték marad
  assert.match(s.updateKm("nincs", "1", "2"), /nem található/);
  assert.deepEqual(s.monthKm("2026-10-20"), { km: 110, incomplete: 0 });
});
