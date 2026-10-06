import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../src/csv.js";

const HEADER = "Azonosító;Dátum;Kezdés;Vége;Időtartam (mp);Időtartam (óó:pp);Indulás;Munkahely;Érkezés;Típus kód;Típus;Egység;Mennyiség;Tevékenység;Forrás;Cím;Naptár azonosító;Indulás cím;Érkezés cím;Munkahely helye";

const sample = [
  { id: "11111111-1111-4111-8111-111111111111", date: "2026-10-05", start: "09:00:00", end: "10:30:00", durationSeconds: 5400,
    workplace: "Győr", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, activity: "Heti; megbeszélés \"X\"", source: "timer", departure: null, arrival: null, address: null, calendarID: null, departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false },
  { id: "22222222-2222-4222-8222-222222222222", date: "2026-10-05", start: null, end: null, durationSeconds: 0,
    workplace: "Mór", type: "VISITING", typeLabel: "Látogatás (gyülekezet)", unit: "fo", quantity: 3, activity: "", source: "manual", departure: null, arrival: null, address: null, calendarID: null, departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false },
  { id: "33333333-3333-4333-8333-333333333333", date: "2026-10-06", start: "07:30:00", end: "08:15:00", durationSeconds: 2700,
    workplace: "Tata, Mór", type: "TRAVEL", typeLabel: "Utazás", unit: "ora", quantity: null, activity: "Kiszállás\nKét sor", source: "manual", departure: "Győr", arrival: "Győr", address: null, calendarID: null, departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false },
  { id: "44444444-4444-4444-8444-444444444444", date: "2026-10-07", start: null, end: null, durationSeconds: 0,
    workplace: "SZABADSÁG", type: "HOLIDAY", typeLabel: "Szabadság", unit: "egesz_nap", quantity: null, activity: "", source: "manual", departure: null, arrival: null, address: null, calendarID: null, departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false },
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

test("a régi (Cím és Naptár azonosító nélküli) fájl olvasható, az új oszlopok üresek", () => {
  const old = "Azonosító;Dátum;Kezdés;Vége;Időtartam (mp);Időtartam (óó:pp);Indulás;Munkahely;Érkezés;Típus kód;Típus;Egység;Mennyiség;Tevékenység;Forrás\r\n" +
    "11111111-1111-4111-8111-111111111111;2026-10-01;09:00:00;10:00:00;3600;1:00;;Győr;;MEETING;Értekezlet;ora;;x;manual\r\n";
  const r = C.decode(old);
  assert.equal(r.warnings.length, 0); assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].address, null); assert.equal(r.entries[0].calendarID, null);
});

test("naptári bejegyzés: Cím és Naptár azonosító oda-vissza, az oszlopok a végén, fejléc szerint azonosítva", () => {
  const e = { id: "55555555-5555-4555-8555-555555555555", date: "2026-10-01", start: "09:00:00", end: "10:00:00", durationSeconds: 3600, workplace: "Győr", type: "MEETING", typeLabel: "Értekezlet", unit: "ora",
    quantity: null, activity: "x; y", source: "calendar", departure: null, arrival: null, address: "Fő utca 3., Győr - Mór u. 5., Mór", calendarID: "ABC|1790000000#2026-10-01", departureAddress: null, arrivalAddress: null, workplaceIsDeparture: false };
  const text = C.encodeText([e]);
  const row = text.split("\r\n")[1];
  assert.ok(row.endsWith(';calendar;"Fő utca 3., Győr - Mór u. 5., Mór";ABC|1790000000#2026-10-01;;;') || row.includes(";calendar;Fő utca"), row);
  assert.deepEqual(C.decode(text).entries[0], e);
  // az oszlopsorrend megváltozása sem zavar (fejléc alapján olvas)
  const swapped = "Naptár azonosító;Cím;Azonosító;Dátum;Típus kód\r\nZ#2026-10-02;;66666666-6666-4666-8666-666666666666;2026-10-02;MEETING\r\n";
  assert.equal(C.decode(swapped).entries[0].calendarID, "Z#2026-10-02");
  assert.deepEqual(C.COLUMNS.slice(-5), ["Cím", "Naptár azonosító", "Indulás cím", "Érkezés cím", "Munkahely helye"]); assert.equal(C.COLUMNS.length, 20);
});

