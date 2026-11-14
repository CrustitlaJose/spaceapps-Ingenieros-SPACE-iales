// AstroVital · mission destinations.
// dose: approximate daily radiation dose (mSv/day). ISS ≈ 0.5 (approx.), lunar surface 1.37 (Chang'e 4),
// Mars cruise 1.84 (Curiosity RAD). projDose: projected dose for the full mission (mSv).
// delayMs: one-way message delay used in the demo. Mars uses 12 min real = 12 s demo (1 min → 1 s).

export const CAREER_LIMIT = 600; // mSv, NASA career standard
export const SOLAR_EXTRA = 45;    // extra mSv added on a solar storm day (illustrative)

export const MISSIONS = {
  iss: {
    name: { es: "Estación Espacial", en: "Space Station" },
    grav: "≈0 g", dose: 0.5, projDays: 180, projDose: 90,
    delay: { es: "< 1 s", en: "< 1 s" }, delayMs: 500,
    demo: { es: "< 1 s", en: "< 1 s" },
    comm: { es: "Los cirujanos de vuelo responden casi en tiempo real.", en: "Flight surgeons can answer almost in real time." },
  },
  moon: {
    name: { es: "Base lunar", en: "Lunar base" },
    grav: "0.17 g", dose: 1.37, projDays: 180, projDose: 247,
    delay: { es: "≈ 1.3 s", en: "≈ 1.3 s" }, delayMs: 1300,
    demo: { es: "1.3 s", en: "1.3 s" },
    comm: { es: "Retraso de unos 1.3 s por tramo: la consulta con la Tierra es casi inmediata.", en: "About 1.3 s per leg: consulting Earth is nearly immediate." },
  },
  mars: {
    name: { es: "Misión a Marte", en: "Mars mission" },
    grav: "0 → 0.38 g", dose: 1.84, projDays: 900, projDose: 1008,
    delay: { es: "4–24 min", en: "4–24 min" }, delayMs: 12000,
    demo: { es: "12 min (demo: 12 s)", en: "12 min (demo: 12 s)" },
    comm: { es: "Cada mensaje tarda entre 4 y 24 minutos en llegar. Hoy, una pregunta y su respuesta tardan unos 24 min: sigue los pasos de autonomía mientras tanto.", en: "Each message takes 4–24 minutes to arrive. Today a question and its answer take about 24 min: follow the autonomy steps meanwhile." },
  },
};

export const SCENARIOS = {
  hidden: { es: "Tendencia oculta", en: "Hidden trend" },
  steady: { es: "Misión estable", en: "Stable mission" },
  emergency: { es: "Emergencia + tormenta solar", en: "Emergency + solar storm" },
};
