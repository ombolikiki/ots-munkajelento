// OTS Munkajelentő (webalkalmazás): a natív Mac-alkalmazás funkcióival, asztali (Windows/Chrome) használatra.
// Az adatok a böngészőben és (kiválasztott adatmappa esetén) automatikusan a számítógépen lévő CSV-fájlokban vannak.
import { createStore } from "./store.js";
import { createFolder, idbHandleStore, folderSupported } from "./folder.js";
import { encodeBytes, decode } from "./csv.js";
import { todayYMD, addDays, formatHM } from "./dates.js";
import { creditSeconds, consecutiveMissingDays, groupByDate } from "./insights.js";
import * as P from "./pomodoro.js";
import { ctx, ui } from "./ui/ctx.js";
import { esc, $ } from "./ui/util.js";
import { icon } from "./ui/icons.js";
import { fieldsHTML, pickPlace } from "./ui/fields.js";
import * as capture from "./ui/capture.js";
import * as cal from "./ui/calendar-view.js";
import * as lower from "./ui/lower.js";
import * as settings from "./ui/settings.js";
import * as ots from "./ui/ots.js";
import * as wiz from "./ui/skill-wizard.js";
import * as calui from "./ui/calendar-ui.js";
import { playSound, notify, NO_SOUND } from "./ui/sound.js";
import { parseYMD } from "./dates.js";

let store;
try {
  const supported = folderSupported();
  const folder = createFolder({
    supported,
    handleStore: supported ? idbHandleStore() : { get: async () => null, set: async () => {}, delete: async () => {} },
    picker: () => window.showDirectoryPicker({ id: "ots-adatok", mode: "readwrite", startIn: "documents" }),
  });
  store = createStore(window.localStorage, { folder, onSyncChange: () => scheduleRender() });
} catch (e) {
  store = createStore(window.localStorage);
}
const S = store.state;
ctx.store = store; ctx.S = S; ctx.render = () => render(); ctx.now = () => Date.now();

let msgHandle = null;
ctx.say = (text, isErr = false, ms = 4000) => {
  ui.msg = text; ui.msgErr = isErr;
  clearTimeout(msgHandle);
  if (ms) msgHandle = setTimeout(() => { ui.msg = null; render(); }, ms);
};

let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; queueMicrotask(() => { renderQueued = false; render(); }); }

// ---------- Megjelenés ----------

function applyTheme() {
  const root = document.documentElement, s = S.settings;
  root.dataset.palette = s.palette;
  if (s.appearance === "system") delete root.dataset.theme; else root.dataset.theme = s.appearance;
  const [, a] = settings.paletteInfo[s.palette] || [];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && a) meta.content = a;
}

const TABS = [["timer", "stopwatch", "Időzítő"], ["manual", "edit", "Kézi bevitel"], ["pomodoro", "timer", "Pomodoro"], ["calendar", "calendar", "Naptár"]];

function todaySummary() {
  const list = S.entries.filter((e) => e.date === todayYMD());
  const secs = list.reduce((a, e) => a + creditSeconds(e), 0);
  return list.length ? `Ma: ${formatHM(secs)} óra · ${list.length} bejegyzés` : "Ma még nincs bejegyzés";
}

function headerHTML() {
  return `<header class="apphead"><div class="logo">${icon("logo", 1.2)}</div><div class="titles"><h1>OTS Munkajelentő Tracker</h1><p>${esc(todaySummary())}</p></div>
    <button class="iconbtn" data-action="openOts" title="Kézi felvitel az OTS-be: a bejegyzések listája és táblázata" aria-label="Kézi felvitel az OTS-be">${icon("tablecells", 1.25)}</button>
    <button class="iconbtn" data-action="toggleSettings" title="${ui.settings ? "Vissza" : "Beállítások"}" aria-label="${ui.settings ? "Vissza" : "Beállítások"}">${icon(ui.settings ? "x" : "gear", 1.25)}</button></header>`;
}

function reminderHTML() {
  const s = S.settings;
  if (!s.reminderEnabled) return "";
  const n = consecutiveMissingDays(new Set(S.entries.map((e) => e.date)), todayYMD());
  if (n < s.reminderDays) return "";
  return `<div class="reminder">${icon("alert", 1.1)}<strong>${n} napja nem írtál munkajelentőt.</strong><span class="grow"></span><button class="linkbtn acc small" data-action="remindFill">Kézi bevitel</button></div>`;
}

