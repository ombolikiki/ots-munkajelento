import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as S from "../src/skill.js";

const bundle = JSON.parse(readFileSync(new URL("../skill/bundle.json", import.meta.url), "utf8"));
const sel = (o = {}) => ({ userName: "Kovács János", home: "Székesfehérvár", congregations: "Mór, Bicske", site: "det", dataPath: "C:\\Users\\Kovács János\\Documents\\OTS Munkajelentő Tracker", tasks: ["havi", "koltseg", "nevsor", "hittan", "latogatottsag"], ...o });

test("a csomagolt sablon megvan, és személyes adat nélküli", () => {
  assert.ok(bundle.files["SKILL.md"].includes("name: ots-adminisztracio"));
  assert.equal(bundle.tasks.length, 5);
  for (const t of bundle.tasks) for (const f of [...t.files, ...t.shared]) assert.ok(bundle.files[f], f);
  const all = Object.values(bundle.files).join("\n");
  for (const bad of ["Ömböli", "Krisztián", "Győr", "Tatabánya", "Toggl", "detkapu-adminisztracio"]) assert.equal(all.includes(bad), false, bad);
  const template = new URL("../skill-template/ots-adminisztracio/SKILL.md", import.meta.url);
  if (existsSync(template)) assert.equal(readFileSync(template, "utf8"), bundle.files["SKILL.md"], "a webes csomag elavult: futtasd a scripts/sync-web-skill.py-t");
});

test("sablon kitöltése: feladat-jelölők, közös szakasz, feltételes rész, helyőrzők", () => {
  const tpl = "A {{OTS_NEV}} ({{OTS_URL}}) {{FELHASZNALO_NEVE}}\n[[TASK:havi]]havi sor[[/TASK]]\n[[TASK:nevsor]]névsor sor[[/TASK]]\n[[SHARED:tracker]]közös[[/SHARED]]\n{{#SZEKHELY}}székhely: {{SZEKHELY}}{{/SZEKHELY}}\n{{BONGESZO}}";
  const vals = { FELHASZNALO_NEVE: "Anna", SZEKHELY: "", OTS_URL: "https://x/", OTS_NEV: "DETKapu" };
  const out = S.render(tpl, { tasks: ["havi"], values: vals, browser: "böngésző" });
  assert.equal(out, "A DETKapu (https://x/) Anna\nhavi sor\nközös\n\nböngésző");
  const noTracker = S.render(tpl, { tasks: ["nevsor"], values: { ...vals, SZEKHELY: "Mór" }, browser: "b" });
  assert.equal(noTracker, "A DETKapu (https://x/) Anna\nnévsor sor\nszékhely: Mór\nb");
  assert.equal(S.PLACEHOLDER_LEFT.test(out), false);
});

test("mind az öt feladattal és a feladatok kombinációival hibátlan a kitöltés; nincs megmaradt jelölő, Mac-útvonal vagy személyes adat", async () => {
  const combos = [sel().tasks, ["havi"], ["koltseg"], ["nevsor", "hittan"], ["latogatottsag", "havi"], ["hittan"]];
  for (const tasks of combos) for (const flavor of ["claude", "generic"]) {
    const files = await S.buildFiles(bundle, sel({ tasks }), flavor);
    const text = files.map((f) => f.text).join("\n");
    assert.equal(S.PLACEHOLDER_LEFT.test(text), false, tasks.join());
    assert.equal(/Library\/Application Support|~\/Library/.test(text), false, "Mac-útvonal maradt: " + tasks.join());
    assert.ok(files.some((f) => f.path === "SKILL.md")); assert.ok(files.some((f) => f.path === S.MARKER_NAME));
    assert.ok(text.includes("https://ots.detkapu.hu/"));
    assert.equal(text.includes("mcp__Claude_Browser__"), flavor === "claude");
    const uses = tasks.some((t) => ["havi", "koltseg", "latogatottsag"].includes(t));
    assert.equal(files.some((f) => f.path === "references/tracker-adatforras.md"), uses);
    if (uses) assert.ok(text.includes("C:\\Users\\Kovács János\\Documents\\OTS Munkajelentő Tracker\\beallitasok.json"));
    const present = files.filter((f) => f.path.startsWith("references/")).map((f) => f.path).sort();
    const expected = new Set(bundle.tasks.filter((t) => tasks.includes(t.id)).flatMap((t) => [...t.files, ...t.shared]));
    assert.deepEqual(present, [...expected].sort());
  }
});

