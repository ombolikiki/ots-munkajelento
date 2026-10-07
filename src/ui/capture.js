// Rögzítési módok: Időzítő, Kézi bevitel, Pomodoro.
import { UNIT, isWholeDay } from "../types.js";
import { gate, draftType, manualEntry } from "../entries.js";
import { todayYMD, formatClock, formatHM, parseTime } from "../dates.js";
import * as P from "../pomodoro.js";
import { ctx, ui } from "./ctx.js";
import { esc, $, timeValue } from "./util.js";
import { clampStart } from "../entries.js";
import { monthLimitWarning } from "../insights.js";
import { icon } from "./icons.js";
import { fieldsHTML } from "./fields.js";
import { askNotifications } from "./sound.js";
import { resolveBannerHTML, linkResolved } from "./calendar-ui.js";

const bigBtn = (cls, action, ic, label, disabled = false, id = "") =>
  `<button class="big ${cls}" ${id ? `id="${id}"` : ""} data-action="${action}" ${disabled ? "disabled" : ""}>${icon(ic, 1.05)}<span>${label}</span></button>`;
const hint = (text, id = "gateHint") => `<p class="hint" id="${id}" ${text ? "" : "hidden"}>${icon("exclam", 0.95)}<span>${esc(text)}</span></p>`;

// ---------- Időzítő ----------

/** Az „előző út” km-állásához: a bejegyzés napja (kézi bevitelnél a kiválasztott nap, a naptári résnél annak napja, egyébként a mai nap). */
export const kmDay = () => (ui.mode === "manual" ? ui.day : ui.mode === "calendar" && ui.pending ? ui.pending.day : todayYMD());
export const kmCtx = () => ({ entries: ctx.S.entries, day: kmDay() });

const START_MINUTES = [5, 10, 15, 30];

/** A Kezdés sora: óó:pp mező és a −5/−10/−15/−30 perc gombok; a „Most” visszaállít. Futás közben a futó időzítő kezdését javítja. */
function startRowHTML(running) {
  const S = ctx.S, now = ctx.now();
  const startMs = running ? S.timer.startMs : ui.plannedStart;
  const isNow = !running && ui.plannedStart == null;
  const val = startMs == null ? "" : timeValue(new Date(startMs));
  const chips = START_MINUTES.map((m) => `<button type="button" class="startchip" data-action="timerBack" data-min="${m}" title="A kezdés ${m} perccel korábbi">−${m}</button>`).join("");
  return `<div class="startrow"><span class="mut small">Kezdés</span>
    <input type="time" data-ns="tstart" data-field="start" value="${esc(val)}" aria-label="Kezdés (óó:pp)" title="Legfeljebb a mai nap elejéig mehet vissza, jövőbeli nem lehet">
    <button type="button" class="startchip" data-action="timerNowStart" aria-pressed="${isNow}" title="A kezdés a pillanatnyi idő">Most</button>${chips}</div>`;
}

/** A Kezdés mező értéke (óó:pp) -> az Időzítő kezdése a mai napon. */
export function setStartTime(value) {
  const secs = parseTime(value), now = ctx.now();
  if (secs == null) { ui.plannedStart = null; return; }
  const n = new Date(now);
  const ms = new Date(n.getFullYear(), n.getMonth(), n.getDate(), Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), 0, 0).getTime();
  if (ms > now) ctx.say("A kezdés nem lehet jövőbeli.", true);
  if (ctx.S.timer) ctx.store.setTimerStart(ms, now); else ui.plannedStart = clampStart(ms, now);
}

export function timerHTML() {
  const S = ctx.S, running = !!S.timer, pomoOn = P.isActive(S.pomo);
  const type = draftType(S.draft);
  const g = gate("timer", S.draft, kmCtx());
  const startHint = pomoOn ? "A Pomodoro fut, előbb állítsd le." : g.text;
  const elapsed = running ? Math.floor((ctx.now() - S.timer.startMs) / 1000) : 0;
  let h = fieldsHTML() + `<section class="card timer">${startRowHTML(running)}<div class="clockrow"><span class="pulse ${running ? "on" : ""}"></span><span class="clock" id="clock">${formatClock(elapsed)}</span></div>`;
  if (running) {
    const hint2 = gate("manual", S.draft, kmCtx()).text;
    h += `<div class="btnrow">${bigBtn("stop", "timerStop", "stop", "Stop és mentés", !ctx.store.fieldsComplete(kmDay()), "gateBtn")}<button class="linkbtn" data-action="timerDiscard">Elvetés</button></div>${hint(hint2)}`;
  } else {
    h += bigBtn("go", "timerStart", "play", "Start", !!startHint || !type, "gateBtn") + hint(startHint);
  }
  return h + `</section>`;
}

