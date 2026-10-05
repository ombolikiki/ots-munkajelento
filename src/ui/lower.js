// A főablak alsó része: napi lista (8 órás jelzéssel), gyülekezeti létszámjelentő kártya, kitöltetlen napok.
import { typeOfEntry, colorFor } from "../types.js";
import { todayYMD, addDays, formatLong, formatChip, formatHM } from "../dates.js";
import { officialSeconds, targetState, missingDaysFor, shortDays, groupByDate, lookbackStart, LOOKBACK_SHORT } from "../insights.js";
import { isDueDay, pendingAttendance, reportsOn, emptyReport, clampCount, MAX_COUNT } from "../attendance.js";
import { ctx, ui } from "./ctx.js";
import { esc, entryAmount, entryWhen, entryDetail, hm } from "./util.js";
import { icon } from "./icons.js";

const entriesOn = (day) => ctx.S.entries.filter((e) => e.date === day);

// ---------- Napi lista ----------

function targetDot(state, hours) {
  if (state === "short") return `<span class="dot lg stopc" title="Még nincs meg a napi ${hours} óra"></span>`;
  if (state === "inProgress") return `<span class="dot lg warnc" title="A mai napon még nincs meg a napi ${hours} óra"></span>`;
  if (state === "reached") return `<span class="okmark" title="Megvan a napi ${hours} óra">${icon("checkCircle", 1)}</span>`;
  return "";
}

export function dayListHTML() {
  const S = ctx.S, today = todayYMD(), day = ui.day, isToday = day === today;
  const items = entriesOn(day), hours = S.settings.targetHours;
  const state = targetState(day, items, today, hours);
  const all = items.reduce((s, e) => s + (e.unit === "ora" ? e.durationSeconds : e.unit === "egesz_nap" ? 0 : Math.max(1, e.quantity ?? 1) * 3600), 0);
  const official = officialSeconds(items);
  let h = `<section class="card daylist"><div class="daynav"><button class="iconbtn" data-action="dayPrev" aria-label="Előző nap">${icon("chevL")}</button>
    <div class="daytitle">${esc(formatLong(day))}${targetDot(state, hours)}</div>
    <button class="iconbtn" data-action="dayNext" aria-label="Következő nap" ${isToday ? "disabled" : ""}>${icon("chevR")}</button>
    <button class="pill ${isToday ? "" : "on"}" data-action="dayToday" ${isToday ? "disabled" : ""} title="Ugrás a mai napra">Ma</button></div>`;
  if (!items.length) {
    h += `<p class="mut small">Nincs bejegyzés erre a napra.</p>`;
    if (state === "short") h += `<p class="small stopt"><span class="dot stopc"></span> 0:00 / ${hours}:00 – még nincs meg a napi ${hours} óra</p>`;
  } else {
    h += `<div class="items">${items.map((e) => {
      const sure = ui.confirmDelete === e.id;
      return `<div class="item"><span class="bar" style="background:${colorFor(e.type)}"></span>
        <div class="main"><div class="t">${esc([entryWhen(e), e.typeLabel].filter(Boolean).join("  "))}</div><div class="d">${esc(entryDetail(e))}</div></div>
        <div class="amt">${esc(entryAmount(e))}</div>
        <button class="del ${sure ? "sure" : ""}" data-action="delete" data-id="${e.id}" aria-label="Törlés">${sure ? "Biztos?" : icon("trash", 1)}</button></div>`;
    }).join("")}</div>`;
    const codes = []; for (const e of items) if (!codes.includes(e.type)) codes.push(e.type);
    const total = state === "exempt"
      ? `<span class="small mut" title="1 fő és 1 alkalom is 1 órának számít">Összesen: ${hm(all)}</span>`
      : `<span class="small ${state === "short" ? "stopt" : "mut"}" title="1 fő és 1 alkalom is 1 órának számít; a saját kategóriák nem számítanak az OTS-órák közé">Összesen: ${hm(official)} / ${hours}:00${official !== all ? ` <span class="mut">(saját kategóriákkal együtt ${hm(all)})</span>` : ""}</span>`;
    h += `<div class="total">${total}<span class="dots">${codes.slice(0, 8).map((c) => `<i style="background:${colorFor(c)}"></i>`).join("")}</span></div>`;
  }
  for (const r of reportsOn(S.attendance, day, S.settings.congregations)) {
    h += `<p class="small mut att-line">${icon("people", 0.95)} Létszámjelentő · ${esc(r.congregation)}: Szombatiskola ${r.sabbathSchool.children}/${r.sabbathSchool.adults}/${r.sabbathSchool.guests}, Istentisztelet ${r.worship.children}/${r.worship.adults}/${r.worship.guests}</p>`;
  }
  return h + `</section>`;
}

