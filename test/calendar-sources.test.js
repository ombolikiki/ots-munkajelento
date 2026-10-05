import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../src/calendarSources.js";
import { parseEvent } from "../src/calendarParser.js";

const at = (y, m, d, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0).getTime();
const NOW = at(2026, 10, 20, 12);

test("Google: időzített esemény, leírás HTML-ből, cím és helyszín", () => {
  const e = S.googleEventToInput({ id: "g1", summary: "Értekezlet: Heti", location: "Fő utca 3., Győr", description: "Első sor<br>második &amp; sor", start: { dateTime: "2026-10-05T09:00:00+02:00" }, end: { dateTime: "2026-10-05T10:30:00+02:00" } });
  assert.equal(e.id, "g1"); assert.equal(e.title, "Értekezlet: Heti"); assert.equal(e.notes, "Első sor\nmásodik & sor");
  assert.equal(e.end - e.start, 90 * 60000); assert.equal(e.isAllDay, false); assert.equal(e.isCancelled, false);
});

test("Google: egész napos (a vég kizáró), lemondott, visszautasított, ismétlődő példány, kihagyott típusok", () => {
  const a = S.googleEventToInput({ id: "g2", summary: "Szabadság", start: { date: "2026-10-01" }, end: { date: "2026-10-04" } });
  assert.ok(a.isAllDay); assert.equal(a.start, at(2026, 10, 1)); assert.equal(a.end, at(2026, 10, 4));
  const r = parseEvent(a, NOW, "");
  assert.deepEqual(r.drafts.map((d) => d.date), ["2026-10-01", "2026-10-02", "2026-10-03"]);   // 3 nap, a 4-e már nem
  assert.ok(S.googleEventToInput({ id: "g3", status: "cancelled" }).isCancelled);
  assert.ok(S.googleEventToInput({ id: "g4", summary: "x", start: { dateTime: "2026-10-05T09:00:00Z" }, end: { dateTime: "2026-10-05T10:00:00Z" }, attendees: [{ self: true, responseStatus: "declined" }, { responseStatus: "accepted" }] }).isDeclined);
  assert.ok(!S.googleEventToInput({ id: "g5", summary: "x", start: { dateTime: "2026-10-05T09:00:00Z" }, end: { dateTime: "2026-10-05T10:00:00Z" }, attendees: [{ responseStatus: "declined" }] }).isDeclined);
  const inst = S.googleEventToInput({ id: "g6_20261005T070000Z", recurringEventId: "g6", summary: "Heti", start: { dateTime: "2026-10-05T09:00:00+02:00" }, end: { dateTime: "2026-10-05T10:00:00+02:00" }, originalStartTime: { dateTime: "2026-10-05T09:00:00+02:00" } });
  assert.equal(inst.id, `g6|${Date.parse("2026-10-05T09:00:00+02:00") / 1000}`);
  assert.equal(S.googleEventToInput({ id: "w", eventType: "workingLocation" }), null); assert.equal(S.googleEventToInput(null), null);
});

test("Google: lapozás, naptárlista, összes naptár, azonos azonosító egyszer", async () => {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, auth: init.headers.Authorization });
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (url.includes("/calendarList")) return ok({ items: [{ id: "a@x.com", summary: "OTS", primary: true }, { id: "b", summary: "Más" }] });
    if (url.includes("/calendars/a%40x.com/events") && !url.includes("pageToken")) return ok({ items: [{ id: "e1", summary: "Értekezlet", start: { dateTime: "2026-10-05T09:00:00Z" }, end: { dateTime: "2026-10-05T10:00:00Z" } }], nextPageToken: "T2" });
    if (url.includes("/calendars/a%40x.com/events")) return ok({ items: [{ id: "e2", summary: "Felk", start: { dateTime: "2026-10-06T09:00:00Z" }, end: { dateTime: "2026-10-06T10:00:00Z" } }] });
    if (url.includes("/calendars/b/events")) return ok({ items: [{ id: "e1", summary: "Értekezlet", start: { dateTime: "2026-10-05T09:00:00Z" }, end: { dateTime: "2026-10-05T10:00:00Z" } }] });
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const g = S.createGoogleProvider({ fetchFn, getToken: async () => "TOK" });
  assert.deepEqual((await g.calendars()).map((c) => [c.id, c.title]), [["google:a@x.com", "OTS"], ["google:b", "Más"]]);
  assert.deepEqual((await g.events(["a@x.com"], at(2026, 10, 1), NOW)).map((e) => e.id), ["e1", "e2"]);
  assert.deepEqual((await g.events(null, at(2026, 10, 1), NOW, { light: true })).map((e) => e.id).sort(), ["e1", "e2"]);   // a két naptárban lévő azonos azonosító egyszer
  assert.ok(calls.every((c) => c.auth === "Bearer TOK")); assert.ok(calls.some((c) => c.url.includes("singleEvents=true") && c.url.includes("showDeleted=true")));
  await assert.rejects(S.createGoogleProvider({ fetchFn: async () => ({ ok: false, status: 401, json: async () => ({}) }), getToken: async () => "x" }).calendars(), /401/);
});

