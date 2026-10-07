// Javaslatok gépelés közben: a mező alatt, a tartalomra rátakarva lebegő lista (nem mozgatja az oldalt, nem rajzolódik újra a gépeléstől).
// Mezők: data-suggest="place" (Munkahely, Kiindulás), "list" (Cél), "activity" (Tevékenység), "type" (Tevékenység típusa).
import { matches, listSuggestions, applySuggestion, activityCandidates } from "../suggest.js";
import { groupedTypes } from "../types.js";
import { draftType } from "../entries.js";
import { ctx } from "./ctx.js";
import { esc } from "./util.js";

const cur = { el: null, items: [], index: -1, kind: "", prefix: "" };
let box = null;

const enabled = () => !!ctx.S?.settings?.suggestions;
const typeItems = () => groupedTypes().flatMap((g) => g.types).map((t) => ({ label: t.label, code: t.code }));

function popup() {
  if (!box) {
    box = document.createElement("div");
    box.id = "suggestBox"; box.className = "suggestbox"; box.setAttribute("role", "listbox"); box.hidden = true;
    box.addEventListener("mousedown", (ev) => { ev.preventDefault(); const it = ev.target.closest("[data-i]"); if (it) accept(Number(it.dataset.i)); });
    document.body.appendChild(box);
  }
  return box;
}

export function hide() {
  cur.items = []; cur.index = -1;
  if (box) box.hidden = true;
}

function show() {
  const b = popup();
  if (!cur.items.length || !cur.el || !cur.el.isConnected) { hide(); return; }
  const r = cur.el.getBoundingClientRect();
  b.innerHTML = cur.items.map((it, i) => `<div role="option" class="sugg ${i === cur.index ? "on" : ""}" data-i="${i}" aria-selected="${i === cur.index}">${esc(it.label)}</div>`).join("");
  b.style.left = `${r.left + window.scrollX}px`; b.style.top = `${r.bottom + window.scrollY + 2}px`; b.style.minWidth = `${r.width}px`;
  b.hidden = false;
}

/** Beíráskor (input esemény) a javaslatok frissítése. */
export function onInput(el) {
  const kind = el.dataset.suggest;
  if (!kind || !enabled()) { hide(); return; }
  const S = ctx.S, v = el.value;
  let items = [], prefix = "";
  if (kind === "place") items = matches(v, S.places).map((label) => ({ label }));
  else if (kind === "list") { const r = listSuggestions(v, S.places); prefix = r.prefix; items = r.items.map((label) => ({ label })); }
  else if (kind === "activity") items = matches(v, activityCandidates(S.entries, S.draft.typeCode)).map((label) => ({ label }));
  else if (kind === "type") items = matches(v, typeItems().map((t) => t.label)).map((label) => ({ label, code: typeItems().find((t) => t.label === label)?.code }));
  Object.assign(cur, { el, kind, prefix, items, index: -1 });
  show();
}

function accept(i) {
  const it = cur.items[i], el = cur.el;
  if (!it || !el) return;
  const kind = cur.kind;
  hide();
  if (kind === "type") {
    ctx.store.setDraftType(it.code);
    el.blur();   // a mező elengedi a fókuszt, és a kiválasztott típus neve látszik
    ctx.render();
    return;
  }
  el.value = applySuggestion(cur.prefix, it.label);
  ctx.S.draft[el.dataset.field] = el.value;
  ctx.store.saveDraft();
  ctx.refreshGate();
  el.focus();
}

/** Billentyűk: Le/Fel lépked, Enter a kijelöltet fogadja el, Tab a kijelöltet (ha nincs, az elsőt), Esc bezárja. True, ha lekezelte. */
export function onKey(ev) {
  if (!box || box.hidden || !cur.items.length || ev.target !== cur.el) {
    if (ev.key === "Escape" && ev.target?.dataset?.suggest === "type") { restoreType(ev.target); return false; }
    return false;
  }
  const n = cur.items.length;
  switch (ev.key) {
    case "ArrowDown": cur.index = cur.index < 0 ? 0 : (cur.index + 1) % n; show(); ev.preventDefault(); return true;
    case "ArrowUp": cur.index = cur.index <= 0 ? n - 1 : cur.index - 1; show(); ev.preventDefault(); return true;
    case "Enter": if (cur.index >= 0) { ev.preventDefault(); accept(cur.index); return true; } return false;
    case "Tab": accept(cur.index >= 0 ? cur.index : 0); ev.preventDefault(); return true;
    case "Escape": hide(); ev.preventDefault(); return true;
    default: return false;
  }
}

/** A Tevékenység típusa mező: a félbehagyott keresésből kilépve a kiválasztott típus neve áll vissza. */
export function restoreType(el) {
  const t = draftType(ctx.S.draft);
  el.value = t ? t.label : "";
}

export function onFocusIn(ev) {
  const el = ev.target;
  if (el?.dataset?.suggest === "type") el.select();   // fókuszban a kiválasztott típus kijelölve: gépelés felülírja
}

export function onFocusOut(ev) {
  const el = ev.target;
  if (!el?.dataset?.suggest) return;
  if (el.dataset.suggest === "type") restoreType(el);
  if (cur.el === el) hide();
}
