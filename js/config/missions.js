// AstroVital · mission destinations.
// dose: daily radiation dose (mSv/day). ISS 0.35 = middle of NASA's 0.2–0.5 range (NTRS, Simonsen et al.),
// lunar surface 1.369 (Chang'e 4, Zhang et al. 2020, Sci. Adv.), Mars cruise 1.84 (Curiosity RAD, Zeitlin et al. 2013, Science). projDose: projected dose for the full mission (mSv).
// The message delay to Earth is computed in models/DelayModel.js (Mars: real distance of the day).

export const CAREER_LIMIT = 600; // mSv, NASA career standard

export const MISSIONS = {
  iss: {
    name: { es: "Estación Espacial", en: "Space Station" },
    grav: "≈0 g", dose: 0.35, projDays: 180, projDose: 63,
  },
  moon: {
    name: { es: "Base lunar", en: "Lunar base" },
    grav: "0.17 g", dose: 1.37, projDays: 180, projDose: 247,
  },
  mars: {
    name: { es: "Misión a Marte", en: "Mars mission" },
    grav: "0 → 0.38 g", dose: 1.84, projDays: 900, projDose: 1008,
  },
};
