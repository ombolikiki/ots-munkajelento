// Beállítások: megjelenés, hangok, naptár, emlékeztetők, létszámjelentő, helyszínek, kategóriák, adatmappa, skill, törlés.
import { BUILTIN_TYPES, GROUP_COLORS, colorFor, isCustomized, SWATCHES, normalizeHex, lookupByCode, allTypes } from "../types.js";
import { PALETTES } from "../store.js";
import { LOOKBACKS, LOOKBACK_TITLES } from "../insights.js";
import { folderSupported } from "../folder.js";
import { ctx, ui } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";
import { SOUNDS, NO_SOUND, playSound } from "./sound.js";
import { calendarSettingsHTML } from "./calendar-ui.js";

export const VERSION = "0.2.0";
const PALETTE_INFO = {
  blue: ["Kék", "#2a6bbd", "#38a0dc"], green: ["Zöld", "#1a7566", "#3da880"], purple: ["Lila", "#6642b3", "#9e6be0"], amber: ["Borostyán", "#c76614", "#f2a333"],
};
export const paletteInfo = PALETTE_INFO;

const card = (title, body, extra = "") => `<section class="card setcard ${extra}"><h3>${title}</h3>${body}</section>`;
const stepper = (key, val, lo, hi, step = 1) => `<div class="stepper"><button class="step" data-action="setStep" data-key="${key}" data-d="${-step}" data-lo="${lo}" data-hi="${hi}" ${val <= lo ? "disabled" : ""}>−</button><span class="val">${val}</span><button class="step" data-action="setStep" data-key="${key}" data-d="${step}" data-lo="${lo}" data-hi="${hi}" ${val >= hi ? "disabled" : ""}>+</button></div>`;
const toggle = (key, checked, label) => `<label class="check"><input type="checkbox" data-ns="set" data-field="${key}" data-type="bool" ${checked ? "checked" : ""}> ${label}</label>`;

function appearanceCard(s) {
  const mode = (id, label, ic) => `<button class="modebtn ${s.appearance === id ? "on" : ""}" data-action="setVal" data-key="appearance" data-value="${id}">${icon(ic, 1)} ${label}</button>`;
  const pal = PALETTES.map((id) => { const [name, a, b] = PALETTE_INFO[id];
    return `<button class="palbtn ${s.palette === id ? "on" : ""}" data-action="setVal" data-key="palette" data-value="${id}" title="${name}"><i style="background:linear-gradient(135deg,${a},${b})"></i><span>${name}</span></button>`; }).join("");
  return card("Megjelenés", `<div class="modes">${mode("light", "Világos", "sun")}${mode("dark", "Sötét", "moon")}${mode("system", "Rendszer", "half")}</div>
    <p class="small mut">Színséma</p><div class="pals">${pal}</div>`);
}

function soundsCard(s) {
  const opts = (sel) => `<option value="${NO_SOUND}" ${sel === NO_SOUND ? "selected" : ""}>Nincs hang</option>` + SOUNDS.map(([id, name]) => `<option value="${id}" ${sel === id ? "selected" : ""}>${name}</option>`).join("");
  const row = (title, key, val) => `<div class="setrow"><span>${title}</span><div class="inl"><select data-ns="set" data-field="${key}">${opts(val)}</select><button class="iconbtn" data-action="playSound" data-key="${key}" title="Meghallgatás">${icon("speaker")}</button></div></div>`;
  return card("Jelzőhangok és értesítés", `${row("Pomo vége", "soundPomoEnd", s.soundPomoEnd)}${row("Szünet vége", "soundBreakEnd", s.soundBreakEnd)}
    ${toggle("notifications", s.notifications, "Böngészős értesítés a pomo és a szünet végén")}
    <p class="small mut">A hátralévő idő a böngészőfül címében is látszik (a natív app menüsori ikonja helyett).</p>`);
}

const hourOpts = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}" ${h === sel ? "selected" : ""}>${h}:00</option>`).join("");

