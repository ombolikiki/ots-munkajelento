// Az „OTS Adminisztráció” skill telepítéséhez: a sablon kitöltése (a natív app SkillInstaller logikája), ZIP-készítés és a célmappák.
// A böngésző a skill-mappákba (~/.claude/skills, ~/.agents/skills) nem tud közvetlenül írni, ezért a csomagot ZIP-ként adjuk,
// és (ahol a böngésző engedi) egy kiválasztott skill-mappába is ki lehet írni.

export const SKILL_NAME = "ots-adminisztracio";
export const SKILL_TITLE = "OTS Adminisztráció";
export const MARKER_NAME = ".ots-tracker-install.json";

export const SITES = {
  det: { id: "det", title: "DETKapu", url: "https://ots.detkapu.hu/" },
  tet: { id: "tet", title: "TETKapu", url: "https://ots.tetkapu.hu/" },
};

export const TARGETS = {
  claude: {
    id: "claude", title: "Claude", free: false,
    detail: "A Claude asztali alkalmazás Code lapja. Kipróbálva. Fizetős Claude-előfizetés kell hozzá.",
    win: "%USERPROFILE%\\.claude\\skills", mac: "~/.claude/skills", start: "/ots-adminisztracio",
  },
  codex: {
    id: "codex", title: "ChatGPT desktop / Codex", free: true,
    detail: "ChatGPT Codex (a ChatGPT asztali alkalmazás és a Codex ugyanazt a mappát használja). Ingyenesen használható. Kipróbálva: látja és olvassa az OTS-t, és kattint rajta.",
    win: "%USERPROFILE%\\.agents\\skills", mac: "~/.agents/skills", start: "$ots-adminisztracio  (a ChatGPT-ben @ jellel is kiválasztható)",
  },
  antigravity: {
    id: "antigravity", title: "Antigravity CLI (agy)", free: true,
    detail: "A Google parancssori asszisztense (a Gemini CLI utódja): személyes Google-fiókkal, előfizetés nélkül használható, heti kerettel. Kipróbálva: látja és olvassa az OTS-t, és kattint rajta.",
    win: "%USERPROFILE%\\.agents\\skills", mac: "~/.agents/skills", start: "agy  (a Terminálban), majd /browser, és kérd: „Használd az ots-adminisztracio skillt”",
  },
};
export const AGY_INSTALL = { windows: "irm https://antigravity.google/cli/install.ps1 | iex", mac: "curl -fsSL https://antigravity.google/cli/install.sh | bash" };

export const TASK_SUMMARY = {
  havi: "Napi bontású munkajelentő az alkalmazás naplójából.",
  koltseg: "Havi útiköltség az Utazás bejegyzések útvonalaiból (Google Maps).",
  nevsor: "Negyedéves névsor lezárása gyülekezetenként.",
  hittan: "Félévente a hitoktatás lezárása gyülekezetenként.",
  latogatottsag: "Létszámjelentő kitöltése a rögzített létszámokból.",
};

export const CLAUDE_BROWSER = "Böngészőként a beépített Claude böngészőpanelt használd (`mcp__Claude_Browser__*`).";
export const GENERIC_BROWSER = "Böngészőként a környezetedben elérhető böngésző- vagy számítógép-vezérlő eszközt használd, a felhasználó bejelentkezett munkamenetével. Ha nincs ilyen eszköz, szólj a felhasználónak, és ne dolgozz a felület nélkül.";

export const TASK_ORDER_DEFAULT = ["havi", "koltseg", "nevsor", "hittan", "latogatottsag"];

/** Az adatforrás-leírást használó feladatok. */
const TRACKER_TASKS = ["havi", "koltseg", "latogatottsag"];

// ---------- Sablon kitöltése ----------

