import test from "node:test";
import assert from "node:assert/strict";
import * as P from "../src/calendarParser.js";
import { draftToEntry } from "../src/calendarParser.js";
import { encodeText, decode } from "../src/csv.js";
import { ymd, addDays, dueDatesOfQuarter, isSunday, monthDays } from "../src/dates.js";

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();
const day = (y, m, d) => at(y, m, d);
const FAR = at(2037, 1, 1);
const ev = (title, o, s, e) => P.eventInput({ id: "E1", title, start: s, end: e, ...o });
const parsed = (e, now = FAR, home = "Győr") => P.parseEvent(e, now, home);
const drafts = (o) => (o.kind === "imported" || o.kind === "incomplete" ? o.drafts : []);
const problems = (o) => (o.kind === "incomplete" ? o.problems : []);
const one = (o) => (o.kind === "imported" && o.drafts.length === 1 ? o.drafts[0] : null);
const code = (m) => m?.type.code;

const TYPES = [["Istentisztelet", "PREACHING"], ["Látogatás", "VISITING"], ["Missziós látogatás", "MISSION_VISITING"], ["Ügyintézés", "OFFICE_WORK"], ["Ügy", "OFFICE_WORK"],
  ["Értekezlet", "MEETING"], ["Ért", "MEETING"], ["Evangelizáció", "EVANGELISATION"], ["Evang", "EVANGELISATION"], ["Bibliaóra", "BIBLE_HOUR"], ["Bibl", "BIBLE_HOUR"],
  ["Továbbképzés", "TRAINING"], ["Képzés", "TRAINING"], ["Tartott képzés", "HELD_TRAINING"], ["Tartott továbbképzés", "HELD_TRAINING"], ["Adminisztráció", "ADMINISTRATION"],
  ["Admin", "ADMINISTRATION"], ["Felkészülés", "PREPARING"], ["Felk", "PREPARING"], ["Utazás", "TRAVEL"], ["Utaz", "TRAVEL"], ["Szabadság", "HOLIDAY"], ["Szabadnap", "DAY_OFF"],
  ["Munkaszüneti nap", "PUBLIC_HOLIDAY"], ["Munkaszüneti", "PUBLIC_HOLIDAY"]];

test("típusnevek: kis- és nagybetű, ékezet, szóköz, leghosszabb egyezés, szóhatár", () => {
  for (const [name, c] of TYPES) for (const v of [name, name.toUpperCase(), name.toLowerCase(), "  " + name]) assert.equal(code(P.matchType(v + ": x")), c, v);
  assert.equal(P.matchType("Ügyes dolog"), null); assert.equal(P.matchType("Értékelés: x"), null); assert.equal(P.matchType("Adminisztrátor"), null);
  assert.equal(code(P.matchType("Ertekezlet: x")), "MEETING"); assert.equal(code(P.matchType("felkeszules")), "PREPARING");
  assert.equal(code(P.matchType("Missziós látogatás ×2")), "MISSION_VISITING"); assert.equal(code(P.matchType("Tartott képzés: x")), "HELD_TRAINING"); assert.equal(code(P.matchType("Képzés: x")), "TRAINING");
  assert.equal(code(P.matchType("Munkaszüneti nap")), "PUBLIC_HOLIDAY");
});

test("alap esetek a leírásból", () => {
  const x = one(parsed(ev("Értekezlet: Heti munkatársi megbeszélés", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10, 30))));
  assert.ok(x && x.type.code === "MEETING" && x.durationSeconds === 5400 && x.workplace === "Győr" && x.activity === "Heti munkatársi megbeszélés" && x.address === null);
  assert.equal(x.calendarID, "E1#2026-10-01"); assert.equal(x.date, "2026-10-01"); assert.equal(x.start, "09:00:00"); assert.equal(x.end, "10:30:00");
  const en = draftToEntry(x);
  assert.ok(en.source === "calendar" && en.calendarID === "E1#2026-10-01" && en.quantity === null && en.unit === "ora");
  for (const sep of [": ", " - ", " – ", " — "]) {
    const y = one(parsed(ev("Értekezlet" + sep + "Heti", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10))));
    assert.ok(y.activity === "Heti" && y.type.code === "MEETING", sep);
  }
  const a = one(parsed(ev("Felkészülés @Mór: Prédikáció", {}, at(2026, 10, 1, 11), at(2026, 10, 1, 13))));
  assert.ok(a.workplace === "Mór" && a.durationSeconds === 7200 && a.activity === "Prédikáció");
  const b = one(parsed(ev("Felk @Mór", {}, at(2026, 10, 1, 11), at(2026, 10, 1, 12))));
  assert.ok(b.workplace === "Mór" && b.activity === "");
  assert.equal(one(parsed(ev("Értekezlet @Tata: x", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10)))).workplace, "Tata");   // a @ erősebb
  assert.equal(one(parsed(ev("Értekezlet heti megbeszélés", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10)))).activity, "heti megbeszélés");
});

