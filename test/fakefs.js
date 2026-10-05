// Hamis mappa a File System Access API megfelelőjéhez (csak a tesztekhez).
export function fakeDir(name = "OTS") {
  const files = new Map();   // név -> {bytes, mtime}
  let clock = 1000;
  const failWrites = { on: false };
  const handle = {
    kind: "directory", name, files, failWrites, permission: "granted",
    async queryPermission() { return handle.permission; },
    async requestPermission() { handle.permission = "granted"; return "granted"; },
    async getFileHandle(n, { create = false } = {}) {
      if (!files.has(n)) {
        if (!create) { const e = new Error("nincs"); e.name = "NotFoundError"; throw e; }
        files.set(n, { bytes: new Uint8Array(), mtime: ++clock });
      }
      return {
        kind: "file", name: n,
        async getFile() { const f = files.get(n); return { lastModified: f.mtime, async arrayBuffer() { return f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength); } }; },
        async createWritable() {
          let buf = null;
          return { async write(d) { if (failWrites.on) throw new Error("lemez tele"); buf = typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d); }, async close() { if (buf) files.set(n, { bytes: buf, mtime: ++clock }); } };
        },
      };
    },
    text: (n) => (files.has(n) ? new TextDecoder().decode(files.get(n).bytes) : null),
    put(n, text) { files.set(n, { bytes: typeof text === "string" ? new TextEncoder().encode(text) : text, mtime: ++clock }); },
  };
  return handle;
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), map: m };
}

export function memoryHandleStore(initial = null) {
  let h = initial;
  return { get: async () => h, set: async (x) => { h = x; }, delete: async () => { h = null; }, peek: () => h };
}
