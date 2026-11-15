// AstroVital · ReportBuilder (Model layer): flight-surgeon report as text + a structured payload for Earth.
import { ZONES } from "../config/zones.js";
import { MISSIONS } from "../config/missions.js";
import { SYMPTOMS } from "../config/ranges.js";
import { tr, L, LEVELS } from "../config/i18n.js";
import { unit } from "../utils/format.js";
import { radiationStatus } from "./RadiationModel.js";
import { ROLES } from "../config/crew.js";
import { CrewModel } from "./CrewModel.js";
import { linkDelay } from "./DelayModel.js";
import { S_NAMES } from "./SpaceWeather.js";
import { compareToBaseline } from "./BaselineModel.js";
import { emergencyText } from "./EmergencyModel.js";

/** extra: { storm (live NOAA reading or null), baseline (computeBaseline result), events (this astronaut's emergencies) } */
export function buildReport(checkins, result, mission, crew, extra = {}) {
  const d = checkins.last(), m = MISSIONS[mission], rad = radiationStatus(checkins.days, mission, extra.storm || null);
  const delay = linkDelay(mission);
  const lines = [];
  lines.push(L("ASTROVITAL · REPORTE PARA CIRUJANOS DE VUELO", "ASTROVITAL · FLIGHT SURGEON REPORT"));
  lines.push("=".repeat(46));
  lines.push(`${L("Tripulante", "Crew member")}: ${crew._id} (${crew.name})   ${L("Misión", "Mission")}: ${tr(m.name)}   ${L("Día", "Day")}: ${d.day}`);
  const bmi = CrewModel.bmi(crew);
  const prof = [crew.role ? tr(ROLES[crew.role].n) : null, crew.age ? `${crew.age} ${L("años", "years")}` : null, crew.weight ? `${crew.weight} kg` : null, crew.height ? `${crew.height} cm` : null, bmi ? `${L("IMC", "BMI")} ${bmi.toFixed(1)}` : null].filter(Boolean).join(" · ");
  if (prof) lines.push(`${L("Perfil", "Profile")}: ${prof}`);
  if (crew.notes) lines.push(`${L("Notas médicas", "Medical notes")}: ${crew.notes}`);
  const src = d.sources || {};
  lines.push(`${L("Fuente", "Source")}: ${src.hr === "camera" ? L("pulso medido con cámara", "pulse measured by camera") + " + " : ""}${Object.values(src).includes("manual") ? L("signos escritos a mano", "vitals typed by hand") : L("pulsera virtual (simulada)", "virtual wristband (simulated)")} + ${L("respuestas del tripulante", "crew member answers")}`);
  lines.push(`${L("Estado general", "Overall status")}: ${tr(LEVELS[result.overall]).toUpperCase()}`);
  lines.push("");
  lines.push(L("SIGNOS DEL DÍA", "TODAY'S VITALS"));
  lines.push(`  ${L("Presión", "BP")}: ${d.sys}/${d.dia} mmHg   ${L("Frecuencia cardiaca", "Heart rate")}: ${d.hr} ${unit("hr")}   SpO2: ${d.spo2}%`);
  lines.push(`  Temp: ${Number(d.temp).toFixed(1)} °C   ${L("Glucosa", "Glucose")}: ${d.glu} mg/dL`);
  lines.push(`  ${L("Sueño", "Sleep")}: ${d.sleep == null ? L("no sabe", "unknown") : Number(d.sleep).toFixed(1) + " h"}   ${L("Ánimo", "Mood")}: ${d.mood}/5   ${L("Ejercicio", "Exercise")}: ${d.ex} min`);
  const mindBits = [d.moodVas != null ? `${L("ánimo", "mood")} ${d.moodVas}/100` : null, d.stressVas != null ? `${L("estrés", "stress")} ${d.stressVas}/100` : null,
    d.pvt ? `PVT-B ${d.pvt.meanRT} ms, ${d.pvt.lapses} ${L("lapsos", "lapses")}${d.pvt.practice ? ` (${L("práctica", "practice")})` : ""}` : null,
    d.pss4 ? `PSS-4 ${d.pss4.score}/16` : null].filter(Boolean);
  if (mindBits.length) lines.push(`  ${L("Mente", "Mind")}: ${mindBits.join(" · ")}`);
  const sy = Object.keys(d.sym || {}).filter((k) => d.sym[k]).map((k) => tr(SYMPTOMS[k]));
  lines.push(`  ${L("Síntomas", "Symptoms")}: ${sy.length ? sy.join(", ") : L("ninguno", "none")}`);
  lines.push(`  ${L("Dosímetro virtual", "Virtual dosimeter")}: ${rad.cum.toFixed(1)} mSv ${L("estimados", "estimated")} (${rad.days} ${rad.days === 1 ? L("día", "day") : L("días", "days")} × ${rad.today} mSv; ${rad.pct.toFixed(1)}% ${L("del límite de carrera", "of career limit")})`);
  lines.push(`  ${L("Clima espacial", "Space weather")}: ${rad.storm ? `${tr(S_NAMES[rad.storm.scale])}, ${Number(rad.storm.flux).toFixed(1)} pfu ≥10 MeV (NOAA GOES, ${new Date(rad.storm.at).toISOString().slice(0, 16).replace("T", " ")} UTC)` : L("sin datos en vivo en este chequeo", "no live data for this check-up")}`);
  const cmp = compareToBaseline(d, extra.baseline);
  if (extra.baseline && !extra.baseline.ready) lines.push(`  ${L("Normal personal", "Personal normal")}: ${L("calculando", "being calculated")} (${extra.baseline.count}/${extra.baseline.needed} ${L("chequeos", "check-ups")})`);
  else if (cmp.length) {
    const out = cmp.filter((c) => c.flagged);
    lines.push(`  ${L("Comparado con su normal", "Compared with their normal")}: ${out.length ? out.map((c) => c.txt).join("; ") : L("dentro de lo normal para esta persona", "within this person's normal")}`);
  }
  lines.push("");
  lines.push(L("HALLAZGOS POR ZONA", "FINDINGS BY ZONE"));
  ZONES.forEach((z) => {
    const r = result.zones[z.id];
    lines.push(`  [${tr(LEVELS[r.lvl]).toUpperCase()}] ${tr(z.n)}`);
    r.findings.forEach((f) => lines.push(`      - ${f.txt}`));
  });
  lines.push("");
  lines.push(L("ACCIONES INDICADAS A BORDO", "ACTIONS ADVISED ON BOARD"));
  const flagged = ZONES.filter((z) => result.zones[z.id].lvl > 0);
  if (!flagged.length) lines.push("  " + L("Ninguna: continuar rutina.", "None: continue routine."));
  flagged.forEach((z) => { lines.push(`  ${tr(z.n)}:`); tr(z.act[result.zones[z.id].lvl]).forEach((s) => lines.push(`      - ${s}`)); });
  lines.push("");
  const ev = (extra.events || []).filter((e) => Date.now() - Date.parse(e.startedAt) < 86400000);
  if (ev.length) {
    lines.push(L("EMERGENCIAS ATENDIDAS (últimas 24 h)", "EMERGENCIES HANDLED (last 24 h)"));
    ev.forEach((e) => lines.push("  " + emergencyText(e)));
    lines.push("");
  }
  lines.push(`${L("Retraso de comunicación", "Communication delay")}: ${delay.text} ${L("por tramo", "per leg")}${delay.detail ? ` (${L("Marte a", "Mars at")} ${delay.detail.millionKm} ${L("millones de km hoy", "million km today")})` : ""}.`);
  lines.push(L("Se solicita revisión y confirmación del plan.", "Review and confirmation of the plan requested."));

  const payload = {
    crewId: crew._id, crewName: crew.name, role: crew.role || null, day: d.day, mission, overall: result.overall,
    zones: Object.fromEntries(ZONES.map((z) => [z.id, result.zones[z.id].lvl])),
    vitals: { sys: d.sys, dia: d.dia, hr: d.hr, glu: d.glu, temp: d.temp, spo2: d.spo2, sleep: d.sleep, mood: d.mood, ex: d.ex },
    radiation: { cum: +rad.cum.toFixed(1), pct: +rad.pct.toFixed(1), storm: rad.storm },
    emergencies: ev.length,
  };
  return { text: lines.join("\n"), payload };
}