// ---------- Gyülekezeti létszámjelentő ----------

export const attendanceEnabled = () => ctx.S.settings.attendanceEnabled && ctx.S.settings.congregations.length > 0;
export const attendanceFormVisible = () => attendanceEnabled() && isDueDay(ui.day) && ui.day <= todayYMD();

function loadAttDrafts() {
  const S = ctx.S, saved = reportsOn(S.attendance, ui.day, S.settings.congregations);
  const rows = {};
  for (const c of S.settings.congregations) {
    const ex = saved.find((r) => r.congregation.toLowerCase() === c.toLowerCase());
    rows[c] = ex ? { ...emptyReport(ui.day, c), sabbathSchool: { ...ex.sabbathSchool }, worship: { ...ex.worship } } : emptyReport(ui.day, c);
  }
  ui.att = { key: ui.day + "|" + S.settings.congregations.join("|") + "|" + S.attendance.length, rows, message: null };
}

export function attendanceHTML() {
  if (!attendanceEnabled()) return "";
  const S = ctx.S, today = todayYMD();
  if (attendanceFormVisible()) {
    const key = ui.day + "|" + S.settings.congregations.join("|") + "|" + S.attendance.length;
    if (ui.att.key !== key) loadAttDrafts();
    const complete = reportsOn(S.attendance, ui.day, S.settings.congregations).length === S.settings.congregations.length;
    const cell = (c, grp, k) => `<input class="num" type="text" inputmode="numeric" data-ns="att" data-cong="${esc(c)}" data-grp="${grp}" data-k="${k}" value="${ui.att.rows[c]?.[grp]?.[k] || ""}" placeholder="0" aria-label="${esc(c)} ${grp === "sabbathSchool" ? "szombatiskola" : "istentisztelet"} ${({ children: "gyermek", adults: "felnőtt adventista", guests: "felnőtt vendég" })[k]}">`;
    return `<section class="card attendance"><div class="atthead">${icon("people", 1.1)}<strong>Gyülekezeti létszámjelentő</strong><span class="grow"></span>
      ${complete ? `<span class="go small">${icon("checkCircle", 0.95)} Mentve</span>` : `<span class="warnt small">${ui.day === today ? "Ma esedékes" : "Kitöltetlen"}</span>`}</div>
      <div class="atttable"><span></span><b class="grp">Szombatiskola</b><b class="grp">Istentisztelet</b>
      <span></span>${["gyerm.", "felnőtt", "vendég", "gyerm.", "felnőtt", "vendég"].map((t) => `<small>${t}</small>`).join("")}
      ${S.settings.congregations.map((c) => `<span class="cname" title="${esc(c)}">${esc(c)}</span>${["children", "adults", "guests"].map((k) => cell(c, "sabbathSchool", k)).join("")}${["children", "adults", "guests"].map((k) => cell(c, "worship", k)).join("")}`).join("")}</div>
      <div class="btnrow"><button class="big accent" data-action="attSave">${icon("check", 1.05)}<span>${complete ? "Frissítés" : "Mentés"}</span></button>${ui.att.message ? `<span class="ok-msg">${esc(ui.att.message)}</span>` : ""}</div></section>`;
  }
  const pending = pendingAttendance(S.attendance, S.settings.congregations, lookbackFrom(), today);
  if (!pending.length) return "";
  return `<section class="card"><div class="atthead">${icon("people", 1.05)}<strong class="small">Esedékes létszámjelentő</strong></div>
    <div class="chips">${[...pending].reverse().map((d) => `<button class="chip purple" data-action="dayGo" data-day="${d}">${esc(formatChip(d))}</button>`).join("")}</div></section>`;
}

const lookbackFrom = () => lookbackStart(ctx.S.settings.lookback, todayYMD());

