// AstroVital · SensorSimulator (Model layer).
// The virtual wristband: the ONLY simulated data source in the app, always shown as "Simulado".
// It stands in for an ARCHeR-style wearable (Artemis II) until real sensors are connected.

/**
 * One reading of the virtual wristband.
 * Day-to-day values follow a mean-reverting random walk: they move around the person's usual value
 * (pulled halfway back each day) with natural variation, so every reading is different but realistic.
 */
export const BASELINE = { sleep: 7.5, sys: 114, dia: 72, hr: 64, glu: 88, temp: 36.6, spo2: 98, ex: 108 };
const DAILY_SD = { sys: 5, dia: 3, hr: 4, glu: 5, temp: 0.2, spo2: 0.8, ex: 9, sleep: 0.6 };
const LIMITS = { sys: [95, 160], dia: [55, 100], hr: [48, 115], glu: [65, 140], temp: [35.9, 38.2], spo2: [93, 100], ex: [0, 150], sleep: [4, 9.5] };
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export function readWearable(last) {
  const out = {};
  for (const k of Object.keys(BASELINE)) {
    const prev = last && last[k] != null ? last[k] : BASELINE[k];
    let v = prev + 0.5 * (BASELINE[k] - prev) + DAILY_SD[k] * gauss();
    v = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v));
    out[k] = k === "temp" || k === "sleep" ? +v.toFixed(1) : Math.round(v);
  }
  out.readAt = new Date().toISOString();
  return out;
}
