// Naptár lap: heti nézet, a rögzített bejegyzések idősávként; egérrel húzva új idősáv jelölhető ki.
import { colorFor, lookupByCode } from "../types.js";
import { slotEntry, gate } from "../entries.js";
import { addDays, todayYMD, startOfWeek, formatShort, dayName, dayOfMonth, formatMonth, parseYMD, hmFromMinutes, formatHM } from "../dates.js";
import { targetState } from "../insights.js";
import * as C from "../calendar.js";
import { ctx, ui } from "./ctx.js";
import { esc, $, hm } from "./util.js";
import { icon } from "./icons.js";
import { fieldsHTML } from "./fields.js";

export const HOUR_PX = 30;
const monthDay = (s) => { const p = parseYMD(s); return p ? `${formatMonth(p.y, p.m).split(" ")[1].slice(0, 3)}. ${p.d}.` : s; };

function currentWeekStart() { return startOfWeek(todayYMD(), ctx.S.settings.weekStart); }

export function ensureWeek() {
  const first = ctx.S.settings.weekStart;
  if (!ui.calWeek || !parseYMD(ui.calWeek) || startOfWeek(ui.calWeek, first) !== ui.calWeek) ui.calWeek = startOfWeek(ui.calWeek && parseYMD(ui.calWeek) ? ui.calWeek : ui.day, first);
}

const stateColor = (s) => (s === "short" ? "var(--stop)" : s === "inProgress" ? "color-mix(in srgb, var(--warn) 80%, transparent)" : "transparent");

export function calendarHTML() {
  ensureWeek();
  const S = ctx.S, today = todayYMD(), band = C.bandHours(S.settings.calStartHour, S.settings.calEndHour);
  const days = C.weekDays(ui.calWeek), isCurrent = ui.calWeek >= currentWeekStart();
  const byDay = new Map(days.map((d) => [d, S.entries.filter((e) => e.date === d)]));
  const hours = []; for (let h = band.lo; h < band.hi; h++) hours.push(h);
  const total = hours.length * HOUR_PX;
  let h = `<section class="card cal"><div class="calnav"><button class="iconbtn" data-action="calPrev" aria-label="Előző hét">${icon("chevL")}</button>
    <span class="caltitle">${esc(monthDay(days[0]))} – ${esc(monthDay(days[6]))}</span>
    <button class="linkbtn acc small" data-action="calToday">Ma</button>
    <button class="iconbtn" data-action="calNext" aria-label="Következő hét" ${isCurrent ? "disabled" : ""}>${icon("chevR")}</button></div>`;
  // napok fejléce
  h += `<div class="calgrid head"><span></span>${days.map((d) => {
    const isToday = d === today, selected = d === ui.day, future = d > today;
    const st = targetState(d, byDay.get(d), today, S.settings.targetHours);
    return `<button class="dayhead ${isToday ? "today" : ""} ${selected ? "sel" : ""}" data-action="calDay" data-day="${d}" ${future ? "disabled" : ""}>
      <span class="dn">${esc(dayName(d))}</span><span class="dd">${dayOfMonth(d)}</span><span class="dot" style="background:${stateColor(st)}" title="Nincs meg a napi ${S.settings.targetHours} óra"></span></button>`;
  }).join("")}</div>`;
  // idő nélküli bejegyzések és a sávon kívüli jelzés
  const untimed = new Map(days.map((d) => [d, byDay.get(d).filter((e) => !e.start || !e.end)]));
  const outside = new Map(days.map((d) => [d, C.outsideCount(byDay.get(d), band)]));
  if ([...untimed.values()].some((l) => l.length) || [...outside.values()].some((n) => n > 0)) {
    h += `<div class="calgrid strip"><span class="tl">nap</span>${days.map((d) => {
      const list = untimed.get(d);
      return `<div class="stripcell">${list.slice(0, 3).map((e) => {
        const t = lookupByCode(e.type);
        return `<span class="tag" style="background:${colorFor(e.type)}" data-action="calDay" data-day="${d}" title="${esc([e.typeLabel, e.workplace, e.activity].filter(Boolean).join(" · "))}">${esc(C.untimedTag(e, t?.shortLabel ?? e.typeLabel, hm))}</span>`;
      }).join("")}${list.length > 3 ? `<span class="more">+${list.length - 3}</span>` : ""}${outside.get(d) > 0 ? `<span class="out" title="${outside.get(d)} bejegyzés a beállított munkanapon (${band.lo}:00–${band.hi}:00) kívül van">↕ ${outside.get(d)}</span>` : ""}</div>`;
    }).join("")}</div>`;
  }
  // rács
  h += `<div class="calscroll" id="calscroll" data-keep-scroll="cal"><div class="calgrid body" style="height:${total}px">
    <div class="times">${hours.map((hh, i) => `<span style="top:${i * HOUR_PX - 5}px">${String(hh).padStart(2, "0")}</span>`).join("")}</div>
    ${days.map((d) => {
      const future = d > today, isSel = d === ui.day;
      const placed = C.clipToBand(C.layoutDay(byDay.get(d)), band);
      const slot = ui.pending && ui.pending.day === d ? ui.pending : null;
      return `<div class="calcol ${future ? "future" : ""} ${isSel ? "sel" : ""}" data-day="${d}" ${future ? "" : 'data-drag="1"'}>
        ${placed.map((p) => {
          const top = (p.startMin - band.lo * 60) / 60 * HOUR_PX, hh = Math.max(8, (p.endMin - p.startMin) / 60 * HOUR_PX - 1);
          const t = lookupByCode(p.entry.type);
          return `<div class="cblock" data-action="calDay" data-day="${d}" style="top:${top}px;height:${hh}px;left:calc(${p.lane / p.lanes * 100}% + 1px);width:calc(${100 / p.lanes}% - 2px);background:${colorFor(p.entry.type)}"
            title="${esc([p.entry.typeLabel, p.entry.workplace, p.entry.activity].filter(Boolean).join(" · "))}"><span>${esc(t?.shortLabel ?? p.entry.typeLabel)}</span></div>`;
        }).join("")}
        ${slot ? `<div class="slot" style="top:${(slot.startMin - band.lo * 60) / 60 * HOUR_PX}px;height:${Math.max(6, (slot.endMin - slot.startMin) / 60 * HOUR_PX)}px"></div>` : ""}
      </div>`;
    }).join("")}
    ${hours.map((_, i) => `<i class="hline" style="top:${i * HOUR_PX}px"></i>`).join("")}</div></div>
    <p class="small mut calhelp">Húzd az egeret az üres idősávon új bejegyzés kijelöléséhez (jövőbeli nap nem választható).</p></section>`;
  return h + pendingHTML();
}