/** A sablon szövegének kitöltése: feladat-jelölők, közös szakasz, feltételes részek és helyőrzők. */
export function render(text, { tasks, values, browser }) {
  let t = String(text);
  // 1) feladat-jelölők: a nem választott feladat sorai törlődnek, a többiből a jelölő
  const lines = [];
  for (const line of t.split("\n")) {
    const m = /\[\[TASK:([a-z]+)\]\]/.exec(line);
    if (m) {
      if (!tasks.includes(m[1])) continue;
      lines.push(line.replace(`[[TASK:${m[1]}]]`, "").replace("[[/TASK]]", ""));
    } else lines.push(line);
  }
  t = lines.join("\n");
  // 2) közös (tracker-adat) szakasz: csak ha olyan feladat is van, ami használja
  if (tasks.some((x) => TRACKER_TASKS.includes(x))) t = t.replace("[[SHARED:tracker]]", "").replace("[[/SHARED]]", "");
  else t = t.replace(/\[\[SHARED:tracker\]\][\s\S]*?\[\[\/SHARED\]\]\n*/g, "");
  // 3) feltételes részek: {{#NÉV}}…{{/NÉV}} csak ha az adat meg van adva
  t = t.replace(/\{\{#([A-Z_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, body) => (values[key] ? body : ""));
  // 4) helyőrzők
  for (const [k, v] of Object.entries(values)) t = t.split(`{{${k}}}`).join(v);
  return t.split("{{BONGESZO}}").join(browser);
}

export const PLACEHOLDER_LEFT = /\{\{[#/]?[A-Z_]+\}\}|\[\[\/?(TASK|SHARED)/;

/** Mely fájlok kerülnek a telepítésbe: a SKILL.md, a kijelölt feladatok fájljai és azok közös fájljai. */
export function includedPaths(taskInfos, selected) {
  const p = new Set(["SKILL.md"]);
  for (const t of taskInfos) if (selected.includes(t.id)) { t.files.forEach((f) => p.add(f)); t.shared.forEach((f) => p.add(f)); }
  return p;
}

export const neededFields = (taskInfos, selected) => new Set(taskInfos.filter((t) => selected.includes(t.id)).flatMap((t) => t.needs));

export const parseCongregations = (text) => {
  const seen = new Set();
  return String(text ?? "").split(",").map((s) => s.trim()).filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
};

/** A felhasználó által megadott mappa-útvonal + fájlnév, az útvonal elválasztójával. */
export function joinPath(dir, name) {
  const d = String(dir ?? "").trim().replace(/[\\/]+$/, "");
  const sep = d.includes("\\") && !d.includes("/") ? "\\" : "/";
  return d + sep + name;
}

/** Az adatforrás-leírás igazítása a webalkalmazáshoz: a natív app (Mac) útvonala helyett a felhasználó adatmappája. */
export function adaptTracker(text, dataPath) {
  const dir = String(dataPath ?? "").trim();
  const mac = "~/Library/Application Support/OTS Munkajelentő Tracker/";
  let t = String(text);
  t = t.split("nevű menüsori alkalmazásának").join("nevű alkalmazásának");
  t = t.split("A felhasználó menüsori appja (Mac) rögzíti").join("A felhasználó OTS Munkajelentő alkalmazása (böngészős webalkalmazás vagy Mac-alkalmazás) rögzíti");
  if (dir) {
    t = t.split("`" + mac + "beallitasok.json`").join("`" + joinPath(dir, "beallitasok.json") + "`");
    t = t.split("`" + mac + "bejegyzesek.csv`").join("`" + joinPath(dir, "bejegyzesek.csv") + "`");
  } else {
    t = t.split("`" + mac + "beallitasok.json`").join("a felhasználó adatmappájában lévő `beallitasok.json`");
    t = t.split("`" + mac + "bejegyzesek.csv`").join("az adatmappában lévő `bejegyzesek.csv`");
  }
  return t;
}

export function effectiveValues({ userName, home, congregations, site }, needs) {
  const s = SITES[site] || SITES.det;
  return {
    FELHASZNALO_NEVE: String(userName ?? "").trim(),
    SZEKHELY: needs.has("home") ? String(home ?? "").trim() : "",
    GYULEKEZETEK: needs.has("congregations") ? parseCongregations(congregations).join(", ") : "",
    OTS_URL: s.url, OTS_NEV: s.title,
  };
}

/** Az adatok ellenőrzése a „Adataid” lépésben; hibaszöveg vagy null. */
export function detailsError({ userName, home, congregations, dataPath }, taskInfos, selected) {
  const needs = neededFields(taskInfos, selected);
  if (!String(userName ?? "").trim()) return "Add meg a neved.";
  if (needs.has("home") && !String(home ?? "").trim()) return "Add meg a székhelyed (ahonnan az útvonalak indulnak).";
  if (needs.has("congregations") && !parseCongregations(congregations).length) return "Add meg legalább egy gyülekezetet.";
  if (selected.some((x) => TRACKER_TASKS.includes(x)) && !String(dataPath ?? "").trim()) return "Add meg az adatmappa teljes elérési útját (a skill ebből találja meg a bejegyzéseidet).";
  for (const v of [userName, home, congregations, dataPath]) {
    if (/\{\{|\}\}|\[\[|\]\]/.test(String(v ?? ""))) return "A mezők nem tartalmazhatnak kapcsos vagy szögletes zárójel-párt.";
  }
  return null;
}

/** A tényleges célmappák: a Codex és az Antigravity CLI közös ~/.agents/skills mappát használ, oda egyszer másolunk. */
export function effectiveFolders(selected, os = "windows") {
  const out = [];
  const path = (id) => (os === "mac" ? TARGETS[id].mac : TARGETS[id].win);
  if (selected.includes("claude")) out.push({ flavor: "claude", targets: ["claude"], path: path("claude"), zip: `${SKILL_NAME}-claude.zip` });
  const shared = ["codex", "antigravity"].filter((t) => selected.includes(t));
  if (shared.length) out.push({ flavor: "generic", targets: shared, path: path("codex"), zip: `${SKILL_NAME}-codex-agy.zip` });
  return out;
}

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A csomagolt sablon azonosítója (a fájlok útvonalából és szövegéből). */
export async function bundleFingerprint(files) {
  const names = Object.keys(files).sort();
  return (await sha256Hex(names.map((n) => n + files[n]).join("\u0000"))).slice(0, 8);
}

/**
 * A telepítendő fájlok (útvonal, szöveg) egy célmappához. bundle: {tasks:[…], files:{útvonal: szöveg}}.
 * Visszatér {files:[{path,text}]} vagy kivételt dob, ha kitöltetlen helyőrző maradt.
 */
export async function buildFiles(bundle, sel, flavor, { version = "web", now = new Date() } = {}) {
  const needs = neededFields(bundle.tasks, sel.tasks);
  const values = effectiveValues(sel, needs);
  const browser = flavor === "claude" ? CLAUDE_BROWSER : GENERIC_BROWSER;
  const include = includedPaths(bundle.tasks, sel.tasks);
  const files = [];
  for (const path of Object.keys(bundle.files).sort()) {
    if (!include.has(path)) continue;
    let text = render(bundle.files[path], { tasks: sel.tasks, values, browser });
    if (path === "references/tracker-adatforras.md") text = adaptTracker(text, sel.dataPath);
    if (PLACEHOLDER_LEFT.test(text)) throw new Error(`Kitöltetlen helyőrző vagy jelölő maradt a(z) ${path} fájlban.`);
    files.push({ path, text });
  }
  const skillMd = files.find((f) => f.path === "SKILL.md");
  if (!skillMd || !skillMd.text.startsWith("---") || !skillMd.text.includes(`name: ${SKILL_NAME}`)) throw new Error("A SKILL.md fejléce érvénytelen.");
  const marker = {
    installedBy: "OTS Munkajelentő (webalkalmazás)", appVersion: version, fingerprint: await bundleFingerprint(bundle.files),
    date: now.toISOString(), targets: flavor === "claude" ? ["claude"] : ["codex", "antigravity"], tasks: [...sel.tasks].sort(), values,
  };
  files.push({ path: MARKER_NAME, text: JSON.stringify(marker, null, 2) + "\n" });
  return files;
}

// ---------- ZIP (tömörítés nélküli, függőség nélkül) ----------

let crcTable = null;
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** ZIP-fájl: files = [{path, text|bytes}], a mappanevet a `root` adja (pl. „ots-adminisztracio”). */
export function zip(files, root = "", now = new Date()) {
  const enc = new TextEncoder();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = (Math.max(0, now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (v) => [v & 0xFF, (v >>> 8) & 0xFF];
  const u32 = (v) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  for (const f of files) {
    const name = enc.encode((root ? root.replace(/\/+$/, "") + "/" : "") + f.path);
    const data = f.bytes ?? enc.encode(f.text);
    const crc = crc32(data);
    const header = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0),
    ]);
    chunks.push(header, name, data);
    central.push(new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dosTime), ...u16(dosDate),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), name);
    offset += header.length + name.length + data.length;
  }
  const centralSize = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

/** Fájlok kiírása egy kiválasztott skill-mappába (File System Access): a meglévő telepítésről előbb másolat készül a mentések mappába. */
export async function writeToDirectory(skillsDir, files, backupDir = null) {
  let existing = null;
  try { existing = await skillsDir.getDirectoryHandle(SKILL_NAME); } catch { existing = null; }
  let backedUp = false;
  if (existing && backupDir) {
    const dest = await backupDir.getDirectoryHandle(`${SKILL_NAME}-${Date.now()}`, { create: true });
    await copyTree(existing, dest);
    backedUp = true;
  }
  const target = await skillsDir.getDirectoryHandle(SKILL_NAME, { create: true });
  for (const f of files) {
    const parts = f.path.split("/");
    let dir = target;
    for (const seg of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(seg, { create: true });
    const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const w = await fh.createWritable();
    try { await w.write(f.bytes ?? new TextEncoder().encode(f.text)); } finally { await w.close(); }
  }
  return { backedUp, replaced: !!existing };
}

async function copyTree(src, dest) {
  for await (const [name, h] of src.entries()) {
    if (h.kind === "directory") await copyTree(h, await dest.getDirectoryHandle(name, { create: true }));
    else {
      const file = await h.getFile();
      const fh = await dest.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      try { await w.write(new Uint8Array(await file.arrayBuffer())); } finally { await w.close(); }
    }
  }
}