test("mennyiség: ×n, xn, n fő, n alkalom; óra típusnál nem mennyiség", () => {
  const cases = [["Látogatás ×3: Idősek otthona", 3, "Idősek otthona"], ["Látogatás x3: Idősek otthona", 3, "Idősek otthona"], ["Látogatás 3 fő: Idősek otthona", 3, "Idősek otthona"],
    ["Látogatás: Idősek otthona 3 fő", 3, "Idősek otthona"], ["Látogatás: Idősek otthona", 1, "Idősek otthona"], ["Látogatás @Mór ×5: x", 5, "x"], ["Látogatás ×0: x", 1, "x"], ["Látogatás: ×2 család", 2, "család"]];
  for (const [title, q, act] of cases) {
    const x = one(parsed(ev(title, { location: "Mór" }, at(2026, 10, 1, 14), at(2026, 10, 1, 15))));
    assert.ok(x && x.quantity === q && x.activity === act && x.type.code === "VISITING", title + JSON.stringify(x));
  }
  const i = one(parsed(ev("Istentisztelet", { location: "Tata" }, at(2026, 10, 3, 10), at(2026, 10, 3, 12))));
  assert.ok(i.quantity === 1 && i.durationSeconds === 7200 && i.workplace === "Tata"); assert.equal(draftToEntry(i).quantity, 1);
  assert.equal(one(parsed(ev("Missziós látogatás ×2: x", { location: "Mór" }, at(2026, 10, 1, 14), at(2026, 10, 1, 15)))).quantity, 2);
  const b = one(parsed(ev("Bibl: Fiatalok", { location: "Bicske" }, at(2026, 10, 1, 18), at(2026, 10, 1, 19, 30))));
  assert.ok(b.type.code === "BIBLE_HOUR" && b.workplace === "Bicske" && b.quantity === 1 && b.activity === "Fiatalok");
  assert.equal(one(parsed(ev("Ért ×3: x", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10)))).quantity, null);
});

test("hiányos és nem felismert események", () => {
  const o = parsed(ev("Értekezlet: x", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 10)));
  assert.deepEqual(problems(o), ["missingWorkplace"]); assert.equal(drafts(o).length, 1); assert.equal(o.type.code, "MEETING");
  assert.deepEqual(parsed(ev("Fogorvos", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 10))), { kind: "unrecognized", title: "Fogorvos" });
  assert.deepEqual(parsed(ev("   ", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 10))), { kind: "unrecognized", title: "" });
  assert.deepEqual(problems(parsed(ev("Értekezlet", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 9)))), ["noDuration"]);
  assert.deepEqual(problems(parsed(ev("Értekezlet", { location: "Győr" }, at(2026, 10, 1, 10), at(2026, 10, 1, 9)))), ["noDuration"]);
  assert.ok(problems(parsed(ev("Értekezlet", { location: "Győr" }, at(2026, 5, 1, 9), at(2026, 8, 1, 9)))).includes("tooLong"));
  for (const t of Object.keys(P.PROBLEM_TEXT)) assert.ok(P.PROBLEM_TEXT[t]);
});

