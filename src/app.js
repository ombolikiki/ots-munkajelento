// Mobilos felület: négy lap (Időzítő, Bevitel, Napok, Adatok). Minden adat csak ezen a készüléken marad.
import { groupedTypes, typeOfEntry, typeColor, isTravel, isWholeDay, hasQuantity, quantityUnit, UNIT } from "./types.js";
import { todayYMD, addDays, formatLong, formatHM, formatClock, parseYMD } from "./dates.js";
import { officialSeconds, targetState, missingDays, needsBackupReminder } from "./insights.js";
import { gate, draftType, manualEntry, workplaceList } from "./entries.js";
import { encodeBytes, decode } from "./csv.js";
import { createStore } from "./store.js";

const VERSION = "0.1.0";
const store = createStore(window.localStorage);
const S = store.state;

const ui = {
  tab: "timer",
  day: todayYMD(),
  manual: { day: todayYMD(), mode: "range", from: "", to: "", hours: 1, minutes: 0 },
  msg: null, msgErr: false,
  confirmDelete: null, confirmReset: false, update: false,
};
let tickHandle = null, msgHandle = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel) => document.querySelector(sel);

function say(text, isErr = false, ms = 4000) {
  ui.msg = text; ui.msgErr = isErr;
  clearTimeout(msgHandle);
  if (ms) msgHandle = setTimeout(() => { ui.msg = null; render(); }, ms);
}

// ---------- Segédek ----------

const typeLabelFor = (code) => draftType({ typeCode: code })?.label ?? "";

function entryAmount(e) {
  if (e.unit === UNIT.OCCASIONS) return `${e.quantity ?? 1} alkalom`;
  if (e.unit === UNIT.PEOPLE) return `${e.quantity ?? 1} fő`;
  if (e.unit === UNIT.WHOLE_DAY) return "";
  return formatHM(e.durationSeconds);
}

function entryWhen(e) {
  if (e.unit === UNIT.WHOLE_DAY) return "egész nap";
  if (e.start && e.end) return `${e.start.slice(0, 5)}–${e.end.slice(0, 5)}`;
  return e.unit === UNIT.HOURS ? "óraszám" : "";
}

function entryDetail(e) {
  if (e.departure || e.arrival) {
    const route = [e.departure, ...workplaceList(e.workplace), e.arrival].filter(Boolean).join(" → ");
    return [route, e.activity].filter(Boolean).join(" · ");
  }
  return [e.workplace, e.activity].filter(Boolean).join(" · ");
}

const entriesOn = (day) => S.entries.filter((e) => e.date === day);

function stateColor(state) {
  return state === "short" ? "var(--stop)" : state === "inProgress" ? "var(--warn)" : state === "reached" ? "var(--go)" : "transparent";
}

// ---------- Űrlap (közös az Időzítő és a Bevitel lapon) ----------

function placeChips(target) {
  const list = S.places.slice(0, 12);
  if (!list.length) return "";
  return `<div class="chips scroll-x">${list.map((p) => `<button type="button" class="chip" data-action="pick" data-target="${target}" data-value="${esc(p)}">${esc(p)}</button>`).join("")}</div>`;
}

