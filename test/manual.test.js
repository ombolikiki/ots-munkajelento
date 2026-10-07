import test from "node:test";
import assert from "node:assert/strict";
import * as M from "../src/manual.js";

let n = 0;
const e = (date, type, o = {}) => ({ id: String(++n), date, type, typeLabel: type, unit: "ora", durationSeconds: 3600, quantity: null, workplace: "Mór", activity: "", start: null, end: null, departure: null, arrival: null, ...o });
const TODAY = "2026-10-20";
const row = (day, list, rules = false) => M.workRow(day, list, rules, TODAY);

test("napi összeg típusonként, a napi összeg kerekítése felfelé (a pomók külön nem)", () => {
  const list = [e("2026-10-05", "MEETING", { durationSeconds: 25 * 60, source: "pomodoro" }), e("2026-10-05", "MEETING", { durationSeconds: 25 * 60 }),
    e("2026-10-05", "MEETING", { durationSeconds: 25 * 60 }), e("2026-10-05", "MEETING", { durationSeconds: 25 * 60 })];
  assert.equal(row("2026-10-05", list).values.MEETING, 2);   // 100 perc -> 2 óra (nem 4 × 1)
  assert.equal(row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 3601 })]).values.MEETING, 2);
  assert.equal(row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 60 })]).values.MEETING, 1);
});

test("fő és alkalom darabszám; legfeljebb 8 vihető fel, a saját kategória kimarad", () => {
  const r = row("2026-10-05", [e("2026-10-05", "VISITING", { unit: "fo", quantity: 3, durationSeconds: 0 }), e("2026-10-05", "VISITING", { unit: "fo", quantity: 7, durationSeconds: 0 }),
    e("2026-10-05", "PREACHING", { unit: "alkalom", quantity: 2, durationSeconds: 0 }), e("2026-10-05", "EGYEDI_X", { durationSeconds: 7200 })]);
  assert.equal(r.values.VISITING, 8); assert.equal(r.values.PREACHING, 2); assert.equal(r.values.EGYEDI_X, undefined);
  assert.ok(r.notes.some((x) => /10 helyett 8/.test(x))); assert.ok(r.notes.some((x) => /saját kategóriás/.test(x)));
  const onlyCustom = row("2026-10-05", [e("2026-10-05", "EGYEDI_X")]);
  assert.equal(onlyCustom.hasData, false); assert.ok(M.workIsEmpty(onlyCustom));
});

test("egész napos típusok és jövőbeli nap", () => {
  assert.equal(row("2026-10-06", [e("2026-10-06", "HOLIDAY", { unit: "egesz_nap", durationSeconds: 0 })]).holiday, true);
  assert.equal(row("2026-10-06", [e("2026-10-06", "DAY_OFF", { unit: "egesz_nap", durationSeconds: 0 })]).workplace, "SZABADNAP");
  assert.equal(row("2026-10-06", [e("2026-10-06", "PUBLIC_HOLIDAY", { unit: "egesz_nap", durationSeconds: 0 })]).workplace, "MUNKASZÜNETI NAP");
  assert.ok(M.workIsEmpty(row("2026-10-25", [e("2026-10-25", "MEETING")], true)));   // jövő: üres, még szabályokkal is
});