function calendarCard(s) {
  return card("Naptár", `<div class="setrow"><span>A munkanap kezdete</span><select data-ns="set" data-field="calStartHour" data-type="int">${hourOpts(0, 22, s.calStartHour)}</select></div>
    <div class="setrow"><span>A munkanap vége</span><select data-ns="set" data-field="calEndHour" data-type="int">${hourOpts(1, 24, s.calEndHour)}</select></div>
    <div class="setrow"><span>A hét kezdőnapja</span><div class="seg tight"><button data-action="setVal" data-key="weekStart" data-value="2" data-num="1" aria-pressed="${s.weekStart === 2}">Hétfő</button><button data-action="setVal" data-key="weekStart" data-value="1" data-num="1" aria-pressed="${s.weekStart === 1}">Vasárnap</button></div></div>
    <p class="small mut">A naptár csak a megadott sávot mutatja (egy 6:30-kor kezdődő munkához állítsd a kezdetet 6:00-ra). A sávon kívüli bejegyzéseket a nap tetején egy jel mutatja, a napi listában mindig látszanak.</p>`);
}

function remindersCard(s) {
  return card("Emlékeztetők és jelzések", `<label class="f"><span>Kitöltetlen napok ellenőrzése</span><select data-ns="set" data-field="lookback">${LOOKBACKS.map((l) => `<option value="${l}" ${s.lookback === l ? "selected" : ""}>${LOOKBACK_TITLES[l]}</option>`).join("")}</select></label>
    <p class="small mut">A vasárnapot is ellenőrzi, a mai napot nem számolja. A szabadság, szabadnap és munkaszüneti nap kitöltött napnak számít.</p><hr>
    ${toggle("reminderEnabled", s.reminderEnabled, "Piros emlékeztető sáv, ha régen nem volt munkajelentő")}
    ${s.reminderEnabled ? `<div class="setrow"><span>Ennyi egymást követő kitöltetlen nap után</span>${stepper("reminderDays", s.reminderDays, 2, 60)}</div>` : ""}<hr>
    <div class="setrow"><span>Napi elvárt óraszám (hétfőtől péntekig)</span>${stepper("targetHours", s.targetHours, 1, 16)}</div>
    <p class="small mut">Ha egy napon nincs meg, kis piros jel mutatja a napi listában, a naptárban és a kitöltetlen napok között.</p>`);
}

function attendanceCard(s) {
  const list = s.congregations.map((c, i) => `<div class="listrow"><span>${esc(c)}</span><span class="grow"></span>
    <button class="iconbtn sm" data-action="congMove" data-name="${esc(c)}" data-d="-1" ${i === 0 ? "disabled" : ""} title="Feljebb">${icon("chevU", 1)}</button>
    <button class="iconbtn sm" data-action="congMove" data-name="${esc(c)}" data-d="1" ${i === s.congregations.length - 1 ? "disabled" : ""} title="Lejjebb">${icon("chevD", 1)}</button>
    <button class="iconbtn sm" data-action="congRemove" data-name="${esc(c)}" title="Törlés a listából">${icon("trash", 1)}</button></div>`).join("");
  return card("Gyülekezeti létszámjelentő", `${toggle("attendanceEnabled", s.attendanceEnabled, "Kérje a létszámjelentőt az esedékes szombatokon")}
    <p class="small mut">Esedékes: minden negyedév második és hetedik szombatja. Ha még nincs kitöltve, kitöltetlen napként is jelzi. A számokat a skill innen olvassa ki.</p>
    ${s.attendanceEnabled ? `<p class="small mut">Gyülekezetek (a feladatok sorrendjében)</p>${s.congregations.length ? "" : `<p class="small warnt">Adj hozzá legalább egy gyülekezetet.</p>`}${list}
      <div class="addrow"><input type="text" id="newCong" data-ns="ui" data-field="newCongregation" value="${esc(ui.newCongregation)}" placeholder="Új gyülekezet" autocomplete="off"><button class="btn small" data-action="congAdd">Hozzáad</button></div>` : ""}`);
}

