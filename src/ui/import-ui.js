// Szabad szöveges rögzítés: az MI-asszisztens által az adatmappa melletti bejegyzesek-import.csv fájlba írt bejegyzések áttekintése és jóváhagyása.
import { formatChip } from "../dates.js";
import { ctx, ui } from "./ctx.js";
import { esc, entryAmount, entryWhen, entryDetail } from "./util.js";
import { icon } from "./icons.js";

const imp = () => ctx.S.imports;
const sel = () => (ui.imp || (ui.imp = { sel: new Set(), known: new Set() }));

/** Az új bejegyzések alapból kijelöltek, ha elfogadhatók és nem duplikátumok; a felhasználó korábbi választása megmarad. */
function syncSelection() {
  const s = sel(), ids = new Set(imp().items.map((i) => i.entry.id));
  for (const i of imp().items) if (!s.known.has(i.entry.id) && i.acceptable && !i.duplicate) s.sel.add(i.entry.id);
  for (const id of ids) s.known.add(id);
  for (const id of [...s.sel]) if (!ids.has(id)) s.sel.delete(id);
}

/** A fejlécben az áttekintésre váró bejegyzések darabszámával jelölt gomb (ha van ilyen). */
export function headerButtonHTML() {
  const n = imp().items.length;
  if (!n) return "";
  return `<button class="iconbtn importbtn" data-action="openImport" title="${n} szabad szöveggel felvitt bejegyzés vár áttekintésre: kattints a megnyitáshoz" aria-label="${n} bejegyzés vár áttekintésre">${icon("download", 1.2)}<b>${n}</b></button>`;
}

function rowHTML(item) {
  const e = item.entry, s = sel();
  const day = formatChip(e.date), amount = entryAmount(e);
  return `<div class="improw ${item.acceptable ? "" : "bad"}"><input type="checkbox" data-action="impToggle" data-id="${e.id}" ${s.sel.has(e.id) ? "checked" : ""} ${item.acceptable ? "" : "disabled"} aria-label="Kijelölés">
    <div class="impmain"><div class="t">${esc([day, entryWhen(e), e.typeLabel].filter(Boolean).join("  "))}</div><div class="d">${esc(entryDetail(e))}</div>
      ${item.problems.map((p) => `<div class="small stopt">${esc(p)}</div>`).join("")}${item.warnings.map((w) => `<div class="small warnt">${esc(w)}</div>`).join("")}</div>
    <div class="amt">${esc(amount)}</div></div>`;
}

export function importHTML() {
  syncSelection();
  const items = imp().items, s = sel();
  return `<div class="modalbody"><p class="mut small">Az MI-asszisztens ezeket a bejegyzéseket készítette a leírásodból. Csak azok kerülnek az adataid közé, amelyeket elfogadsz. A pirossal jelölt bejegyzés nem fogadható el: kérd meg az asszisztenst, hogy javítsa.</p>
    ${imp().notes.map((n) => `<p class="small warnt">${esc(n)}</p>`).join("")}
    ${items.length ? `<div class="implist">${items.map(rowHTML).join("")}</div>` : `<p class="mut center">Nincs áttekintésre váró bejegyzés.</p>`}</div>
    <div class="modalfoot"><span class="small mut">${s.sel.size} kijelölve</span><span class="grow"></span>
      <button class="btn ghost" data-action="impDiscard" ${s.sel.size ? "" : "disabled"}>Kijelöltek elvetése</button>
      <button class="btn ghost" data-action="impDiscardAll" ${items.length ? "" : "disabled"}>Mind elvetése</button>
      <button class="btn" data-action="impAccept" ${s.sel.size ? "" : "disabled"}>Kijelöltek elfogadása</button></div>`;
}

/** A Beállítások kártya tartalma (a megnyitó gombbal). */
export function settingsBodyHTML() {
  const n = imp().items.length;
  return `<p class="small mut">Az MI-asszisztensnek (a telepített OTS Adminisztráció skill „Bejegyzések felvitele szabad szövegből” feladata) leírhatod szabadon, mit csináltál („Ma 9–10 között adminisztráltam, tegnapelőtt volt egy két órás megbeszélésem”). Ha valami nem egyértelmű, megkérdezi. A bejegyzéseket az adatmappa melletti <code>bejegyzesek-import.csv</code> fájlba írja, és csak az itt megnyitható áttekintés után, a jóváhagyásoddal kerülnek az adataid közé. Az adatmappa kiválasztása szükséges hozzá.</p>
    <div class="btnwrap"><button class="btn small" data-action="openImport">Áttekintés megnyitása${n ? ` (${n})` : ""}</button></div>`;
}

export const actions = {
  openImport() { ui.modal = "import"; ui.settings = false; ctx.store.refreshImport({ force: true }).then(() => ctx.render()); },
  impToggle(el) { const s = sel(); if (s.sel.has(el.dataset.id)) s.sel.delete(el.dataset.id); else s.sel.add(el.dataset.id); },
  async impAccept() {
    const n = await ctx.store.acceptImport([...sel().sel]);
    if (n) ctx.say(`${n} bejegyzés felvéve a szabad szöveges rögzítésből.`);
    if (!imp().items.length) ui.modal = null;
    ctx.render(); return false;
  },
  async impDiscard() { await ctx.store.discardImport([...sel().sel]); if (!imp().items.length) ui.modal = null; ctx.render(); return false; },
  async impDiscardAll() { await ctx.store.discardImport(imp().items.map((i) => i.entry.id)); ui.modal = null; ctx.render(); return false; },
};