const slotLabel = (s) => `${hmFromMinutes(s.startMin)}–${hmFromMinutes(s.endMin)}`;

export function pendingHTML() {
  const slot = ui.pending;
  if (!slot) return "";
  const fc = ctx.store.fieldsComplete();
  return `<section class="card pending"><div class="pendhead">${icon("plus", 1.05)}<strong>Új bejegyzés: ${esc(formatShort(slot.day))}, ${slotLabel(slot)}</strong></div></section>
    ${fieldsHTML()}<section class="card"><div class="btnrow"><button class="big accent" id="gateBtn" data-action="calCommit" ${fc ? "" : "disabled"}>${icon("check", 1.05)}<span>Rögzítés</span></button>
    <button class="linkbtn" data-action="calCancel">Mégse</button></div><p class="hint" id="gateHint" ${fc ? "hidden" : ""}>${icon("exclam", 0.95)}<span>${esc(gate("manual", ctx.S.draft).text)}</span></p></section>`;
}

export const actions = {
  calPrev() { ui.calWeek = addDays(ui.calWeek, -7); ui.pending = null; },
  calNext() { if (ui.calWeek < currentWeekStart()) { ui.calWeek = addDays(ui.calWeek, 7); ui.pending = null; } },
  calToday() { ui.calWeek = currentWeekStart(); ui.day = todayYMD(); },
  calDay(el) { const d = el.dataset.day; if (d <= todayYMD()) ui.day = d; },
  calCancel() { ui.pending = null; },
  calCommit() {
    const p = ui.pending;
    if (!p) return;
    const r = slotEntry(ctx.S.draft, p.day, p.startMin, p.endMin, new Date(ctx.now()), ctx.S.entries);
    if (!r.ok) { ctx.say(r.error, true); return; }
    ctx.store.addEntry(r.entry); ctx.store.resetDraft(); ui.pending = null;
  },
};

// ---------- Húzással történő kijelölés (egér és érintés) ----------

export function initCalendarPointer() {
  let drag = null;
  document.addEventListener("pointerdown", (ev) => {
    const col = ev.target.closest?.(".calcol[data-drag]");
    if (!col || ev.target.closest(".cblock") || ev.button > 0) return;
    const day = col.dataset.day, band = C.bandHours(ctx.S.settings.calStartHour, ctx.S.settings.calEndHour);
    const y = ev.clientY - col.getBoundingClientRect().top;
    drag = { col, day, band, startMin: C.minutesAt(y, HOUR_PX, band), moved: false, x: ev.clientX, y: ev.clientY, el: null };
    col.setPointerCapture?.(ev.pointerId);
  });
  document.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < 5) return;
    drag.moved = true;
    const y = ev.clientY - drag.col.getBoundingClientRect().top;
    const now = new Date(ctx.now());
    const nowMin = drag.day === todayYMD() ? now.getHours() * 60 + now.getMinutes() : null;
    const slot = C.dragSlot(drag.startMin, C.minutesAt(y, HOUR_PX, drag.band), drag.band, nowMin);
    if (!slot) return;
    drag.slot = slot;
    if (!drag.el) { drag.el = document.createElement("div"); drag.el.className = "slot"; drag.col.appendChild(drag.el); }
    drag.el.style.top = `${(slot.startMin - drag.band.lo * 60) / 60 * HOUR_PX}px`;
    drag.el.style.height = `${Math.max(6, (slot.endMin - slot.startMin) / 60 * HOUR_PX)}px`;
  });
  const finish = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved && d.slot) { ui.pending = { day: d.day, ...d.slot }; ui.day = d.day; }
    else if (!d.moved) ui.day = d.day;   // egyszerű kattintás: a nap kiválasztása
    ctx.render();
  };
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", () => { if (drag) { drag = null; ctx.render(); } });
}
