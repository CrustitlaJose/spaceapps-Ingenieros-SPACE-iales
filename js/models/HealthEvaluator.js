// AstroVital · HealthEvaluator (Model layer).
// Decides the traffic-light level of each body zone from the latest values, 7–14 day trends and symptoms.

import { INDICATORS, TRENDS, levelOf } from "../config/ranges.js";
import { ZONES, ZONE_BY_ID, PRIORITY } from "../config/zones.js";
import { tr, L } from "../config/i18n.js";
import { radiationStatus } from "./RadiationModel.js";
import { S_NAMES } from "./SpaceWeather.js";
import { fmt, unit, sgn } from "../utils/format.js";

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const MIN_AVG = 3;   // real days needed before a multi-day average is reported
const MIN_TREND = 7; // real days needed before a rising trend is reported

/** Least-squares slope per day. */
export function slope(a) {
  const n = a.length;
  if (n < 3) return 0;
  const xm = (n - 1) / 2, ym = avg(a);
  let num = 0, den = 0;
  a.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) * (i - xm); });
  return num / den;
}

/**
 * Evaluates one zone. `checkins` is a CheckinModel (days + series()). storm: live NOAA reading { scale, flux, at } or null.
 * Returns { lvl, findings: [{ l, txt, trend, range }], vals: [{ k, v, l }] }. range = "value out of range" (already shown as a value card).
 */