function placesCard(s) {
  const list = ctx.S.places.map((p) => `<div class="listrow"><span>${esc(p)}</span><span class="grow"></span><button class="iconbtn sm" data-action="placeRemove" data-name="${esc(p)}" title="Törlés a listából">${icon("trash", 1)}</button></div>`).join("");
  return card("Székhely és helyszínek", `<label class="f"><span>Székhely</span><input type="text" data-ns="set" data-field="home" value="${esc(s.home)}" placeholder="pl. Pécs" autocomplete="off"></label>
    <p class="small mut">Az Utazás Indulás és Érkezés mezőjének alapértéke, és a Költségelszámolás útvonalainak kiindulópontja.</p><hr>
    <p class="small mut">Mentett helyszínek</p>${list || `<p class="small mut">Még nincs mentett helyszín.</p>`}
    <div class="addrow"><input type="text" id="newPlace" data-ns="ui" data-field="newPlace" value="${esc(ui.newPlace)}" placeholder="Új helyszín" autocomplete="off"><button class="btn small" data-action="placeAdd">Hozzáad</button></div>
    <p class="small mut">Rögzítéskor az új helyszín magától bekerül a listába. A törlés a már rögzített bejegyzéseket nem érinti.</p>`);
}

const UNIT_NAMES = { hours: "óra", occasions: "alkalom", people: "fő" };

function categoriesCard(s) {
  const custom = s.customCategories.map((c) => `<div class="listrow"><input type="text" class="inl-in" data-ns="cat" data-code="${esc(c.code)}" value="${esc(c.label)}" aria-label="Kategória neve"><span class="small mut">${UNIT_NAMES[c.unit]}</span>
    <button class="iconbtn sm" data-action="catRemove" data-code="${esc(c.code)}" title="Kategória törlése">${icon("trash", 1)}</button></div>`).join("");
  const colorRows = allTypes().map((t) => {
    const open = ui.colorOpen === t.code;
    let panel = "";
    if (open) {
      panel = `<div class="colorpanel"><div class="swatches">${SWATCHES.map((hex) => `<button class="sw ${colorFor(t.code).toUpperCase() === hex ? "on" : ""}" style="background:${hex}" data-action="colorPick" data-code="${t.code}" data-hex="${hex}" aria-label="${hex}"></button>`).join("")}</div>
        <div class="addrow"><span class="small mut">Egyedi:</span><input type="text" id="hexIn" data-ns="ui" data-field="hex" value="${esc(ui.hex)}" placeholder="#RRGGBB" maxlength="7" autocomplete="off"><button class="btn small" data-action="colorHex" data-code="${t.code}">Beállít</button>
        ${isCustomized(t.code) ? `<button class="btn small ghost" data-action="colorPick" data-code="${t.code}" data-hex="">Alapérték</button>` : ""}</div></div>`;
    }
    return `<div class="colorrow ${open ? "open" : ""}"><button class="colorline" data-action="colorOpen" data-code="${t.code}"><i style="background:${colorFor(t.code)}"></i><span>${esc(t.label)}</span>${icon(open ? "chevU" : "chevD", 0.9)}</button>${panel}</div>`;
  }).join("");
  const visible = BUILTIN_TYPES.length - s.hiddenTypes.length;
  const builtins = ui.catOpen ? `<div class="hidegrid">${BUILTIN_TYPES.map((t) => `<label class="check small"><input type="checkbox" data-ns="hide" data-code="${t.code}" ${s.hiddenTypes.includes(t.code) ? "" : "checked"}> ${esc(t.label)}</label>`).join("")}</div>
    <p class="small mut">Az OTS-kategóriák nevét nem lehet módosítani, de elrejthetők a legördülő menüből.</p>` : "";
  return card("Tevékenység-kategóriák", `<p class="small mut">Saját kategóriák</p>${custom || `<p class="small mut">Még nincs saját kategória.</p>`}
    <div class="addrow"><input type="text" id="newCat" data-ns="ui" data-field="newCategory" value="${esc(ui.newCategory)}" placeholder="Új kategória" autocomplete="off">
      <select data-ns="ui" data-field="newCategoryUnit"><option value="hours" ${ui.newCategoryUnit === "hours" ? "selected" : ""}>óra</option><option value="occasions" ${ui.newCategoryUnit === "occasions" ? "selected" : ""}>alkalom</option><option value="people" ${ui.newCategoryUnit === "people" ? "selected" : ""}>fő</option></select>
      <button class="btn small" data-action="catAdd">Hozzáad</button></div>
    <p class="small mut">A saját kategóriáknak nincs OTS-megfelelőjük, a munkajelentő skill nem viszi át őket az OTS-be. A törlés a már rögzített bejegyzéseket nem érinti.</p><hr>
    <p class="small mut">Kategóriák színei</p><div class="colors">${colorRows}</div>
    <p class="small mut">A színek a naptárban, a napi listában és a kézi felviteli ablakban jelennek meg.</p><hr>
    <button class="linkbtn acc small" data-action="catToggle">${icon(ui.catOpen ? "chevU" : "chevD", 0.9)} OTS-kategóriák megjelenítése (${visible}/${BUILTIN_TYPES.length} látható)</button>${builtins}`);
}

