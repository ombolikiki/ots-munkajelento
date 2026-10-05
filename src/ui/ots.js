// Kézi felvitel az OTS-be: Munkajelentő, Költségelszámolás, Létszámjelentő × Naptár, Felsorolás, OTS-táblázat.
import { colorFor, lookupByCode } from "../types.js";
import { todayYMD, monthDays, startOfWeek, addDays, shiftMonth, formatMonth, formatLong, dayName, dayOfMonth, parseYMD, isSaturday, isSunday, formatHM } from "../dates.js";
import { groupByDate } from "../insights.js";
import * as M from "../manual.js";
import { ctx, ui } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";
import { paletteInfo } from "./settings.js";

const DATASETS = [["work", "Munkajelentő", "list"], ["cost", "Költségelszámolás", "car"], ["attendance", "Létszámjelentő", "people"]];
const VIEWS = [["calendar", "Naptár"], ["list", "Felsorolás"], ["table", "OTS-táblázat"]];
const isWeekend = (d) => isSaturday(d) || isSunday(d);
const unitText = (t) => (t.unit === "ora" ? "óra" : t.unit === "fo" ? "fő" : "alkalom");

export function openOts() {
  const today = todayYMD(), i = M.initialMonth(today, ctx.S.entries, ctx.S.attendance);
  ui.ots = { y: i.y, m: i.m, copied: null };
  ui.modal = "ots";
}

const canForward = () => { const t = parseYMD(todayYMD()); return ui.ots.y < t.y || (ui.ots.y === t.y && ui.ots.m < t.m); };
const copyable = (text, { bold = false, center = false } = {}) => text === "" || text == null
  ? `<span class="cp empty"> </span>`
  : `<button class="cp ${bold ? "b" : ""} ${center ? "c" : ""}" data-action="copy" data-text="${esc(text)}" title="Kattints a másoláshoz">${esc(text)}</button>`;
const doneBtn = (key, sig) => {
  const on = ctx.store.isDone(key, sig);
  return `<button class="donebtn ${on ? "on" : ""}" data-action="done" data-key="${esc(key)}" data-sig="${esc(sig)}" title="${on ? "Felvíve – kattintásra törlöd a jelölést" : "Jelöld meg, ha már felvitted az OTS-be"}">${icon(on ? "checkCircle" : "circle", 1.1)}</button>`;
};
const empty = (t) => `<p class="mut padded">${esc(t)}</p>`;

// ---------- Adatok ----------

function workRows() {
  const by = groupByDate(ctx.S.entries), today = todayYMD(), rules = ctx.S.settings.otsRules;
  return monthDays(ui.ots.y, ui.ots.m).map((d) => M.workRow(d, by.get(d) || [], rules, today));
}
const live = (r) => r.hasData || (ctx.S.settings.otsRules && !M.workIsEmpty(r));

// ---------- Hónap-rács ----------

function monthGrid(chipsFor) {
  const days = monthDays(ui.ots.y, ui.ots.m);
  if (!days.length) return "";
  const first = ctx.S.settings.weekStart, start = startOfWeek(days[0], first);
  const cells = []; let d = start;
  for (let n = 0; n < 42;) { cells.push(d); d = addDays(d, 1); n++; if (n % 7 === 0 && d > days[days.length - 1]) break; }
  const names = first === 1 ? ["V", "H", "K", "Sze", "Cs", "P", "Szo"] : ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
  let h = `<div class="mgrid">${names.map((n) => `<b>${n}</b>`).join("")}`;
  for (const day of cells) {
    const inMonth = day >= days[0] && day <= days[days.length - 1];
    const chips = inMonth ? chipsFor(day) : [];
    h += `<div class="mcell ${inMonth ? "" : "dim"}"><span class="mday ${isWeekend(day) ? "we" : ""}">${dayOfMonth(day)}</span>${chips.slice(0, 5).map((c) => `<span class="mchip" style="--c:${c.color}">${esc(c.text)}</span>`).join("")}${chips.length > 5 ? `<span class="tiny mut">+${chips.length - 5}</span>` : ""}</div>`;
  }
  return h + `</div>`;
}