test("TETKapu és a névhelyőrzők; a jelölőfájl tartalma", async () => {
  const files = await S.buildFiles(bundle, sel({ site: "tet", userName: "Nagy Éva" }), "generic", { version: "9.9", now: new Date("2026-10-05T10:00:00Z") });
  const all = files.map((f) => f.text).join("\n");
  assert.ok(all.includes("https://ots.tetkapu.hu/") && all.includes("TETKapu")); assert.equal(all.includes("ots.detkapu.hu"), false);
  const marker = JSON.parse(files.find((f) => f.path === S.MARKER_NAME).text);
  assert.equal(marker.appVersion, "9.9"); assert.match(marker.fingerprint, /^[0-9a-f]{8}$/); assert.deepEqual(marker.targets, ["codex", "antigravity"]);
  assert.equal(marker.values.FELHASZNALO_NEVE, "Nagy Éva"); assert.equal(marker.values.OTS_NEV, "TETKapu");
});

test("a Mac-útvonal átírása az adatmappára (Windows és Mac elválasztó), és ha nincs megadva", () => {
  const src = "1. Olvasd be a `~/Library/Application Support/OTS Munkajelentő Tracker/beallitasok.json` fájlt.\n2. Alapértelmezett: `~/Library/Application Support/OTS Munkajelentő Tracker/bejegyzesek.csv`.\nA felhasználó menüsori appja (Mac) rögzíti az időt.";
  const w = S.adaptTracker(src, "D:\\Munka\\OTS\\");
  assert.ok(w.includes("`D:\\Munka\\OTS\\beallitasok.json`") && w.includes("`D:\\Munka\\OTS\\bejegyzesek.csv`")); assert.equal(w.includes("Library"), false);
  assert.ok(!w.includes("menüsori appja (Mac)"));
  assert.ok(S.adaptTracker(src, "/Users/anna/OTS").includes("`/Users/anna/OTS/beallitasok.json`"));
  assert.equal(S.adaptTracker(src, "").includes("Library"), false);
  assert.equal(S.joinPath("C:\\A\\", "x.csv"), "C:\\A\\x.csv"); assert.equal(S.joinPath("/a/b/", "x.csv"), "/a/b/x.csv");
});

test("az adatok ellenőrzése", () => {
  const tasks = bundle.tasks;
  assert.match(S.detailsError(sel({ userName: " " }), tasks, ["havi"]), /neved/);
  assert.match(S.detailsError(sel({ home: "" }), tasks, ["koltseg"]), /székhely/);
  assert.equal(S.detailsError(sel({ home: "" }), tasks, ["havi"]), null);   // a Havi munkajelentőhöz nem kell székhely
  assert.match(S.detailsError(sel({ congregations: " , " }), tasks, ["nevsor"]), /gyülekezet/);
  assert.match(S.detailsError(sel({ dataPath: "" }), tasks, ["havi"]), /adatmappa/);
  assert.equal(S.detailsError(sel({ dataPath: "" }), tasks, ["nevsor"]), null);   // a névsorhoz nem kell adatmappa
  assert.match(S.detailsError(sel({ userName: "{{OTS_URL}}" }), tasks, ["havi"]), /zárójel/);
  assert.equal(S.detailsError(sel(), tasks, ["havi", "koltseg", "latogatottsag"]), null);
});