test("címek: település, pontos cím, szétvágás ` - ` mentén", () => {
  const pl = P.place;
  assert.deepEqual(pl("Fő utca 3., Győr"), { settlement: "Győr", address: "Fő utca 3., Győr" });
  assert.equal(pl("Fő utca 3., 9021 Győr, Magyarország").settlement, "Győr"); assert.equal(pl("Fő u. 3, 9021 Győr, Hungary").settlement, "Győr");
  assert.equal(pl("Győr, Fő utca 3.").settlement, "Győr"); assert.equal(pl("9021 Győr, Fő utca 3.").settlement, "Győr");
  assert.deepEqual(pl("Győr"), { settlement: "Győr", address: null });
  assert.equal(pl("Szent-Györgyi u. 3., Győr").settlement, "Győr"); assert.equal(pl("Győr-Moson").settlement, "Győr-Moson");
  assert.equal(pl("Fő utca 3").settlement, null); assert.equal(pl("").settlement, null); assert.equal(pl(" , ").settlement, null);
  assert.deepEqual(P.splitLocations("Fő utca 3., Győr - Mór u. 5, Mór"), ["Fő utca 3., Győr", "Mór u. 5, Mór"]);
  assert.deepEqual(P.splitLocations("Szent-Györgyi u. 3., Győr-Moson"), ["Szent-Györgyi u. 3., Győr-Moson"]); assert.equal(P.splitLocations("A–B u. 1., Győr").length, 1);
  assert.deepEqual(P.splitLocations("Győr – Mór"), ["Győr", "Mór"]); assert.deepEqual(P.splitLocations("Győr — Mór"), ["Győr", "Mór"]);
  const loc = (l, title = "Értekezlet: x") => parsed(ev(title, { location: l }, at(2026, 10, 1, 9), at(2026, 10, 1, 10)));
  let x = one(loc("Fő utca 3., Győr")); assert.ok(x.workplace === "Győr" && x.address === "Fő utca 3., Győr");
  const y = loc("Fő utca 3., Győr - Mór u. 5, Mór");
  assert.deepEqual(problems(y), ["multipleAddresses"]); assert.ok(drafts(y)[0].workplace === "Győr" && drafts(y)[0].address === "Fő utca 3., Győr");
  x = one(loc("Fő utca 3., Győr", "Értekezlet @Tata: x")); assert.ok(x.workplace === "Tata" && x.address === null);    // idegen cím nem kerül be
  x = one(loc("Fő utca 3., Győr", "Értekezlet @Győr: x")); assert.ok(x.workplace === "Győr" && x.address === "Fő utca 3., Győr");
  assert.equal(one(loc("Győr")).address, null);
});

test("Utazás: útvonal-jelölések, székhely, cél, egy nyíl, címek", () => {
  const tr = (title, o = {}, home = "Győr") => parsed(ev(title, o, at(2026, 10, 1, 7, 30), at(2026, 10, 1, 8, 15)), FAR, home);
  for (const r of ["Győr ⇄ Tata, Mór | Kiszállás", "Győr <-> Tata, Mór | Kiszállás", "Győr oda-vissza Tata, Mór | Kiszállás", "Győr → Tata, Mór → Győr | Kiszállás", "Győr -> Tata, Mór -> Győr | Kiszállás"]) {
    const x = one(tr("Utazás: " + r));
    assert.ok(x && x.type.code === "TRAVEL" && x.departure === "Győr" && x.arrival === "Győr" && x.workplace === "Tata, Mór" && x.activity === "Kiszállás" && x.durationSeconds === 2700, r);
  }
  let x = one(tr("Utaz: Győr → Tata → Mór → Bicske | cél")); assert.ok(x.departure === "Győr" && x.workplace === "Tata, Mór" && x.arrival === "Bicske");
  x = one(tr("Utazás: Kiszállás", { location: "Tata" })); assert.ok(x.departure === "Győr" && x.arrival === "Győr" && x.workplace === "Tata" && x.activity === "Kiszállás");
  x = one(tr("Utazás: Tata | Kiszállás")); assert.ok(x.workplace === "Tata" && x.departure === "Győr" && x.arrival === "Győr");
  x = one(tr("Utazás: Győr ⇄ Tata", { notes: "Kiszállás\nmásodik sor" })); assert.equal(x.activity, "Kiszállás");
  assert.deepEqual(problems(tr("Utazás: Győr ⇄ Tata")), ["missingActivity"]);
  assert.deepEqual(problems(tr("Utazás: Kiszállás", { location: "Tata" }, "")), ["missingDeparture"]);
  const e1 = tr("Utazás: Győr → Tata | Kiszállás");
  assert.deepEqual(problems(e1), ["missingWorkplace"]); assert.ok(drafts(e1)[0].arrival === "Tata" && drafts(e1)[0].departure === "Győr");
  x = one(tr("Utazás: Kiszállás", { location: "Fő utca 3., Győr - Mór u. 5., Mór" })); assert.ok(x.workplace === "Győr, Mór" && x.address === "Fő utca 3., Győr - Mór u. 5., Mór");
  x = one(tr("Utazás: Győr ⇄ Tata, Mór | Kiszállás", { location: "Fő u. 3., Tata - Mór u. 5., Mór" })); assert.ok(x.workplace === "Tata, Mór" && x.address === "Fő u. 3., Tata - Mór u. 5., Mór");
  assert.equal(one(tr("Utazás @Tata: Kiszállás")).workplace, "Tata");
});

