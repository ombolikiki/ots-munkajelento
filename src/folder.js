// Adatmappa a számítógépen (File System Access API: Chrome, Edge). Ide íródik automatikusan a `bejegyzesek.csv`,
// a `letszamjelentesek.csv` és a `beallitasok.json` (a skill ebből tudja, hol vannak az adatok), a natív alkalmazáséval azonos formában.
// A mappa-kezelő a böngészős részeket (picker, IndexedDB) kívülről kapja, így a logika Node-ban, hamis mappával tesztelhető.

export const FILES = { entries: "bejegyzesek.csv", attendance: "letszamjelentesek.csv", pointer: "beallitasok.json" };

/** Mely mappákat nem engedi kiválasztani a Chrome (rendszermappák, a felhasználó könyvtára, AppData, Library). Tájékoztató szöveg a hibához. */
export const BLOCKED_HINT = "A Chrome nem enged rendszermappát (például az AppData-t vagy a Library-t), sem a felhasználói mappát magát kijelölni. Válassz egy almappát, például a Dokumentumok alatt egy „OTS Munkajelentő Tracker” mappát.";

export const folderSupported = (win = globalThis) => typeof win.showDirectoryPicker === "function";

/** IndexedDB-ben tárolja a mappa-azonosítót (a böngésző megjegyzi a kiválasztott mappát). */
export function idbHandleStore(idb = globalThis.indexedDB, dbName = "ots-web", store = "handles", key = "dataFolder") {
  const open = () => new Promise((resolve, reject) => {
    const req = idb.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => { db.close(); resolve(req.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  };
  return {
    get: () => run("readonly", (s) => s.get(key)),
    set: (h) => run("readwrite", (s) => s.put(h, key)),
    delete: () => run("readwrite", (s) => s.delete(key)),
  };
}

const errName = (e) => (e && e.name) || "";

export function createFolder({ handleStore, picker, supported = true } = {}) {
  let handle = null;
  const f = {
    /** unsupported | none | needs-permission | ready */
    status: supported ? "none" : "unsupported",
    get name() { return handle ? handle.name : ""; },
    get ready() { return f.status === "ready"; },

    /** Az előző munkamenet mappájának visszaállítása. */
    async init() {
      if (!supported) return f.status;
      try {
        handle = (await handleStore.get()) || null;
      } catch { handle = null; }
      if (!handle) { f.status = "none"; return f.status; }
      return f.refreshPermission();
    },

    async refreshPermission() {
      if (!handle) { f.status = supported ? "none" : "unsupported"; return f.status; }
      try {
        const p = await handle.queryPermission({ mode: "readwrite" });
        f.status = p === "granted" ? "ready" : "needs-permission";
      } catch { f.status = "needs-permission"; }
      return f.status;
    },

    /** Mappa kiválasztása (felhasználói kattintásból hívandó). Visszatér: {ok} vagy {ok:false, cancelled|error}. */
    async choose() {
      if (!supported) return { ok: false, error: "Ez a böngésző nem tud mappába írni. Használd a Chrome-ot vagy az Edge-et." };
      let h;
      try {
        h = await picker();
      } catch (e) {
        if (errName(e) === "AbortError") return { ok: false, cancelled: true };
        return { ok: false, error: BLOCKED_HINT };
      }
      handle = h;
      try { await handleStore.set(h); } catch { /* nem baj, csak a következő indításkor kell újra kiválasztani */ }
      f.status = "ready";
      return { ok: true };
    },

    /** A mappa elérésének újbóli engedélyezése (felhasználói kattintásból hívandó). */
    async grant() {
      if (!handle) return false;
      try {
        const p = await handle.requestPermission({ mode: "readwrite" });
        f.status = p === "granted" ? "ready" : "needs-permission";
      } catch { f.status = "needs-permission"; }
      return f.ready;
    },

    async forget() {
      handle = null;
      f.status = supported ? "none" : "unsupported";
      try { await handleStore.delete(); } catch { /* nem baj */ }
    },

    async exists(name) {
      if (!handle) return false;
      try { await handle.getFileHandle(name); return true; } catch { return false; }
    },

    /** {text, bytes, modified} vagy null, ha nincs ilyen fájl. */
    async read(name) {
      if (!handle) return null;
      let fh;
      try { fh = await handle.getFileHandle(name); } catch (e) { if (errName(e) === "NotFoundError") return null; throw e; }
      const file = await fh.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, modified: file.lastModified };
    },

    async modified(name) {
      if (!handle) return null;
      try { return (await (await handle.getFileHandle(name)).getFile()).lastModified; } catch { return null; }
    },

    /** Fájl írása (cserélő: a böngésző ideiglenes fájlba ír, és lezáráskor cseréli, így megszakadt írás nem rontja el a régit). Visszatér az új módosítási idővel. */
    async write(name, data) {
      if (!handle) throw new Error("Nincs kiválasztott adatmappa.");
      const fh = await handle.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      try { await w.write(data); } finally { await w.close(); }
      return (await fh.getFile()).lastModified;
    },

    /** Másolat készítése egy meglévő fájlról (ha az nincs, nem csinál semmit). */
    async copy(name, newName) {
      const cur = await f.read(name);
      if (!cur) return false;
      await f.write(newName, cur.bytes);
      return true;
    },

    /** Almappa létrehozása és megnyitása (skill telepítéséhez, mentésekhez); a mappa objektum a hívó dolga. */
    async subfolder(name) {
      if (!handle) throw new Error("Nincs kiválasztott adatmappa.");
      return handle.getDirectoryHandle(name, { create: true });
    },
  };
  return f;
}

/** A beallitasok.json tartalma (a skill ebből találja meg a fájlokat); `path`: a mappa teljes elérési útja (ha ismert). */
export function pointerJson(path, appName = "OTS Munkajelentő Tracker") {
  const p = String(path ?? "").trim().replace(/[\\/]+$/, "");
  const sep = p.includes("\\") && !p.includes("/") ? "\\" : "/";
  const obj = { formatVersion: 2, app: appName, source: "web", format: "csv", delimiter: ";" };
  if (p) { obj.dataFile = p + sep + FILES.entries; obj.attendanceFile = p + sep + FILES.attendance; }
  return JSON.stringify(obj, null, 2) + "\n";
}

export const stamp = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
};
