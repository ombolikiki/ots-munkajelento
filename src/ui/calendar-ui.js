// Naptár-összekapcsolás (Google, Outlook): beállítások, a „Hiányos” és „Nem felismert” események listája, a szinkron ütemezése.
import { createAuth } from "../calendarAuth.js";
import { createGoogleProvider, createMicrosoftProvider, combineSources } from "../calendarSources.js";
import { createSyncer } from "../calendarSync.js";
import { PROBLEM_TEXT, place } from "../calendarParser.js";
import { toYMD, formatShort, hhmmss } from "../dates.js";
import { lookupByCode } from "../types.js";
import { ctx, ui } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";

let auth = null, syncer = null, timer = null;
const PROVIDERS = [["google", "Google Naptár"], ["microsoft", "Outlook / Microsoft 365"]];

function rebuild() {
  const providers = [];
  if (auth.google.connected) providers.push(createGoogleProvider({ getToken: () => auth.google.getToken() }));
  if (auth.microsoft.connected) providers.push(createMicrosoftProvider({ getToken: () => auth.microsoft.getToken() }));
  syncer = createSyncer(ctx.store, combineSources(providers));
}

export function initCalendar() {
  auth = createAuth();
  rebuild();
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === "visible") syncNow({ auto: true }); }, 5 * 60 * 1000);
  setTimeout(() => syncNow({ auto: true }), 2500);
}

export const calendarState = () => (syncer ? syncer.state : { incomplete: [], unrecognized: [], heldDeletions: [], lastResult: null });

/** Ablakra visszalépéskor: legfeljebb 2 percenként. */
export function maybeSyncOnFocus() { if (Date.now() - ui.cal.lastAuto > 120000) syncNow({ auto: true }); }

const errText = (e) => (e && e.code === "login_required" ? e.message : `Naptár-szinkron: ${e?.message || e}`);

export async function syncNow({ auto = false } = {}) {
  const s = ctx.S.settings;
  if (!syncer || !s.syncEnabled || !s.syncCalendars.length || ui.cal.busy) return null;
  if (!auth.google.connected && !auth.microsoft.connected) return null;
  ui.cal.busy = true; ui.cal.lastAuto = Date.now();
  try {
    const r = await syncer.sync(Date.now());
    ui.cal.error = null; ui.cal.needsLogin = {};
    if (r && !auto) ctx.say(`Szinkron kész: ${r.added} új, ${r.updated} frissített, ${r.deleted} törölt bejegyzés.`);
    return r;
  } catch (e) {
    ui.cal.error = errText(e);
    if (e && e.code === "login_required") ui.cal.needsLogin = { [/Google/.test(e.message) ? "google" : "microsoft"]: true };
    if (!auto) ctx.say(ui.cal.error, true, 8000);
    return null;
  } finally { ui.cal.busy = false; ctx.render(); }
}

async function refreshList() {
  try { ui.cal.calendars = await combineSources(listProviders()).calendars(); ui.cal.error = null; }
  catch (e) { ui.cal.error = errText(e); }
}
function listProviders() {
  const p = [];
  if (auth.google.connected) p.push(createGoogleProvider({ getToken: () => auth.google.getToken() }));
  if (auth.microsoft.connected) p.push(createMicrosoftProvider({ getToken: () => auth.microsoft.getToken() }));
  return p;
}

// ---------- Megjelenés ----------