test("kihagyás: jövőbeli, éppen tartó, visszautasított, törölt", () => {
  const past = ev("Értekezlet", { location: "Győr" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10));
  assert.deepEqual(parsed(past, at(2026, 9, 30, 12)), { kind: "skipped", reason: "notFinished" });
  assert.deepEqual(parsed(past, at(2026, 10, 1, 9, 30)), { kind: "skipped", reason: "notFinished" });
  assert.ok(one(parsed(past, at(2026, 10, 1, 10))));
  assert.deepEqual(parsed({ ...past, isDeclined: true }), { kind: "skipped", reason: "declined" }); assert.deepEqual(parsed({ ...past, isCancelled: true }), { kind: "skipped", reason: "cancelled" });
  assert.deepEqual(parsed({ ...ev("Fogorvos", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 10)), isDeclined: true }), { kind: "skipped", reason: "declined" });
  assert.deepEqual(parsed(ev("Fogorvos", {}, at(2027, 1, 1, 9), at(2027, 1, 1, 10)), at(2026, 10, 1)), { kind: "skipped", reason: "notFinished" });
});

test("egész napos események", () => {
  for (const end of [at(2026, 10, 3, 23, 59), day(2026, 10, 4)]) {
    const o = parsed(ev("Szabadság", { isAllDay: true }, day(2026, 10, 1), end));
    assert.deepEqual(drafts(o).map((d) => d.date), ["2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.ok(o.kind === "imported" && drafts(o).every((d) => d.durationSeconds === 0 && d.start === null && d.type.code === "HOLIDAY"));
  }
  const o = parsed(ev("Szabadság", { isAllDay: true, id: "ABC" }, day(2026, 10, 1), at(2026, 10, 3, 23, 59)));
  assert.deepEqual(drafts(o).map((d) => d.calendarID), ["ABC#2026-10-01", "ABC#2026-10-02", "ABC#2026-10-03"]);
  assert.deepEqual(drafts(parsed(ev("Szabadság", { isAllDay: true }, day(2026, 10, 1), at(2026, 10, 3, 23, 59)), at(2026, 10, 2, 12))).map((d) => d.date), ["2026-10-01"]);
  assert.deepEqual(parsed(ev("Szabadnap", { isAllDay: true }, day(2026, 10, 5), day(2026, 10, 5)), at(2026, 10, 5, 12)), { kind: "skipped", reason: "notFinished" });
  assert.equal(drafts(parsed(ev("Munkaszüneti nap", { isAllDay: true }, day(2026, 10, 23), day(2026, 10, 23)))).length, 1);
  assert.ok(problems(parsed(ev("Értekezlet", { location: "Győr", isAllDay: true }, day(2026, 10, 1), day(2026, 10, 1)))).includes("wholeDayNotAllowed"));
  const long = parsed(ev("Szabadság", { isAllDay: true }, day(2026, 7, 1), at(2026, 8, 20, 23, 59)));
  assert.ok(drafts(long).length === 51 && long.kind === "imported");
  const th = parsed(ev("Szabadság", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 17)));
  assert.ok(drafts(th).length === 1 && drafts(th)[0].start === null);
  assert.equal(one(parsed(ev("Szabadság: Nyaralás", { isAllDay: true }, day(2026, 10, 1), day(2026, 10, 1)))).activity, "Nyaralás");
});

test("éjfélen átnyúló esemény két bejegyzésre bomlik (kivéve alkalom és fő)", () => {
  const ds = drafts(parsed(ev("Értekezlet", { location: "Győr" }, at(2026, 10, 1, 22), at(2026, 10, 2, 2))));
  assert.deepEqual(ds.map((d) => d.date), ["2026-10-01", "2026-10-02"]); assert.deepEqual(ds.map((d) => d.durationSeconds), [7200, 7200]);
  assert.equal(ds[0].end, "00:00:00"); assert.equal(ds[1].start, "00:00:00");   // a nap végi vég „00:00:00”
  assert.deepEqual(ds.map((d) => d.calendarID), ["E1#2026-10-01", "E1#2026-10-02"]);
  const back = decode(encodeText(ds.map((d) => draftToEntry(d)))).entries;
  assert.deepEqual(back.map((e) => e.durationSeconds), [7200, 7200]); assert.deepEqual(back.map((e) => e.date), ["2026-10-01", "2026-10-02"]);
  assert.deepEqual(back.map((e) => e.calendarID), ["E1#2026-10-01", "E1#2026-10-02"]);
  const q = drafts(parsed(ev("Istentisztelet", { location: "Tata" }, at(2026, 10, 1, 23), at(2026, 10, 2, 1))));
  assert.ok(q.length === 1 && q[0].quantity === 1 && q[0].date === "2026-10-01");
  const three = drafts(parsed(ev("Értekezlet", { location: "Győr" }, at(2026, 10, 1, 20), at(2026, 10, 3, 4))));
  assert.deepEqual(three.map((d) => d.durationSeconds), [4 * 3600, 86400, 4 * 3600]);
  const back3 = decode(encodeText(three.map((d) => draftToEntry(d)))).entries;
  assert.deepEqual(back3.map((e) => e.durationSeconds), [4 * 3600, 86400, 4 * 3600]);   // a 24 órás nap is megmarad
});

test("2024–2035, minden negyedév: negyedév- és évhatár, szökőnap, nyári időszámítás váltása", () => {
  for (let year = 2024; year <= 2035; year++) {
    for (let q = 1; q <= 4; q++) {
      const qs = ymd(year, (q - 1) * 3 + 1, 1), last = addDays(qs, -1), [qy, qm, qd] = qs.split("-").map(Number), [ly, lm, ld] = last.split("-").map(Number);
      const ds = drafts(parsed(ev("Értekezlet", { location: "Győr" }, at(ly, lm, ld, 22), at(qy, qm, qd, 1, 30))));
      assert.deepEqual(ds.map((d) => d.date), [last, qs], `${year}/Q${q}`);
      assert.equal(ds.reduce((a, d) => a + d.durationSeconds, 0), Math.round((at(qy, qm, qd, 1, 30) - at(ly, lm, ld, 22)) / 1000));
      assert.ok(ds[0].end === "00:00:00" && ds[1].start === "00:00:00");
      const [py, pm, pd] = addDays(qs, -2).split("-").map(Number), [ny, nm, nd] = addDays(qs, 2).split("-").map(Number);
      assert.equal(drafts(parsed(ev("Szabadság", { isAllDay: true }, day(py, pm, pd), day(ny, nm, nd)))).length, 4);
    }
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const sl = drafts(parsed(ev("Értekezlet", { location: "Győr" }, at(year, 2, 28, 22), at(year, 3, 1, 2))));
    assert.equal(sl.length, leap ? 3 : 2, `${year}`);
    if (leap) assert.ok(sl[1].date === `${year}-02-29` && sl[1].durationSeconds === 86400);
    const ny = drafts(parsed(ev("Értekezlet", { location: "Győr" }, at(year, 12, 31, 23), at(year + 1, 1, 1, 1))));
    assert.deepEqual(ny.map((d) => d.date), [`${year}-12-31`, `${year + 1}-01-01`]); assert.deepEqual(ny.map((d) => d.durationSeconds), [3600, 3600]);
    for (const month of [3, 10]) {
      const days = monthDays(year, month); let sun = days[days.length - 1];
      while (!isSunday(sun)) sun = addDays(sun, -1);
      const [sy, sm, sd] = addDays(sun, -1).split("-").map(Number), [ey, em, ed] = addDays(sun, 1).split("-").map(Number);
      const s2 = at(sy, sm, sd, 20), e2 = at(ey, em, ed, 8);
      const dsd = drafts(parsed(ev("Értekezlet", { location: "Győr" }, s2, e2)));
      assert.equal(dsd.reduce((a, d) => a + d.durationSeconds, 0), Math.round((e2 - s2) / 1000), `${year}/${month}`);
      assert.ok(dsd.length === 3 && new Set(dsd.map((d) => d.date)).size === 3);
    }
  }
});

test("hibás bemenet nem omlik össze", () => {
  assert.doesNotThrow(() => parsed(ev(undefined, { location: undefined, notes: null }, NaN, NaN)));
  assert.doesNotThrow(() => parsed(ev("Utazás: → | ⇄ ,", { location: " - , - " }, at(2026, 10, 1, 9), at(2026, 10, 1, 10))));
  assert.doesNotThrow(() => parsed(ev("Látogatás ×99999999999: x", {}, at(2026, 10, 1, 9), at(2026, 10, 1, 10))));
  assert.equal(one(parsed(ev("Látogatás ×999: x", { location: "Mór" }, at(2026, 10, 1, 9), at(2026, 10, 1, 10)))).quantity, 999);
});
