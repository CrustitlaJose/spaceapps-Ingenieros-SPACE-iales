// AstroVital · RadiationModel (Model layer).
import { MISSIONS, CAREER_LIMIT, SOLAR_EXTRA } from "../config/missions.js";

export function todayDose(day, mission) {
  return MISSIONS[mission].dose + (day.solar ? SOLAR_EXTRA : 0);
}

export function cumulativeDose(days, mission) {
  return days.reduce((s, d) => s + todayDose(d, mission), 0);
}

export function radiationStatus(days, mission) {
  const m = MISSIONS[mission];
  const last = days[days.length - 1];
  const cum = cumulativeDose(days, mission);
  const pct = (cum / CAREER_LIMIT) * 100;
  return {
    today: todayDose(last, mission),
    expected: m.dose,
    cum, pct,
    projDose: m.projDose, projDays: m.projDays,
    solar: !!last.solar,
    limit: CAREER_LIMIT,
  };
}

/** Illustrative bone-loss model: up to 1.5 %/month without countermeasures (CSA); exercise reduces it up to 70 %. */
export function boneLoss(days) {
  return days.reduce((s, d) => s + (1.5 / 30) * (1 - (0.7 * Math.min(d.ex, 120)) / 120), 0);
}