test("üres napok jelölése: !!! (hétköznap, szombat és vasárnap is), nincs 8-ra kiegészítés és nincs szombati kivétel", () => {
  const meeting = (d, h) => e(d, "MEETING", { durationSeconds: h * 3600, workplace: "Tata" });
  for (const [day, h] of [["2026-10-05", 3], ["2026-10-10", 3], ["2026-10-11", 2]]) {   // hétfő, szombat, vasárnap
    const r = row(day, [meeting(day, h)], true);
    assert.equal(r.values.OFFICE_WORK, undefined, day); assert.equal(r.values.MEETING, h); assert.equal(r.workplace, "Tata");   // azt írja be, amit rögzítettek
  }
  const big = row("2026-10-05", [e("2026-10-05", "OFFICE_WORK", { durationSeconds: 5 * 3600, workplace: "Tata" })], true);
  assert.equal(big.workplace, "Tata"); assert.equal(big.values.OFFICE_WORK, 5);        // nincs !!! az 5 órás Ügyintézésre
  assert.equal(row("2026-10-07", [], true).workplace, "!!!");            // üres hétköznap
  assert.equal(row("2026-10-10", [], true).workplace, "!!!");            // üres szombat
  assert.equal(row("2026-10-11", [], true).workplace, "!!!");            // üres vasárnap: NEM SZABADNAP
  assert.equal(row("2026-10-11", [e("2026-10-11", "DAY_OFF", { unit: "egesz_nap", durationSeconds: 0 })], true).workplace, "SZABADNAP");
  assert.ok(M.workIsEmpty(row("2026-10-07", [], false)));                // kikapcsolva csak a rögzített napok látszanak
  assert.equal(row("2026-10-05", [e("2026-10-05", "OFFICE_WORK", { durationSeconds: 5 * 3600, workplace: "" })], true).workplace, "");
  assert.equal(row("2026-10-05", [meeting("2026-10-05", 3), meeting("2026-10-05", 1)], true).values.MEETING, 4);   // napi összeg
  assert.equal(row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 9000, workplace: "Tata" })], true).values.MEETING, 3);   // felfelé kerekítés
  assert.equal(row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 12 * 3600, workplace: "Tata" })], true).values.MEETING, 8);   // legfeljebb 8
});

test("Munkahely mező: különböző helyek időrendben, Utazás Munkahelyei külön", () => {
  const list = [e("2026-10-05", "MEETING", { workplace: "Mór", start: "11:00:00", end: "12:00:00" }),
    e("2026-10-05", "TRAVEL", { workplace: "Tata, Mór, Bicske", start: "09:00:00", end: "10:00:00", departure: "Győr", arrival: "Győr" }),
    e("2026-10-05", "PREPARING", { workplace: "tata" })];
  assert.deepEqual(M.workplaceList(list), ["Tata", "Mór", "Bicske"]);
  assert.equal(row("2026-10-05", list).workplace, "Tata, Mór, Bicske");
});

test("költségelszámolás: útvonal, székhely az üres végpontokon, azonos szomszédos pontok összevonása, csak az Utazás tevékenysége", () => {
  const list = [e("2026-10-05", "TRAVEL", { workplace: "Tata, Mór", departure: "Győr", arrival: "Győr", activity: "Hittan", start: "08:00:00", end: "09:00:00" }),
    e("2026-10-05", "TRAVEL", { workplace: "Győr", departure: "", arrival: "", activity: "Hittan", start: "17:00:00", end: "18:00:00" }),
    e("2026-10-05", "MEETING", { activity: "Nem ez" }), e("2026-10-06", "MEETING", { activity: "Semmi" }),
    e("2026-09-30", "TRAVEL", { workplace: "Mór", departure: "Győr", arrival: "Tata", activity: "Más hónap" })];
  const rows = M.costRows(list, 2026, 10, "Pécs");
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].routes, [["Győr", "Tata", "Mór", "Győr"], ["Pécs", "Győr", "Pécs"]]);   // az üres végpont helyén a székhely áll
  assert.equal(M.costRoute(rows[0]), "Győr - Tata - Mór - Győr ; Pécs - Győr - Pécs");
  assert.equal(rows[0].activity, "Hittan");
  const home = M.costRows([e("2026-10-07", "TRAVEL", { workplace: "Mór", departure: "", arrival: "", activity: "x" })], 2026, 10, "Pécs");
  assert.deepEqual(home[0].routes, [["Pécs", "Mór", "Pécs"]]);
  assert.deepEqual(M.costRows([e("2026-10-07", "TRAVEL", { workplace: "Mór", departure: "Pécs", arrival: "Pécs" })], 2026, 11, "Pécs"), []);
});