function folderBannerHTML() {
  const f = store.folder;
  if (!f || ui.settings) return "";
  if (f.status === "none" && !ui.folderBannerHidden) {
    return `<div class="banner">${icon("folder", 1.1)}<div><strong>Válaszd ki az adatmappát</strong><div class="small mut">Így minden bejegyzés magától a számítógépedre is mentődik (bejegyzesek.csv), és a skill eléri.</div></div>
      <button class="btn small" data-action="folderChoose">Kiválasztás…</button><button class="iconbtn sm" data-action="bannerHide" aria-label="Elrejtés">${icon("x", 1)}</button></div>`;
  }
  if (f.status === "needs-permission") {
    return `<div class="banner warn">${icon("alert", 1.1)}<div><strong>Engedélyezd az adatmappát</strong><div class="small mut">A böngésző újra kéri a(z) „${esc(f.name)}” mappa elérését. Addig a változások csak a böngészőben vannak.</div></div><button class="btn small" data-action="folderGrant">Engedélyezés</button></div>`;
  }
  return "";
}

function bannersHTML() {
  let h = "";
  if (ui.update) h += `<div class="msg">Új változat érhető el. <button class="chip acc" data-action="reload">Frissítés</button></div>`;
  if (ui.msg) h += `<div class="msg ${ui.msgErr ? "err" : ""}" role="status">${esc(ui.msg)}</div>`;
  else if (store.error) h += `<div class="msg err">${esc(store.error)}</div>`;
  if (S.sync.error && !ui.settings) h += `<div class="msg err">${esc(S.sync.error)}</div>`;
  else if (S.sync.warning && !ui.settings) h += `<div class="msg warn">${esc(S.sync.warning)}</div>`;
  return h;
}

function footerHTML() {
  const f = store.folder;
  let text;
  if (f && f.status === "ready") text = `${icon("checkCircle", 0.9)} Automatikus mentés: ${esc(f.name)}`;
  else if (f && f.status === "needs-permission") text = `${icon("alert", 0.9)} Az adatmappa engedélyre vár`;
  else text = `${icon("alert", 0.9)} Az adatok csak a böngészőben vannak`;
  return `<footer class="foot"><span class="small mut ${f && f.status === "ready" ? "okf" : ""}">${text}</span><button class="linkbtn small" data-action="toggleSettings">Beállítások</button></footer>`;
}

function bodyHTML() {
  if (ui.settings) return settings.settingsHTML();
  const tabs = `<nav class="tabs" role="tablist" aria-label="Fő lapok">${TABS.map(([k, ic, t]) => `<button role="tab" data-action="tab" data-tab="${k}" aria-selected="${ui.mode === k}">${icon(ic, 1.05)}<span>${t}</span></button>`).join("")}</nav>`;
  const view = ui.mode === "timer" ? capture.timerHTML() : ui.mode === "manual" ? capture.manualHTML() : ui.mode === "pomodoro" ? capture.pomodoroHTML() : cal.calendarHTML();
  const hideLower = (ui.mode === "pomodoro" && ui.pomoSettings) || (ui.mode === "calendar" && ui.pending);
  return tabs + view + (hideLower ? "" : lower.dayListHTML() + lower.attendanceHTML() + lower.missingHTML() + calui.calendarCardHTML()) + footerHTML();
}

function modalHTML() {
  if (!ui.modal) return "";
  const title = ui.modal === "ots" ? "Kézi felvitel az OTS-be" : "OTS Adminisztráció skill telepítése";
  const inner = ui.modal === "ots" ? ots.otsHTML() : wiz.skillHTML();
  return `<div class="overlay" data-action="modalBackdrop"><div class="modal ${ui.modal}" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="modaltitle"><strong>${title}</strong><button class="iconbtn" data-action="modalClose" aria-label="Bezárás">${icon("x")}</button></div>${inner}</div></div>`;
}

// ---------- Újrarajzolás (a görgetési helyek megmaradnak) ----------

function render() {
  applyTheme();
  const keep = {};
  document.querySelectorAll("[data-keep-scroll]").forEach((el) => { keep[el.dataset.keepScroll] = el.scrollTop; });
  const winY = window.scrollY, active = document.activeElement, activeId = active && active.id;
  const app = $("#app");
  app.innerHTML = `<div class="panel ${ui.settings ? "is-settings" : ""}">${headerHTML()}${bannersHTML()}${ui.settings ? "" : reminderHTML() + folderBannerHTML()}${bodyHTML()}</div>${modalHTML()}`;
  document.querySelectorAll("[data-keep-scroll]").forEach((el) => { if (keep[el.dataset.keepScroll] != null) el.scrollTop = keep[el.dataset.keepScroll]; });
  if (ui.mode === "calendar" && !ui.settings && keep.cal == null) { const c = $("#calscroll"); if (c) c.scrollTop = 0; }
  window.scrollTo(0, winY);
  if (activeId) { const el = document.getElementById(activeId); if (el && el !== document.activeElement) { try { el.focus({ preventScroll: true }); } catch { /* nem baj */ } } }
  capture.tickDOM();
}

