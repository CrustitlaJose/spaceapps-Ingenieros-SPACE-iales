// AstroVital · CrewModel (Model layer): astronauts registered on board (collection `crew`).
import { ROLES, PROFILE_LIMITS } from "../config/crew.js";

const ACTIVE_KEY = "astrovital-active-crew";

export class CrewModel {
  constructor(db) {
    this.db = db;
    this.list = [];
    this.activeId = null;
  }

  async load() {
    this.list = (await this.db.all("crew")).sort((a, b) => a._id.localeCompare(b._id, undefined, { numeric: true }));
    // No example astronaut: the crew starts empty and the team adds itself.
    let saved = null;
    try { saved = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
    this.activeId = this.list.some((c) => c._id === saved) ? saved : (this.list[0] ? this.list[0]._id : null);
    return this.list;
  }

  active() { return this.list.find((c) => c._id === this.activeId); }

  setActive(id) {
    this.activeId = id;
    try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
  }

  /** Next free code for a role: CDR-1, CMO-2, MS-3… (number = position in the crew). */
  nextCode(role) {
    const used = new Set(this.list.map((c) => c._id));
    let n = this.list.length + 1;
    while (used.has(`${ROLES[role].code}-${n}`)) n++;
    return `${ROLES[role].code}-${n}`;
  }

  /** Accepts height in meters (1.72) or centimeters (172): anything under 3 is taken as meters. */
  static normalize(p) {
    const out = { ...p };
    if (out.height != null && !Number.isNaN(out.height) && out.height > 0 && out.height < 3) out.height = Math.round(out.height * 100);
    return out;
  }

  /** Validates a profile. Returns an error key or null. */
  validate(p) {
    p = CrewModel.normalize(p);
    if (!p.name || !p.name.trim()) return "crewNeedName";
    for (const [k, [lo, hi]] of Object.entries(PROFILE_LIMITS)) {
      const v = p[k];
      if (v !== null && v !== undefined && v !== "" && (Number.isNaN(v) || v < lo || v > hi)) return "crewBadNumber";
    }
    return null;
  }

  async save(profile) {
    const doc = { ...CrewModel.normalize(profile), name: profile.name.trim() };
    if (!doc._id) { doc._id = this.nextCode(doc.role); doc.createdAt = new Date().toISOString(); }
    await this.db.put("crew", doc);
    await this.load();
    return doc;
  }

  /** Deletes the astronaut and their check-ins and missions. */
  async remove(id) {
    await this.db.remove("crew", id);
    await this.db.removeWhere("checkins", { crewId: id });
    await this.db.removeWhere("events", { crewId: id });
    await this.db.removeWhere("messages", { crewId: id });
    await this.load();
    if (this.activeId === id || !this.list.some((c) => c._id === this.activeId)) this.setActive(this.list[0] ? this.list[0]._id : null);
  }

  static bmi(c) {
    if (!c.weight || !c.height) return null;
    return c.weight / Math.pow(c.height / 100, 2);
  }
}
