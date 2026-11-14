// AstroVital · HealthEvaluator (Model layer).
// Decides the traffic-light level of each body zone from the latest values, 7–14 day trends and symptoms.

import { INDICATORS, TRENDS } from "../config/ranges.js";
import { ZONES, ZONE_BY_ID, PRIORITY } from "../config/zones.js";
import { tr, L } from "../config/i18n.js";
import { radiationStatus } from "./RadiationModel.js";
import { fmt, unit, sgn } from "../utils/format.js";

const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;

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
 * Evaluates one zone. `checkins` is a CheckinModel (days + series()).
 * Returns { lvl, findings: [{ l, txt, trend }], vals: [{ k, v, l }] }.
 */
export function evaluateZone(z, checkins, mission) {
  const d = checkins.last();
  const S = (k, n) => checkins.series(k, n);
  const F = [];
  let lvl = 0;
  const push = (l, es, en, trend = false) => { F.push({ l, txt: L(es, en), trend }); lvl = Math.max(lvl, l); };

  const vals = z.inds.map((k) => ({ k, v: d[k], l: INDICATORS[k].ev(d[k]) }));
  vals.forEach((v) => {
    if (v.l > 0) {
      const I = INDICATORS[v.k];
      push(v.l,
        `${tr(I.n)}: ${fmt(v.k, v.v)} ${unit(v.k)} (fuera del rango normal ${I.band[0]}–${I.band[1]})`,
        `${tr(I.n)}: ${fmt(v.k, v.v)} ${unit(v.k)} (outside normal range ${I.band[0]}–${I.band[1]})`);
    }
  });

  if (z.id === "mind") {
    const s5 = avg(S("sleep", 5)), m5 = avg(S("mood", 5)), m3 = S("mood", 3);
    if (s5 < TRENDS.sleepAvg5) push(1, `Promedio de sueño de los últimos 5 días: ${s5.toFixed(1)} h (meta: 7 h o más)`, `Average sleep over the last 5 days: ${s5.toFixed(1)} h (goal: 7 h or more)`, true);
    if (m3.length === 3 && m3.every((x) => x <= 2)) push(2, "Ánimo bajo 3 días seguidos", "Low mood 3 days in a row", true);
    else if (m5 <= TRENDS.moodAvg5) push(1, `Ánimo promedio en descenso: ${m5.toFixed(1)}/5 en 5 días`, `Mood trending down: ${m5.toFixed(1)}/5 average over 5 days`, true);
  }
  if (z.id === "brain") {
    const s = d.sym || {};
    if (s.head && s.vision) push(d.sys >= 140 ? 2 : 1, "Dolor de cabeza con visión borrosa: posible señal de SANS", "Headache with blurred vision: possible SANS sign");
    else if (s.vision) push(1, "Visión borrosa reportada", "Blurred vision reported");
    else if (s.head) push(1, "Dolor de cabeza reportado", "Headache reported");
    if (s.dizzy || s.nausea) push(1, "Mareo o náuseas: posible alteración del oído interno", "Dizziness or nausea: possible inner-ear disturbance");
  }
  if (z.id === "heart") {
    const ss = slope(S("sys", 14)), hs = slope(S("hr", 14));
    if (ss > TRENDS.sysSlope) push(1, `La presión sistólica sube ${sgn(ss)} mmHg al día desde hace 14 días`, `Systolic pressure rising ${sgn(ss)} mmHg per day over 14 days`, true);
    if (hs > TRENDS.hrSlope) push(1, `La frecuencia en reposo sube ${sgn(hs)} lpm al día desde hace 14 días`, `Resting heart rate rising ${sgn(hs)} bpm per day over 14 days`, true);
    if (d.sym && d.sym.chest) push(2, "Dolor de pecho reportado", "Chest pain reported");
  }
  if (z.id === "blood") {
    const gs = slope(S("glu", 14));
    if (gs > TRENDS.gluSlope) push(1, `La glucosa sube ${sgn(gs)} mg/dL al día`, `Glucose rising ${sgn(gs)} mg/dL per day`, true);
  }
  if (z.id === "bones") {
    const e5 = avg(S("ex", 5));
    if (e5 < TRENDS.exAvg5Red) push(2, `Promedio de ejercicio de 5 días: ${Math.round(e5)} min`, `5-day exercise average: ${Math.round(e5)} min`, true);
    else if (e5 < TRENDS.exAvg5Yellow) push(1, `Promedio de ejercicio de 5 días: ${Math.round(e5)} min (meta: 90)`, `5-day exercise average: ${Math.round(e5)} min (goal: 90)`, true);
  }
  if (z.id === "immune") {
    const s = d.sym || {};
    if (s.rash) push(d.temp >= 38 ? 2 : 1, "Erupción en la piel reportada", "Skin rash reported");
  }
  if (z.id === "rad") {
    const r = radiationStatus(checkins.days, mission);
    if (r.solar) push(2, "Tormenta solar: la dosis de hoy es muy superior a lo normal", "Solar storm: today's dose is far above normal");
    if (r.pct >= 80) push(2, `Dosis acumulada: ${r.pct.toFixed(0)}% del límite de carrera`, `Cumulative dose: ${r.pct.toFixed(0)}% of career limit`);
    else if (r.pct >= 50) push(1, `Dosis acumulada: ${r.pct.toFixed(0)}% del límite de carrera`, `Cumulative dose: ${r.pct.toFixed(0)}% of career limit`);
    if (r.projDose > r.limit) push(0, `Proyección de la misión completa: ≈${r.projDose} mSv, más que el límite de ${r.limit} mSv`, `Full-mission projection: ≈${r.projDose} mSv, above the ${r.limit} mSv limit`);
  }
  return { lvl, findings: F, vals };
}

/** Evaluates all 8 zones. Returns { zones: {id: result}, overall, worst }. */
export function evaluateAll(checkins, mission) {
  const zones = {};
  ZONES.forEach((z) => { zones[z.id] = evaluateZone(z, checkins, mission); });
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