const HELP = `<details class="subcard"><summary class="small"><b>Naptár jelölések: hogyan vidd fel a naptárba?</b></summary>
  <p class="small">Egy esemény = egy bejegyzés. A <b>cím</b>: <code>Típus: Mit csináltál</code>. A <b>Helyszín</b> mező a munkahely (település vagy pontos cím), az <b>időpont</b> a kezdés és a vég. Ajánlott külön naptárat használni „OTS Munkajelentő” néven. Csak a már lezajlott eseményeket veszi át.</p>
  <p class="small"><b>Típusnevek</b> (kis- és nagybetű, ékezet nem számít): Istentisztelet · Látogatás · Missziós látogatás · Ügyintézés (Ügy) · Értekezlet (Ért) · Evangelizáció (Evang) · Bibliaóra (Bibl) · Továbbképzés (Képzés) · Tartott képzés · Adminisztráció (Admin) · Felkészülés (Felk) · Utazás (Utaz) · Szabadság · Szabadnap · Munkaszüneti nap.</p>
  <ul class="small">
    <li><b>Munkahely:</b> a Helyszín mező; teljes cím is lehet (<code>Fő utca 3., Győr</code> → Győr). Gyors alternatíva: <code>Értekezlet @Győr: Heti</code> (a @ erősebb). Több cím <code> - </code> (szóköz-kötőjel-szóköz) jellel; nem Utazásnál ilyenkor az esemény „Hiányos”.</li>
    <li><b>Mennyiség</b> (Istentisztelet, Látogatás, Evangelizáció, Bibliaóra): <code>×3</code>, <code>3 fő</code>, <code>3 alkalom</code>; alapérték 1.</li>
    <li><b>Utazás:</b> <code>Utazás: Győr → Tata, Mór → Győr | Kiszállás</code>, vagy oda-vissza: <code>Utazás: Győr ⇄ Tata, Mór | Kiszállás</code>. A cél (a <code>|</code> után, vagy a Leírás első sora) kötelező. Útvonal nélkül (<code>Utazás: cél</code>) az Indulás és az Érkezés a székhely.</li>
    <li><b>Egész napos:</b> csak Szabadság, Szabadnap, Munkaszüneti nap; többnaposnál naponta egy bejegyzés.</li>
    <li><b>Éjfélen átnyúló</b> esemény két napra bomlik (kivéve az alkalom és fő típusokat).</li>
    <li><b>A naptár a mérvadó:</b> a módosított esemény frissíti a bejegyzést, a törölt vagy lemondott esemény bejegyzése törlődik. A kézzel felvitt bejegyzéshez és a beállított időszaknál régebbihez nem nyúl. Törlés előtt másolat készül; sok törlésnél megerősítést kér.</li>
  </ul></details>`;

function providerRow(id, title) {
  const a = auth[id], needs = ui.cal.needsLogin[id];
  const status = !a.connected ? `<span class="mut small">nincs összekötve</span>` : needs ? `<span class="warnt small">újra be kell lépned</span>` : `<span class="go small">${icon("checkCircle", 0.9)} összekötve</span>`;
  const btn = !a.connected ? `<button class="btn small" data-action="calConnect" data-p="${id}">Összekapcsolás</button>`
    : needs ? `<button class="btn small" data-action="calConnect" data-p="${id}">Újra belépés</button><button class="btn small ghost" data-action="calDisconnect" data-p="${id}">Leválasztás</button>`
    : `<button class="btn small ghost" data-action="calDisconnect" data-p="${id}">Leválasztás</button>`;
  return `<div class="setrow"><span><b>${title}</b> ${status}</span><div class="inl">${btn}</div></div>`;
}

export function calendarSettingsHTML() {
  const s = ctx.S.settings, anyConn = auth && (auth.google.connected || auth.microsoft.connected);
  let h = `<section class="card setcard"><h3>Naptár (Google, Outlook)</h3>
    <p class="small mut">A naptáradat segít a bejegyzések elkészítésében: a lezajlott eseményeidből (a jelölések szerint) magától bejegyzés lesz. Az alkalmazás a naptárat <b>csak olvassa</b>, nem módosítja; a bejelentkezés közvetlenül a Google-lel, illetve a Microsofttal történik, jelszót nem látunk. Részletek: <a href="adatvedelem.html" target="_blank" rel="noopener">Adatvédelem</a>.</p>
    <p class="small mut">Google: „A Google nem ellenőrizte ezt az alkalmazást” figyelmeztetésnél kattints a <b>Speciális › Továbblépés</b> pontra.</p>
    ${PROVIDERS.map(([id, t]) => providerRow(id, t)).join("")}`;
  if (anyConn) {
    const cals = ui.cal.calendars;
    h += `<hr><div class="setrow"><span>Melyik naptárakból olvasson?</span><button class="btn small ghost" data-action="calRefreshList">Frissítés</button></div>`;
    h += cals.length ? cals.map((c) => `<label class="check small"><input type="checkbox" data-ns="calsel" data-id="${esc(c.id)}" ${s.syncCalendars.includes(c.id) ? "checked" : ""}> ${esc(c.title)} <span class="mut">(${esc(c.providerTitle || c.provider)})</span></label>`).join("")
      : `<p class="small mut">A lista még nem töltődött be. Kattints a Frissítés gombra.</p>`;
    h += `<p class="small mut">Ha több naptárat jelölsz ki, csak a felismerhető típussal kezdődő című események kerülnek be.</p>
      <label class="check"><input type="checkbox" data-ns="set" data-field="syncEnabled" data-type="bool" ${s.syncEnabled ? "checked" : ""}> Automatikus szinkron (indításkor, ablakra visszalépéskor és 5 percenként)</label>
      <div class="setrow"><span>Ennyi napra visszamenőleg követi a naptárat</span><div class="stepper"><button class="step" data-action="setStep" data-key="syncDays" data-d="-10" data-lo="1" data-hi="730" ${s.syncDays <= 1 ? "disabled" : ""}>−</button><span class="val">${s.syncDays}</span><button class="step" data-action="setStep" data-key="syncDays" data-d="10" data-lo="1" data-hi="730" ${s.syncDays >= 730 ? "disabled" : ""}>+</button></div></div>
      <div class="btnwrap"><button class="btn" data-action="calSyncNow" ${ui.cal.busy || !s.syncCalendars.length ? "disabled" : ""}>${ui.cal.busy ? "Szinkronizálás…" : "Szinkronizálás most"}</button></div>`;
    const r = calendarState().lastResult;
    if (r) h += `<p class="small mut">Utolsó szinkron: ${new Date(r.date).toLocaleString("hu-HU")} · ${r.added} új, ${r.updated} frissített, ${r.deleted} törölt, ${r.incomplete} hiányos, ${r.unrecognized} nem felismert.</p>`;
  }
  if (ui.cal.error) h += `<p class="errbox"><span>${esc(ui.cal.error)}</span></p>`;
  return h + HELP + `</section>`;
}