export function evaluateZone(z, checkins, mission, storm = null) {
  const d = checkins.last();
  const S = (k, n) => checkins.series(k, n);
  const F = [];
  let lvl = 0;
  const push = (l, es, en, trend = false, range = false) => { F.push({ l, txt: L(es, en), trend, range }); lvl = Math.max(lvl, l); };

  const vals = z.inds.map((k) => ({ k, v: d[k], l: levelOf(k, d[k]) }));
  vals.forEach((v) => {
    if (v.l > 0) {
      const I = INDICATORS[v.k];
      push(v.l,
        `${tr(I.n)}: ${fmt(v.k, v.v)} ${unit(v.k)} (fuera del rango normal ${I.band[0]}–${I.band[1]})`,
        `${tr(I.n)}: ${fmt(v.k, v.v)} ${unit(v.k)} (outside normal range ${I.band[0]}–${I.band[1]})`, false, true);
    }
  });

  if (z.id === "mind") {
    // Averages need at least 3 real days; the text always says how many days were used.
    const sl = S("sleep", 5), s5 = sl.length >= MIN_AVG ? avg(sl) : null, mo = S("mood", 5), m5 = mo.length >= MIN_AVG ? avg(mo) : null, m3 = S("mood", 3);
    if (s5 !== null && s5 < TRENDS.sleepAvg5) push(1, `Promedio de sueño de los últimos ${sl.length} días: ${s5.toFixed(1)} h (meta: 7 h o más)`, `Average sleep over the last ${sl.length} days: ${s5.toFixed(1)} h (goal: 7 h or more)`, true);
    if (d.stressVas != null && d.stressVas >= 70) push(1, `Estrés alto reportado hoy: ${d.stressVas}/100`, `High stress reported today: ${d.stressVas}/100`);
    if (d.pvt && !d.pvt.practice && d.pvt.lapses >= 3) push(1, `Prueba de reacción: ${d.pvt.lapses} lapsos (posible cansancio)`, `Reaction test: ${d.pvt.lapses} lapses (possible fatigue)`);
    if (m3.length === 3 && m3.every((x) => x <= 2)) push(2, "Ánimo bajo 3 días seguidos", "Low mood 3 days in a row", true);
    else if (m5 !== null && m5 <= TRENDS.moodAvg5) push(1, `Ánimo promedio bajo: ${m5.toFixed(1)}/5 en ${mo.length} días`, `Low average mood: ${m5.toFixed(1)}/5 over ${mo.length} days`, true);
  }
  if (z.id === "brain") {
    const s = d.sym || {};
    if (s.head && s.vision) push(d.sys >= 140 ? 2 : 1, "Dolor de cabeza con visión borrosa: posible señal de SANS", "Headache with blurred vision: possible SANS sign");
    else if (s.vision) push(1, "Visión borrosa reportada", "Blurred vision reported");
    else if (s.head) push(1, "Dolor de cabeza reportado", "Headache reported");
    if (s.dizzy || s.nausea) push(1, "Mareo o náuseas: posible alteración del oído interno", "Dizziness or nausea: possible inner-ear disturbance");
  }
  if (z.id === "heart") {
    // Trends need at least 7 real days (one jump on a single day is not a trend).
    const sy = S("sys", 14), hr = S("hr", 14), ss = sy.length >= MIN_TREND ? slope(sy) : 0, hs = hr.length >= MIN_TREND ? slope(hr) : 0;
    if (ss > TRENDS.sysSlope) push(1, `La presión sistólica sube ${sgn(ss)} mmHg al día en los últimos ${sy.length} días`, `Systolic pressure rising ${sgn(ss)} mmHg per day over the last ${sy.length} days`, true);
    if (hs > TRENDS.hrSlope) push(1, `La frecuencia en reposo sube ${sgn(hs)} lpm al día en los últimos ${hr.length} días`, `Resting heart rate rising ${sgn(hs)} bpm per day over the last ${hr.length} days`, true);
    if (d.sym && d.sym.chest) push(2, "Dolor de pecho reportado", "Chest pain reported");
  }
  if (z.id === "blood") {
    const gl = S("glu", 14), gs = gl.length >= MIN_TREND ? slope(gl) : 0;
    if (gs > TRENDS.gluSlope) push(1, `La glucosa sube ${sgn(gs)} mg/dL al día en los últimos ${gl.length} días`, `Glucose rising ${sgn(gs)} mg/dL per day over the last ${gl.length} days`, true);
  }
  if (z.id === "bones") {
    const ex = S("ex", 5), e5 = ex.length >= MIN_AVG ? avg(ex) : null;
    if (e5 !== null && e5 < TRENDS.exAvg5Red) push(2, `Promedio de ejercicio de ${ex.length} días: ${Math.round(e5)} min`, `${ex.length}-day exercise average: ${Math.round(e5)} min`, true);
    else if (e5 !== null && e5 < TRENDS.exAvg5Yellow) push(1, `Promedio de ejercicio de ${ex.length} días: ${Math.round(e5)} min (meta: 90)`, `${ex.length}-day exercise average: ${Math.round(e5)} min (goal: 90)`, true);
  }
  if (z.id === "immune") {
    const s = d.sym || {};
    if (s.rash) push(d.temp >= 38 ? 2 : 1, "Erupción en la piel reportada", "Skin rash reported");
  }
  if (z.id === "rad") {
    const r = radiationStatus(checkins.days, mission, storm);
    if (r.storm && r.stormLevel > 0) {
      const flux = Math.round(r.storm.flux);
      push(r.stormLevel, `Tormenta de radiación ${S_NAMES[r.storm.scale].es} (NOAA): ${flux} protones ≥10 MeV`, `Radiation storm ${S_NAMES[r.storm.scale].en} (NOAA): ${flux} protons ≥10 MeV`);
    }
    if (r.pct >= 80) push(2, `Dosis acumulada: ${r.pct.toFixed(0)}% del límite de carrera`, `Cumulative dose: ${r.pct.toFixed(0)}% of career limit`);
    else if (r.pct >= 50) push(1, `Dosis acumulada: ${r.pct.toFixed(0)}% del límite de carrera`, `Cumulative dose: ${r.pct.toFixed(0)}% of career limit`);
    if (r.projDose > r.limit) push(0, `Proyección de la misión completa: ≈${r.projDose} mSv, más que el límite de ${r.limit} mSv`, `Full-mission projection: ≈${r.projDose} mSv, above the ${r.limit} mSv limit`);
  }
  return { lvl, findings: F, vals };
}

/** Evaluates all 8 zones. Returns { zones: {id: result}, overall, worst }. */
export function evaluateAll(checkins, mission, storm = null) {
  const zones = {};
  ZONES.forEach((z) => { zones[z.id] = evaluateZone(z, checkins, mission, storm); });
  const overall = Math.max(...ZONES.map((z) => zones[z.id].lvl));
  const worst = PRIORITY.find((id) => zones[id].lvl === overall);
  return { zones, overall, worst };
}

/** Compact assessment stored with each check-in document. */
export function toAssessment(result) {
  return { overall: result.overall, zones: Object.fromEntries(Object.entries(result.zones).map(([k, v]) => [k, v.lvl])) };
}

/** Trend findings across zones, for the Trends tab. */
export function trendAlerts(result) {
  const out = [];
  ZONES.forEach((z) => result.zones[z.id].findings.forEach((f) => { if (f.trend) out.push({ l: f.l, txt: `${tr(z.n)}: ${f.txt}` }); }));
  return out;
}

export { ZONE_BY_ID };