// ---------- Munkajelentő ----------

function workChips(day, rows) {
  const r = rows.find((x) => x.key === day);
  if (!r) return [];
  const chips = [];
  if (r.holiday) chips.push({ text: "Szabadság", color: colorFor("HOLIDAY") });
  if (r.workplace === "SZABADNAP") chips.push({ text: "Szabadnap", color: colorFor("DAY_OFF") });
  if (r.workplace === "MUNKASZÜNETI NAP") chips.push({ text: "Munkaszüneti nap", color: colorFor("PUBLIC_HOLIDAY") });
  for (const t of M.columns()) if (r.values[t.code] != null) chips.push({ text: `${t.shortLabel} ${r.values[t.code]} ${unitText(t)}`, color: colorFor(t.code) });
  if (!chips.length && r.workplace.startsWith("!!!")) chips.push({ text: "!!!", color: "var(--warn)" });
  return chips;
}

function sourceLine(e) {
  const parts = [];
  if (e.start && e.end) parts.push(`${e.start.slice(0, 5)}–${e.end.slice(0, 5)}`);
  parts.push(e.typeLabel);
  if (e.unit === "alkalom") parts.push(`${e.quantity ?? 1} alkalom`); else if (e.unit === "fo") parts.push(`${e.quantity ?? 1} fő`); else if (e.unit === "ora") parts.push(formatHM(e.durationSeconds));
  if (e.workplace) parts.push(e.workplace);
  if (e.activity) parts.push(e.activity);
  return parts.join(" · ");
}

function workList() {
  const rows = workRows().filter(live), by = groupByDate(ctx.S.entries);
  if (!rows.length) return empty("Ebben a hónapban nincs OTS-be vihető bejegyzés.");
  return `<div class="olist">${rows.map((r) => {
    const src = [...(by.get(r.key) || [])].sort((a, b) => (a.start || "") < (b.start || "") ? -1 : 1);
    return `<div class="ocard"><div class="ohead">${doneBtn("w|" + r.key, M.workSignature(r))}<strong>${esc(formatLong(r.key))}</strong></div>
      ${r.workplace ? `<div class="oline"><span class="lbl">Munkahely</span>${copyable(r.workplace, { bold: true })}</div>` : ""}
      ${r.holiday ? `<div class="oline"><i class="cbar" style="background:${colorFor("HOLIDAY")}"></i><span>Szabadság? jelölőnégyzet: pipa</span></div>` : ""}
      ${M.columns().filter((t) => r.values[t.code] != null).map((t) => `<div class="oline"><i class="cbar" style="background:${colorFor(t.code)}"></i><span class="lbl w150">${esc(t.label)}</span>${copyable(String(r.values[t.code]), { bold: true })}<span class="small mut">${unitText(t)}</span></div>`).join("")}
      ${r.notes.map((n) => `<p class="small mut onote">${icon("info", 0.9)} ${esc(n)}</p>`).join("")}
      ${src.length ? `<details class="srcs"><summary>Rögzített bejegyzések (${src.length})</summary>${src.map((e) => `<p class="small mut"><i class="cbar s" style="background:${colorFor(e.type)}"></i>${esc(sourceLine(e))}</p>`).join("")}</details>` : ""}</div>`;
  }).join("")}</div>`;
}