function formHTML(locked) {
  const d = S.draft, type = draftType(d), travel = isTravel(type), whole = isWholeDay(type);
  const dis = locked ? "disabled" : "";
  const typeOptions = groupedTypes().map((g) =>
    `<optgroup label="${esc(g.name)}">${g.types.map((t) => `<option value="${t.code}" ${d.typeCode === t.code ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</optgroup>`).join("");
  let h = `<section class="card form">
    <label class="f"><span>Tevékenység típusa</span>
      <select data-ns="draft" data-field="typeCode" ${dis}><option value="">Válassz típust…</option>${typeOptions}</select></label>`;
  if (type && !whole) {
    h += `<label class="f"><span>${travel ? "Munkahely(ek)" : "Munkahely"}</span>
      <input type="text" data-ns="draft" data-field="workplace" list="places" value="${esc(d.workplace)}" placeholder="${travel ? "pl. Tata, Tatabánya" : "Település"}" autocomplete="off" ${dis}></label>
      ${locked ? "" : placeChips("workplace")}`;
  }
  if (travel) {
    h += `<div class="row">
      <label class="f"><span>Indulás</span><input type="text" data-ns="draft" data-field="departure" list="places" value="${esc(d.departure)}" placeholder="Indulás" autocomplete="off" ${dis}></label>
      <label class="f"><span>Érkezés</span><input type="text" data-ns="draft" data-field="arrival" list="places" value="${esc(d.roundTrip ? d.departure : d.arrival)}" placeholder="Érkezés" autocomplete="off" ${dis || d.roundTrip ? "disabled" : ""}></label>
    </div>
    <label class="check"><input type="checkbox" data-ns="draft" data-field="roundTrip" ${d.roundTrip ? "checked" : ""} ${dis}> Oda-vissza út (az Érkezés az Indulás)</label>
    ${locked ? "" : placeChips("departure")}`;
  }
  if (hasQuantity(type)) {
    h += `<div class="stepper"><span class="small">Mennyiség</span>
      <button type="button" data-action="qty" data-d="-1" ${dis}>−</button>
      <span class="val">${d.quantity} ${quantityUnit(type)}</span>
      <button type="button" data-action="qty" data-d="1" ${dis}>+</button></div>`;
  }
  if (type) {
    const label = whole ? "Megjegyzés (nem kötelező)" : travel ? "Tevékenység (kötelező, a Költségelszámoláshoz)" : "Tevékenység (nem kötelező)";
    const ph = whole ? "Megjegyzés" : travel ? "Mi volt az út célja?" : "Mit csináltál?";
    h += `<label class="f"><span>${label}</span><input type="text" data-ns="draft" data-field="activity" value="${esc(d.activity)}" placeholder="${ph}" autocomplete="off" ${dis}></label>`;
  }
  h += `<datalist id="places">${S.places.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist></section>`;
  return h;
}

// ---------- Lapok ----------

function timerView() {
  const running = !!S.timer;
  const g = gate("timer", S.draft);
  let h = formHTML(running);
  h += `<section class="card"><div class="clock" id="clock">${formatClock(running ? Math.floor((Date.now() - S.timer.startMs) / 1000) : 0)}</div>`;
  if (running) {
    const t = new Date(S.timer.startMs);
    h += `<p class="sub">Indult: ${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")} · ${esc(typeLabelFor(S.draft.typeCode))}</p>
      <button class="btn stop" data-action="timerStop">Leállítás és mentés</button>
      <p style="margin:8px 0 0"><button class="btn ghost small" data-action="timerDiscard">Elvetés</button></p>`;
  } else {
    h += `<button class="btn go" id="gateBtn" data-action="timerStart" ${g.disabled ? "disabled" : ""}>Start</button>
      <p class="hint" id="gateHint" ${g.text ? "" : "hidden"}>${esc(g.text)}</p>`;
  }
  return h + `</section>`;
}

function manualView() {
  const m = ui.manual, type = draftType(S.draft), whole = isWholeDay(type);
  const needsTime = type && type.unit === UNIT.HOURS;
  const g = gate("manual", S.draft);
  let h = formHTML(false);
  h += `<section class="card"><label class="f"><span>Nap</span>
      <input type="date" data-ns="manual" data-field="day" value="${esc(m.day)}" max="${todayYMD()}"></label>`;
  if (needsTime) {
    h += `<div class="seg"><button type="button" data-action="mode" data-mode="range" aria-pressed="${m.mode === "range"}">Időpont (tól–ig)</button>
      <button type="button" data-action="mode" data-mode="duration" aria-pressed="${m.mode === "duration"}">Óraszám</button></div>`;
    if (m.mode === "range") {
      h += `<div class="row"><label class="f"><span>Tól</span><input type="time" data-ns="manual" data-field="from" value="${esc(m.from)}"></label>
        <label class="f"><span>Ig</span><input type="time" data-ns="manual" data-field="to" value="${esc(m.to)}"></label></div>`;
    } else {
      h += `<div class="stepper"><button type="button" data-action="step" data-field="hours" data-d="-1">−</button><span class="val">${m.hours} óra</span><button type="button" data-action="step" data-field="hours" data-d="1">+</button></div>
        <div class="stepper"><button type="button" data-action="step" data-field="minutes" data-d="-5">−</button><span class="val">${m.minutes} perc</span><button type="button" data-action="step" data-field="minutes" data-d="5">+</button></div>`;
    }
  } else if (type && !whole) {
    h += `<p class="small">Ennél a típusnál nem kell időtartam, csak a mennyiség.</p>`;
  }
  h += `<button class="btn" id="gateBtn" data-action="manualSave" ${g.disabled ? "disabled" : ""}>Rögzítés</button>
    <p class="hint" id="gateHint" ${g.text ? "" : "hidden"}>${esc(g.text)}</p>`;
  return h + `</section>`;
}

function daysView() {
  const today = todayYMD(), day = ui.day;
  const list = entriesOn(day);
  const state = targetState(day, list, today, S.settings.targetHours);
  const official = officialSeconds(list);
  const all = list.reduce((s, e) => s + (e.unit === UNIT.HOURS ? e.durationSeconds : e.unit === UNIT.WHOLE_DAY ? 0 : Math.max(1, e.quantity ?? 1) * 3600), 0);
  let h = "";
  if (needsBackupReminder(S.entries, S.meta.lastExport, today)) {
    h += `<div class="msg err">Régen nem mentettél CSV-t. Az adatok csak ezen a telefonon vannak, ezért érdemes exportálni. <button class="chip acc" data-action="export">Exportálás most</button></div>`;
  }
  h += `<section class="card"><div class="daynav">
      <button data-action="dayPrev" aria-label="Előző nap">‹</button>
      <div class="title">${esc(formatLong(day))}<span class="dot" style="background:${stateColor(state)}"></span></div>
      <button data-action="dayNext" aria-label="Következő nap" ${day >= today ? "disabled" : ""}>›</button></div>
      ${day === today ? "" : `<p style="text-align:center;margin:8px 0 0"><button class="chip acc" data-action="dayToday">Ugrás a mai napra</button></p>`}</section>`;
  h += `<section class="card">`;
  if (!list.length) h += `<p class="empty">Nincs bejegyzés erre a napra.</p>`;
  for (const e of list) {
    const confirm = ui.confirmDelete === e.id;
    h += `<div class="item"><span class="bar" style="background:${typeColor(typeOfEntry(e))}"></span>
      <div class="main"><div class="t">${esc(entryWhen(e))} ${esc(e.typeLabel)}</div><div class="d">${esc(entryDetail(e))}</div></div>
      <div class="amt">${esc(entryAmount(e))}</div>
      <button class="del ${confirm ? "sure" : ""}" data-action="delete" data-id="${e.id}" aria-label="Törlés">${confirm ? "Biztos?" : "🗑"}</button></div>`;
  }
  if (list.length) {
    const target = state === "exempt" ? "" : ` / ${S.settings.targetHours}:00`;
    h += `<div class="total"><span>Összesen: ${formatHM(official)}${target}</span>${all !== official ? `<span>(saját kategóriával ${formatHM(all)})</span>` : ""}</div>`;
  }
  h += `</section>`;
  const missing = missingDays(new Set(S.entries.map((e) => e.date)), today);
  h += `<section class="card"><h2>Kitöltetlen napok ebben a hónapban (${missing.length})</h2>`;
  h += missing.length
    ? `<div class="scroll-x">${missing.slice().reverse().map((d) => `<button class="chip warn" data-action="dayGo" data-day="${d}">${esc(d.slice(5).replace("-", ". ") + ".")}</button>`).join("")}</div>`
    : `<p class="empty">Minden nap ki van töltve.</p>`;
  return h + `</section>`;
}

function dataView() {
  const exp = S.meta.lastExport ? new Date(S.meta.lastExport).toLocaleDateString("hu-HU") : "még nem";
  let h = `<section class="card"><h2>Beállítások</h2>
    <label class="f"><span>Székhely (az Utazás alapértéke)</span><input type="text" data-ns="settings" data-field="home" value="${esc(S.settings.home)}" placeholder="pl. Pécs" autocomplete="off"></label>
    <label class="f"><span>Napi elvárt óraszám (hétfőtől péntekig)</span><input type="number" min="1" max="12" inputmode="numeric" data-ns="settings" data-field="targetHours" value="${S.settings.targetHours}"></label></section>`;
  h += `<section class="card"><h2>Helyszínek</h2><div class="list-places">`;
  h += S.places.length ? S.places.map((p) => `<div class="place"><span>${esc(p)}</span><button data-action="placeRemove" data-value="${esc(p)}" aria-label="Törlés">✕</button></div>`).join("") : `<p class="empty">Még nincs mentett helyszín, rögzítéskor automatikusan épül.</p>`;
  h += `</div><div class="row" style="margin-top:10px"><input type="text" id="newPlace" placeholder="Új helyszín" autocomplete="off"><button class="btn small" style="flex:none" data-action="placeAdd">Hozzáad</button></div></section>`;
  h += `<section class="card"><h2>Adatok mentése és átvitele</h2>
    <p class="tip">Az adataid <b>csak ezen a készüléken</b> vannak. A CSV ugyanolyan formátumú, mint az OTS Munkajelentő Tracker Mac-alkalmazásáé, így a Macen beolvasható, és a skill is használni tudja. Utolsó exportálás: ${esc(exp)}. Bejegyzések: ${S.entries.length}.</p>
    <p><button class="btn" data-action="export">CSV exportálása</button></p>
    <p><button class="btn ghost" data-action="importPick">CSV importálása (összefésülés)</button></p>
    <input type="file" id="importFile" accept=".csv,text/csv,text/plain" hidden></section>`;
  h += `<section class="card"><h2>Telepítés a főképernyőre</h2>
    <p class="tip"><b>iPhone (Safari):</b> Megosztás ↑ › „Főképernyőhöz adás”. <b>Android (Chrome):</b> ⋮ menü › „Alkalmazás telepítése”. Így saját ikonja lesz, teljes képernyőn fut, és internet nélkül is működik.</p></section>`;
  h += `<section class="card"><h2 class="danger">Összes adat törlése</h2>
    <p class="tip">Törli a bejegyzéseket, a helyszíneket és a beállításokat erről a készülékről. Előtte exportálj!</p>
    <button class="btn ghost ${ui.confirmReset ? "stop" : ""}" data-action="reset">${ui.confirmReset ? "Biztosan törlöm (még egy érintés)" : "Összes adat törlése…"}</button></section>`;
  return h + `<p class="small" style="text-align:center">OTS Munkajelentő (web) ${VERSION} · helyben tároló változat</p>`;
}

/** Beíráskor frissíti a Start/Rögzítés gombot és a figyelmeztetést az űrlap újrarajzolása nélkül (így a billentyűzet nyitva marad). */
function refreshGate() {
  const g = gate(ui.tab, S.draft);
  const btn = $("#gateBtn"), hint = $("#gateHint");
  if (btn) btn.disabled = g.disabled;
  if (hint) { hint.textContent = g.text; hint.hidden = !g.text; }
}

// ---------- Megjelenítés ----------

const TABS = [["timer", "⏱", "Időzítő"], ["manual", "✎", "Bevitel"], ["days", "📅", "Napok"], ["data", "⚙", "Adatok"]];

function render() {
  clearInterval(tickHandle);
  const today = todayYMD();
  const todayList = entriesOn(today);
  $("#head").innerHTML = `<h1>OTS Munkajelentő</h1><p>Ma: ${formatHM(officialSeconds(todayList))} óra · ${todayList.length} bejegyzés</p>`;
  $("#tabs").innerHTML = TABS.map(([k, ic, t]) => `<button data-action="tab" data-tab="${k}" ${ui.tab === k ? 'aria-current="page"' : ""}><span class="ic">${ic}</span>${t}</button>`).join("");
  let body = ui.tab === "timer" ? timerView() : ui.tab === "manual" ? manualView() : ui.tab === "days" ? daysView() : dataView();
  const updateBar = ui.update ? `<div class="msg">Új változat érhető el. <button class="chip acc" data-action="reload">Frissítés</button></div>` : "";
  const banner = updateBar + (ui.msg ? `<div class="msg ${ui.msgErr ? "err" : ""}" role="status">${esc(ui.msg)}</div>` : store.error ? `<div class="msg err">${esc(store.error)}</div>` : "");
  $("#view").innerHTML = banner + body;
  if (ui.tab === "timer" && S.timer) {
    tickHandle = setInterval(() => {
      const c = $("#clock");
      if (c && S.timer) c.textContent = formatClock(Math.floor((Date.now() - S.timer.startMs) / 1000));
    }, 1000);
  }
}

// ---------- Műveletek ----------

async function exportCSV() {
  const bytes = encodeBytes(S.entries);
  const file = new File([bytes], "bejegyzesek.csv", { type: "text/csv" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "OTS Munkajelentő – bejegyzések" });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file); a.download = "bejegyzesek.csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    store.markExported();
    say("Az exportálás kész.");
  } catch (e) {
    if (e && e.name === "AbortError") return;   // a felhasználó megszakította a megosztást
    say("Az exportálás nem sikerült: " + (e?.message || e), true);
  }
  render();
}

async function importFile(file) {
  try {
    const { entries, warnings } = decode(await file.text());
    const r = store.importEntries(entries);
    say(`Importálva: ${r.added} új bejegyzés, ${r.skipped} már megvolt.${warnings.length ? ` Figyelmeztetés: ${warnings.slice(0, 3).join("; ")}${warnings.length > 3 ? " …" : ""}` : ""}`, warnings.length > 0, 9000);
  } catch (e) {
    say("Az importálás nem sikerült: " + (e?.message || e), true, 9000);
  }
  render();
}

function onClick(ev) {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action, d = el.dataset;
  const draft = S.draft;
  if (a !== "delete") ui.confirmDelete = null;
  if (a !== "reset") ui.confirmReset = false;
  switch (a) {
    case "tab": ui.tab = d.tab; if (d.tab === "days") ui.day = todayYMD(); ui.msg = null; break;
    case "pick": {
      const t = d.target;
      if (t === "workplace" && isTravel(draftType(draft))) {
        const l = workplaceList(draft.workplace);
        if (!l.some((x) => x.toLowerCase() === d.value.toLowerCase())) l.push(d.value);
        draft.workplace = l.join(", ");
      } else draft[t] = d.value;
      store.saveDraft(); break;
    }
    case "qty": draft.quantity = Math.min(99, Math.max(1, draft.quantity + Number(d.d))); store.saveDraft(); break;
    case "timerStart":
      if (!store.startTimer()) say("Töltsd ki a kötelező mezőket.", true);
      break;
    case "timerStop": {
      const e = store.stopTimer();
      say(e ? `Mentve: ${e.typeLabel}, ${formatHM(e.durationSeconds)}.` : "Töltsd ki a kötelező mezőket a mentéshez.", !e);
      break;
    }
    case "timerDiscard": if (confirm("Elveted a futó időmérést?")) store.discardTimer(); break;
    case "mode": ui.manual.mode = d.mode; break;
    case "step": {
      const m = ui.manual;
      m.hours = Math.min(16, Math.max(0, m.hours + (d.field === "hours" ? Number(d.d) : 0)));
      if (d.field === "minutes") m.minutes = Math.min(55, Math.max(0, m.minutes + Number(d.d)));
      break;
    }
    case "manualSave": {
      const m = ui.manual;
      const r = manualEntry(draft, { day: m.day, mode: m.mode, from: m.from, to: m.to, hours: m.hours, minutes: m.minutes });
      if (!r.ok) { say(r.error, true); break; }
      store.addEntry(r.entry); store.resetDraft();
      say(`Rögzítve: ${r.entry.typeLabel} (${r.entry.date}).`);
      break;
    }
    case "dayPrev": ui.day = addDays(ui.day, -1); break;
    case "dayNext": if (ui.day < todayYMD()) ui.day = addDays(ui.day, 1); break;
    case "dayToday": ui.day = todayYMD(); break;
    case "dayGo": ui.day = d.day; break;
    case "delete":
      if (ui.confirmDelete === d.id) { store.deleteEntry(d.id); ui.confirmDelete = null; } else ui.confirmDelete = d.id;
      break;
    case "placeRemove": store.setPlaces(S.places.filter((p) => p !== d.value)); break;
    case "placeAdd": { const i = $("#newPlace"); if (i && i.value.trim()) store.setPlaces([...S.places, i.value]); break; }
    case "reload": location.reload(); return;
    case "export": exportCSV(); return;
    case "importPick": $("#importFile")?.click(); return;
    case "reset":
      if (ui.confirmReset) { store.resetAll(); ui.confirmReset = false; ui.tab = "timer"; say("Minden adat törölve."); } else ui.confirmReset = true;
      break;
    default: return;
  }
  render();
}

function onInput(ev) {
  const el = ev.target;
  const ns = el.dataset?.ns, f = el.dataset?.field;
  if (!ns || !f) return;
  const value = el.type === "checkbox" ? el.checked : el.value;
  if (ns === "draft") {
    S.draft[f] = value;
    store.saveDraft();
    if (ev.type === "change" && (f === "typeCode" || f === "roundTrip")) render();
    else refreshGate();
  } else if (ns === "manual") {
    ui.manual[f] = value;
    if (ev.type === "change" && f === "day") {
      if (!parseYMD(value) || value > todayYMD()) { ui.manual.day = todayYMD(); say("Jövőbeli napra nem lehet bejegyzést felvenni.", true); }
      render();
    }
  } else if (ns === "settings" && ev.type === "change") {
    store.saveSettings({ [f]: value });
    render();
  }
}

document.addEventListener("click", onClick);
document.addEventListener("input", onInput);
document.addEventListener("change", (ev) => {
  if (ev.target.id === "importFile" && ev.target.files?.[0]) { importFile(ev.target.files[0]); ev.target.value = ""; return; }
  onInput(ev);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { if (ui.day > todayYMD()) ui.day = todayYMD(); render(); }
});

// Tartós tárhely kérése (csökkenti az esélyét, hogy a böngésző törölje az adatokat).
navigator.storage?.persist?.().catch(() => {});
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("./sw.js").catch(() => {});
  // Ha új változat vált aktívvá, jelezzük (a futó időzítő és az űrlap tartalma ilyenkor sem vész el, mert tárolva van).
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) { ui.update = true; render(); } });
}
render();
