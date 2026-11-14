// AstroVital · Database (Model layer).
// On-board database in IndexedDB: works offline and without a server.
// Documents use the same JSON shape a MongoDB server would (v3), so only this file changes to migrate.
// If IndexedDB is unavailable (private window, blocked storage) it falls back to memory.

const DB_NAME = "astrovital";
const DB_VERSION = 1;
const STORES = {
  crew: { keyPath: "_id", indexes: [] },
  checkins: { keyPath: "_id", indexes: ["crewId", "day"] },
  messages: { keyPath: "_id", indexes: ["direction", "status"] },
  missions: { keyPath: "_id", indexes: ["crewId"] },
};

export class Database {
  constructor() {
    this.db = null;
    this.memory = null; // fallback: { store: Map }
  }

  async open() {
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const [name, def] of Object.entries(STORES)) {
            if (db.objectStoreNames.contains(name)) continue;
            const os = db.createObjectStore(name, { keyPath: def.keyPath });
            def.indexes.forEach((ix) => os.createIndex(ix, ix));
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("blocked"));
      });
    } catch (e) {
      this.memory = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map()]));
    }
    return this;
  }

  get isPersistent() { return !!this.db; }

  _tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const os = tx.objectStore(store);
      let result;
      Promise.resolve(fn(os)).then((r) => { result = r; });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  }

  _req(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(store, doc) {
    if (this.memory) { this.memory[store].set(doc._id, structuredClone(doc)); return doc; }
    await this._tx(store, "readwrite", (os) => os.put(doc));
    return doc;
  }

  async putMany(store, docs) {
    if (this.memory) { docs.forEach((d) => this.memory[store].set(d._id, structuredClone(d))); return; }
    await this._tx(store, "readwrite", (os) => { docs.forEach((d) => os.put(d)); });
  }

  async get(store, id) {
    if (this.memory) return structuredClone(this.memory[store].get(id) ?? null);
    const tx = this.db.transaction(store, "readonly");
    return (await this._req(tx.objectStore(store).get(id))) ?? null;
  }

  async all(store) {
    if (this.memory) return [...this.memory[store].values()].map((d) => structuredClone(d));
    const tx = this.db.transaction(store, "readonly");
    return this._req(tx.objectStore(store).getAll());
  }

  /** Simple "find" in MongoDB style: find("checkins", { crewId: "CDR-1" }). */
  async find(store, query = {}) {
    const docs = await this.all(store);
    return docs.filter((d) => Object.entries(query).every(([k, v]) => d[k] === v));
  }

  async remove(store, id) {
    if (this.memory) { this.memory[store].delete(id); return; }
    await this._tx(store, "readwrite", (os) => os.delete(id));
  }

  async removeWhere(store, query) {
    const docs = await this.find(store, query);
    if (this.memory) { docs.forEach((d) => this.memory[store].delete(d._id)); return; }
    await this._tx(store, "readwrite", (os) => { docs.forEach((d) => os.delete(d._id)); });
  }

  async clear(store) {
    if (this.memory) { this.memory[store].clear(); return; }
    await this._tx(store, "readwrite", (os) => os.clear());
  }
}