test("célmappák: a Codex és az Antigravity CLI közös mappába kerül, egyszer", () => {
  assert.deepEqual(S.effectiveFolders(["claude", "codex", "antigravity"], "windows").map((f) => [f.flavor, f.path, f.targets]),
    [["claude", "%USERPROFILE%\\.claude\\skills", ["claude"]], ["generic", "%USERPROFILE%\\.agents\\skills", ["codex", "antigravity"]]]);
  assert.deepEqual(S.effectiveFolders(["antigravity"], "mac").map((f) => f.path), ["~/.agents/skills"]);
  assert.deepEqual(S.effectiveFolders([], "windows"), []);
  assert.equal(S.TARGETS.codex.free && S.TARGETS.antigravity.free && !S.TARGETS.claude.free, true);
});

test("CRC32 és érvényes ZIP (a rendszer ZIP-olvasójával ellenőrizve), ékezetes fájlnevek és tartalom", async () => {
  assert.equal(S.crc32(new TextEncoder().encode("123456789")), 0xCBF43926);
  const files = await S.buildFiles(bundle, sel(), "claude");
  const bytes = S.zip(files, S.SKILL_NAME, new Date(2026, 9, 5, 12, 0, 0));
  const dir = mkdtempSync(join(tmpdir(), "ots-zip-"));
  const path = join(dir, "t.zip"); writeFileSync(path, bytes);
  const py = spawnSync("python3", ["-c", "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint('\\n'.join(sorted(z.namelist())))\nprint(z.read('ots-adminisztracio/SKILL.md').decode('utf-8')[:30])", path], { encoding: "utf8" });
  if (py.error) return;   // nincs python3: csak a CRC-ellenőrzés
  assert.equal(py.status, 0, py.stderr);
  const names = py.stdout.split("\n");
  assert.ok(names.includes("ots-adminisztracio/SKILL.md")); assert.ok(names.includes("ots-adminisztracio/" + S.MARKER_NAME));
  assert.ok(names.includes("ots-adminisztracio/references/havi-munkajelento.md"));
  assert.ok(py.stdout.includes("---\nname: ots-adminisztracio"));
});

test("kiírás kiválasztott mappába: meglévő telepítésről előbb másolat készül", async () => {
  const mk = () => { const files = new Map(); const dirs = new Map();
    const d = { files, dirs, kind: "directory",
      async getDirectoryHandle(n, { create } = {}) { if (!dirs.has(n)) { if (!create) throw Object.assign(new Error("x"), { name: "NotFoundError" }); dirs.set(n, mk()); } return dirs.get(n); },
      async getFileHandle(n, { create } = {}) { if (!files.has(n)) { if (!create) throw new Error("x"); files.set(n, new Uint8Array()); }
        return { kind: "file", async getFile() { const b = files.get(n); return { async arrayBuffer() { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }; },
          async createWritable() { let buf; return { async write(x) { buf = new Uint8Array(x); }, async close() { files.set(n, buf); } }; } }; },
      async *entries() { for (const [n, h] of dirs) yield [n, h]; for (const n of files.keys()) yield [n, { kind: "file", async getFile() { const b = files.get(n); return { async arrayBuffer() { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } }; } }]; } };
    return d; };
  const skills = mk(), backups = mk();
  const files = await S.buildFiles(bundle, sel(), "claude");
  const r1 = await S.writeToDirectory(skills, files, backups);
  assert.deepEqual(r1, { backedUp: false, replaced: false });
  assert.ok(skills.dirs.get("ots-adminisztracio").files.has("SKILL.md")); assert.ok(skills.dirs.get("ots-adminisztracio").dirs.get("references").files.has("havi-munkajelento.md"));
  const r2 = await S.writeToDirectory(skills, files, backups);
  assert.deepEqual(r2, { backedUp: true, replaced: true });
  assert.equal(backups.dirs.size, 1);
  const [name] = [...backups.dirs.keys()]; assert.match(name, /^ots-adminisztracio-\d+$/); assert.ok(backups.dirs.get(name).files.has("SKILL.md")); assert.ok(backups.dirs.get(name).dirs.get("references").files.size > 0);
});