// ---------- Kézi bevitel ----------

function manualDefaults() {
  const m = ui.manual;
  if (!m.from || !m.to) {
    const now = new Date(ctx.now());
    m.to = timeValue(now);
    const from = new Date(now.getTime() - 3600000);
    m.from = from.getDate() === now.getDate() ? timeValue(from) : "00:00";
  }
}

function manualResult() {
  const m = ui.manual;
  return manualEntry(ctx.S.draft, { day: ui.day, mode: m.mode, from: m.from, to: m.to, hours: m.hours, minutes: m.minutes, now: new Date(ctx.now()), existing: ctx.S.entries });
}

export function manualHTML() {
  manualDefaults();
  const m = ui.manual, S = ctx.S, type = draftType(S.draft), whole = isWholeDay(type), needsTime = type && type.unit === UNIT.HOURS;
  const r = manualResult();
  let h = resolveBannerHTML() + fieldsHTML() + `<section class="card manual"><label class="f"><span>Nap</span><input type="date" data-ns="manual" data-field="day" value="${esc(ui.day)}" max="${todayYMD()}"></label>`;
  if (needsTime) {
    h += `<div class="seg"><button type="button" data-action="mmode" data-mode="range" aria-pressed="${m.mode === "range"}">Időpont (tól–ig)</button>
      <button type="button" data-action="mmode" data-mode="duration" aria-pressed="${m.mode === "duration"}">Óraszám</button></div>`;
    h += m.mode === "range"
      ? `<div class="row2"><label class="f"><span>Tól</span><input type="time" data-ns="manual" data-field="from" value="${esc(m.from)}"></label>
          <label class="f"><span>Ig</span><input type="time" data-ns="manual" data-field="to" value="${esc(m.to)}"></label></div>`
      : `<div class="row2"><div class="stepline"><div class="stepper"><button type="button" class="step" data-action="mstep" data-field="hours" data-d="-1">−</button><span class="val">${m.hours} óra</span><button type="button" class="step" data-action="mstep" data-field="hours" data-d="1">+</button></div></div>
          <div class="stepline"><div class="stepper"><button type="button" class="step" data-action="mstep" data-field="minutes" data-d="-5">−</button><span class="val">${m.minutes} perc</span><button type="button" class="step" data-action="mstep" data-field="minutes" data-d="5">+</button></div></div></div>`;
  } else if (type && !whole) h += `<p class="mut small">Ennél a típusnál nem kell időtartam, csak a mennyiség.</p>`;
  const msg = m.message ? `<span class="ok-msg">${esc(m.message)}</span>` : "";
  h += `<div class="btnrow">${bigBtn("accent", "manualSave", "check", "Rögzítés", !r.ok, "gateBtn")}${msg}</div>${hint(r.ok ? "" : r.error)}`;
  return h + `</section>`;
}

/** Beíráskor a Rögzítés gomb és a figyelmeztetés frissítése újrarajzolás nélkül. */
export function refreshGate() {
  const btn = $("#gateBtn"), hintEl = $("#gateHint");
  if (!btn) return;
  let disabled, text;
  if (ui.mode === "manual") { const r = manualResult(); disabled = !r.ok; text = r.ok ? "" : r.error; }
  else if (ui.mode === "timer") {
    if (ctx.S.timer) { disabled = !ctx.store.fieldsComplete(kmDay()); text = disabled ? gate("manual", ctx.S.draft, kmCtx()).text : ""; }
    else { const g = gate("timer", ctx.S.draft, kmCtx()); disabled = g.disabled || P.isActive(ctx.S.pomo); text = P.isActive(ctx.S.pomo) ? "A Pomodoro fut, előbb állítsd le." : g.text; }
  } else if (ui.mode === "pomodoro") {
    const g = gate("timer", ctx.S.draft, kmCtx());
    if (P.isActive(ctx.S.pomo)) { disabled = ctx.S.pomo.phase === "work" ? !ctx.store.fieldsComplete(kmDay()) : false; text = ctx.S.pomo.phase === "work" ? g.text : ""; }
    else { disabled = g.disabled || !!ctx.S.timer; text = ctx.S.timer ? "Az időzítő fut, előbb állítsd le." : g.text; }
  } else if (ui.mode === "calendar" && ui.pending) { disabled = !ctx.store.fieldsComplete(kmDay()); text = gate("manual", ctx.S.draft, kmCtx()).text; }
  else return;
  btn.disabled = disabled;
  if (hintEl) { hintEl.querySelector("span").textContent = text; hintEl.hidden = !text; }
}

// ---------- Pomodoro ----------

const RING_R = 52, RING_C = 2 * Math.PI * RING_R;

