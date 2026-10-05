// Az „OTS Adminisztráció” skill telepítő varázsló: áttekintés, cél, feladatok, adataid, telepítés, kész.
// A böngésző nem ír a skill-mappákba magától: a csomag ZIP-ként letölthető (kézi másolás parancsokkal), vagy egy kiválasztott skill-mappába kiírható.
import * as S from "../skill.js";
import { folderSupported } from "../folder.js";
import { ctx, ui } from "./ctx.js";
import { esc } from "./util.js";
import { icon } from "./icons.js";
import { VERSION } from "./settings.js";

const STEPS = ["Áttekintés", "Cél", "Feladatok", "Adataid", "Telepítés", "Kész"];
let bundle = null, bundleError = null, bundleFp = null, loading = false;

export function detectOS() {
  const p = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return p.includes("mac") ? "mac" : "windows";
}

export function openSkill() {
  const sk = ctx.S.settings.skill;
  ui.skill = {
    step: 0, error: null, results: [], copied: null,
    targets: sk.targets.length ? [...sk.targets] : ["claude"], tasks: sk.tasks.length ? [...sk.tasks] : S.TASK_ORDER_DEFAULT,
    userName: sk.userName, site: sk.site, home: sk.home || ctx.S.settings.home, congregations: sk.congregations || ctx.S.settings.congregations.join(", "),
    dataPath: ctx.S.settings.dataPath, os: sk.os || detectOS(),
  };
  ui.modal = "skill";
  loadBundle();
}

