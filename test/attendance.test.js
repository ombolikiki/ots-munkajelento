import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../src/attendance.js";

const rep = (date, cong, ss = [1, 2, 3], ws = [4, 5, 6]) => ({ date, congregation: cong, sabbathSchool: { children: ss[0], adults: ss[1], guests: ss[2] }, worship: { children: ws[0], adults: ws[1], guests: ws[2] } });

test("CSV kör-teszt: BOM, pontosvessző, CRLF, rendezés", () => {
  const list = [rep("2026-10-10", "Mór"), rep("2026-10-10", "Bicske", [0, 10, 0], [0, 9, 1]), rep("2026-08-15", "Mór")];
  const bytes = A.encodeBytes(list);
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  const text = new TextDecoder().decode(bytes.slice(3));
  assert.ok(text.endsWith("\r\n")); assert.ok(text.startsWith("Dátum;Gyülekezet;Szombatiskola gyermek;"));
  assert.equal(text.split("\r\n")[1], "2026-08-15;Mór;1;2;3;4;5;6");
  const back = A.decode(new TextDecoder().decode(bytes));
  assert.equal(back.warnings.length, 0); assert.equal(back.reports.length, 3);
  assert.deepEqual(back.reports.find((r) => r.congregation === "Bicske"), rep("2026-10-10", "Bicske", [0, 10, 0], [0, 9, 1]));
});

test("hibás bemenet nem okoz hibát: rossz dátum, hiányzó gyülekezet, inf és 1e99, duplikátum, Excel-dátum", () => {
  const csv = "Dátum;Gyülekezet;Szombatiskola gyermek;Szombatiskola felnőtt adventista;Szombatiskola felnőtt vendég;Istentisztelet gyermek;Istentisztelet felnőtt adventista;Istentisztelet felnőtt vendég\n" +
    "nem dátum;Mór;1;1;1;1;1;1\n2026-10-10;;1;1;1;1;1;1\n2026-10-10;Mór;inf;1e99;-5;7;abc;100000\n2026. 10. 10.;mór;9;9;9;9;9;9\n\n";
  const r = A.decode(csv);
  assert.equal(r.warnings.length, 2); assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].sabbathSchool.children, 9);   // a későbbi, ugyanarra a napra és gyülekezetre szóló sor felülír
  const clamp = A.decode("Dátum;Gyülekezet;Szombatiskola gyermek;Istentisztelet felnőtt vendég\n2026-10-10;Mór;inf;100000\n").reports[0];
  assert.equal(clamp.sabbathSchool.children, 0); assert.equal(clamp.worship.guests, 99999);
  assert.throws(() => A.decode("Valami;Más\n1;2"), /hiányzik/);
  assert.deepEqual(A.decode("").reports, []);
});

test("gyülekezetlista tisztítása, napi jelentések, mentés cseréje", () => {
  assert.deepEqual(A.cleanCongregations([" Mór ", "mór", "", "Bicske", 5, null]), ["Mór", "Bicske", "5"]);
  const all = [rep("2026-10-10", "Mór"), rep("2026-10-10", "Bicske"), rep("2026-08-15", "Mór")];
  assert.deepEqual(A.reportsOn(all, "2026-10-10", ["Bicske", "Mór", "Tata"]).map((r) => r.congregation), ["Bicske", "Mór"]);
  const saved = A.saveDayReports(all, "2026-10-10", [rep("x", "mór", [9, 9, 9], [9, 9, 9])]);
  assert.equal(saved.length, 3); assert.equal(saved.find((r) => r.date === "2026-10-10" && r.congregation === "mór").sabbathSchool.children, 9);
  assert.equal(A.clampCount("12.7"), 12); assert.equal(A.clampCount("x"), 0); assert.equal(A.clampCount(-4), 0); assert.equal(A.clampCount(1e9), 99999);
});

test("lemaradt létszámjelentők a tartományban (mai nap is), minden negyedévre 2024–2035", () => {
  const congs = ["Mór", "Bicske"];
  const pend = A.pendingAttendance([], congs, "2026-10-01", "2026-10-10");
  assert.deepEqual(pend, ["2026-10-10"]);                                  // a mai napon esedékes
  assert.deepEqual(A.pendingAttendance([], congs, "2026-10-01", "2026-10-09"), []);   // még nem jött el
  assert.deepEqual(A.pendingAttendance([rep("2026-10-10", "Mór")], congs, "2026-10-01", "2026-10-31"), ["2026-10-10"]);   // csak az egyik gyülekezet
  assert.deepEqual(A.pendingAttendance([rep("2026-10-10", "Mór"), rep("2026-10-10", "bicske")], congs, "2026-10-01", "2026-10-31"), []);
  assert.deepEqual(A.pendingAttendance([], [], "2026-10-01", "2026-10-31"), []);
  assert.deepEqual(A.pendingAttendance([], congs, "rossz", "2026-10-31"), []);
});
