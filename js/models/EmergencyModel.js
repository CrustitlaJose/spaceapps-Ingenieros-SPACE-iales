// AstroVital · EmergencyModel (Model layer): runs an emergency protocol and keeps the log of what was done.
// Each emergency is one document in the "events" collection, tied to one astronaut.
import { PROTOCOLS, PROTOCOL_BY_ZONE } from "../config/protocols.js";
import { ZONE_BY_ID } from "../config/zones.js";
import { tr, L } from "../config/i18n.js";

/** Protocol for a type ("storm", "heart", "oxygen", "temp") or for a red zone id. Returns { type, zone, name, goal, steps } with {es,en} texts. */
export function protocolFor(typeOrZone) {
  const type = PROTOCOLS[typeOrZone] ? typeOrZone : PROTOCOL_BY_ZONE[typeOrZone];
  if (type) return { type, ...PROTOCOLS[type] };
  const z = ZONE_BY_ID[typeOrZone];
  if (!z) return null;
  const es = z.act[2].es, en = z.act[2].en; // zones without a dedicated protocol: their red-level actions
  return { type: "zone-" + z.id, zone: z.id, icon: "!", name: z.n, goal: { es: "Seguir los pasos indicados para esta zona.", en: "Follow the steps for this zone." },
    steps: es.map((s, i) => ({ es: s, en: en[i] || s })) };
}

export class EmergencyModel {
  constructor(db) { this.db = db; this.active = null; }

  /** trigger: "auto" (red zone), "storm" (NOAA S3+), "manual" (red button), "drill". crew may be null (nothing is saved then). */
  start(typeOrZone, crew, trigger, extra = {}) {
    const p = protocolFor(typeOrZone);
    if (!p) return null;
    const now = new Date();
    this.active = {
      _id: `EMG-${crew ? crew._id : "X"}-${now.getTime()}`,
      crewId: crew ? crew._id : null, crewName: crew ? crew.name : null,
      type: p.type, zone: p.zone, trigger, drill: trigger === "drill", context: extra.context || null,
      startedAt: now.toISOString(), endedAt: null,
      steps: p.steps.map((s) => ({ es: s.es, en: s.en, breath: !!s.breath, doneAt: null })),
      protocol: p, index: 0,
    };
    return this.active;
  }

  get step() { return this.active ? this.active.steps[this.active.index] : null; }

  /** Marks the current step as done and moves on. Returns true when it was the last one. */
  done() {
    const a = this.active;
    if (!a) return true;
    a.steps[a.index].doneAt = new Date().toISOString();
    if (a.index >= a.steps.length - 1) return true;
    a.index++;
    return false;
  }

  back() { if (this.active && this.active.index > 0) this.active.index--; }

  /** Closes the emergency and saves the log (only with an astronaut). Returns the saved document. */
  async finish() {
    const a = this.active;
    if (!a) return null;
    a.endedAt = new Date().toISOString();
    const doc = { _id: a._id, crewId: a.crewId, crewName: a.crewName, type: a.type, zone: a.zone, trigger: a.trigger, drill: a.drill, context: a.context,
      name: a.protocol.name, startedAt: a.startedAt, endedAt: a.endedAt, steps: a.steps.map((s) => ({ es: s.es, en: s.en, doneAt: s.doneAt })) };
    if (doc.crewId) await this.db.put("events", doc);
    this.active = null;
    return doc;
  }

  cancel() { this.active = null; }

  /** Emergencies of one astronaut, newest first. */
  async list(crewId) {
    return (await this.db.find("events", { crewId })).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
}

const hm = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Text of one emergency for the report to Earth. */
export function emergencyText(doc) {
  const done = doc.steps.filter((s) => s.doneAt).length;
  const lines = [`${doc.drill ? L("SIMULACRO", "DRILL") : L("EMERGENCIA", "EMERGENCY")}: ${tr(doc.name)} · ${new Date(doc.startedAt).toLocaleDateString()} ${hm(doc.startedAt)}–${doc.endedAt ? hm(doc.endedAt) : "…"} · ${done}/${doc.steps.length} ${L("pasos hechos", "steps done")}`];
  if (doc.context) lines.push(`      ${doc.context}`);
  doc.steps.forEach((s, i) => lines.push(`      ${s.doneAt ? "[x]" : "[ ]"} ${i + 1}. ${tr(s)}${s.doneAt ? ` (${hm(s.doneAt)})` : ""}`));
  return lines.join("\n");
}