test("Microsoft: időzített (UTC), egész napos, lemondott, ismétlődő példány", () => {
  const e = S.msEventToInput({ id: "m1", subject: "Ért: Heti", location: { displayName: "Győr" }, bodyPreview: "cél", start: { dateTime: "2026-10-05T07:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-10-05T08:30:00.0000000", timeZone: "UTC" }, isAllDay: false });
  assert.equal(e.start, Date.UTC(2026, 9, 5, 7)); assert.equal(e.end - e.start, 90 * 60000); assert.equal(e.location, "Győr"); assert.equal(e.notes, "cél");
  const a = S.msEventToInput({ id: "m2", subject: "Szabadnap", isAllDay: true, start: { dateTime: "2026-10-05T00:00:00.0000000" }, end: { dateTime: "2026-10-06T00:00:00.0000000" } });
  assert.ok(a.isAllDay && a.start === at(2026, 10, 5) && a.end === at(2026, 10, 6));
  assert.ok(S.msEventToInput({ id: "m3", subject: "x", isCancelled: true, start: { dateTime: "2026-10-05T07:00:00" }, end: { dateTime: "2026-10-05T08:00:00" } }).isCancelled);
  assert.ok(S.msEventToInput({ id: "m4", subject: "x", responseStatus: { response: "declined" }, start: { dateTime: "2026-10-05T07:00:00" }, end: { dateTime: "2026-10-05T08:00:00" } }).isDeclined);
  const o = S.msEventToInput({ id: "m5", type: "occurrence", seriesMasterId: "M", subject: "x", originalStart: "2026-10-05T07:00:00Z", start: { dateTime: "2026-10-05T07:00:00" }, end: { dateTime: "2026-10-05T08:00:00" } });
  assert.equal(o.id, `M|${Date.UTC(2026, 9, 5, 7) / 1000}`);
  assert.equal(S.msEventToInput({ id: "m6", type: "singleInstance", subject: "x", start: { dateTime: "2026-10-05T07:00:00" }, end: { dateTime: "2026-10-05T08:00:00" } }).id, "m6");
});

test("Microsoft: lapozás (@odata.nextLink) és a Prefer fejléc", async () => {
  const seen = [];
  const fetchFn = async (url, init) => {
    seen.push([url, init.headers.Prefer]);
    const ok = (j) => ({ ok: true, status: 200, json: async () => j });
    if (url.includes("/me/calendars?")) return ok({ value: [{ id: "c1", name: "Naptár", isDefaultCalendar: true }] });
    if (url.includes("page2")) return ok({ value: [{ id: "x2", subject: "Felk", start: { dateTime: "2026-10-06T07:00:00" }, end: { dateTime: "2026-10-06T08:00:00" } }] });
    return ok({ value: [{ id: "x1", subject: "Ért", start: { dateTime: "2026-10-05T07:00:00" }, end: { dateTime: "2026-10-05T08:00:00" } }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/page2" });
  };
  const m = S.createMicrosoftProvider({ fetchFn, getToken: async () => "T" });
  assert.deepEqual((await m.calendars()).map((c) => c.id), ["ms:c1"]);
  assert.deepEqual((await m.events(["c1"], at(2026, 10, 1), NOW)).map((e) => e.id), ["x1", "x2"]);
  assert.ok(seen.every(([, p]) => p === 'outlook.timezone="UTC"'));
});

test("összevont forrás: előtag szerinti szétosztás, null = minden naptár, hozzáférés", async () => {
  const mk = (id, evs) => ({ id, title: id, calendars: async () => [{ id: id + ":1", title: "n" }], events: async (ids) => (ids && !ids.length ? (() => { throw new Error("üres lista nem kérdezhető"); })() : evs) });
  const src = S.combineSources([mk("google", [{ id: "g" }]), mk("ms", [{ id: "m" }])]);
  assert.equal(src.access(), "granted"); assert.equal(S.combineSources([]).access(), "denied");
  assert.deepEqual((await src.events(new Set(["google:1"]), 0, 1)).map((e) => e.id), ["g"]);
  assert.deepEqual((await src.events(new Set(["ms:1"]), 0, 1)).map((e) => e.id), ["m"]);
  assert.deepEqual((await src.events(null, 0, 1)).map((e) => e.id).sort(), ["g", "m"]);
  assert.deepEqual((await src.calendars()).map((c) => c.provider), ["google", "ms"]);
});
