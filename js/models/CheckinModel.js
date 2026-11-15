// AstroVital · CheckinModel (Model layer).
// Daily check-ins: converts between the evaluator's flat record and the database document.

import { MISSIONS } from "../config/missions.js";

const pad = (n) => String(n).padStart(3, "0");

/** Flat record → database document (same shape as the documented `checkins` collection). */
export function toDoc(crewId, rec, mission) {
  return {
    _id: `${crewId}-${pad(rec.day)}`,
    crewId,
    day: rec.day,
    createdAt: new Date().toISOString(),
    source: "manual", // every check-up is captured by the crew
    vitals: { sys: rec.sys, dia: rec.dia, hr: rec.hr, glu: rec.glu, temp: rec.temp, spo2: rec.spo2 },
    sleep: rec.sleep,
    mood: rec.mood,
    exercise: rec.ex,
    symptoms: Object.keys(rec.sym || {}).filter((k) => rec.sym[k]),
    radiation: { dose: MISSIONS[mission].dose, storm: rec.storm || null }, // storm: NOAA reading at check-up time, or null
    sources: rec.sources || null,       // where each value came from: camera, sim, manual, self
    hrQuality: rec.hrQuality || null,   // camera pulse: { snr, quality }
    mind: {                             // reaction test and scales (null when not taken)
      moodVas: rec.moodVas ?? null, stressVas: rec.stressVas ?? null,
      pvt: rec.pvt || null, pss4: rec.pss4 || null,
    },
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
    storm: (doc.radiation && doc.radiation.storm) || null,
    createdAt: doc.createdAt || null,
    src: "user",
    sources: doc.sources || null,
    hrQuality: doc.hrQuality || null,
    moodVas: doc.mind ? doc.mind.moodVas : null,
    stressVas: doc.mind ? doc.mind.stressVas : null,
    pvt: doc.mind ? doc.mind.pvt : null,
    pss4: doc.mind ? doc.mind.pss4 : null,
    lvl: doc.assessment ? doc.assessment.overall : null,
    zonesLvl: doc.assessment ? doc.assessment.zones : null,
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

  async add(rec, mission, assessment) {
    const full = { ...rec, day: this.days.length ? this.last().day + 1 : 1 };
    const doc = toDoc(this.crewId, full, mission);
    if (assessment) doc.assessment = assessment;
    await this.db.put("checkins", doc);
    full.createdAt = doc.createdAt;
    this.days.push(full);
    return full;
  }

  async saveAssessment(day, assessment) {
    const doc = await this.db.get("checkins", `${this.crewId}-${pad(day)}`);
    if (doc) { doc.assessment = assessment; await this.db.put("checkins", doc); }
  }

  /** Deletes one check-up (check-ups are never edited, only deleted and repeated). */
  async remove(day) {
    await this.db.remove("checkins", `${this.crewId}-${pad(day)}`);
    this.days = this.days.filter((d) => d.day !== day);
  }

  /** Last real PSS-4 answer, to ask it only once a week. */
  lastPss() { return [...this.days].reverse().find((d) => d.pss4) || null; }

  setCrew(crewId) { this.crewId = crewId; this.days = []; }
  last() { return this.days[this.days.length - 1]; }
  /** Last n values of an indicator, skipping missing ones ("I don't know"). */
  series(key, n) { return this.days.slice(-n).map((d) => d[key]).filter((v) => v !== null && v !== undefined); }
}