function folderCard(s) {
  const f = ctx.store.folder, st = f ? f.status : "unsupported", sync = ctx.S.sync;
  let status = "", buttons = "";
  if (st === "unsupported" || !folderSupported()) {
    status = `<p class="warnbox">${icon("alert", 1)}<span>Ez a böngésző nem tud a számítógép mappájába írni. Használd a <b>Chrome-ot</b> vagy az <b>Edge-et</b>. Addig az adatok csak a böngészőben vannak, ezért exportálj rendszeresen CSV-t.</span></p>`;
  } else if (st === "none") {
    status = `<p class="warnbox">${icon("alert", 1)}<span>Még nincs adatmappa kiválasztva: az adatok csak a böngészőben vannak, a skill nem éri el őket. Válassz egy mappát, és innentől minden változás magától a <b>bejegyzesek.csv</b> fájlba is kerül.</span></p>`;
    buttons = `<button class="btn" data-action="folderChoose">${icon("folder", 1)} Adatmappa kiválasztása…</button>`;
  } else if (st === "needs-permission") {
    status = `<p class="warnbox">${icon("alert", 1)}<span>A(z) <b>${esc(f.name)}</b> mappa elérését a böngésző újra kéri. Amíg nem engedélyezed, a változások a böngészőben maradnak, és az engedély után kiíródnak.</span></p>`;
    buttons = `<button class="btn" data-action="folderGrant">Engedélyezés</button> <button class="btn ghost" data-action="folderChoose">Másik mappa…</button>`;
  } else {
    status = `<p class="okbox">${icon("checkCircle", 1)}<span>Automatikus mentés: <b>${esc(f.name)}</b> mappa (bejegyzesek.csv, letszamjelentesek.csv, beallitasok.json).</span></p>`;
    buttons = `<button class="btn ghost" data-action="folderChoose">Másik mappa…</button> <button class="btn ghost" data-action="folderForget">Leválasztás</button>`;
  }
  const msgs = (sync.error ? `<p class="errbox"><span>${esc(sync.error)}</span></p>` : "") + (sync.warning ? `<p class="warnbox"><span>${esc(sync.warning)}</span></p>` : "");
  const exp = ctx.S.meta.lastExport ? new Date(ctx.S.meta.lastExport).toLocaleDateString("hu-HU") : "még nem";
  return card("Adatmappa és mentés", `${status}${msgs}<div class="btnwrap">${buttons}</div>
    <label class="f" style="margin-top:12px"><span>A mappa teljes elérési útja (a skill ebből találja meg az adatokat)</span><input type="text" data-ns="set" data-field="dataPath" value="${esc(s.dataPath)}" placeholder="pl. C:\\Users\\Neved\\Documents\\OTS Munkajelentő Tracker" autocomplete="off" spellcheck="false"></label>
    <p class="small mut">A böngésző nem árulja el a mappa útvonalát, ezért itt kell megadnod. Windowson: Fájlkezelőben kattints a mappára, majd <b>Ctrl+Shift+C</b> (Másolás elérési útként), és illeszd be ide. Ha a Mac-alkalmazást is használod, ugyanezt a mappát add meg annak Beállítások › Adatfájl részénél, így közös az adat.</p>
    <p class="small mut">A Chrome nem enged rendszermappát (például AppData) kijelölni; válassz a Dokumentumok alatt egy „OTS Munkajelentő Tracker” mappát. A fájlok pontosvesszővel tagolt CSV-k, Excelben is szerkeszthetők; a módosítást az app a következő megnyitáskor (vagy az ablakra visszalépéskor) újra beolvassa.</p><hr>
    <p class="small mut">Kézi mentés és átvitel. Bejegyzések: ${ctx.S.entries.length}. Utolsó exportálás: ${esc(exp)}.</p>
    <div class="btnwrap"><button class="btn ghost" data-action="export">${icon("download", 1)} CSV exportálása</button><button class="btn ghost" data-action="importPick">${icon("upload", 1)} CSV importálása (összefésülés)</button></div>
    <input type="file" id="importFile" accept=".csv,text/csv,text/plain" hidden>`);
}

