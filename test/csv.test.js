import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/csv.js";

const HEADER = "Azonosító;Dátum;Kezdés;Vége;Időtartam (mp);Időtartam (óó:pp);Indulás;Munkahely;Érkezés;Típus kód;Típus;Egység;Mennyiség;Tevékenység;Forrás";

const sample = [
  { id: "11111111-1111-4111-8111-111111111111", date: "2026-10-05", start: "09:00:00", end: "10:30:00", durationSeconds: 5400,
    workplace: "Győr", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, activity: "Heti; megbeszélés \"X\"", source: "timer", departure: null, arrival: null },
  { id: "22222222-2222-4222-8222-222222222222", date: "2026-10-05", start: null, end: null, durationSeconds: 0,
    workplace: "Mór", type: "VISITING", typeLabel: "Látogatás (gyülekezet)", unit: "fo", quantity: 3, activity: "", source: "manual", departure: null, arrival: null },
  { id: "33333333-3333-4333-8333-333333333333", date: "2026-10-06", start: "07:30:00", end: "08:15:00", durationSeconds: 2700,
    workplace: "Tata, Mór", type: "TRAVEL", typeLabel: "Utazás", unit: "ora", quantity: null, activity: "Kiszállás\nKét sor", source: "manual", departure: "Győr", arrival: "Győr" },
  { id: "44444444-4444-4444-8444-444444444444", date: "2026-10-07", start: null, end: null, durationSeconds: 0,
    workplace: "SZABADSÁG", type: "HOLIDAY", typeLabel: "Szabadság", unit: "egesz_nap", quantity: null, activity: "", source: "manual", departure: null, arrival: null },
];

test("a fejléc bájtra azonos a Mac-alkalmazáséval", () => {
  assert.equal(C.COLUMNS.join(";"), HEADER);
  assert.ok(C.encodeText([]).startsWith(HEADER + "\r\n"));
});

test("a fájl UTF-8 BOM-mal kezdődik, CRLF sorvéggel", () => {
  const b = C.encodeBytes(sample);
  assert.deepEqual([...b.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  assert.ok(C.encodeText(sample).endsWith("\r\n"));
});

test("írás és olvasás körbe", () => {
  const { entries, warnings } = C.decode(C.encodeText(sample));
  assert.deepEqual(warnings, []);
  assert.deepEqual(entries, sample);
});

test("BOM-mal is olvasható, és az időtartam óó:pp csak óra típusnál van", () => {
  const text = "﻿" + C.encodeText(sample);
  const { entries } = C.decode(text);
  assert.equal(entries.length, 4);
  const rows = C.encodeText(sample).split("\r\n");
  assert.ok(rows[1].includes(";5400;1:30;"));
  assert.ok(rows[2].includes(";0;;"));   // fő típus: nincs óó:pp
});

test("Mac által írt sor olvasása (idézőjeles pontosvesszővel és sortöréssel)", () => {
  const text = HEADER + "\r\n" + '33333333-3333-4333-8333-333333333333;2026-10-06;07:30:00;08:15:00;2700;0:45;Győr;"Tata, Mór";Győr;TRAVEL;Utazás;ora;;"Kiszállás\nKét sor";manual\r\n';
  const { entries } = C.decode(text);
  assert.equal(entries[0].activity, "Kiszállás\nKét sor");
  assert.equal(entries[0].workplace, "Tata, Mór");
  assert.equal(entries[0].departure, "Győr");
  assert.equal(entries[0].durationSeconds, 2700);
});

test("táblázatkezelő által átírt dátum, vessző elválasztó, LF sorvég", () => {
  const text = "Dátum,Kezdés,Vége,Munkahely,Típus kód,Tevékenység\n2026. 10. 03.,9:00,10:00,Győr,MEETING,x\n03/10/2026,,,Mór,OFFICE_WORK,y\n";
  const { entries, warnings } = C.decode(text);
  assert.deepEqual(warnings, []);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].date, "2026-10-03");
  assert.equal(entries[0].durationSeconds, 3600);
  assert.equal(entries[1].date, "2026-10-03");
  assert.equal(entries[1].durationSeconds, 0);
});

test("hibás számok és sorok nem okoznak hibát", () => {
  const text = HEADER + "\n" +
    "x;2026-10-05;;;inf;;;Győr;;MEETING;Értekezlet;ora;;a;manual\n" +
    "y;2026-10-05;;;1e99;;;Győr;;MEETING;Értekezlet;ora;;a;manual\n" +
    "z;2026-10-05;;;NaN;;;Győr;;MEETING;Értekezlet;ora;;a;manual\n" +
    "w;nem-dátum;;;60;;;Győr;;MEETING;Értekezlet;ora;;a;manual\n" +
    "v;2026-02-30;;;60;;;Győr;;MEETING;Értekezlet;ora;;a;manual\n" +
    ";;;;;;;;;;;;;;\n" +
    "u;2026-10-05;;;60;;;Győr;;;;ora;;a;manual\n";
  const { entries, warnings } = C.decode(text);
  assert.equal(entries.length, 3);                       // inf, 1e99, NaN -> 0 másodperc, de a sor megmarad
  assert.ok(entries.every((e) => e.durationSeconds === 0));
  assert.ok(warnings.length >= 2);
  assert.ok(warnings.some((w) => w.includes("hibás dátum")));
  assert.ok(warnings.some((w) => w.includes("nincs megadva típus")));
});

test("hiányzó kötelező oszlop hibát jelez", () => {
  assert.throws(() => C.decode("Munkahely;Típus kód\nGyőr;MEETING\n"), /Dátum/);
  assert.throws(() => C.decode("Dátum;Munkahely\n2026-10-05;Győr\n"), /Típus/);
  assert.deepEqual(C.decode(""), { entries: [], warnings: [] });
});

test("ismeretlen (egyéni) kategória nem vész el", () => {
  const text = "Dátum;Munkahely;Típus kód;Típus;Egység;Időtartam (mp)\n2026-10-05;Győr;EGYEDI_ONKEPZES;Önképzés;ora;3600\n";
  const { entries } = C.decode(text);
  assert.equal(entries[0].type, "EGYEDI_ONKEPZES");
  assert.equal(entries[0].typeLabel, "Önképzés");
  assert.equal(entries[0].durationSeconds, 3600);
});

test("éjfélen átnyúló bejegyzés időtartama", () => {
  const { entries } = C.decode("Dátum;Kezdés;Vége;Munkahely;Típus kód\n2026-10-05;23:00;01:00;Győr;MEETING\n");
  assert.equal(entries[0].durationSeconds, 7200);
});

test("mennyiség korlátozása", () => {
  const { entries } = C.decode("Dátum;Munkahely;Típus kód;Mennyiség\n2026-10-05;Győr;PREACHING;5000\n2026-10-05;Győr;PREACHING;0\n2026-10-05;Győr;PREACHING;\n");
  assert.deepEqual(entries.map((e) => e.quantity), [999, 1, 1]);
});

test("a szám-olvasó védett", () => {
  assert.equal(C.number("12"), 12);
  assert.equal(C.number("1,5"), 2);
  for (const s of ["", " ", "inf", "-Infinity", "1e99", "x", null]) assert.equal(C.number(s), null, String(s));
});

test("az ismétlődő és a hiányos azonosító új azonosítót kap", () => {
  const { entries } = C.decode("Azonosító;Dátum;Munkahely;Típus kód\nnem-uuid;2026-10-05;Győr;MEETING\n");
  assert.match(entries[0].id, /^[0-9a-f-]{36}$/);
});
