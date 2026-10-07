// Közös mezők (Időzítő, Kézi bevitel, Pomodoro, Naptár): típus, munkahely, Utazás, mennyiség, tevékenység.
import { groupedTypes, isTravel, isWholeDay, hasQuantity, quantityUnit } from "../types.js";
import { draftType } from "../entries.js";
import { parsePlaces } from "../calendarParser.js";
import { ctx } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";

/** Szövegmező a mentett helyszínek legördülő menüjével. `append`: a menü a listához fűz (Munkahely(ek)), egyébként lecserél. */
function placeField(field, value, placeholder, { append = false, disabled = false, suggest = "" } = {}) {
  const places = ctx.S.places;
  const menu = places.length
    ? places.map((p) => `<button type="button" role="menuitem" data-action="pick" data-field="${field}" data-append="${append ? 1 : 0}" data-value="${esc(p)}">${esc(p)}</button>`).join("")
    : `<span class="menu-empty">Még nincs mentett helyszín</span>`;
  return `<div class="placefield">
    <input type="text" data-ns="draft" data-field="${field}" ${suggest ? `data-suggest="${suggest}"` : ""} value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" ${disabled ? "disabled" : ""}>
    <details class="menu"><summary title="${append ? "Hozzáadás a listához a mentett helyszínekből" : "Mentett helyszínek"}" aria-label="Mentett helyszínek">${icon("chevD", 0.9)}</summary>
      <div class="menu-list" role="menu">${menu}</div></details></div>`;
}

/** A Tevékenység típusa: javaslatokkal gépelve szűrhető mező (a nyíl a teljes csoportosított listát nyitja), kikapcsolva a régi legördülő lista. */
function typeField(d, type, typeOptions) {
  if (!ctx.S.settings.suggestions) return `<label class="f"><span>Tevékenység típusa</span><select data-ns="draft" data-field="typeCode"><option value="">Válassz típust…</option>${typeOptions}</select></label>`;
  const menu = groupedTypes().map((g) => `<span class="menu-group">${esc(g.name)}</span>${g.types.map((t) => `<button type="button" role="menuitem" data-action="pickType" data-code="${esc(t.code)}">${esc(t.label)}</button>`).join("")}`).join("");
  return `<div class="f"><span>Tevékenység típusa</span><div class="placefield">
    <input type="text" id="typeInput" data-ns="typeq" data-suggest="type" value="${esc(type ? type.label : "")}" placeholder="Válassz típust…" autocomplete="off" aria-label="Tevékenység típusa">
    <details class="menu"><summary title="Összes típus" aria-label="Összes típus">${icon("chevD", 0.9)}</summary><div class="menu-list" role="menu">${menu}</div></details></div></div>`;
}

export function fieldsHTML() {
  const d = ctx.S.draft, type = draftType(d), travel = isTravel(type), whole = isWholeDay(type);
  const typeOptions = groupedTypes().map((g) =>
    `<optgroup label="${esc(g.name)}">${g.types.map((t) => `<option value="${esc(t.code)}" ${d.typeCode === t.code ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</optgroup>`).join("");
  const showWork = !travel && (!type || !whole);
  let h = `<section class="card fields"><div class="row2">`;
  if (showWork) h += `<label class="f"><span>Munkahely</span>${placeField("workplace", d.workplace, "Munkahely", { suggest: "place" })}</label>`;
  h += `${typeField(d, type, typeOptions)}</div>`;
  if (travel) {
    h += `<div class="row2"><label class="f"><span>Kiindulás</span>${placeField("departure", d.departure, "Tata vagy Tata, Fő út 1.", { suggest: "place" })}</label>
      <label class="f"><span>Cél</span>${placeField("destination", d.destination, "Mór, Tata vagy Tata, Kossuth u. 5.", { append: true, suggest: "list" })}</label></div>
      <div class="travelopts"><div class="radios" role="radiogroup" aria-label="Munkahely"><span class="mut small">Munkahely:</span>
        <label class="check small"><input type="radio" name="wplace" data-ns="draft" data-field="workplaceIsDeparture" value="1" ${d.workplaceIsDeparture ? "checked" : ""}> Kiindulás</label>
        <label class="check small"><input type="radio" name="wplace" data-ns="draft" data-field="workplaceIsDeparture" value="0" ${d.workplaceIsDeparture ? "" : "checked"}> Cél</label></div>
        <label class="check small" title="Oda-vissza út: a munka után visszatértem a Kiindulásra (Kiindulás - Cél(ek) - Kiindulás)"><input type="checkbox" data-ns="draft" data-field="roundTrip" ${d.roundTrip ? "checked" : ""}> Oda-vissza</label></div>`;
  }
  if (travel) {
    h += `<div class="kmrow"><span class="mut small">Km-óra</span>
      <input type="text" inputmode="numeric" data-ns="draft" data-field="startKm" value="${esc(d.startKm)}" placeholder="induló km" autocomplete="off" aria-label="Induló km" title="A kilométeróra állása az út elején (nem kötelező; az előző út végállásával előtöltve)">
      <span class="arrowc">${icon("forward", 0.85)}</span>
      <input type="text" inputmode="numeric" data-ns="draft" data-field="endKm" value="${esc(d.endKm)}" placeholder="érkező km" autocomplete="off" aria-label="Érkező km" title="A kilométeróra állása az út végén (nem kötelező)"></div>`;
  }
  if (type && hasQuantity(type)) {
    h += `<div class="stepline"><span class="mut">Mennyiség</span><div class="stepper">
      <button type="button" class="step" data-action="qty" data-d="-1" aria-label="Kevesebb">−</button>
      <span class="val">${d.quantity} ${quantityUnit(type)}</span>
      <button type="button" class="step" data-action="qty" data-d="1" aria-label="Több">+</button></div></div>`;
  }
  const label = !type ? "Tevékenység (nem kötelező)" : whole ? "Megjegyzés (nem kötelező)" : travel ? "Tevékenység (kötelező, a Költségelszámoláshoz)" : "Tevékenység (nem kötelező)";
  const ph = whole ? "Megjegyzés" : travel ? "Mi volt az út célja?" : "Mit csináltál? (nem kötelező)";
  h += `<label class="f"><span>${label}</span><input type="text" data-ns="draft" data-field="activity" ${ctx.S.settings.suggestions ? 'data-suggest="activity"' : ""} value="${esc(d.activity)}" placeholder="${ph}" autocomplete="off"></label></section>`;
  return h;
}

/** A Munkahely(ek) listához fűzés / lecserélés a menüből. */
export function pickPlace(field, value, append) {
  const d = ctx.S.draft;
  if (append) {
    const cur = String(d[field] ?? "").trim();
    const have = (parsePlaces(cur) || []).some((p) => p.settlement.toLowerCase() === value.toLowerCase());
    if (!have) d[field] = cur ? cur + ", " + value : value;
  } else d[field] = value;
  ctx.store.saveDraft();
}
