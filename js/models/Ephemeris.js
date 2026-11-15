// AstroVital · Ephemeris (Model layer): real Earth–Mars distance for any date, computed offline.
// Source: NASA/JPL Solar System Dynamics, "Approximate Positions of the Planets", Table 1
// (Keplerian elements and their rates, valid 1800–2050). https://ssd.jpl.nasa.gov/planets/approx_pos.html
// The Earth is taken at the Earth–Moon barycenter, which is at most ~4,700 km from the Earth's center.

// [a (au), e, I (deg), L (deg), longPeri (deg), longNode (deg)] and their rates per Julian century.
const ELEMENTS = {
  earth: { e0: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
           rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  mars: { e0: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
          rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
};
const RAD = Math.PI / 180;
export const AU_KM = 149597870.7;
export const AU_LIGHT_SECONDS = 499.004784; // light travel time for 1 au

export const julianDate = (date) => date.getTime() / 86400000 + 2440587.5;

/** Heliocentric position (au, ecliptic J2000) of "earth" or "mars". */
export function position(body, date) {
  const T = (julianDate(date) - 2451545.0) / 36525;
  const [a, e, I, Lm, wBar, node] = ELEMENTS[body].e0.map((v, i) => v + ELEMENTS[body].rate[i] * T);
  const w = wBar - node;
  let M = (Lm - wBar) % 360;
  if (M > 180) M -= 360; if (M < -180) M += 360;
  // Kepler's equation E - e·sin(E) = M, solved by Newton iteration (degrees)
  const eDeg = e / RAD;
  let E = M + eDeg * Math.sin(M * RAD);
  for (let i = 0; i < 12; i++) {
    const dE = (M - (E - eDeg * Math.sin(E * RAD))) / (1 - e * Math.cos(E * RAD));
    E += dE;
    if (Math.abs(dE) < 1e-7) break;
  }
  const xp = a * (Math.cos(E * RAD) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E * RAD);
  const cw = Math.cos(w * RAD), sw = Math.sin(w * RAD), cn = Math.cos(node * RAD), sn = Math.sin(node * RAD), ci = Math.cos(I * RAD), si = Math.sin(I * RAD);
  return {
    x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    z: sw * si * xp + cw * si * yp,
  };
}

/** Earth–Mars distance in au. */
export function marsDistanceAU(date = new Date()) {
  const e = position("earth", date), m = position("mars", date);
  return Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z);
}

/** One-way light (radio) travel time Earth–Mars in seconds. */
export const marsLightSeconds = (date = new Date()) => marsDistanceAU(date) * AU_LIGHT_SECONDS;