function skillCard() {
  return card("Skill: OTS Adminisztráció (Claude, ChatGPT/Codex, Antigravity CLI)", `<p class="small mut">Az MI-asszisztens ezzel tölti ki helyetted az OTS adminisztrációt (Havi munkajelentő, Költségelszámolás, névsor, Hittan, Látogatottság), és ennek az alkalmazásnak az adataiból dolgozik. Az Antigravity CLI ingyenes megoldás (személyes Google-fiókkal).</p>
    <p class="small mut">Ha nem a skillel dolgozol, a bejegyzéseket kézzel is felviheted: a külön ablakban naptárban, felsorolásban és az OTS táblázatának megfelelően látod őket.</p>
    <div class="btnwrap"><button class="btn" data-action="openOts">${icon("tablecells", 1)} Kézi felvitel az OTS-be…</button><button class="btn" data-action="openSkill">${icon("download", 1)} Skill telepítése…</button></div>`);
}

function installCard() {
  return card("Telepítés (tálca, saját ablak)", `<p class="small mut"><b>Windows/Mac (Chrome vagy Edge):</b> a címsor jobb szélén a telepítés ikon, vagy a ⋮ menü › „Átküldés, mentés és megosztás” › „Telepítés”. Így saját ikonja és saját ablaka lesz, az Indítás menüből és a tálcáról is indítható, és internet nélkül is működik.</p>`);
}

function resetCard() {
  const lvl = ui.confirmReset;
  let body;
  if (!ui.resetOpen) body = "";
  else if (lvl === 0) body = `<p class="small mut">Törli az összes eddig bevitt adatot (bejegyzések, létszámjelentések, mentett helyszínek, saját kategóriák), és az alkalmazást alapállapotba állítja. A megjelenés, a hangok és a naptár-beállítások megmaradnak.</p>
    <p class="small mut">Biztonsági okból a törlés előtti adatfájl egy másolata megmarad az adatmappában („bejegyzesek.torles-elotti.csv”). A következő törlés felülírja. Adatmappa nélkül nincs másolat: előtte exportálj!</p>
    <button class="btn ghost danger" data-action="resetAsk">${icon("trash", 1)} Összes adat törlése…</button>`;
  else if (lvl === 1) body = `<div class="confirmbox"><strong>Biztosan törlöd az összes adatot?</strong><p class="small">Minden bejegyzés, létszámjelentés, mentett helyszín és saját kategória törlődik.</p>
    <div class="btnwrap"><button class="btn" data-action="resetCancel">Mégse</button><button class="btn ghost danger" data-action="resetAsk2">Mindent törlök</button></div></div>`;
  else body = `<div class="confirmbox"><strong>Utolsó megerősítés</strong><p class="small">Valóban véglegesen törlöd az összes bevitt adatot?</p>
    <div class="btnwrap"><button class="btn" data-action="resetCancel">Nem, megtartom</button><button class="btn ghost danger" data-action="resetDo">Igen, törlés</button></div></div>`;
  return `<section class="card setcard"><button class="linkbtn danger" data-action="resetToggle">${icon("alert", 1)} Adatok törlése, alapállapot ${icon(ui.resetOpen ? "chevU" : "chevD", 0.9)}</button>${body}</section>`;
}