/** A munkamenet eddigi ideje óó:pp. */
const sessionClock = (st, nowMs) => formatHM(P.sessionElapsed(st, nowMs) ?? 0);

export function pomodoroHTML() {
  const S = ctx.S, cfg = S.settings.pomo, st = S.pomo, active = P.isActive(st), now = ctx.now();
  const g = gate("timer", S.draft, kmCtx());
  const startHint = S.timer ? "Az időzítő fut, előbb állítsd le." : g.text;
  const prog = P.progress(st, now, cfg);
  const break_ = st.phase === "shortBreak" || st.phase === "longBreak";
  let h = fieldsHTML() + `<section class="card pomo"><div class="ring ${break_ ? "brk" : ""}"><svg viewBox="0 0 120 120" width="100%" height="100%">
      <circle class="track" cx="60" cy="60" r="${RING_R}"/><circle class="rbar" id="ringBar" cx="60" cy="60" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - prog)}" transform="rotate(-90 60 60)"/></svg>
      <div class="ringtext"><span class="clock sm ${active ? "" : "mut"}" id="pomoClock">${formatClock(active ? P.remainingSeconds(st, now) : cfg.work * 60)}</span><span class="small mut" id="pomoPhase">${P.phaseTitle(st.phase)}</span></div></div>`;
  if (!active) h += bigBtn("go", "pomoStart", "play", "Pomo indítása", !!startHint || !draftType(S.draft), "gateBtn") + hint(startHint);
  else if (st.phase === "work") h += `<div class="btnrow">${bigBtn("stop", "pomoStop", "stop", "Leállítás és mentés", !ctx.store.fieldsComplete(kmDay()), "gateBtn")}<button class="linkbtn" data-action="pomoDiscard">Elvetés</button></div>${hint(ctx.store.fieldsComplete(kmDay()) ? "" : g.text)}`;
  else h += `<div class="btnrow">${bigBtn("accent", "pomoSkip", "forward", "Szünet kihagyása")}<button class="linkbtn" data-action="pomoStop">Leállítás</button></div>`;
  h += `<div class="pomofoot"><span class="small mut">Elvégzett pomo: ${st.done}</span>${st.session ? `<span class="small mut" title="A munkamenet (a pomók és a szünetek együtt) eddigi ideje; egyetlen bejegyzésként rögzül">· munkamenet: <b id="pomoSession">${sessionClock(st, now)}</b></span>` : ""}${st.done > 0 ? `<button class="linkbtn acc small" data-action="pomoReset">Nulláz</button>` : ""}
      <span class="grow"></span><button class="linkbtn acc small" data-action="pomoSettings">${icon(ui.pomoSettings ? "chevU" : "gear", 0.95)} Pomo beállítások</button></div>`;
  if (ui.pomoSettings) {
    const step = (key, title, lo, hi) => `<div class="setrow"><span>${title}</span><div class="stepper"><button class="step" data-action="pomoStep" data-key="${key}" data-d="-1" ${cfg[key] <= lo ? "disabled" : ""}>−</button><span class="val">${cfg[key]}</span><button class="step" data-action="pomoStep" data-key="${key}" data-d="1" ${cfg[key] >= hi ? "disabled" : ""}>+</button></div></div>`;
    h += `<div class="subcard">${step("work", "Pomo hossza (perc)", 1, 180)}${step("short", "Rövid szünet (perc)", 1, 60)}${step("long", "Hosszú szünet (perc)", 1, 120)}${step("every", "Hosszú szünet minden … pomo után", 2, 12)}
      <label class="check" title="Bekapcsolva a pomók és a szünetek együtt egyetlen bejegyzést adnak (Kezdés = az első pomo indítása, Vége = a munkamenet vége); a mezők a munkamenet alatt zároltak. Kikapcsolva minden lejárt pomo külön bejegyzés, a szünet nem rögzül."><input type="checkbox" data-ns="pomo" data-field="merge" ${cfg.merge ? "checked" : ""}> A szünet is munkaidő, és a munkamenet egy bejegyzésben rögzül</label>
      <label class="check"><input type="checkbox" data-ns="pomo" data-field="autoBreak" ${cfg.autoBreak ? "checked" : ""}> A szünet automatikusan induljon</label>
      <label class="check"><input type="checkbox" data-ns="pomo" data-field="autoWork" ${cfg.autoWork ? "checked" : ""}> A következő pomo automatikusan induljon</label>
      <button class="linkbtn acc small" data-action="pomoDefaults">Alapértelmezett (25 / 5 / 15, minden 4.)</button>
      <p class="small mut">A módosítás a következő pomo indításától érvényes.</p></div>`;
  }
  return h + `</section>`;
}

