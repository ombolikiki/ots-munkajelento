// Közös mezők (Időzítő, Kézi bevitel, Pomodoro, Naptár): típus, munkahely, Utazás, mennyiség, tevékenység.
import { groupedTypes, isTravel, isWholeDay, hasQuantity, quantityUnit } from "../types.js";
import { draftType, workplaceList } from "../entries.js";
import { ctx } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";

/** Szövegmező a mentett helyszínek legördülő menüjével. `append`: a menü a listához fűz (Munkahely(ek)), egyébként lecserél. */
function placeField(field, value, placeholder, { append = false, disabled = false } = {}) {
  const places = ctx.S.places;
  const menu = places.length
    ? places.map((p) => `<button type="button" role="menuitem" data-action="pick" data-field="${field}" data-append="${append ? 1 : 0}" data-value="${esc(p)}">${esc(p)}</button>`).join("")
    : `<span class="menu-empty">Még nincs mentett helyszín</span>`;
  return `<div class="placefield">
    <input type="text" data-ns="draft" data-field="${field}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" ${disabled ? "disabled" : ""}>
    <details class="menu"><summary title="${append ? "Hozzáadás a listához a mentett helyszínekből" : "Mentett helyszínek"}" aria-label="Mentett helyszínek">${icon("chevD", 0.9)}</summary>
      <div class="menu-list" role="menu">${menu}</div></details></div>`;
}

export function fieldsHTML() {
  const d = ctx.S.draft, type = draftType(d), travel = isTravel(type), whole = isWholeDay(type);
  const typeOptions = groupedTypes().map((g) =>
    `<optgroup label="${esc(g.name)}">${g.types.map((t) => `<option value="${esc(t.code)}" ${d.typeCode === t.code ? "selected" : ""}>${esc(t.label)}</option>`).join("")}</optgroup>`).join("");
  const showWork = !type || !whole;
  let h = `<section class="card fields"><div class="row2">`;
  if (showWork) h += `<label class="f"><span>${travel ? "Munkahely(ek)" : "Munkahely"}</span>${placeField("workplace", d.workplace, travel ? "pl. Mohács, Szigetvár" : "Munkahely", { append: travel })}</label>`;
  h += `<label class="f"><span>Tevékenység típusa</span><select data-ns="draft" data-field="typeCode"><option value="">Válassz típust…</option>${typeOptions}</select></label></div>`;
  if (travel) {
    h += `<div class="row2"><label class="f"><span>Indulás</span>${placeField("departure", d.departure, "Indulás")}</label>
      <div class="f"><div class="f-head"><span>Érkezés</span>
        <label class="check small"><input type="checkbox" data-ns="draft" data-field="roundTrip" ${d.roundTrip ? "checked" : ""}> Oda-vissza</label></div>
        ${d.roundTrip
          ? `<div class="placefield"><input type="text" value="${esc(d.departure.trim() || "= Indulás")}" disabled></div>`
          : placeField("arrival", d.arrival, "Érkezés")}</div></div>`;
  }
  if (type && hasQuantity(type)) {
    h += `<div class="stepline"><span class="mut">Mennyiség</span><div class="stepper">
      <button type="button" class="step" data-action="qty" data-d="-1" aria-label="Kevesebb">−</button>
      <span class="val">${d.quantity} ${quantityUnit(type)}</span>
      <button type="button" class="step" data-action="qty" data-d="1" aria-label="Több">+</button></div></div>`;
  }
  const label = !type ? "Tevékenység (nem kötelező)" : whole ? "Megjegyzés (nem kötelező)" : travel ? "Tevékenység (kötelező, a Költségelszámoláshoz)" : "Tevékenység (nem kötelező)";
  const ph = whole ? "Megjegyzés" : travel ? "Mi volt az út célja?" : "Mit csináltál? (nem kötelező)";
  h += `<label class="f"><span>${label}</span><input type="text" data-ns="draft" data-field="activity" value="${esc(d.activity)}" placeholder="${ph}" autocomplete="off"></label></section>`;
  return h;
}

/** A Munkahely(ek) listához fűzés / lecserélés a menüből. */
export function pickPlace(field, value, append) {
  const d = ctx.S.draft;
  if (append) {
    const l = workplaceList(d[field]);
    if (!l.some((x) => x.toLowerCase() === value.toLowerCase())) l.push(value);
    d[field] = l.join(", ");
  } else d[field] = value;
  ctx.store.saveDraft();
}