test("Google Maps hivatkozás kódolása", () => {
  assert.equal(M.mapsURL(["Győr", "Tata"]), "https://www.google.com/maps/dir/Gy%C5%91r/Tata");
  assert.equal(M.mapsURL(["Szent István út 3/B", "Mór & Társa"]), "https://www.google.com/maps/dir/Szent%20Istv%C3%A1n%20%C3%BAt%203%2FB/M%C3%B3r%20%26%20T%C3%A1rsa");
  assert.equal(M.mapsURL(["Győr"]), null); assert.equal(M.mapsURL([]), null);
});

test("létszámjelentő sorok a hónapra: esedékes napok gyülekezetenként + a nem esedékes rögzített napok", () => {
  const rep = (date, c) => ({ date, congregation: c, sabbathSchool: { children: 1, adults: 2, guests: 3 }, worship: { children: 0, adults: 0, guests: 0 } });
  const rows = M.attendanceRows([rep("2026-10-10", "Mór"), rep("2026-10-17", "Tata")], ["Mór", "Bicske"], 2026, 10);
  assert.deepEqual(rows.map((r) => `${r.key} ${r.congregation} ${r.report ? "van" : "nincs"}`),
    ["2026-10-10 Mór van", "2026-10-10 Bicske nincs", "2026-10-17 Mór nincs", "2026-10-17 Bicske nincs", "2026-10-17 Tata van"]);
  assert.deepEqual(M.attendanceRows([], ["Mór"], 2026, 9), []);   // szeptemberben nincs esedékes nap
  assert.equal(M.attendanceSignature(rows[0]), "1,2,3,0,0,0"); assert.equal(M.attendanceSignature(rows[1]), "-");
  assert.deepEqual(M.attendanceRows([], ["Mór"], 2026, 13), []);
});

test("a „felvittem” jelölés aláírása változik, ha a sor tartalma módosul", () => {
  const a = row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 3600 })]), b = row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 7200 })]);
  assert.notEqual(M.workSignature(a), M.workSignature(b));
  assert.equal(M.workSignature(a), M.workSignature(row("2026-10-05", [e("2026-10-05", "MEETING", { durationSeconds: 3000 })])));   // mindkettő 1 óra
  const c1 = M.costRows([e("2026-10-05", "TRAVEL", { workplace: "Mór", departure: "A", arrival: "A", activity: "x" })], 2026, 10, "A")[0];
  const c2 = M.costRows([e("2026-10-05", "TRAVEL", { workplace: "Mór", departure: "A", arrival: "A", activity: "y" })], 2026, 10, "A")[0];
  assert.notEqual(M.costSignature(c1), M.costSignature(c2));
});

test("összesítő sor és induló hónap", () => {
  const rows = ["2026-10-05", "2026-10-06"].map((d) => row(d, [e(d, "MEETING", { durationSeconds: 7200 }), e(d, "PREACHING", { unit: "alkalom", quantity: 1, durationSeconds: 0 })]));
  assert.equal(M.workTotals(rows), "Összesen: Istentisztelet 2 · Értekezlet 4");
  assert.equal(M.workTotals([]), "");
  const prev = [e("2026-09-20", "MEETING")];
  assert.deepEqual(M.initialMonth("2026-10-05", prev, []), { y: 2026, m: 9 });   // hónap elején az előző, ha van adata
  assert.deepEqual(M.initialMonth("2026-10-11", prev, []), { y: 2026, m: 10 });
  assert.deepEqual(M.initialMonth("2026-10-05", [], []), { y: 2026, m: 10 });
  assert.deepEqual(M.initialMonth("2026-01-03", [e("2025-12-30", "MEETING")], []), { y: 2025, m: 12 });
});

test("a számítás nem omlik össze hibás bemenettől", () => {
  assert.doesNotThrow(() => row("rossz", [e("rossz", "MEETING", { durationSeconds: NaN, quantity: "x" })], true));
  assert.deepEqual(M.costRows([], 2026, 13, "A"), []);
  assert.deepEqual(M.routePoints({ workplace: ",, ,", departure: null, arrival: undefined }, ""), []);
});
