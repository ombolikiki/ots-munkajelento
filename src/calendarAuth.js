// Bejelentkezés a naptárakhoz, csak olvasási joggal, kliens titok nélkül:
// - Google: Google Identity Services „token” mód (böngészőben, 1 órás hozzáférési jel; lejártakor csendes megújítás, ha nem megy, újra be kell lépni);
// - Microsoft: hitelesítési kód + PKCE, felugró ablakban (frissítő jellel).
// A jelek csak ebben a böngészőben vannak (localStorage); jelszót az alkalmazás sosem lát.
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE, MS_CLIENT_ID, MS_SCOPE } from "./calendarConfig.js";

const KEY = "ots.cal.auth";
export const MARGIN_MS = 60000;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const randomString = (n = 48) => b64url(globalThis.crypto.getRandomValues(new Uint8Array(n)));
export async function pkceChallenge(verifier) {
  return b64url(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

/** A Microsoft átirányítási címe: a regisztrált címmel egyezik (az oldal címe `index.html` nélkül; localhoston a gyökér, záró per jel nélkül). */
export function redirectUri(loc = globalThis.location) {
  if (/^(localhost|127\.0\.0\.1)$/.test(loc.hostname)) return loc.origin;
  return loc.origin + loc.pathname.replace(/index\.html$/, "");
}

export function msAuthUrl({ challenge, state, redirect, clientId = MS_CLIENT_ID, scope = MS_SCOPE }) {
  const q = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirect, response_mode: "query", scope, state, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" });
  return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + q.toString();
}

/** Az átirányítás utáni keresősztringből a kód (vagy hiba). */
export function parseAuthReturn(search, expectedState) {
  const p = new URLSearchParams(String(search).replace(/^\?/, ""));
  if (p.get("state") !== expectedState) return { error: "A bejelentkezés állapota nem egyezik (próbáld újra)." };
  if (p.get("error")) return { error: p.get("error_description") || p.get("error") };
  return p.get("code") ? { code: p.get("code") } : { error: "Nem érkezett hitelesítési kód." };
}

function loadStore(storage) { try { return JSON.parse(storage.getItem(KEY) || "{}") || {}; } catch { return {}; } }
function saveStore(storage, v) { try { storage.setItem(KEY, JSON.stringify(v)); } catch { /* nem baj */ } }

export function createAuth({ storage = globalThis.localStorage, fetchFn = (...a) => globalThis.fetch(...a), now = () => Date.now() } = {}) {
  const store = loadStore(storage);
  const save = () => saveStore(storage, store);
  const loginRequired = (who) => Object.assign(new Error(`${who}: újra be kell jelentkezned.`), { code: "login_required" });

  // ---------- Google ----------
  let gisPromise = null, tokenClient = null, pending = null;
  const loadGis = () => gisPromise || (gisPromise = new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client"; s.async = true;
    s.onload = () => resolve(); s.onerror = () => { gisPromise = null; reject(new Error("A Google bejelentkezési szkript nem tölthető be (internetkapcsolat?).")); };
    document.head.appendChild(s);
  }));
  async function googleRequest(prompt) {
    await loadGis();
    if (!tokenClient) {
      tokenClient = globalThis.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPE,
        callback: (r) => { const p = pending; pending = null; if (!p) return; if (r.error) p.reject(Object.assign(new Error(r.error_description || r.error), { code: r.error })); else p.resolve(r); },
        error_callback: (e) => { const p = pending; pending = null; if (p) p.reject(Object.assign(new Error(e.message || e.type || "Megszakadt a bejelentkezés."), { code: e.type || "popup_failed_to_open" })); },
      });
    }
    return new Promise((resolve, reject) => { pending = { resolve, reject }; tokenClient.requestAccessToken({ prompt, ...(store.google?.hint ? { hint: store.google.hint } : {}) }); });
  }
  const google = {
    get connected() { return !!store.google; },
    get valid() { return !!store.google?.token && store.google.exp - now() > MARGIN_MS; },
    /** Bejelentkezés (kattintásból hívandó). */
    async connect() {
      const r = await googleRequest(store.google ? "" : "consent");
      if (!(r.scope || "").includes("calendar.readonly") && r.scope) throw new Error("A naptár olvasási engedélyét nem adtad meg.");
      store.google = { ...(store.google || {}), token: r.access_token, exp: now() + (Number(r.expires_in) || 3600) * 1000 };
      save();
    },
    /** Érvényes hozzáférési jel; lejártakor csendes megújítás, ennek kudarca esetén `login_required`. */
    async getToken() {
      if (google.valid) return store.google.token;
      if (!store.google) throw loginRequired("Google Naptár");
      try {
        const r = await Promise.race([googleRequest("none"), new Promise((_, rej) => setTimeout(() => rej(new Error("időtúllépés")), 8000))]);
        store.google = { ...store.google, token: r.access_token, exp: now() + (Number(r.expires_in) || 3600) * 1000 };
        save();
        return store.google.token;
      } catch { throw loginRequired("Google Naptár"); }
    },
    async disconnect() {
      const t = store.google?.token;
      delete store.google; save();
      try { if (t && globalThis.google?.accounts?.oauth2) globalThis.google.accounts.oauth2.revoke(t, () => {}); } catch { /* nem baj */ }
    },
  };

  // ---------- Microsoft ----------
  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  async function msToken(params) {
    const res = await fetchFn(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: MS_CLIENT_ID, scope: MS_SCOPE, ...params }).toString() });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) throw Object.assign(new Error(j.error_description || j.error || `A Microsoft bejelentkezés hibát jelzett (${res.status}).`), { code: j.error || "token_error" });
    return j;
  }
  const keep = (j) => { store.ms = { access: j.access_token, refresh: j.refresh_token || store.ms?.refresh, exp: now() + (Number(j.expires_in) || 3600) * 1000 }; save(); };
  const microsoft = {
    get connected() { return !!store.ms; },
    get valid() { return !!store.ms?.access && store.ms.exp - now() > MARGIN_MS; },
    /** Bejelentkezés felugró ablakban (kattintásból hívandó). */
    async connect() {
      const verifier = randomString(48), state = randomString(16), redirect = redirectUri();
      const url = msAuthUrl({ challenge: await pkceChallenge(verifier), state, redirect });
      const w = globalThis.open(url, "ots-ms-login", "width=520,height=700");
      if (!w) throw new Error("A böngésző letiltotta a felugró ablakot. Engedélyezd az oldalnak, és próbáld újra.");
      const search = await new Promise((resolve, reject) => {
        const onMsg = (ev) => { if (ev.origin === globalThis.location.origin && ev.data?.type === "ots-ms-auth") { cleanup(); resolve(ev.data.search); } };
        const timer = setInterval(() => { if (w.closed) { cleanup(); reject(Object.assign(new Error("Bezártad a bejelentkezési ablakot."), { code: "cancelled" })); } }, 500);
        const cleanup = () => { clearInterval(timer); globalThis.removeEventListener("message", onMsg); try { w.close(); } catch { /* nem baj */ } };
        globalThis.addEventListener("message", onMsg);
      });
      const r = parseAuthReturn(search, state);
      if (r.error) throw new Error(r.error);
      keep(await msToken({ grant_type: "authorization_code", code: r.code, redirect_uri: redirect, code_verifier: verifier }));
    },
    async getToken() {
      if (microsoft.valid) return store.ms.access;
      if (!store.ms?.refresh) throw loginRequired("Outlook naptár");
      try { keep(await msToken({ grant_type: "refresh_token", refresh_token: store.ms.refresh })); return store.ms.access; }
      catch { throw loginRequired("Outlook naptár"); }
    },
    disconnect() { delete store.ms; save(); },
  };
  return { google, microsoft };
}

/** A Microsoft-bejelentkezés felugró ablaka: az átirányított oldal visszaküldi a kódot a megnyitónak, és bezárja magát. Igaz, ha ez az eset állt fenn. */
export function handlePopupReturn(loc = globalThis.location, opener = globalThis.opener, win = globalThis) {
  if (!opener || !/[?&](code|error)=/.test(loc.search) || !/[?&]state=/.test(loc.search)) return false;
  try { opener.postMessage({ type: "ots-ms-auth", search: loc.search }, loc.origin); } catch { /* nem baj */ }
  try { win.document.body.textContent = "Kész. Ez az ablak bezárul…"; win.close(); } catch { /* nem baj */ }
  return true;
}