function workTable() {
  const rows = workRows(), cols = M.columns();
  const head = `<div class="orow head"><span class="c-chk"></span><span class="c-day"></span><span class="c-place">Munkahely</span><span class="c-num">Szabadság?</span>${cols.map((t) => `<span class="c-num col"><i style="background:${colorFor(t.code)}"></i><small>${t.group === "Egyéb" ? "&nbsp;" : esc(t.group)}</small>${esc(t.shortLabel)}<small>${unitText(t)}</small></span>`).join("")}</div>`;
  const body = rows.map((r) => {
    const lv = live(r), done = lv && ctx.store.isDone("w|" + r.key, M.workSignature(r));
    return `<div class="orow ${isWeekend(r.key) ? "we" : ""} ${done ? "done" : ""}"><span class="c-chk">${lv ? doneBtn("w|" + r.key, M.workSignature(r)) : ""}</span>
      <span class="c-day ${isWeekend(r.key) ? "wet" : ""}">${dayOfMonth(r.key)}. ${esc(dayName(r.key))}</span><span class="c-place">${copyable(r.workplace)}</span>
      <span class="c-num">${r.holiday ? `<button class="cp c b" data-action="copy" data-text="Szabadság" data-label="Szabadság: pipa">${icon("check", 1)}</button>` : ""}</span>
      ${cols.map((t) => { const v = r.values[t.code]; return `<span class="c-num ${v != null ? "has" : ""}" ${v != null ? `style="--c:${colorFor(t.code)}"` : ""}>${v != null ? copyable(String(v), { bold: true, center: true }) : ""}</span>`; }).join("")}</div>`;
  }).join("");
  const tot = M.workTotals(rows);
  return `<div class="otable work">${head}${body}</div>${tot ? `<p class="small mut padded">${esc(tot)}</p>` : ""}`;
}

// ---------- Költségelszámolás ----------

const mapButtons = (r) => (r.mapRoutes || r.routes).map((route, i) => { const url = M.mapsURL(route);
  return url ? `<a class="btn small ghost" href="${esc(url)}" target="_blank" rel="noopener" title="Megnyitja a Google Maps többpontos útvonalát a kilométer kiszámításához">${icon("map", 1)} ${r.routes.length > 1 ? "Térkép " + (i + 1) : "Google Maps"}</a>` : ""; }).join("");

function costRows() { return M.costRows(ctx.S.entries, ui.ots.y, ui.ots.m, ctx.S.settings.home); }

function costList() {
  const rows = costRows();
  if (!rows.length) return empty("Ebben a hónapban nincs Utazás bejegyzés.");
  return `<div class="olist">${rows.map((r) => `<div class="ocard"><div class="ohead">${doneBtn("c|" + r.key, M.costSignature(r))}<strong>${esc(formatLong(r.key))}</strong><span class="grow"></span>${mapButtons(r)}</div>
    <div class="oline top"><i class="cbar" style="background:${colorFor("TRAVEL")}"></i><div><div class="oline"><span class="lbl">Útvonal</span>${copyable(M.costRoute(r), { bold: true })}</div>
    <div class="oline"><span class="lbl">Tevékenység</span>${r.activity ? copyable(r.activity, { bold: true }) : `<span class="small mut">(nincs)</span>`}</div></div></div>
    ${r.routes.length > 1 ? `<p class="small warnt">${icon("alert", 0.95)} Több útvonal ugyanazon a napon: az OTS egy sorába ` + "` ; `" + `-vel elválasztva írd, a kilométer a részútvonalak összege.</p>` : ""}</div>`).join("")}</div>`;
}

function costTable() {
  const rows = costRows();
  if (!rows.length) return empty("Ebben a hónapban nincs Utazás bejegyzés.");
  return `<div class="otable cost"><div class="orow head"><span class="c-chk"></span><span class="c-day">Dátum</span><span class="c-route">Útvonal</span><span class="c-act">Tevékenység</span><span class="c-map">Kilométer</span></div>
    ${rows.map((r) => `<div class="orow ${ctx.store.isDone("c|" + r.key, M.costSignature(r)) ? "done" : ""}"><span class="c-chk">${doneBtn("c|" + r.key, M.costSignature(r))}</span><span class="c-day">${dayOfMonth(r.key)}. ${esc(dayName(r.key))}</span>
    <span class="c-route"><i class="cbar" style="background:${colorFor("TRAVEL")}"></i>${copyable(M.costRoute(r))}</span><span class="c-act">${copyable(r.activity)}</span><span class="c-map">${r.routes.some((p) => p.length >= 2) ? mapButtons(r) : ""}</span></div>`).join("")}</div>`;
}