// ---------- Műveletek ----------

const actions = {
  ...capture.actions, ...cal.actions, ...lower.actions, ...settings.actions, ...ots.actions, ...wiz.actions, ...calui.actions,
  tab(el) { ui.mode = el.dataset.tab; if (ui.mode !== "calendar") ui.pending = null; ui.msg = null; },
  pick(el) { fieldsPick(el); },
  qty(el) { S.draft.quantity = Math.min(99, Math.max(1, S.draft.quantity + Number(el.dataset.d))); store.saveDraft(); },
  toggleSettings() { ui.settings = !ui.settings; ui.colorOpen = null; },
  remindFill() { ui.day = addDays(todayYMD(), -1); ui.mode = "manual"; ui.pending = null; },
  openOts() { ots.openOts(); },
  openSkill() { wiz.openSkill(); },
  modalClose() { ui.modal = null; ui.skill = null; },
  modalBackdrop(el, ev) { if (ev.target === el) { ui.modal = null; ui.skill = null; } else return false; },
  reload() { location.reload(); return false; },
  bannerHide() { ui.folderBannerHidden = true; },
  async folderChoose() {
    const r = await store.chooseFolder();
    if (r.ok) ctx.say(`Az adatmappa be van állítva: ${store.folder.name}.${(r.messages || []).length ? " " + r.messages.join(" ") : ""}`, false, 7000);
    else if (!r.cancelled) ctx.say(r.error || "A mappa kiválasztása nem sikerült.", true, 10000);
    render(); return false;
  },
  async folderGrant() {
    const ok = await store.grantFolder();
    ctx.say(ok ? "Az adatmappa újra elérhető, a változások kiírva." : "Az engedély nem lett megadva.", !ok);
    render(); return false;
  },
  async folderForget() {
    if (!confirm("Leválasztod az adatmappát? Az adatok megmaradnak a böngészőben és a mappában is, de az automatikus mentés leáll.")) return false;
    await store.forgetFolder(); render(); return false;
  },
  export() { exportCSV(); return false; },
  importPick() { $("#importFile")?.click(); return false; },
};

function fieldsPick(el) { pickPlace(el.dataset.field, el.dataset.value, el.dataset.append === "1"); document.querySelectorAll("details.menu[open]").forEach((d) => d.removeAttribute("open")); }