export function settingsHTML() {
  const s = ctx.S.settings;
  return [appearanceCard(s), soundsCard(s), calendarCard(s), remindersCard(s), attendanceCard(s), calendarSettingsHTML(), placesCard(s), categoriesCard(s), folderCard(s), skillCard(), installCard(), resetCard(),
    `<p class="small mut center">OTS Munkajelentő (web) ${VERSION} · <a href="adatvedelem.html" target="_blank" rel="noopener">Adatvédelem</a> · <a href="felhasznalasi-feltetelek.html" target="_blank" rel="noopener">Felhasználási feltételek</a></p>`].join("");
}

// ---------- Műveletek ----------

const str = (v) => String(v ?? "");
export const actions = {
  setVal(el) { const v = el.dataset.num ? Number(el.dataset.value) : el.dataset.value; ctx.store.saveSettings({ [el.dataset.key]: v }); },
  setStep(el) {
    const key = el.dataset.key, v = ctx.S.settings[key] + Number(el.dataset.d);
    ctx.store.saveSettings({ [key]: Math.min(Number(el.dataset.hi), Math.max(Number(el.dataset.lo), v)) });
  },
  playSound(el) { playSound(ctx.S.settings[el.dataset.key]); return false; },
  congAdd() { if (ui.newCongregation.trim()) { ctx.store.addCongregation(ui.newCongregation); ui.newCongregation = ""; } },
  congRemove(el) { ctx.store.removeCongregation(el.dataset.name); },
  congMove(el) { ctx.store.moveCongregation(el.dataset.name, Number(el.dataset.d)); },
  placeAdd() { if (ui.newPlace.trim()) { ctx.store.addPlace(ui.newPlace); ui.newPlace = ""; } },
  placeRemove(el) { ctx.store.removePlace(el.dataset.name); },
  catAdd() { if (ctx.store.addCategory(ui.newCategory, ui.newCategoryUnit)) ui.newCategory = ""; },
  catRemove(el) { ctx.store.removeCategory(el.dataset.code); },
  catToggle() { ui.catOpen = !ui.catOpen; },
  colorOpen(el) { ui.colorOpen = ui.colorOpen === el.dataset.code ? null : el.dataset.code; ui.hex = ""; },
  colorPick(el) { ctx.store.setCategoryColor(el.dataset.code, el.dataset.hex || null); ui.hex = ""; },
  colorHex(el) { if (normalizeHex(ui.hex)) { ctx.store.setCategoryColor(el.dataset.code, ui.hex); ui.hex = ""; } else ctx.say("Adj meg egy #RRGGBB színkódot.", true); },
  resetToggle() { ui.resetOpen = !ui.resetOpen; ui.confirmReset = 0; },
  resetAsk() { ui.confirmReset = 1; },
  resetAsk2() { ui.confirmReset = 2; },
  resetCancel() { ui.confirmReset = 0; },
  async resetDo() {
    const r = await ctx.store.resetAll();
    ui.confirmReset = 0; ui.resetOpen = false;
    if (r.ok) { ui.settings = false; ui.mode = "timer"; ctx.say("Minden bevitt adat törölve."); } else ctx.say(r.error, true, 10000);
    ctx.render();
    return false;
  },
};

/** Beállítás-mezők változása (select, jelölőnégyzet, szöveg). */
export function onSettingChange(el) {
  const f = el.dataset.field, t = el.dataset.type;
  const v = t === "bool" ? el.checked : t === "int" ? Number(el.value) : el.value;
  ctx.store.saveSettings({ [f]: v });
}
