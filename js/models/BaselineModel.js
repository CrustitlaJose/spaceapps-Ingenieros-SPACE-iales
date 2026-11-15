// AstroVital · BaselineModel (Model layer): each astronaut's personal normal.
// The first 5 real check-ups of an astronaut define their normal (the average of each value).
// After that, every check-up is compared with it. The "how far is far" limits below are defined by this app
// (they are not clinical cut-offs): they only add a note, they never change the traffic light by themselves.
import { INDICATORS } from "../config/ranges.js";
import { tr, L } from "../config/i18n.js";

export const BASELINE_DAYS = 5;
/** key: [difference that counts, direction: "both" | "down"] */
export const BASELINE_LIMITS = { hr: [10, "both"], sys: [10, "both"], dia: [8, "both"], temp: [0.5, "both"], glu: [15, "both"], spo2: [2, "down"], sleep: [1, "down"] };
const KEYS = Object.keys(BASELINE_LIMITS);
const SHORT = { hr: { es: "pulso", en: "pulse" }, sys: { es: "presión sistólica", en: "systolic pressure" }, dia: { es: "presión diastólica", en: "diastolic pressure" },
  temp: { es: "temperatura", en: "temperature" }, glu: { es: "glucosa", en: "glucose" }, spo2: { es: "oxígeno", en: "oxygen" }, sleep: { es: "sueño", en: "sleep" } };

/** Returns { ready, count, needed, normal: {key: average} }. normal is null until there are 5 check-ups. */
export function computeBaseline(days) {
  const first = days.slice(0, BASELINE_DAYS);
  const out = { ready: first.length >= BASELINE_DAYS, count: Math.min(days.length, BASELINE_DAYS), needed: BASELINE_DAYS, normal: null };
  if (!out.ready) return out;
  out.normal = {};
  for (const k of KEYS) {
    const vals = first.map((d) => d[k]).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    out.normal[k] = vals.length >= 3 ? vals.reduce((s, x) => s + x, 0) / vals.length : null; // not enough answers ("I don't know") = no normal for that value
  }
  return out;
}

/** Compares one check-up with the normal. Returns [{ k, value, normal, diff, flagged, txt }] for every value with a normal. */
export function compareToBaseline(day, baseline) {
  if (!baseline || !baseline.ready || !day) return [];
  return KEYS.filter((k) => baseline.normal[k] !== null && day[k] !== null && day[k] !== undefined).map((k) => {
    const dec = INDICATORS[k].dec, normal = +baseline.normal[k].toFixed(dec), diff = +(day[k] - normal).toFixed(dec);
    const [limit, dir] = BASELINE_LIMITS[k];
    const flagged = dir === "down" ? diff <= -limit : Math.abs(diff) >= limit;
    const amount = Math.abs(diff).toFixed(dec);
    const txt = diff > 0 ? L(`${tr(SHORT[k])} ${amount} arriba de lo normal para ti`, `${tr(SHORT[k])} ${amount} above your normal`)
      : L(`${tr(SHORT[k])} ${amount} abajo de lo normal para ti`, `${tr(SHORT[k])} ${amount} below your normal`);
    return { k, value: day[k], normal, diff, flagged, txt };
  });
}
