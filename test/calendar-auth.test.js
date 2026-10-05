import test from "node:test";
import assert from "node:assert/strict";
import * as A from "../src/calendarAuth.js";

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

test("PKCE: a kód-kihívás a szabvány (RFC 7636) példájával egyezik", async () => {
  assert.equal(await A.pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.notEqual(A.randomString(), A.randomString()); assert.match(A.randomString(32), /^[A-Za-z0-9_-]+$/);
});

test("átirányítási cím: élesben az oldal címe, localhoston a gyökér", () => {
  assert.equal(A.redirectUri({ origin: "https://ombolikiki.github.io", pathname: "/ots-munkajelento/index.html", hostname: "ombolikiki.github.io" }), "https://ombolikiki.github.io/ots-munkajelento/");
  assert.equal(A.redirectUri({ origin: "https://ombolikiki.github.io", pathname: "/ots-munkajelento/", hostname: "ombolikiki.github.io" }), "https://ombolikiki.github.io/ots-munkajelento/");
  assert.equal(A.redirectUri({ origin: "http://localhost:8123", pathname: "/", hostname: "localhost" }), "http://localhost:8123");
});

test("Microsoft bejelentkezési cím és az átirányítás értelmezése", () => {
  const u = new URL(A.msAuthUrl({ challenge: "CH", state: "ST", redirect: "https://x/y/" }));
  assert.equal(u.origin + u.pathname, "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256"); assert.equal(u.searchParams.get("redirect_uri"), "https://x/y/");
  assert.match(u.searchParams.get("scope"), /Calendars\.Read/); assert.ok(!/ReadWrite/.test(u.searchParams.get("scope")));   // csak olvasás
  assert.deepEqual(A.parseAuthReturn("?code=C&state=ST", "ST"), { code: "C" });
  assert.match(A.parseAuthReturn("?code=C&state=XX", "ST").error, /állapota/);
  assert.equal(A.parseAuthReturn("?error=access_denied&error_description=Nem+engedted&state=ST", "ST").error, "Nem engedted");
  assert.match(A.parseAuthReturn("?state=ST", "ST").error, /kód/);
});

test("Microsoft: a lejárt jel frissítése, a frissítő jel kudarca bejelentkezést kér", async () => {
  const storage = mem(); let t = 1_000_000, calls = [];
  storage.setItem("ots.cal.auth", JSON.stringify({ ms: { access: "OLD", refresh: "R1", exp: t + 30000 } }));   // 30 mp múlva lejár: a tartalék idő miatt már nem érvényes
  const fetchFn = async (url, init) => { calls.push(new URLSearchParams(init.body)); return { ok: true, status: 200, json: async () => ({ access_token: "NEW", refresh_token: "R2", expires_in: 3600 }) }; };
  const a = A.createAuth({ storage, fetchFn, now: () => t });
  assert.equal(a.microsoft.valid, false); assert.equal(await a.microsoft.getToken(), "NEW");
  assert.equal(calls[0].get("grant_type"), "refresh_token"); assert.equal(calls[0].get("refresh_token"), "R1");
  assert.equal(JSON.parse(storage.getItem("ots.cal.auth")).ms.refresh, "R2");   // az új frissítő jel megmarad
  assert.equal(await a.microsoft.getToken(), "NEW"); assert.equal(calls.length, 1);   // érvényes jelnél nincs újabb hívás
  const bad = A.createAuth({ storage, fetchFn: async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }), now: () => t + 10 * 3600_000 });
  await assert.rejects(bad.microsoft.getToken(), (e) => e.code === "login_required");
  assert.equal(A.createAuth({ storage: mem() }).microsoft.connected, false);
  await assert.rejects(A.createAuth({ storage: mem() }).google.getToken(), (e) => e.code === "login_required");
});

test("a bejelentkezési ablak visszatérési oldala csak a kódot küldi vissza, és bezárja magát", () => {
  const sent = []; let closed = false;
  const loc = { search: "?code=C&state=S", origin: "https://x" };
  assert.equal(A.handlePopupReturn(loc, { postMessage: (m, o) => sent.push([m, o]) }, { document: { body: {} }, close: () => { closed = true; } }), true);
  assert.deepEqual(sent, [[{ type: "ots-ms-auth", search: "?code=C&state=S" }, "https://x"]]); assert.ok(closed);
  assert.equal(A.handlePopupReturn({ search: "?code=C&state=S", origin: "https://x" }, null, {}), false);   // nincs megnyitó: normál indulás
  assert.equal(A.handlePopupReturn({ search: "", origin: "https://x" }, {}, {}), false);
});

test("a Google kapcsolat állapota: lemondás, jelek tárolása", async () => {
  const storage = mem(); storage.setItem("ots.cal.auth", JSON.stringify({ google: { token: "T", exp: 5_000_000 } }));
  const a = A.createAuth({ storage, now: () => 1_000_000 });
  assert.ok(a.google.connected && a.google.valid); assert.equal(await a.google.getToken(), "T");
  await a.google.disconnect(); assert.equal(a.google.connected, false); assert.equal(JSON.parse(storage.getItem("ots.cal.auth")).google, undefined);
});
