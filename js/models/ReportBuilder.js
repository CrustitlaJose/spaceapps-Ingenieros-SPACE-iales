// AstroVital · ReportBuilder (Model layer): flight-surgeon report as text + a structured payload for Earth.
import { ZONES } from "../config/zones.js";
import { MISSIONS } from "../config/missions.js";
import { SYMPTOMS } from "../config/ranges.js";
import { tr, L, LEVELS } from "../config/i18n.js";
import { unit } from "../utils/format.js";
import { radiationStatus } from "./RadiationModel.js";

export function buildReport(checkins, result, mission, crew) {
  const d = checkins.last(), m = MISSIONS[mission], rad = radiationStatus(checkins.days, mission);
  const lines = [];
  lines.push(L("ASTROVITAL · REPORTE PARA CIRUJANOS DE VUELO", "ASTROVITAL · FLIGHT SURGEON REPORT"));
  lines.push("=".repeat(46));
  lines.push(`${L("Tripulante", "Crew member")}: ${crew.id} (${crew.name})   ${L("Misión", "Mission")}: ${tr(m.name)}   ${L("Día", "Day")}: ${d.day}`);
  lines.push(`${L("Fuente", "Source")}: ${L("sensores simulados + autorreporte", "simulated sensors + self-report")}`);
  lines.push(`${L("Estado general", "Overall status")}: ${tr(LEVELS[result.overall]).toUpperCase()}`);
  lines.push("");
  lines.push(L("SIGNOS DEL DÍA", "TODAY'S VITALS"));
  lines.push(`  ${L("Presión", "BP")}: ${d.sys}/${d.dia} mmHg   ${L("FC", "HR")}: ${d.hr} ${unit("hr")}   SpO2: ${d.spo2}%`);
  lines.push(`  Temp: ${Number(d.temp).toFixed(1)} °C   ${L("Glucosa", "Glucose")}: ${d.glu} mg/dL`);
  lines.push(`  ${L("Sueño", "Sleep")}: ${Number(d.sleep).toFixed(1)} h   ${L("Ánimo", "Mood")}: ${d.mood}/5   ${L("Ejercicio", "Exercise")}: ${d.ex} min`);
  const sy = Object.keys(d.sym || {}).filter((k) => d.sym[k]).map((k) => tr(SYMPTOMS[k]));
  lines.push(`  ${L("Síntomas", "Symptoms")}: ${sy.length ? sy.join(", ") : L("ninguno", "none")}`);
  lines.push(`  ${L("Radiación acumulada", "Cumulative radiation")}: ${rad.cum.toFixed(0)} mSv (${rad.pct.toFixed(1)}% ${L("del límite de carrera", "of career limit")})`);
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
  lines.push(`${L("Retraso de comunicación", "Communication delay")}: ${tr(m.delay)} ${L("por tramo", "per leg")}.`);
  lines.push(L("Se solicita revisión y confirmación del plan.", "Review and confirmation of the plan requested."));

  const payload = {
    crewId: crew.id, crewName: crew.name, day: d.day, mission, overall: result.overall,
    zones: Object.fromEntries(ZONES.map((z) => [z.id, result.zones[z.id].lvl])),
    vitals: { sys: d.sys, dia: d.dia, hr: d.hr, glu: d.glu, temp: d.temp, spo2: d.spo2, sleep: d.sleep, mood: d.mood, ex: d.ex },
    radiation: { cum: +rad.cum.toFixed(1), pct: +rad.pct.toFixed(1), solar: rad.solar },
  };
  return { text: lines.join("\n"), payload };
}