// ---------- Kitöltetlen napok ----------

export function missingHTML() {
  const S = ctx.S, today = todayYMD(), lb = S.settings.lookback;
  const by = groupByDate(S.entries);
  const missing = missingDaysFor(new Set(by.keys()), lb, today);
  const short = shortDays(by, lb, today, S.settings.targetHours);
  const att = attendanceEnabled() ? pendingAttendance(S.attendance, S.settings.congregations, lookbackFrom(), today) : [];
  const nothing = !missing.length && !short.length && !att.length;
  const parts = [];
  if (missing.length) parts.push(`Kitöltetlen napok (${missing.length})`);
  if (short.length) parts.push(`hiányos (${short.length})`);
  if (att.length) parts.push(`létszámjelentő (${att.length})`);
  const chip = (d, kind) => {
    const selected = d === ui.day && (kind === "att" || ui.mode === "manual");
    const extra = kind === "short" ? `<span class="chip-sub">${hm(officialSeconds(by.get(d) || []))}</span>` : "";
    const lead = kind === "short" ? `<span class="dot stopc"></span>` : kind === "att" ? icon("people", 0.85) : "";
    const title = kind === "missing" ? "Kitöltetlen nap" : kind === "short" ? `Nincs meg a napi ${S.settings.targetHours} óra` : "Létszámjelentő esedékes";
    return `<button class="chip ${kind} ${selected ? "sel" : ""}" data-action="${kind === "att" ? "dayGo" : "dayFill"}" data-day="${d}" title="${title}">${lead}${esc(formatChip(d))}${extra}</button>`;
  };
  return `<section class="card missing"><div class="mhead">${icon(nothing ? "seal" : "calendar", 1.1)}<strong class="small">${esc(parts.length ? parts.join(" · ") : "Nincs kitöltetlen nap")}</strong>
    <span class="grow"></span><span class="mut tiny">${esc(LOOKBACK_SHORT[lb] || "")}</span></div>
    ${nothing ? "" : `<div class="chips">${[...att].reverse().map((d) => chip(d, "att")).join("")}${[...missing].reverse().map((d) => chip(d, "missing")).join("")}${[...short].reverse().map((d) => chip(d, "short")).join("")}</div>`}</section>`;
}

// ---------- Műveletek ----------

export const actions = {
  dayPrev() { ui.day = addDays(ui.day, -1); ui.confirmDelete = null; },
  dayNext() { if (ui.day < todayYMD()) ui.day = addDays(ui.day, 1); ui.confirmDelete = null; },
  dayToday() { ui.day = todayYMD(); ui.confirmDelete = null; },
  dayGo(el) { ui.day = el.dataset.day; },
  dayFill(el) { ui.day = el.dataset.day; ui.mode = "manual"; ui.pending = null; },
  delete(el) {
    if (ui.confirmDelete === el.dataset.id) { ctx.store.deleteEntry(el.dataset.id); ui.confirmDelete = null; } else ui.confirmDelete = el.dataset.id;
  },
  attSave() {
    const S = ctx.S;
    const reports = S.settings.congregations.map((c) => ({ ...(ui.att.rows[c] || emptyReport(ui.day, c)), date: ui.day, congregation: c }));
    if (!ctx.store.saveReports(ui.day, reports)) { ctx.say("Jövőbeli napra nem lehet létszámjelentőt rögzíteni.", true); return; }
    ui.att.key = ""; ui.att.message = "✓ Mentve";
    loadAttDrafts(); ui.att.message = "✓ Mentve";
    setTimeout(() => { ui.att.message = null; ctx.render(); }, 2500);
  },
};

/** Beíráskor: a létszám-mező értékének mentése a piszkozatba (újrarajzolás nélkül; csak számjegyek, 0–99 999). */
export function attInput(el) {
  const c = el.dataset.cong, grp = el.dataset.grp, k = el.dataset.k;
  const digits = el.value.replace(/\D/g, "").slice(0, 5);
  const v = clampCount(digits);
  if (el.value !== (v ? String(v) : "")) el.value = v ? String(Math.min(v, MAX_COUNT)) : "";
  const r = ui.att.rows[c] || (ui.att.rows[c] = emptyReport(ui.day, c));
  r[grp][k] = v;
}