// ---------- Létszámjelentő ----------

const attRows = () => M.attendanceRows(ctx.S.attendance, ctx.S.settings.congregations, ui.ots.y, ui.ots.m);
const cnt = (c) => `${c.children}/${c.adults}/${c.guests}`;
const accent = () => paletteInfo[ctx.S.settings.palette]?.[1] || "#2a6bbd";

function attBody() {
  if (!ctx.S.settings.congregations.length && !ctx.S.attendance.length) return empty("Még nincs gyülekezet regisztrálva a létszámjelentőhöz (Beállítások › Gyülekezeti létszámjelentő).");
  const rows = attRows();
  if (ctx.S.settings.otsView === "calendar") {
    return monthGrid((day) => rows.filter((r) => r.key === day).map((r) => r.report
      ? { text: `${r.congregation}: SI ${cnt(r.report.sabbathSchool)} · IT ${cnt(r.report.worship)}`, color: accent() }
      : { text: `${r.congregation}: hiányzik`, color: "var(--warn)" }));
  }
  if (!rows.length) return empty("Ebben a hónapban nincs esedékes létszámjelentő.");
  const id = (r) => "l|" + r.key + "|" + r.congregation;
  if (ctx.S.settings.otsView === "list") {
    return `<div class="olist">${rows.map((r) => `<div class="ocard"><div class="ohead">${r.report ? doneBtn(id(r), M.attendanceSignature(r)) : ""}<strong>${esc(formatLong(r.key))} · ${esc(r.congregation)}</strong></div>
      ${r.report ? [["Szombatiskola", r.report.sabbathSchool], ["Istentisztelet", r.report.worship]].map(([t, c]) => `<div class="oline"><span class="lbl w110">${t}</span>
        ${[["gyermek", c.children], ["felnőtt adventista", c.adults], ["felnőtt vendég", c.guests]].map(([l, v]) => `<span class="small mut">${l}</span>${copyable(String(v), { bold: true })}`).join("")}</div>`).join("")
      : `<p class="small warnt">${icon("alert", 0.95)} Ehhez a naphoz még nincs rögzített létszám.</p>`}</div>`).join("")}</div>`;
  }
  return `<div class="otable att"><div class="orow head"><span class="c-chk"></span><span class="c-day">Dátum</span><span class="c-place">Gyülekezet</span>
    <span class="c-grp"><b>Szombatiskola</b><small>gyermek · felnőtt adv. · felnőtt vendég</small></span><span class="c-grp"><b>Istentisztelet</b><small>gyermek · felnőtt adv. · felnőtt vendég</small></span></div>
    ${rows.map((r) => `<div class="orow ${r.report && ctx.store.isDone(id(r), M.attendanceSignature(r)) ? "done" : ""}"><span class="c-chk">${r.report ? doneBtn(id(r), M.attendanceSignature(r)) : ""}</span>
    <span class="c-day">${dayOfMonth(r.key)}. ${esc(dayName(r.key))}</span><span class="c-place">${esc(r.congregation)}</span>
    ${r.report ? [r.report.sabbathSchool, r.report.worship].map((c) => `<span class="c-grp nums">${[c.children, c.adults, c.guests].map((v) => copyable(String(v), { bold: true, center: true })).join("")}</span>`).join("") : `<span class="small warnt c-grp">hiányzik</span>`}</div>`).join("")}</div>`;
}

// ---------- Összeállítás ----------

function progress() {
  const ds = ctx.S.settings.otsDataset;
  if (ds === "work") { const rows = workRows().filter(live); return `${rows.filter((r) => ctx.store.isDone("w|" + r.key, M.workSignature(r))).length}/${rows.length} nap felvíve`; }
  if (ds === "cost") { const rows = costRows(); return `${rows.filter((r) => ctx.store.isDone("c|" + r.key, M.costSignature(r))).length}/${rows.length} nap felvíve`; }
  const rows = attRows().filter((r) => r.report);
  return `${rows.filter((r) => ctx.store.isDone("l|" + r.key + "|" + r.congregation, M.attendanceSignature(r))).length}/${rows.length} jelentés felvíve`;
}