test("éjfélen átnyúló bejegyzések: a nap végi vég „00:00:00”, a 24 órás nap is megmarad", () => {
  const mk = (o) => ({ id: "77777777-7777-4777-8777-777777777777", type: "MEETING", typeLabel: "Értekezlet", unit: "ora", quantity: null, workplace: "Győr", activity: "", source: "calendar", departure: null, arrival: null, address: null, calendarID: null, ...o });
  const a = mk({ date: "2026-10-01", start: "22:00:00", end: "00:00:00", durationSeconds: 7200 });
  const b = mk({ date: "2026-10-02", start: "00:00:00", end: "02:00:00", durationSeconds: 7200 });
  const full = mk({ date: "2026-10-02", start: "00:00:00", end: "00:00:00", durationSeconds: 86400 });
  const back = C.decode(C.encodeText([a, b, full])).entries;
  assert.deepEqual(back.map((x) => x.durationSeconds), [7200, 7200, 86400]);
  assert.deepEqual(back.map((x) => x.date), ["2026-10-01", "2026-10-02", "2026-10-02"]);
});

test("Utazás: Indulás cím és Érkezés cím oda-vissza, a régi 17 oszlopos fájl is olvasható", () => {
  const e = { id: "88888888-8888-4888-8888-888888888888", date: "2026-10-01", start: null, end: null, durationSeconds: 1800, workplace: "Tata", type: "TRAVEL", typeLabel: "Utazás", unit: "ora", quantity: null,
    activity: "Kiszállás", source: "manual", departure: "Győr", arrival: "Mór", address: null, calendarID: null, departureAddress: "Fő út 1., Győr", arrivalAddress: "Kossuth u. 5., Mór", workplaceIsDeparture: false };
  const text = C.encodeText([e]);
  assert.ok(text.split("\r\n")[1].endsWith(";Fő út 1., Győr;Kossuth u. 5., Mór;") || text.includes('"Fő út 1., Győr"'));
  assert.deepEqual(C.decode(text).entries[0], e);
  const v17 = "Azonosító;Dátum;Típus kód;Cím;Naptár azonosító\r\n99999999-9999-4999-8999-999999999999;2026-10-02;MEETING;;\r\n";
  const r = C.decode(v17).entries[0];
  assert.equal(r.departureAddress, null); assert.equal(r.arrivalAddress, null);
});

test("Munkahely helye: „indulás” a Kiindulás jelölése, üres vagy hiányzó = a Cél; a régi 15 oszlopos fájl olvasható", () => {
  const e = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", date: "2026-10-01", start: null, end: null, durationSeconds: 1800, workplace: "Tata", type: "TRAVEL", typeLabel: "Utazás", unit: "ora", quantity: null,
    activity: "Kiszállás", source: "manual", departure: "Győr", arrival: "Győr", address: "Kossuth u. 5., Tata", calendarID: null, departureAddress: "Fő út 1., Győr", arrivalAddress: "Fő út 1., Győr", workplaceIsDeparture: true };
  const text = C.encodeText([e]);
  assert.ok(text.split("\r\n")[1].endsWith(";indulás"), text);
  assert.deepEqual(C.decode(text).entries[0], e);
  assert.equal(C.decode(C.encodeText([{ ...e, workplaceIsDeparture: false }])).entries[0].workplaceIsDeparture, false);
  assert.equal(C.decode(text.replace(";indulás", ";INDULAS")).entries[0].workplaceIsDeparture, true);   // kis- és ékezetfüggetlen
  const old = "Azonosító;Dátum;Kezdés;Vége;Időtartam (mp);Időtartam (óó:pp);Indulás;Munkahely;Érkezés;Típus kód;Típus;Egység;Mennyiség;Tevékenység;Forrás\r\nbbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb;2026-10-01;;;1800;0:30;Győr;Tata;Győr;TRAVEL;Utazás;ora;;x;manual\r\n";
  const r = C.decode(old);
  assert.equal(r.entries.length, 1); assert.equal(r.entries[0].workplaceIsDeparture, false); assert.equal(r.entries[0].departureAddress, null);
});
