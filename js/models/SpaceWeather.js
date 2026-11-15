// AstroVital · SpaceWeather (Model layer): real space weather, live.
// 1. NOAA SWPC, GOES satellite: integral proton flux ≥10 MeV (updated every 5 minutes).
//    https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json
// 2. NASA DONKI (CCMC): solar flares of the last 7 days. https://api.nasa.gov/DONKI/FLR
// The flux is classified with NOAA's Solar Radiation Storm scale (S1–S5).
// Nothing here is invented: with no internet the app says so and only shows the last reading it really received.

export const NOAA_URL = "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json";
export const DONKI_URL = "https://api.nasa.gov/DONKI/FLR";
const CACHE_KEY = "astrovital-spaceweather";
const DONKI_EVERY_MS = 60 * 60 * 1000; // DEMO_KEY allows 30 requests per hour: ask once an hour

/** NOAA S-scale: flux of ≥10 MeV protons in pfu. S1 ≥10, S2 ≥100, S3 ≥1,000, S4 ≥10,000, S5 ≥100,000. */
export function sScale(flux) {
  if (flux == null || Number.isNaN(flux)) return null;
  return flux >= 1e5 ? 5 : flux >= 1e4 ? 4 : flux >= 1e3 ? 3 : flux >= 100 ? 2 : flux >= 10 ? 1 : 0;
}

export const S_NAMES = [
  { es: "Sin tormenta", en: "No storm" },
  { es: "S1 · Menor", en: "S1 · Minor" },
  { es: "S2 · Moderada", en: "S2 · Moderate" },
  { es: "S3 · Fuerte", en: "S3 · Strong" },
  { es: "S4 · Severa", en: "S4 · Severe" },
  { es: "S5 · Extrema", en: "S5 · Extreme" },
];

/** App level for the radiation zone: S1–S2 = yellow (watch), S3+ = red (NOAA: hazard avoidance recommended for astronauts on EVA). */
export const stormLevel = (scale) => (scale >= 3 ? 2 : scale >= 1 ? 1 : 0);

/**
 * A real past event, used ONLY for the drill and as a reference, always shown with its date.
 * Sources: NOAA SWPC "Report of Solar-Geophysical Activity", 10 May 2024 (protons >10 MeV peaked at 206 pfu at 17:45 UTC; X3 flare at 06:54 UTC, Region 3664);
 * NASA/JPL, Curiosity RAD: 8,100 micrograys at the Martian surface on 20 May 2024.
 */
export const STORED_EVENT = {
  at: "2024-05-10T17:45:00Z", flux: 206, scale: 2, flare: "X3",
  source: "NOAA SWPC · 10 may 2024",
  mars: { at: "2024-05-20", microGray: 8100, source: "NASA/JPL Curiosity RAD" },
};

/** Latest ≥10 MeV reading and the 24-hour maximum from NOAA's JSON. Returns null if the data has no such readings. */
export function parseProtons(json) {
  if (!Array.isArray(json)) return null;
  const rows = json.filter((r) => r && r.energy === ">=10 MeV" && typeof r.flux === "number" && r.time_tag);
  if (!rows.length) return null;
  const last = rows.reduce((a, b) => (a.time_tag > b.time_tag ? a : b));
  const max = rows.reduce((a, b) => (a.flux > b.flux ? a : b));
  return { flux: last.flux, at: last.time_tag, satellite: last.satellite ?? null, max24: max.flux, max24At: max.time_tag };
}

/** Strongest flare in DONKI's list (class order A < B < C < M < X). Returns null when the list is empty. */
export function parseFlares(json) {
  if (!Array.isArray(json) || !json.length) return null;
  const rank = (c) => { const m = /^([ABCMX])(\d+(\.\d+)?)?/.exec(c || ""); return m ? "ABCMX".indexOf(m[1]) * 100 + parseFloat(m[2] || "0") : -1; };
  const top = json.filter((f) => f && f.classType).reduce((a, b) => (rank(a.classType) >= rank(b.classType) ? a : b), json[0]);
  return top && top.classType ? { classType: top.classType, at: top.peakTime || top.beginTime || null, count: json.length } : null;
}

const ymd = (d) => d.toISOString().slice(0, 10);

export class SpaceWeather {
  /** fetchFn can be replaced in the tests. */
  constructor(fetchFn) {
    this.fetchFn = fetchFn || ((...a) => fetch(...a));
    this.state = { status: "loading", protons: null, scale: null, flare: null, flareAt: null, fetchedAt: null };
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (c && c.protons) this.state = { ...c, status: "cached" };
    } catch (e) {}
  }

  async getJson(url) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 9000) : null;
    try {
      const res = await this.fetchFn(url, ctl ? { signal: ctl.signal, cache: "no-store" } : undefined);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { if (timer) clearTimeout(timer); }
  }

  /** Asks NOAA (always) and NASA DONKI (at most once an hour). Never throws: on failure the status says so. */
  async refresh(now = new Date()) {
    const prev = this.state;
    let protons = null;
    try { protons = parseProtons(await this.getJson(NOAA_URL)); } catch (e) { protons = null; }
    let flare = prev.flare, flareAt = prev.flareAt;
    if (protons && (!flareAt || now.getTime() - Date.parse(flareAt) > DONKI_EVERY_MS)) {
      try {
        const start = new Date(now.getTime() - 7 * 86400000);
        flare = parseFlares(await this.getJson(`${DONKI_URL}?startDate=${ymd(start)}&endDate=${ymd(now)}&api_key=DEMO_KEY`));
        flareAt = now.toISOString();
      } catch (e) { /* keep the last flare we really received */ }
    }
    if (protons) {
      this.state = { status: "live", protons, scale: sScale(protons.flux), flare, flareAt, fetchedAt: now.toISOString() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(this.state)); } catch (e) {}
    } else {
      this.state = prev.protons ? { ...prev, status: "cached" } : { status: "offline", protons: null, scale: null, flare: null, flareAt: null, fetchedAt: null };
    }
    return this.state;
  }

  /** Storm reading to store with a check-up: only a live reading counts. */
  current() {
    const s = this.state;
    return s.status === "live" && s.protons ? { scale: s.scale, flux: s.protons.flux, at: s.protons.at } : null;
  }
}
