import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/pomodoro.js";

const cfg = P.normalizePomo({});
const MIN = 60000;

test("beállítások érvényesítése", () => {
  assert.deepEqual(P.normalizePomo(undefined), P.POMO_DEFAULTS);
  assert.deepEqual(P.normalizePomo({ work: "x", short: 999, long: -3, every: 1, autoBreak: 0, autoWork: 1 }), { work: 25, short: 60, long: 1, every: 2, autoBreak: false, autoWork: true });
  assert.deepEqual(P.normalizeState({ phase: "bogus" }), P.idleState());
  assert.deepEqual(P.normalizeState(null), P.idleState());
  assert.equal(P.normalizeState({ phase: "work", start: 1, end: 2, done: -4 }).done, 0);
});

test("egy teljes kör: pomo, rövid szünet, …, hosszú szünet a 4. pomo után", () => {
  let s = P.begin(P.idleState(), "work", 0, cfg), t = 0;
  const entries = [];
  for (let i = 1; i <= 4; i++) {
    assert.equal(s.phase, "work");
    assert.equal(P.remainingSeconds(s, t), 25 * 60);
    t = s.end;
    const r = P.tick(s, t, cfg, true);
    assert.deepEqual(r.entry, { start: s.start, end: s.end }); entries.push(r.entry);
    assert.equal(r.state.done, i);
    assert.equal(r.state.phase, i % 4 === 0 ? "longBreak" : "shortBreak");   // automatikus szünet
    assert.equal(r.notify.title, "Pomo vége"); assert.equal(r.notify.body, i % 4 === 0 ? "Hosszú szünet jön." : "Rövid szünet jön.");
    assert.equal(r.state.end - r.state.start, (i % 4 === 0 ? 15 : 5) * MIN);
    t = r.state.end;
    const b = P.tick(r.state, t, cfg, true);   // a szünet vége: a következő pomo nem indul magától
    assert.equal(b.state.phase, "idle"); assert.equal(b.notify.sound, "breakEnd"); assert.equal(b.entry, undefined);
    s = P.begin(b.state, "work", t, cfg);
  }
  assert.equal(entries.length, 4);
});

test("nincs léptetés a szakasz vége előtt; kitöltetlen űrlapnál a pomo nem ment, de a számláló nő", () => {
  const s = P.begin(P.idleState(), "work", 1000, cfg);
  assert.equal(P.tick(s, s.end - 1, cfg, true).state, s);
  const r = P.tick(s, s.end, cfg, false);
  assert.equal(r.entry, null); assert.equal(r.state.done, 1);
  assert.equal(P.tick(P.idleState(), 5, cfg, true).state.phase, "idle");
});

test("automatikus szünet és automatikus következő pomo kikapcsolása/bekapcsolása", () => {
  const off = P.normalizePomo({ autoBreak: false });
  const s = P.begin(P.idleState(), "work", 0, off);
  assert.equal(P.tick(s, s.end, off, true).state.phase, "idle");
  const auto = P.normalizePomo({ autoWork: true });
  const br = P.begin({ ...P.idleState(), done: 1 }, "shortBreak", 0, auto);
  assert.equal(P.tick(br, br.end, auto, true).state.phase, "work");
  assert.equal(P.skipBreak(br, auto, 7).phase, "work");
  assert.equal(P.skipBreak(br, cfg, 7).phase, "idle");
  assert.equal(P.skipBreak(P.begin(P.idleState(), "work", 0, cfg), cfg, 7).phase, "work");   // munka közben nincs mit kihagyni
});

test("leállítás: a félbehagyott pomo ideje bekerül (30 másodperctől), szünetben nem", () => {
  const s = P.begin(P.idleState(), "work", 0, cfg);
  assert.deepEqual(P.stop(s, 29_000, true).entry, null);
  assert.deepEqual(P.stop(s, 30_000, true).entry, { start: 0, end: 30_000 });
  assert.equal(P.stop(s, 600_000, false).entry, null);
  assert.equal(P.stop(s, 600_000, true).state.phase, "idle");
  assert.equal(P.stop(P.begin(P.idleState(), "shortBreak", 0, cfg), 100_000, true).entry, null);
});

test("gyűrű kitöltöttsége és hátralévő idő", () => {
  const s = P.begin(P.idleState(), "work", 0, cfg);
  assert.equal(P.progress(s, 0, cfg), 0); assert.equal(P.progress(s, 25 * MIN, cfg), 1); assert.ok(Math.abs(P.progress(s, 12.5 * MIN, cfg) - 0.5) < 1e-9);
  assert.equal(P.progress(P.idleState(), 0, cfg), 0);
  assert.equal(P.remainingSeconds(s, 25 * MIN - 500), 1); assert.equal(P.remainingSeconds(s, 99 * MIN), 0);
  assert.equal(P.phaseTitle("longBreak"), "Hosszú szünet");
});