const when = (item) => {
  const d = item.drafts[0]?.date || toYMD(new Date(item.event.start));
  return formatShort(d);
};

/** A főoldali kártya: visszatartott törlések, hiányos és nem felismert események (ha van). */
export function calendarCardHTML() {
  const st = calendarState(), s = ctx.S.settings;
  if (!s.syncEnabled || !auth) return "";
  const held = st.heldDeletions.length, inc = st.incomplete, unr = st.unrecognized;
  if (!held && !inc.length && !unr.length && !ui.cal.error) return "";
  let h = `<section class="card calpending"><div class="mhead">${icon("calendar", 1.1)}<strong class="small">Naptár</strong><span class="grow"></span>${ui.cal.busy ? `<span class="mut tiny">szinkron…</span>` : ""}</div>`;
  if (ui.cal.error) h += `<p class="small warnt">${esc(ui.cal.error)}</p>`;
  if (held) h += `<div class="confirmbox"><strong>A szinkron ${held} bejegyzés törlését visszatartotta.</strong><p class="small">A naptárban már nem találja az eseményeiket (vagy a naptár üresnek látszik). Törlés előtt másolat készül (bejegyzesek.naptar-elotti.csv).</p>
    <div class="btnwrap"><button class="btn ghost danger" data-action="calConfirmHeld">Törlés megerősítése</button><button class="btn" data-action="calDiscardHeld">Megtartom</button></div></div>`;
  const row = (item, kind) => `<div class="listrow"><div style="flex:1;min-width:0"><div class="small"><b>${esc(when(item))}</b> ${esc(item.event.title || "(cím nélkül)")}</div>
      ${kind === "inc" ? `<div class="tiny mut">${esc(item.problems.map((p) => PROBLEM_TEXT[p]).join(" "))}</div>` : `<div class="tiny mut">A cím nem ismert típussal kezdődik.</div>`}</div>
      <button class="btn small" data-action="calFill" data-id="${esc(item.event.id)}">Kitöltöm</button><button class="btn small ghost" data-action="calDismiss" data-id="${esc(item.event.id)}" title="Végleg kihagyja ezt az eseményt">Kihagyom</button></div>`;
  if (inc.length) h += `<p class="small"><b>Hiányos (${inc.length})</b></p>${inc.map((i) => row(i, "inc")).join("")}`;
  if (unr.length) h += `<p class="small" style="margin-top:8px"><b>Nem felismert (${unr.length})</b></p>${unr.map((i) => row(i, "unr")).join("")}`;
  return h + `</section>`;
}

/** A Kézi bevitel lapon: jelzés, ha egy naptáresemény kitöltése folyik. */
export function resolveBannerHTML() {
  const r = ui.cal.resolve;
  return r ? `<div class="banner">${icon("calendar", 1.1)}<div><strong>Naptáresemény kitöltése</strong><div class="small mut">${esc(r.title || "")}: a rögzítés a naptáreseményhez kapcsolódik.</div></div><button class="btn small ghost" data-action="calResolveCancel">Mégse</button></div>` : "";
}

// ---------- Műveletek ----------

