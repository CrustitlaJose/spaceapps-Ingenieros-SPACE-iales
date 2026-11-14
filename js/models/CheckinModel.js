// AstroVital · CheckinModel (Model layer).
// Daily check-ins: converts between the evaluator's flat record and the database document.

import { generateHistory } from "./SensorSimulator.js";
import { MISSIONS, SOLAR_EXTRA } from "../config/missions.js";

const pad = (n) => String(n).padStart(3, "0");

/** Flat record → database document (same shape as the documented `checkins` collection). */
export function toDoc(crewId, rec, mission) {
  return {
    _id: `${crewId}-${pad(rec.day)}`,
    crewId,
    day: rec.day,
    createdAt: new Date().toISOString(),
    source: rec.src === "user" ? "manual" : rec.src === "sensor" ? "sensor" : "sim",
    vitals: { sys: rec.sys, dia: rec.dia, hr: rec.hr, glu: rec.glu, temp: rec.temp, spo2: rec.spo2 },
    sleep: rec.sleep,
    mood: rec.mood,
    exercise: rec.ex,
    symptoms: Object.keys(rec.sym || {}).filter((k) => rec.sym[k]),
    radiation: { dose: MISSIONS[mission].dose + (rec.solar ? SOLAR_EXTRA : 0), solarEvent: !!rec.solar },
  };
}

/** Database document → flat record. */
export function fromDoc(doc) {
  return {
    day: doc.day,
    sys: doc.vitals.sys, dia: doc.vitals.dia, hr: doc.vitals.hr, glu: doc.vitals.glu,
    temp: doc.vitals.temp, spo2: doc.vitals.spo2,
    sleep: doc.sleep, mood: doc.mood, ex: doc.exercise,
    sym: Object.fromEntries((doc.symptoms || []).map((s) => [s, true])),
    solar: !!(doc.radiation && doc.radiation.solarEvent),
    src: doc.source === "manual" ? "user" : doc.source,
  };
}

export class CheckinModel {
  constructor(db, crewId) {
    this.db = db;
    this.crewId = crewId;
    this.days = [];
  }

  async load() {
    const docs = await this.db.find("checkins", { crewId: this.crewId });
    this.days = docs.sort((a, b) => a.day - b.day).map(fromDoc);
    return this.days;
  }

  /** Replaces the history with a demo scenario (30 simulated days). */
  async seed(scenario, mission) {
    await this.db.removeWhere("checkins", { crewId: this.crewId });
    const recs = generateHistory(scenario);
    await this.db.putMany("checkins", recs.map((r) => toDoc(this.crewId, r, mission)));
    this.days = recs;
    return this.days;
  }

  async add(rec, mission, assessment) {
    const full = { ...rec, day: this.last().day + 1 };
    const doc = toDoc(this.crewId, full, mission);
    if (assessment) doc.assessment = assessment;
    await this.db.put("checkins", doc);
    this.days.push(full);
    return full;
  }

  async saveAssessment(day, assessment) {
    const doc = await this.db.get("checkins", `${this.crewId}-${pad(day)}`);
    if (doc) { doc.assessment = assessment; await this.db.put("checkins", doc); }
  }

  last() { return this.days[this.days.length - 1]; }
  series(key, n) { return this.days.slice(-n).map((d) => d[key]); }
}