/** Másodpercenként: az óra és a gyűrű frissítése újrarajzolás nélkül; a böngészőcím mutatja az időt (a menüsori ikon helyett). */
export function tickDOM() {
  const S = ctx.S, now = ctx.now();
  const c = $("#clock");
  if (c && S.timer) c.textContent = formatClock(Math.floor((now - S.timer.startMs) / 1000));
  if (P.isActive(S.pomo)) {
    const pc = $("#pomoClock"), bar = $("#ringBar"), ps = $("#pomoSession");
    if (ps && S.pomo.session) ps.textContent = sessionClock(S.pomo, now);
    if (pc) pc.textContent = formatClock(P.remainingSeconds(S.pomo, now));
    if (bar) bar.setAttribute("stroke-dashoffset", String(RING_C * (1 - P.progress(S.pomo, now, S.settings.pomo))));
  }
  let title = "OTS Munkajelentő Tracker";
  if (S.timer) title = `⏱ ${formatClock(Math.floor((now - S.timer.startMs) / 1000))} · ${title}`;
  else if (P.isActive(S.pomo)) title = `${S.pomo.phase === "work" ? "🍅" : "☕"} ${formatClock(P.remainingSeconds(S.pomo, now))} · ${title}`;
  if (document.title !== title) document.title = title;
}

// ---------- Műveletek ----------

const clampStep = (v, d, lo, hi) => Math.min(hi, Math.max(lo, v + d));
const RANGES = { work: [1, 180], short: [1, 60], long: [1, 120], every: [2, 12] };

export const actions = {
  timerStart() {
    if (!ctx.store.startTimer(ctx.now(), ui.plannedStart)) ctx.say("Töltsd ki a kötelező mezőket.", true); else ui.plannedStart = null;
  },
  timerBack(el) {
    const ms = ctx.now() - Number(el.dataset.min) * 60000;
    if (ctx.S.timer) ctx.store.setTimerStart(ms, ctx.now()); else ui.plannedStart = clampStart(ms, ctx.now());
  },
  timerNowStart() { if (ctx.S.timer) ctx.store.setTimerStart(ctx.now(), ctx.now()); else ui.plannedStart = null; },
  timerStop() {
    const e = ctx.store.stopTimer(ctx.now());
    ctx.say(e ? `Mentve: ${e.typeLabel}, ${formatHM(e.durationSeconds)}.` : "Töltsd ki a kötelező mezőket a mentéshez.", !e);
  },
  timerDiscard() { if (confirm("Elveted a futó időmérést?")) { ctx.store.discardTimer(); ui.plannedStart = null; } },
  pomoStart() { askNotifications(); if (!ctx.store.startPomo(ctx.now())) ctx.say("Töltsd ki a kötelező mezőket.", true); },
  pomoStop() { const e = ctx.store.stopPomo(ctx.now()); if (e) ctx.say(`Mentve: ${e.typeLabel}, ${formatHM(e.durationSeconds)}.`); },
  pomoDiscard() { if (confirm("Elveted a futó pomót? (A munkamenet korábbi pomói és szünetei bekerülnek.)")) ctx.store.discardPomo(); },
  pomoSkip() { ctx.store.skipPomoBreak(ctx.now()); },
  pomoReset() { ctx.store.resetPomoCounter(); },
  pomoSettings() { ui.pomoSettings = !ui.pomoSettings; },
  pomoStep(el) {
    const key = el.dataset.key, [lo, hi] = RANGES[key];
    ctx.store.saveSettings({ pomo: { ...ctx.S.settings.pomo, [key]: clampStep(ctx.S.settings.pomo[key], Number(el.dataset.d), lo, hi) } });
  },
  pomoDefaults() { ctx.store.saveSettings({ pomo: P.POMO_DEFAULTS }); },
  mmode(el) { ui.manual.mode = el.dataset.mode; },
  mstep(el) {
    const m = ui.manual, d = Number(el.dataset.d);
    if (el.dataset.field === "hours") m.hours = clampStep(m.hours, d, 0, 16); else m.minutes = clampStep(m.minutes, d, 0, 55);
  },
  manualSave() {
    const r = manualResult();
    if (!r.ok) { ctx.say(r.error, true); return; }
    ctx.store.addEntry(linkResolved(r.entry)); ctx.store.resetDraft();
    const warn = monthLimitWarning(ctx.S.entries, r.entry);
    if (warn) ctx.say(warn, true, 15000);
    ui.manual.hours = 1; ui.manual.minutes = 0; ui.manual.message = "✓ Mentve";
    setTimeout(() => { ui.manual.message = null; ctx.render(); }, 2500);
  },
};

