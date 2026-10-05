import test from "node:test";
import assert from "node:assert/strict";
import { createStore, KEYS, sanitizeSettings, DEFAULT_SETTINGS } from "../src/store.js";
import { configureTypes } from "../src/types.js";
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

test("időmérő: indítás csak kitöltött űrlappal, leállítás menti és kiüríti az űrlapot (az oda-vissza jelölő marad)", () => {
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
  assert.equal(s.state.draft.departure, "Pécs"); assert.equal(s.state.draft.arrival, "Pécs"); assert.equal(s.state.draft.quantity, 1);
  fill(s, { departure: "Mór" }); s.setDraftType("MEETING"); s.setDraftType("TRAVEL");
  assert.equal(s.state.draft.departure, "Mór");   // a már kitöltött nem íródik felül
  s.setDraftType("VISITING"); fill(s, { quantity: 4 }); s.setDraftType("VISITING"); assert.equal(s.state.draft.quantity, 4);
});

test("Pomodoro: indítás, a munkaszakasz végén automatikus mentés, leállítás részidővel", () => {
  const s = createStore(memory());
  fill(s, { typeCode: "PREPARING", workplace: "Mór", activity: "Prédikáció" });
  const t0 = new Date(2026, 9, 5, 9, 0, 0).getTime();
  assert.equal(s.startPomo(t0), true); assert.equal(s.startTimer(t0), false);
  assert.equal(s.tickPomo(t0 + 1000), null);
  const r = s.tickPomo(t0 + 25 * 60000);
  assert.equal(r.notify.title, "Pomo vége"); assert.equal(r.entry.source, "pomodoro"); assert.equal(r.entry.durationSeconds, 1500); assert.equal(r.entry.start, "09:00:00");
  assert.equal(s.state.pomo.phase, "shortBreak"); assert.equal(s.state.pomo.done, 1);
  assert.equal(s.state.draft.typeCode, "PREPARING");   // a következő pomóhoz az űrlap megmarad
  const b = s.tickPomo(t0 + 30 * 60000);
  assert.equal(b.notify.title, "A szünet véget ért"); assert.equal(s.state.pomo.phase, "idle");
  s.startPomo(t0 + 31 * 60000);
  const part = s.stopPomo(t0 + 31 * 60000 + 10 * 60000);
  assert.equal(part.durationSeconds, 600); assert.equal(s.state.entries.length, 2); assert.equal(s.state.draft.typeCode, "");
  fill(s, { typeCode: "PREPARING", workplace: "Mór" }); s.startPomo(t0 + 99 * 60000);
  assert.equal(s.stopPomo(t0 + 99 * 60000 + 5000), null); assert.equal(s.state.entries.length, 2);   // 30 mp alatt nem ment
  s.resetPomoCounter(); assert.equal(s.state.pomo.done, 0);
});

test("a Pomodoro állapota túléli az újratöltést", () => {
  const st = memory(); const a = createStore(st);
  fill(a, { typeCode: "MEETING", workplace: "Győr" }); a.startPomo(5000);
  const b = createStore(st);
  assert.equal(b.state.pomo.phase, "work"); assert.equal(b.state.pomo.start, 5000);
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
