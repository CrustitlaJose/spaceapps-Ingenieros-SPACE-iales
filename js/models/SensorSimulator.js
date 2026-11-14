// AstroVital · SensorSimulator (Model layer).
// Generates realistic simulated data, the way an ARCHeR-style wearable (Artemis II) would provide it.

/** Deterministic random generator so each demo scenario always looks the same. */
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 30 days of history for a demo scenario.
 * steady: normal values · hidden: slow drift (BP and HR up, sleep, mood and exercise down) · emergency: hidden + a critical last day.
 * Returns flat day records: { day, sleep, mood, sys, dia, hr, glu, temp, spo2, ex, sym, solar, src }.
 */
export function generateHistory(scenario, days = 30) {
  const r = seeded(scenario === "steady" ? 7 : scenario === "hidden" ? 42 : 99);
  const n = (s) => (r() + r() + r() - 1.5) * s * 1.15;
  const drift = scenario === "steady" ? 0 : 1;
  const out = [];
  for (let d = 1; d <= days; d++) {
    const p = d / days, late = Math.max(0, (d - 20) / 10);
    const rec = {
      day: d,
      sleep: +((scenario === "steady" ? 7.8 : 7.6) - 1.3 * late * drift + n(0.35)).toFixed(1),
      mood: Math.max(1, Math.min(5, Math.round(4.4 - 1.4 * late * drift + n(0.35)))),
      sys: Math.round(113 + 15 * p * drift + n(3)),
      dia: Math.round(72 + 6 * p * drift + n(2)),
      hr: Math.round(62 + 11 * p * drift + n(2)),
      glu: Math.round(88 + 5 * p * drift + n(4)),
      temp: +(36.6 + n(0.15)).toFixed(1),
      spo2: Math.min(100, Math.round(98 + n(0.7))),
      ex: Math.max(0, Math.round(108 - 58 * late * drift + n(8))),
      sym: {}, solar: false, src: "sim",
    };
    if (scenario === "emergency" && d === days) {
      Object.assign(rec, { sys: 154, dia: 97, hr: 114, temp: 38.4, spo2: 91, sleep: 4.6, mood: 2, glu: 131,
        sym: { head: true, vision: true, nausea: true }, solar: true });
    }
    out.push(rec);
  }
  return out;
}

/** One wearable reading based on the last record, with small natural variation. */
export function readWearable(last) {
  const j = (v, s, dec) => +(v + (Math.random() - 0.5) * 2 * s).toFixed(dec);
  return {
    sleep: j(last.sleep, 0.4, 1),
    sys: Math.round(j(last.sys, 3, 0)),
    dia: Math.round(j(last.dia, 2, 0)),
    hr: Math.round(j(last.hr, 2, 0)),
    glu: Math.round(j(last.glu, 4, 0)),
    temp: j(last.temp, 0.15, 1),
    spo2: Math.min(100, Math.round(j(last.spo2, 1, 0))),
    ex: Math.max(0, Math.round(j(last.ex, 10, 0))),
  };
}
