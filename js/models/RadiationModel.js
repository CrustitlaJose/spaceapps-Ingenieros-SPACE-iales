// AstroVital · RadiationModel (Model layer): the virtual dosimeter.
// Dose = recorded mission days × the published average daily dose for that destination (see config/missions.js).
// It is an estimate, shown as such: the app has no physical dosimeter. During a radiation storm the extra dose
// is NOT invented; the storm is reported with NOAA's S-scale and the zone changes color.
import { MISSIONS, CAREER_LIMIT } from "../config/missions.js";
import { stormLevel } from "./SpaceWeather.js";

export const todayDose = (mission) => MISSIONS[mission].dose;
export const cumulativeDose = (days, mission) => days.length * MISSIONS[mission].dose;

/** liveStorm: { scale, flux, at } from SpaceWeather.current(), or null. Falls back to the storm stored with the last check-up. */
export function radiationStatus(days, mission, liveStorm = null) {
  const m = MISSIONS[mission];
  const last = days[days.length - 1];
  const cum = cumulativeDose(days, mission);
  const storm = liveStorm || (last && last.storm) || null;
  return {
    today: m.dose, expected: m.dose, days: days.length,
    cum, pct: (cum / CAREER_LIMIT) * 100,
    projDose: m.projDose, projDays: m.projDays,
    storm, stormLevel: storm ? stormLevel(storm.scale) : 0,
    limit: CAREER_LIMIT,
  };
}

/** Illustrative bone-loss model: up to 1.5 %/month without countermeasures (CSA); exercise reduces it up to 70 %. */
export function boneLoss(days) {
  return days.reduce((s, d) => s + (1.5 / 30) * (1 - (0.7 * Math.min(d.ex, 120)) / 120), 0);
}
