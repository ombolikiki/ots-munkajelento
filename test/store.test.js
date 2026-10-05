import test from "node:test";
import assert from "node:assert/strict";
import { createStore, KEYS } from "../src/store.js";

function memory() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}
const fill = (s, o) => Object.assign(s.state.draft, o);

test("sérült tárolt adat nem okoz hibát", () => {
  const st = memory();
  st.setItem(KEYS.entries, "nem json"); st.setItem(KEYS.timer, '{"startMs":"x"}'); st.setItem(KEYS.settings, "[1]"); st.setItem(KEYS.places, '{"a":1}');
  const s = createStore(st);
  assert.deepEqual(s.state.entries, []); assert.equal(s.state.timer, null); assert.deepEqual(s.state.places, []);
  assert.equal(s.state.settings.targetHours, 8);
});

test("időmérő: indítás csak kitöltött űrlappal, leállítás menti és kiüríti az űrlapot", () => {
  const st = memory(); const s = createStore(st);
  assert.equal(s.startTimer(1000), false);                               // nincs típus
  fill(s, { typeCode: "HOLIDAY" }); assert.equal(s.startTimer(1000), false);   // egész napos
  fill(s, { typeCode: "MEETING", workplace: "Győr", activity: "" });
  const start = new Date(2026, 9, 5, 9, 0, 0).getTime();
  assert.equal(s.startTimer(start), true);
  assert.equal(s.startTimer(start + 5), false);                           // már fut
  const e = s.stopTimer(start + 3600 * 1000);
  assert.equal(e.durationSeconds, 3600); assert.equal(e.date, "2026-10-05");
  assert.equal(s.state.timer, null); assert.equal(s.state.draft.typeCode, "");
  assert.equal(s.state.entries.length, 1); assert.deepEqual(s.state.places, ["Győr"]);
});

test("a futó időmérő túléli az újratöltést", () => {
  const st = memory(); const a = createStore(st);
  fill(a, { typeCode: "MEETING", workplace: "Győr" }); a.saveDraft(); a.startTimer(12345);
  const b = createStore(st);
  assert.equal(b.state.timer.startMs, 12345); assert.equal(b.state.draft.workplace, "Győr");
});

test("elvetés, törlés, importálás, alaphelyzet", () => {
  const st = memory(); const s = createStore(st);
  fill(s, { typeCode: "MEETING", workplace: "Győr" }); s.startTimer(1); s.discardTimer();
  assert.equal(s.state.timer, null); assert.equal(s.state.entries.length, 0);
  const e = { id: "x", date: "2026-10-05", start: null, workplace: "Mór", unit: "ora", departure: null, arrival: null };
  assert.equal(s.importEntries([e]).added, 1); assert.equal(s.importEntries([e]).added, 0);
  assert.ok(s.state.places.includes("Mór"));
  s.deleteEntry("x"); assert.equal(s.state.entries.length, 0);
  s.importEntries([e]); s.resetAll();
  assert.equal(s.state.entries.length, 0); assert.equal(st.map.size, 0);
});

test("beállítások korlátozása és a tárhely-hiba jelzése", () => {
  const s = createStore(memory());
  s.saveSettings({ home: "  Győr ", targetHours: 99 }); assert.deepEqual(s.state.settings, { home: "Győr", targetHours: 12, layout: "auto" });
  s.saveSettings({ targetHours: "x" }); assert.equal(s.state.settings.targetHours, 8);
  const full = { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem() {} };
  const t = createStore(full); fill(t, { typeCode: "MEETING", workplace: "Győr" });
  assert.equal(t.addEntry({ id: "q", date: "2026-10-05", unit: "ora", workplace: "Győr" }), false);
  assert.match(t.error, /nem sikerült/);
});

test("nézet beállítása: érvénytelen érték automatikusra áll, a többi beállítás megmarad", () => {
  const st = memory(); const s = createStore(st);
  s.saveSettings({ home: "Győr", layout: "desktop" }); assert.equal(s.state.settings.layout, "desktop");
  s.saveSettings({ targetHours: 7 }); assert.equal(s.state.settings.layout, "desktop"); assert.equal(s.state.settings.home, "Győr");
  s.saveSettings({ layout: "ismeretlen" }); assert.equal(s.state.settings.layout, "auto");
  s.saveSettings({ layout: "mobile" }); assert.equal(createStore(st).state.settings.layout, "mobile");
});