function exportCSV() {
  try {
    const file = new File([encodeBytes(S.entries)], "bejegyzesek.csv", { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file); a.download = "bejegyzesek.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    store.markExported(); ctx.say("Az exportálás kész."); 
  } catch (e) { ctx.say("Az exportálás nem sikerült: " + (e?.message || e), true); }
  render();
}

async function importFile(file) {
  try {
    const { entries, warnings } = decode(await file.text());
    const r = store.importEntries(entries);
    ctx.say(`Importálva: ${r.added} új bejegyzés, ${r.skipped} már megvolt.${warnings.length ? ` Figyelmeztetés: ${warnings.slice(0, 3).join("; ")}${warnings.length > 3 ? " …" : ""}` : ""}`, warnings.length > 0, 9000);
  } catch (e) { ctx.say("Az importálás nem sikerült: " + (e?.message || e), true, 9000); }
  render();
}

async function onClick(ev) {
  document.querySelectorAll("details.menu[open]").forEach((d) => { if (!d.contains(ev.target)) d.removeAttribute("open"); });
  const el = ev.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const a = el.dataset.action, fn = actions[a];
  if (!fn) return;
  if (a !== "delete") ui.confirmDelete = null;
  if (a.startsWith("reset") === false && ui.confirmReset && !["resetAsk", "resetAsk2", "resetCancel", "resetDo", "resetToggle"].includes(a)) { ui.confirmReset = 0; }
  const r = await fn(el, ev);
  if (r !== false) render();
}

function onInput(ev) {
  const el = ev.target, ns = el.dataset?.ns, f = el.dataset?.field, isChange = ev.type === "change";
  if (!ns) return;
  const value = el.type === "checkbox" ? el.checked : el.value;
  switch (ns) {
    case "draft":
      if (f === "typeCode") { if (isChange) { store.setDraftType(value); render(); } return; }
      if (f === "workplaceIsDeparture") { if (el.checked) { S.draft[f] = value === "1"; store.saveDraft(); } return; }
      S.draft[f] = value; store.saveDraft();
      if (isChange && f === "roundTrip") render(); else capture.refreshGate();
      return;
    case "manual":
      ui.manual[f] = value;
      if (f === "day") {
        if (isChange) {
          if (!parseYMD(value) || value > todayYMD()) { ui.day = todayYMD(); ctx.say("Jövőbeli napra nem lehet bejegyzést felvenni.", true); } else ui.day = value;
          render();
        }
      } else capture.refreshGate();
      return;
    case "tstart": if (isChange) { capture.setStartTime(value); render(); } return;
    case "pomo": if (isChange) { store.saveSettings({ pomo: { ...S.settings.pomo, [f]: value } }); render(); } return;
    case "set": if (isChange) { settings.onSettingChange(el); render(); if (f === "syncEnabled" && value) calui.syncNow({ auto: false }); } return;
    case "calsel": if (isChange) { calui.onCalSelect(el); render(); } return;
    case "ui": ui[f] = value; return;
    case "cat": if (isChange) { if (!store.renameCategory(el.dataset.code, value)) ctx.say("A kategória neve nem lehet üres.", true); render(); } return;
    case "hide": if (isChange) { store.setBuiltinHidden(el.dataset.code, !el.checked); render(); } return;
    case "att": if (!isChange) lower.attInput(el); return;
    case "skill": if (ui.skill) ui.skill[f] = value; return;
    default:
  }
}

document.addEventListener("click", onClick);
document.addEventListener("input", onInput);
document.addEventListener("change", (ev) => {
  if (ev.target.id === "importFile" && ev.target.files?.[0]) { importFile(ev.target.files[0]); ev.target.value = ""; return; }
  onInput(ev);
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && ui.modal) { ui.modal = null; ui.skill = null; render(); return; }
  if (ev.key !== "Enter") return;
  const t = ev.target;
  if (!(t instanceof HTMLInputElement) || t.type === "checkbox") return;
  if (t.dataset.ns === "draft" || t.dataset.ns === "manual") {
    const btn = $("#gateBtn");
    if (btn && !btn.disabled) { ev.preventDefault(); btn.click(); }
  } else if (t.id === "newPlace") { ev.preventDefault(); actions.placeAdd(); render(); }
  else if (t.id === "newCong") { ev.preventDefault(); actions.congAdd(); render(); }
  else if (t.id === "newCat") { ev.preventDefault(); actions.catAdd(); render(); }
  else if (t.id === "hexIn" && ui.colorOpen) { ev.preventDefault(); actions.colorHex({ dataset: { code: ui.colorOpen } }); render(); }
});
cal.initCalendarPointer();

// ---------- Másodpercenkénti léptetés (a háttérben is pontos, Web Workerből) ----------

let lastDay = todayYMD();
function onTick() {
  const now = Date.now();
  const r = store.tickPomo(now);
  if (r) {
    if (r.notify) {
      const snd = S.settings[r.notify.sound === "pomoEnd" ? "soundPomoEnd" : "soundBreakEnd"];
      if (snd && snd !== NO_SOUND) playSound(snd);
      if (S.settings.notifications) notify(r.notify.title, r.notify.body);
    }
    render();
    return;
  }
  const day = todayYMD();
  if (day !== lastDay) { if (ui.day === lastDay) ui.day = day; lastDay = day; render(); return; }
  capture.tickDOM();
}
try {
  const url = URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),1000)"], { type: "text/javascript" }));
  const w = new Worker(url);
  w.onmessage = onTick;
} catch { setInterval(onTick, 1000); }

// ---------- Mentés, újraolvasás, frissítés ----------

async function refreshFromFolder() {
  try { if (await store.reloadIfChanged()) render(); } catch { /* nem baj */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { if (ui.day > todayYMD()) ui.day = todayYMD(); refreshFromFolder(); render(); }
  else store.flush();
});
window.addEventListener("focus", () => { refreshFromFolder(); calui.maybeSyncOnFocus(); });
window.addEventListener("pagehide", () => { store.flush(); });

navigator.storage?.persist?.().catch(() => {});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) { ui.update = true; render(); } });
}
// Telepített (saját ablakos) használatnál első indításkor a natív app méretére állítja az ablakot.
try {
  if (window.matchMedia("(display-mode: standalone)").matches && !localStorage.getItem("ots.sized")) {
    window.resizeTo(520, Math.min(screen.availHeight, 900)); localStorage.setItem("ots.sized", "1");
  }
} catch { /* nem baj */ }

if (location.hostname === "localhost") window.__ots = { store, ui, render };   // csak helyi fejlesztéshez
render();
calui.initCalendar();
store.startSync().then(() => render()).catch(() => render());
