import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/pomodoro.js";

const cfg = P.normalizePomo({});
const MIN = 60000;

test("beállítások érvényesítése", () => {
  assert.deepEqual(P.normalizePomo(undefined), P.POMO_DEFAULTS);
  assert.deepEqual(P.normalizePomo({ work: "x", short: 999, long: -3, every: 1, autoBreak: 0, autoWork: 1 }), { work: 25, short: 60, long: 1, every: 2, autoBreak: false, autoWork: true, merge: true });
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
  assert.equal(P.skipBreak(br, auto, 7).state.phase, "work");
  assert.equal(P.skipBreak(br, cfg, 7).state.phase, "idle");
  assert.equal(P.skipBreak(P.begin(P.idleState(), "work", 0, cfg), cfg, 7).state.phase, "work");   // munka közben nincs mit kihagyni
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

// ---------- Munkamenet (1.7.0) ----------
const mini = (o = {}) => P.normalizePomo({ work: 1, short: 1, long: 1, every: 2, ...o });   // pomo 1 perc, szünetek 1 perc, hosszú szünet minden 2. pomo után
const tpl = { id: "t", date: "", start: null, end: null, durationSeconds: 0, workplace: "Győr", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, activity: "x", source: "pomodoro" };
const T0 = new Date(2026, 9, 7, 10, 0, 0).getTime();

/** Másodpercenként léptet a megadott időig; visszatér {state, ends: [munkamenet-végek ms], notes}. */
function run(cfg, s, fromMs, toMs) {
  const ends = [], notes = [];
  for (let t = fromMs; t <= toMs; t += 1000) {
    const r = P.tick(s, t, cfg, true);
    if (r.state !== s) { s = r.state; if (r.notify) notes.push(r.notify.title); if (r.endSession != null) ends.push(r.endSession); }
  }
  return { state: s, ends, notes };
}

test("munkamenet: automatikus indítás nélkül a pomo + a szünet egy bejegyzés (10:00–10:02, 120 mp)", () => {
  const c = mini(), s = P.start(P.idleState(), T0, c, tpl);
  assert.equal(s.phase, "work"); assert.ok(s.session);
  const r = run(c, s, T0, T0 + 3 * MIN);
  assert.deepEqual(r.ends, [T0 + 2 * MIN]); assert.equal(r.state.phase, "idle"); assert.equal(r.state.session, null);
  const e = P.sessionEntries(tpl, T0, r.ends[0]);
  assert.equal(e.length, 1); assert.deepEqual([e[0].start, e[0].end, e[0].durationSeconds, e[0].source, e[0].unit], ["10:00:00", "10:02:00", 120, "pomodoro", "ora"]);
});

test("munkamenet: automatikus indítással pomo, rövid szünet, pomo, hosszú szünet, vége (240 mp), a fázisok folyamatosak", () => {
  const c = mini({ autoWork: true });
  let s = P.start(P.idleState(), T0, c, tpl);
  const phases = [];
  for (let t = T0; t <= T0 + 5 * MIN; t += 1000) {
    const r = P.tick(s, t, c, true);
    if (r.state !== s) { s = r.state; phases.push([r.state.phase, r.state.start - T0]); if (r.endSession != null) { assert.equal(r.endSession, T0 + 4 * MIN); break; } }
    if (P.isActive(s)) assert.ok(s.session);   // a rövid szünet után új pomo indul: egy munkamenet
  }
  assert.deepEqual(phases, [["shortBreak", MIN], ["work", 2 * MIN], ["longBreak", 3 * MIN], ["idle", 3 * MIN]]);
  assert.equal(s.done, 2);
});

test("munkamenet: a hosszú szünet vége akkor is lezár, ha az automatikus indítás be van kapcsolva; a késve észlelt ütem nem csúsztat", () => {
  const c = mini({ autoWork: true, every: 2 });
  let s = P.start(P.idleState(), T0, c, tpl);
  s = P.tick(s, T0 + MIN + 7000, c, true).state;   // 7 mp késéssel észlelt pomo-vég
  assert.equal(s.start, T0 + MIN); assert.equal(s.end, T0 + 2 * MIN);   // az új fázis az előző tervezett végétől indul
});

test("munkamenet: leállítás szünet közben (60 mp pomo + 30 mp szünet = 90 mp); 20 mp-es munkamenet nem rögzül", () => {
  const c = mini();
  let s = P.start(P.idleState(), T0, c, tpl);
  s = P.tick(s, T0 + MIN, c, true).state;   // szünet indul
  const r = P.stop(s, T0 + MIN + 30_000, true);
  assert.equal(r.endSession, T0 + 90_000); assert.equal(r.state.phase, "idle");
  assert.equal(P.sessionEntries(tpl, T0, r.endSession)[0].durationSeconds, 90);
  assert.deepEqual(P.sessionEntries(tpl, T0, T0 + 20_000), []); assert.equal(P.sessionEntries(tpl, T0, T0 + 30_000).length, 1);
});

test("munkamenet: elvetés a 2. pomo közben: csak az első pomo + szünet (120 mp) mentődik", () => {
  const c = mini({ autoWork: true, every: 3 });
  let s = P.start(P.idleState(), T0, c, tpl);
  s = P.tick(s, T0 + MIN, c, true).state; s = P.tick(s, T0 + 2 * MIN, c, true).state;   // 2. pomo indult
  assert.equal(s.phase, "work");
  const r = P.discard(s);
  assert.equal(r.endSession, T0 + 2 * MIN); assert.equal(P.sessionEntries(tpl, T0, r.endSession)[0].durationSeconds, 120);
  assert.deepEqual(P.discard(P.begin(P.idleState(), "work", 0, c)), { state: { ...P.idleState(), phase: "idle", start: 0, end: c.work * MIN, session: null } });   // régi módban semmi
});

test("munkamenet: az első pomo elvetése: semmi nem mentődik; szünet kihagyása", () => {
  const c = mini({ autoWork: true });
  const s0 = P.start(P.idleState(), T0, c, tpl);
  assert.equal(P.sessionEntries(tpl, T0, P.discard(s0).endSession).length, 0);   // 0 mp < 30 mp
  let s = P.tick(s0, T0 + MIN, c, true).state;   // rövid szünet
  const k = P.skipBreak(s, c, T0 + MIN + 20_000);   // automatikus indítás: a munkamenet folytatódik
  assert.equal(k.state.phase, "work"); assert.ok(k.state.session); assert.equal(k.endSession, undefined);
  const nk = P.skipBreak(s, mini(), T0 + MIN + 20_000);   // automatikus indítás nélkül véget ér
  assert.equal(nk.endSession, T0 + MIN + 20_000); assert.equal(nk.state.session, null);
  const lng = P.skipBreak({ ...s, phase: "longBreak" }, c, T0 + MIN + 5000);   // hosszú szünet kihagyása: vége
  assert.equal(lng.endSession, T0 + MIN + 5000);
});

test("munkamenet: ha az automatikus szünet ki van kapcsolva, a pomo végén véget ér (csak a pomót tartalmazza)", () => {
  const c = mini({ autoBreak: false });
  const r = run(c, P.start(P.idleState(), T0, c, tpl), T0, T0 + 2 * MIN);
  assert.deepEqual(r.ends, [T0 + MIN]); assert.equal(P.sessionEntries(tpl, T0, r.ends[0])[0].durationSeconds, 60);
});

test("régi mód (merge kikapcsolva): pomónként külön bejegyzés, a szünet nem rögzül, nincs munkamenet", () => {
  const c = mini({ merge: false }), s = P.start(P.idleState(), T0, c, tpl);
  assert.equal(s.session, null);
  const r = P.tick(s, T0 + MIN, c, true);
  assert.deepEqual(r.entry, { start: T0, end: T0 + MIN }); assert.equal(r.endSession, undefined); assert.equal(r.state.phase, "shortBreak");
  assert.equal(P.tick(r.state, T0 + 2 * MIN, c, true).entry, undefined);
});

test("munkamenet: az állapot tárolása és a helyreállítás az életjelig (legfeljebb most)", () => {
  const c = mini(), s = P.alive(P.start(P.idleState(), T0, c, tpl), T0 + 40_000);
  const back = P.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.session, s.session);
  const r = P.recover(back, T0 + 10 * MIN);
  assert.equal(r.recover.endMs, T0 + 40_000); assert.equal(r.state.phase, "idle"); assert.equal(r.state.session, null);
  assert.equal(P.recover(back, T0 + 10_000).recover.endMs, T0 + 10_000);   // legfeljebb „most”
  assert.equal(P.recover(P.idleState(), T0).recover, undefined);
  assert.equal(P.normalizeState({ ...s, session: { start: "x" } }).session, null);
  assert.equal(P.sessionElapsed(s, T0 + 125_000), 125); assert.equal(P.sessionElapsed(P.idleState(), T0), null);
});

test("éjfélbontás: 23:50–00:20 két bejegyzés (600 és 1200 mp, saját napjukon), 2024–2035 minden negyedév első napján, évhatár, nyári időszámítás", () => {
  let n = 0;
  for (let y = 2024; y <= 2035; y++) for (const m of [1, 4, 7, 10]) {
    const start = new Date(y, m - 1, 1, 0, 0, 0).getTime() - 10 * MIN;   // az előző nap 23:50
    const e = P.sessionEntries(tpl, start, start + 30 * MIN);
    const prev = new Date(y, m - 1, 0), first = new Date(y, m - 1, 1);
    const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    assert.deepEqual(e.map((x) => [x.date, x.start, x.end, x.durationSeconds]), [[ymd(prev), "23:50:00", "00:00:00", 600], [ymd(first), "00:00:00", "00:20:00", 1200]], `${y}-${m}`);
    n++;
  }
  assert.equal(n, 48);
  const exact = new Date(2026, 9, 7, 23, 0, 0).getTime();
  assert.equal(P.sessionEntries(tpl, exact, exact + 60 * MIN).length, 1);   // pontosan éjfélig: nincs üres második bejegyzés
  for (const [y, m, d] of [[2026, 3, 29], [2026, 10, 25], [2027, 3, 28], [2027, 10, 31]]) {   // nyári időszámítás váltás napjai (Európa)
    const a = new Date(y, m - 1, d, 22, 0, 0).getTime(), b = new Date(y, m - 1, d + 1, 2, 0, 0).getTime();
    const e = P.sessionEntries(tpl, a, b), dayEnd = new Date(y, m - 1, d + 1).getTime();
    assert.equal(e.length, 2); assert.equal(e[0].durationSeconds, Math.round((dayEnd - a) / 1000)); assert.equal(e[0].end, "00:00:00"); assert.equal(e[1].start, "00:00:00");
    assert.equal(e[0].durationSeconds + e[1].durationSeconds, Math.round((b - a) / 1000));
  }
});