async function loadBundle() {
  if (bundle || loading) return;
  loading = true;
  try {
    const res = await fetch("skill/bundle.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    bundle = await res.json();
    bundleFp = await S.bundleFingerprint(bundle.files);
    if (ui.skill && ui.skill.tasks.length === 0) ui.skill.tasks = bundle.tasks.map((t) => t.id);
  } catch (e) { bundleError = e?.message || String(e); }
  loading = false;
  if (ui.modal === "skill") ctx.render();
}

const sel = () => ({ userName: ui.skill.userName, home: ui.skill.home, congregations: ui.skill.congregations, site: ui.skill.site, dataPath: ui.skill.dataPath, tasks: ui.skill.tasks });
const tasksList = () => (bundle ? bundle.tasks : []);
const code = (text, key) => `<div class="codebox"><code>${esc(text)}</code><button class="btn small ghost" data-action="skillCopy" data-text="${esc(text)}" data-key="${key}">${ui.skill.copied === key ? "Másolva" : "Másolás"}</button></div>`;

function row(kind, title, detail) {
  const ic = kind === "ok" ? "checkCircle" : kind === "info" ? "info" : "alert";
  return `<div class="checkrow ${kind}">${icon(ic, 1.1)}<div><div>${title}</div>${detail ? `<div class="small mut">${detail}</div>` : ""}</div></div>`;
}

function intro() {
  const f = ctx.store.folder, fs = f ? f.status : "none";
  return `<h2>OTS Adminisztráció skill telepítése</h2>
    <p>A skill („OTS Adminisztráció”) megtanítja az MI-asszisztenst, hogyan töltse ki helyetted az OTS adminisztrációs feladatait: Havi munkajelentő, Költségelszámolás, Gyülekezeti névsor, Hittan, Látogatottság. A munkajelentőhöz, a költségelszámoláshoz és a létszámjelentőhöz ennek az alkalmazásnak az adatait használja.</p>
    <p class="mut">A telepítés egy mappát másol a gépedre. Semmit nem küld az internetre, és az OTS-ben semmit nem módosít. A böngésző a skill-mappákba nem tud magától írni, ezért a csomagot ZIP-ként töltöd le, és a varázsló parancsokat ad a kicsomagoláshoz (vagy, ha a böngésző engedi, a skill-mappát kijelölve közvetlenül is kiírható).</p>
    <div class="subcard"><strong class="small">Ellenőrzés</strong>
      ${bundle ? row("ok", "A skill csomag megvan az alkalmazásban", `azonosító: ${bundleFp}`) : bundleError ? row("warn", "A skill csomag nem tölthető be", esc(bundleError)) : row("info", "A skill csomag betöltése…")}
      ${fs === "ready" ? row("ok", "Az adatmappa be van állítva", `${esc(f.name)} · ${ctx.S.entries.length} bejegyzés`) : row("warn", "Még nincs adatmappa kiválasztva", "A skill a bejegyzéseket a mappából olvassa. Állítsd be a Beállítások › Adatmappa és mentés résznél, mielőtt használod.")}
      ${ctx.S.settings.dataPath ? row("ok", "Az adatmappa elérési útja megadva", esc(ctx.S.settings.dataPath)) : row("warn", "Az adatmappa elérési útja még nincs megadva", "A következő lépésekben megadhatod.")}</div>
    <div class="setrow"><span>Operációs rendszer (a mappák és a parancsok ehhez igazodnak)</span><div class="seg tight"><button data-action="skillOs" data-os="windows" aria-pressed="${ui.skill.os === "windows"}">Windows</button><button data-action="skillOs" data-os="mac" aria-pressed="${ui.skill.os === "mac"}">Mac</button></div></div>`;
}

function target() {
  const os = ui.skill.os;
  return `<h2>Hová telepítsük?</h2><p class="mut">Több célt is választhatsz. Ugyanaz a skill kerül mindegyikbe, csak a mappa különbözik.</p>
    ${Object.values(S.TARGETS).map((t) => { const on = ui.skill.targets.includes(t.id);
      return `<button class="optcard ${on ? "on" : ""}" data-action="skillTarget" data-id="${t.id}"><span class="chk">${icon(on ? "check" : "", 1)}</span><span><strong>${esc(t.title)}</strong>${t.free ? `<span class="badge go">Ingyenes</span>` : ""}
        <span class="small mut db">${esc(t.detail)}</span><span class="small mut db">Mappa: <code>${esc(os === "mac" ? t.mac : t.win)}</code></span></span></button>`; }).join("")}
    ${ui.skill.targets.includes("antigravity") ? `<div class="subcard"><p class="small"><strong>Antigravity CLI telepítése</strong> (ha még nincs a gépen) – a ${os === "mac" ? "Terminálban" : "PowerShellben"}:</p>${code(S.AGY_INSTALL[os === "mac" ? "mac" : "windows"], "agy")}
      <p class="small mut">Utána nyiss új ablakot, és ellenőrizd: <code>agy --version</code>. Első indításkor jelentkezz be a Google-fiókoddal. A Codex és az Antigravity CLI ugyanazt a skill-mappát használja, ezért azt egyszer másolod.</p></div>` : ""}`;
}

function tasksStep() {
  return `<h2>Mely feladatokat szeretnéd?</h2><p class="mut">A Határidők kiolvasása mindig része a skillnek. Csak a kijelölt feladatokhoz kér adatot a következő lépés.</p>
    ${tasksList().map((t) => { const on = ui.skill.tasks.includes(t.id);
      return `<button class="optcard ${on ? "on" : ""}" data-action="skillTask" data-id="${t.id}"><span class="chk">${icon(on ? "check" : "", 1)}</span><span><strong>${esc(t.name)}</strong><span class="small mut db">${esc(S.TASK_SUMMARY[t.id] || "")}</span></span></button>`; }).join("")}`;
}

function details() {
  const needs = S.neededFields(tasksList(), ui.skill.tasks), tracker = ui.skill.tasks.some((t) => ["havi", "koltseg", "latogatottsag"].includes(t));
  return `<h2>Adataid</h2><p class="mut">Először: melyik OTS-oldalon dolgozol? A két oldal felépítése megegyezik, a skill a választott címet használja.</p>
    <div class="seg"><button data-action="skillSite" data-site="det" aria-pressed="${ui.skill.site === "det"}">DETKapu</button><button data-action="skillSite" data-site="tet" aria-pressed="${ui.skill.site === "tet"}">TETKapu</button></div>
    <p class="small mut">${esc(S.SITES[ui.skill.site].url)}</p>
    <label class="f"><span>Neved</span><input type="text" data-ns="skill" data-field="userName" value="${esc(ui.skill.userName)}" autocomplete="off"></label>
    ${needs.has("home") ? `<label class="f"><span>Székhelyed (ahonnan az útvonalak indulnak)</span><input type="text" data-ns="skill" data-field="home" value="${esc(ui.skill.home)}" autocomplete="off"></label>` : ""}
    ${needs.has("congregations") ? `<label class="f"><span>Gyülekezeteid (vesszővel elválasztva, a feladatok sorrendjében)</span><input type="text" data-ns="skill" data-field="congregations" value="${esc(ui.skill.congregations)}" autocomplete="off"></label>` : ""}
    ${tracker ? `<label class="f"><span>Az adatmappa teljes elérési útja</span><input type="text" data-ns="skill" data-field="dataPath" value="${esc(ui.skill.dataPath)}" placeholder="${ui.skill.os === "mac" ? "/Users/Neved/Documents/OTS Munkajelentő Tracker" : "C:\\Users\\Neved\\Documents\\OTS Munkajelentő Tracker"}" autocomplete="off" spellcheck="false"></label>
      <p class="small mut">Ebben a mappában van a bejegyzesek.csv (lásd Beállítások › Adatmappa és mentés). A skill ebből a mappából olvassa a munkajelentés adatait. ${ui.skill.os === "mac" ? "Mac: Finderben a mappa › Option+jobb kattintás › „Másolás elérési útként”." : "Windows: Fájlkezelőben kattints a mappára, majd Ctrl+Shift+C."}</p>` : ""}`;
}

function review() {
  const folders = S.effectiveFolders(ui.skill.targets, ui.skill.os), site = S.SITES[ui.skill.site];
  const names = tasksList().filter((t) => ui.skill.tasks.includes(t.id)).map((t) => t.name).join(", ");
  return `<h2>Összegzés</h2><div class="subcard">
    <div class="sumrow"><span>OTS-oldal</span><b>${esc(site.title)} (${esc(site.url)})</b></div>
    <div class="sumrow"><span>Név</span><b>${esc(ui.skill.userName)}</b></div>
    <div class="sumrow"><span>Feladatok</span><b>${esc(names)}</b></div>
    ${ui.skill.tasks.some((t) => ["havi", "koltseg", "latogatottsag"].includes(t)) ? `<div class="sumrow"><span>Adatmappa</span><b>${esc(ui.skill.dataPath)}</b></div>` : ""}
    <div class="sumrow"><span>Célok</span><b>${folders.map((f) => esc(f.targets.map((t) => S.TARGETS[t].title).join(" + ")) + ` → <code>${esc(f.path)}</code>`).join("<br>")}</b></div></div>
    <p class="mut small">A „Telepítés” gomb elkészíti a csomagot (ZIP), és megmutatja, hogyan kerül a skill-mappába. Ha már van ilyen nevű skill a mappában, a kicsomagolás előtt készíts róla másolatot (a közvetlen kiírás ezt magától megteszi).</p>`;
}

function done() {
  const os = ui.skill.os, r = ui.skill.results;
  const zipDir = os === "mac" ? "~/Downloads" : "$env:USERPROFILE\\Downloads";
  return `<h2>Kész a csomag</h2><p>A skill ki van töltve a megadott adataiddal. Most már csak a skill-mappába kell tenned.</p>
    ${r.map((x, i) => {
      const dest = x.folder.path, winDest = dest.replace("%USERPROFILE%", "$env:USERPROFILE");
      const cmd = os === "mac"
        ? `mkdir -p ${dest} && unzip -o ${zipDir}/${x.folder.zip} -d ${dest}`
        : `New-Item -ItemType Directory -Force "${winDest}" | Out-Null; Expand-Archive -Force "${zipDir}\\${x.folder.zip}" "${winDest}"`;
      return `<div class="subcard"><strong>${esc(x.folder.targets.map((t) => S.TARGETS[t].title).join(" + "))}</strong> <span class="small mut">→ ${esc(dest)}</span>
        <div class="btnwrap"><button class="btn" data-action="skillZip" data-i="${i}">${icon("download", 1)} ZIP letöltése</button>
        ${folderSupported() ? `<button class="btn ghost" data-action="skillWrite" data-i="${i}">${icon("folder", 1)} Kiírás a skill-mappába…</button>` : ""}</div>
        ${x.status ? `<p class="${x.ok ? "okbox" : "errbox"}"><span>${esc(x.status)}</span></p>` : ""}
        <p class="small"><b>Kézi telepítés</b> (a ZIP letöltése után, ${os === "mac" ? "Terminálban" : "PowerShellben"}):</p>${code(cmd, "cmd" + i)}
        <p class="small mut">${os === "mac" ? "A parancs létrehozza a skill-mappát, és kicsomagolja a letöltött ZIP-et. A ZIP-ben az „ots-adminisztracio” mappa van, ez kerül a skills mappába." : "A parancs létrehozza a skill-mappát (ha nincs), és kicsomagolja a letöltött ZIP-et. A ZIP-ben az „ots-adminisztracio” mappa van, ez kerül a skills mappába. A mappa Fájlkezelőben a Win+R, majd " + "<code>" + esc(dest) + "</code> beírásával nyitható meg."} Ha ugyanilyen nevű skilled már van, előbb másold el máshová.</p></div>`;
    }).join("")}
    <div class="subcard"><strong>A telepítés után</strong><ol class="steps">
      <li>Indítsd újra az asszisztens alkalmazását, hogy betöltse a skillt.</li>
      <li>Nyiss új munkamenetet:<ul>${ui.skill.targets.map((t) => `<li><b>${esc(S.TARGETS[t].title)}</b>: <code>${esc(S.TARGETS[t].start)}</code></li>`).join("")}</ul></li>
      <li>Az első böngészőhívásnál több engedélyt is kér (olvasd el őket), és megnyílik egy Chrome-ablak: <b>jelentkezz be benne te az OTS-be</b>, a jelszavadat az asszisztens soha nem írja be.</li>
      <li>Az asszisztens kilistázza az esedékes határidőket, és <b>minden lezárás előtt megerősítést kér</b>. A Havi munkajelentő kitöltése után megáll, hogy átnézhesd.</li></ol></div>
    ${ui.skill.targets.includes("antigravity") ? `<div class="subcard"><strong>Antigravity CLI ellenőrzése</strong><p class="small mut">Az <code>agy</code>-ban kérd: „Sorold fel a skilleket név szerint”, és látnod kell az <code>ots-adminisztracio</code>-t. Ingyenes keret: heti korlát; ha elfogy, várj a következő hétig, vagy használd a Kézi felvitel az OTS-be ablakot.</p></div>` : ""}`;
}

export function skillHTML() {
  const k = ui.skill, st = k.step;
  let body = [intro, target, tasksStep, details, review, done][st]();
  const dots = STEPS.map((t, i) => `<span class="stp ${i === st ? "on" : i < st ? "past" : ""}"><i>${i < st ? icon("check", 0.8) : i + 1}</i>${i === st ? `<b>${t}</b>` : ""}</span>`).join('<em></em>');
  const back = st > 0 && st < 5 ? `<button class="btn ghost" data-action="skillBack">Vissza</button>` : "";
  const next = st === 4 ? `<button class="btn" data-action="skillInstall">${icon("download", 1)} Telepítés</button>` : st < 4 ? `<button class="btn" data-action="skillNext" ${st === 0 && !bundle ? "disabled" : ""}>Tovább</button>` : `<button class="btn" data-action="skillClose">Kész</button>`;
  return `<div class="modalhead"><div class="stepper-dots">${dots}</div></div><div class="modalbody wiz" data-keep-scroll="skill">${body}${k.error ? `<p class="errbox">${icon("alert", 1)}<span>${esc(k.error)}</span></p>` : ""}</div>
    <div class="modalfoot">${back}<span class="grow"></span>${st < 5 ? `<button class="btn ghost" data-action="modalClose">Mégse</button>` : ""}${next}</div>`;
}

// ---------- Műveletek ----------

const toggleIn = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
function validateStep() {
  const k = ui.skill;
  if (k.step === 1 && !k.targets.length) return "Válassz legalább egy célt.";
  if (k.step === 2 && !k.tasks.length) return "Válassz legalább egy feladatot.";
  if (k.step === 3) return S.detailsError(sel(), tasksList(), k.tasks);
  return null;
}

async function persist() {
  const k = ui.skill;
  ctx.store.saveSettings({ dataPath: k.dataPath, skill: { userName: k.userName, site: k.site, home: k.home, congregations: k.congregations, tasks: k.tasks, targets: k.targets, os: k.os } });
}

export const actions = {
  skillOs(el) { ui.skill.os = el.dataset.os; },
  skillTarget(el) { ui.skill.targets = toggleIn(ui.skill.targets, el.dataset.id); ui.skill.error = null; },
  skillTask(el) { ui.skill.tasks = toggleIn(ui.skill.tasks, el.dataset.id); ui.skill.error = null; },
  skillSite(el) { ui.skill.site = el.dataset.site; },
  skillBack() { ui.skill.step = Math.max(0, ui.skill.step - 1); ui.skill.error = null; },
  skillNext() {
    const e = validateStep();
    if (e) { ui.skill.error = e; return; }
    ui.skill.error = null; ui.skill.step += 1;
  },
  async skillInstall() {
    const k = ui.skill;
    const e = (!k.targets.length && "Válassz legalább egy célt.") || (!k.tasks.length && "Válassz legalább egy feladatot.") || S.detailsError(sel(), tasksList(), k.tasks);
    if (e) { k.error = e; return; }
    try {
      k.results = [];
      for (const folder of S.effectiveFolders(k.targets, k.os)) {
        const files = await S.buildFiles(bundle, sel(), folder.flavor, { version: "web " + VERSION });
        k.results.push({ folder, files, status: null, ok: false });
      }
      await persist();
      k.error = null; k.step = 5;
    } catch (err) { k.error = "A telepítés nem sikerült: " + (err?.message || err); }
    ctx.render();
    return false;
  },
  skillZip(el) {
    const x = ui.skill.results[Number(el.dataset.i)];
    if (!x) return false;
    const blob = new Blob([S.zip(x.files, S.SKILL_NAME)], { type: "application/zip" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = x.folder.zip;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    x.status = `A(z) ${x.folder.zip} letöltődött (a böngésző Letöltések mappájába). Kövesd az alábbi kézi telepítést.`; x.ok = true;
    return true;
  },
  async skillWrite(el) {
    const x = ui.skill.results[Number(el.dataset.i)];
    if (!x) return false;
    try {
      const dir = await window.showDirectoryPicker({ id: "ots-skills", mode: "readwrite" });
      let backup = null;
      try { backup = ctx.store.folder?.ready ? await ctx.store.folder.subfolder("skill-mentesek") : null; } catch { backup = null; }
      const r = await S.writeToDirectory(dir, x.files, backup);
      x.status = `Kiírva a(z) „${dir.name}” mappába (ots-adminisztracio).${r.replaced ? (r.backedUp ? " A korábbi telepítésről másolat készült az adatmappa skill-mentesek almappájában." : " A korábbi telepítést felülírtuk (másolat nem készült, mert nincs adatmappa).") : ""} Ellenőrizd, hogy ez a ${esc(x.folder.path)} mappa volt-e.`; x.ok = true;
    } catch (err) {
      if (err && err.name === "AbortError") return true;
      x.status = "A böngésző nem engedte a mappába írást (a Chrome a rejtett és rendszermappákat sokszor tiltja). Használd a ZIP letöltését és a kézi telepítést."; x.ok = false;
    }
    ctx.render();
    return false;
  },
  async skillCopy(el) {
    try { await navigator.clipboard.writeText(el.dataset.text); } catch { /* nem baj */ }
    ui.skill.copied = el.dataset.key;
    setTimeout(() => { if (ui.skill) { ui.skill.copied = null; if (ui.modal === "skill") ctx.render(); } }, 2000);
    return true;
  },
  skillClose() { ui.modal = null; ui.skill = null; },
};

export const SKILL_STEP_COUNT = STEPS.length;