const HINTS = {
  work: "Kattints egy értékre a vágólapra másoláshoz, a körre pedig a „felvittem” jelöléshez. A saját kategóriák nem vihetők az OTS-be.",
  cost: "Az útvonalat másold az OTS-be; a kilométert a Google Maps gombbal számolhatod ki (autóval, a leggyorsabb út, felfelé kerekítve).",
  attendance: "Kattints egy számra a másoláshoz, a körre pedig a „felvittem” jelöléshez.",
};

export function otsHTML() {
  const s = ctx.S.settings, ds = s.otsDataset, view = s.otsView;
  const body = ds === "work" ? (view === "calendar" ? monthGrid((d) => workChips(d, workRows())) : view === "list" ? workList() : workTable())
    : ds === "cost" ? (view === "calendar" ? monthGrid((day) => { const r = costRows().find((x) => x.key === day); return r ? r.routes.map((p) => ({ text: p.join(" → "), color: colorFor("TRAVEL") })) : []; }) : view === "list" ? costList() : costTable())
    : attBody();
  const t = parseYMD(todayYMD());
  return `<div class="modalhead"><div class="mtool"><div class="seg wide">${DATASETS.map(([id, label, ic]) => `<button data-action="otsSet" data-key="otsDataset" data-value="${id}" aria-pressed="${ds === id}">${icon(ic, 1)} ${label}</button>`).join("")}</div>
    <div class="monthnav"><button class="iconbtn" data-action="otsMonth" data-d="-1" aria-label="Előző hónap">${icon("chevL")}</button><strong>${esc(formatMonth(ui.ots.y, ui.ots.m))}</strong>
    <button class="iconbtn" data-action="otsMonth" data-d="1" aria-label="Következő hónap" ${canForward() ? "" : "disabled"}>${icon("chevR")}</button></div></div>
    <div class="mtool"><div class="seg">${VIEWS.map(([id, label]) => `<button data-action="otsSet" data-key="otsView" data-value="${id}" aria-pressed="${view === id}">${label}</button>`).join("")}</div>
    ${ds === "work" ? `<label class="check small" title="8 órára kiegészítés az Ügyintézésben (hétköznap), !!! jelölés, üres napok kitöltése. Kikapcsolva a rögzített adatok szerepelnek, kiegészítés nélkül."><input type="checkbox" data-ns="set" data-field="otsRules" data-type="bool" ${s.otsRules ? "checked" : ""}> A skill szabályai szerint</label>` : ""}</div></div>
    <div class="modalbody" data-keep-scroll="ots">${body}</div>
    <div class="modalfoot">${ui.ots.copied ? `<span class="acc">${icon("copy", 1)} Másolva: ${esc(ui.ots.copied)}</span>` : `<span class="mut">${HINTS[ds]}</span>`}<span class="grow"></span><span class="mut">${progress()}</span></div>`;
}

// ---------- Műveletek ----------

let copiedTimer = null;
export const actions = {
  otsSet(el) { ctx.store.saveSettings({ [el.dataset.key]: el.dataset.value }); },
  otsMonth(el) {
    const n = shiftMonth(ui.ots.y, ui.ots.m, Number(el.dataset.d));
    if (Number(el.dataset.d) > 0 && !canForward()) return;
    ui.ots.y = n.y; ui.ots.m = n.m;
  },
  done(el) { ctx.store.setDone(el.dataset.key, el.dataset.sig, !ctx.store.isDone(el.dataset.key, el.dataset.sig)); },
  async copy(el) {
    const text = el.dataset.text;
    if (!text) return false;
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch { /* nem baj */ } ta.remove();
    }
    const shown = el.dataset.label || text;
    ui.ots.copied = shown.length > 60 ? shown.slice(0, 60) + "…" : shown;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { ui.ots.copied = null; if (ui.modal === "ots") ctx.render(); }, 2500);
    ctx.render();
    return false;
  },
};