function prefill(item) {
  const S = ctx.S, store = ctx.store, d0 = item.drafts[0], ev = item.event;
  const startD = new Date(ev.start), endD = new Date(ev.end);
  const day = d0 ? d0.date : toYMD(startD);
  store.setDraftType(item.type ? item.type.code : "");
  const dr = S.draft;
  const loc = place((ev.location || "").split(/\s[-–—]\s/)[0]).settlement || "";
  dr.workplace = d0 ? d0.workplace : loc; dr.activity = d0 ? d0.activity : ev.title;
  if (d0 && item.type && item.type.code === "TRAVEL") { dr.departure = d0.departure || ""; dr.arrival = d0.arrival || ""; dr.roundTrip = !!(d0.departure && d0.departure === d0.arrival); }
  if (d0 && d0.quantity) dr.quantity = d0.quantity;
  store.saveDraft();
  ui.day = day; ui.mode = "manual"; ui.settings = false; ui.pending = null;
  const m = ui.manual;
  const st = d0 && d0.start ? d0.start.slice(0, 5) : hhmmss(startD).slice(0, 5);
  let en = d0 && d0.end ? d0.end.slice(0, 5) : hhmmss(endD).slice(0, 5);
  if (en <= st) en = "23:59";
  if (!(d0 && d0.start) && !(ev.start === ev.end)) { m.mode = "range"; m.from = st; m.to = en; }
  else if (d0 && d0.durationSeconds) { m.mode = "duration"; m.hours = Math.min(16, Math.floor(d0.durationSeconds / 3600)); m.minutes = Math.min(55, Math.floor((d0.durationSeconds % 3600) / 300) * 5); }
  else { m.mode = "range"; m.from = st; m.to = en; }
  ui.cal.resolve = { eventId: ev.id, title: ev.title };
}

export const actions = {
  async calConnect(el) {
    const id = el.dataset.p;
    try { await auth[id].connect(); ui.cal.needsLogin[id] = false; ui.cal.error = null; rebuild(); await refreshList();
      const ids = new Set(ctx.S.settings.syncCalendars);
      if (!ids.size) for (const c of ui.cal.calendars) if (c.primary && c.provider === (id === "google" ? "google" : "ms")) ids.add(c.id);
      ctx.store.saveSettings({ syncCalendars: [...ids] });
    } catch (e) { if (e?.code !== "cancelled" && e?.code !== "popup_closed") ui.cal.error = errText(e); }
    ctx.render(); return false;
  },
  async calDisconnect(el) {
    const id = el.dataset.p;
    if (!confirm("Leválasztod ezt a naptár-kapcsolatot? A már átvett bejegyzések megmaradnak.")) return false;
    await auth[id].disconnect();
    const prefix = id === "google" ? "google:" : "ms:";
    ctx.store.saveSettings({ syncCalendars: ctx.S.settings.syncCalendars.filter((c) => !c.startsWith(prefix)) });
    ui.cal.calendars = ui.cal.calendars.filter((c) => !c.id.startsWith(prefix)); rebuild(); return true;
  },
  async calRefreshList() { await refreshList(); },
  async calSyncNow() { await syncNow({ auto: false }); return false; },
  calFill(el) { const item = [...calendarState().incomplete, ...calendarState().unrecognized].find((i) => i.event.id === el.dataset.id); if (item) prefill(item); },
  calDismiss(el) { syncer.dismiss(el.dataset.id); },
  async calConfirmHeld() { const ok = await syncer.confirmHeldDeletions(); ctx.say(ok ? "A visszatartott törlések végrehajtva." : "A törlés nem sikerült.", !ok); return true; },
  calDiscardHeld() { syncer.discardHeldDeletions(); },
  calResolveCancel() { ui.cal.resolve = null; },
};

/** Beállítás-mezők: naptár-jelölőnégyzet. */
export function onCalSelect(el) {
  const id = el.dataset.id, set = new Set(ctx.S.settings.syncCalendars);
  if (el.checked) set.add(id); else set.delete(id);
  ctx.store.saveSettings({ syncCalendars: [...set] });
}

/** Rögzítéskor: a kitöltött naptáreseményhez kapcsolja a bejegyzést (nem kerül vissza a hiányos listára). */
export function linkResolved(entry) {
  const r = ui.cal.resolve;
  if (!r) return entry;
  ui.cal.resolve = null;
  return { ...entry, source: "calendar", calendarID: `${r.eventId}#${entry.date}` };
}
export const lookupTypeLabel = (code) => lookupByCode(code)?.label ?? "";
