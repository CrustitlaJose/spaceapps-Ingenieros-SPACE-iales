// AstroVital · automated tests. They run in the browser against the real models, using an in-memory database
// so they never touch the astronauts' saved data.

import { INDICATORS } from "../js/config/ranges.js";
import { setLang } from "../js/config/i18n.js";
import { Database } from "../js/models/Database.js";
import { CheckinModel, toDoc, fromDoc } from "../js/models/CheckinModel.js";
import { CrewModel } from "../js/models/CrewModel.js";
import { evaluateAll, slope } from "../js/models/HealthEvaluator.js";
import { cumulativeDose, boneLoss } from "../js/models/RadiationModel.js";
import { readWearable } from "../js/models/SensorSimulator.js";
import { generateHistory, seedHistory } from "./fixtures.js";
import { marsDistanceAU, marsLightSeconds } from "../js/models/Ephemeris.js";
import { linkDelay } from "../js/models/DelayModel.js";
import { sScale, stormLevel, parseProtons, parseFlares, SpaceWeather, STORED_EVENT } from "../js/models/SpaceWeather.js";
import { radiationStatus } from "../js/models/RadiationModel.js";
import { computeBaseline, compareToBaseline } from "../js/models/BaselineModel.js";
import { EmergencyModel, protocolFor, emergencyText } from "../js/models/EmergencyModel.js";
import { PROTOCOLS } from "../js/config/protocols.js";
import { buildReport } from "../js/models/ReportBuilder.js";
import { LinkModel, setMission, getMission } from "../js/models/LinkModel.js";
import { estimateHeartRate } from "../js/models/RppgPOS.js";
import { levelOf } from "../js/config/ranges.js";
import { scorePvt, scorePss4, vasToMood, PVT } from "../js/models/MindModel.js";
import { exportAll, validateBackup, importAll, resetAll } from "../js/models/DataModel.js";

setLang("es");
// The tests use their own in-memory database; remember app settings they touch and restore them at the end.
const KEEP = ["astrovital-spaceweather", "astrovital-active-crew", "astrovital-mission", "astrovital-link-up"];
const saved = {}; try { KEEP.forEach((k) => { saved[k] = localStorage.getItem(k); }); } catch (e) {}
const results = [];
const test = (group, name, fn) => results.push({ group, name, fn });
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg || "esperado"}: ${JSON.stringify(b)}, obtenido: ${JSON.stringify(a)}`); };
const ok = (v, msg) => { if (!v) throw new Error(msg || "condición falsa"); };
const near = (a, b, tol, msg) => { if (Math.abs(a - b) > tol) throw new Error(`${msg || "esperado"} ≈${b}, obtenido ${a}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function scenario(name, mission = "mars") {
  const db = await new Database({ memory: true }).open();
  const c = new CheckinModel(db, "TEST-1");
  await seedHistory(c, name, mission);
  return { db, c, r: evaluateAll(c, mission) };
}

// 1. Ranges (traffic light)
test("Rangos", "Presión 120 = verde, 135 = amarillo, 150 = rojo", () => {
  eq(INDICATORS.sys.ev(120), 0); eq(INDICATORS.sys.ev(135), 1); eq(INDICATORS.sys.ev(150), 2);
});
test("Rangos", "Oxígeno 97 = verde, 93 = amarillo, 90 = rojo", () => {
  eq(INDICATORS.spo2.ev(97), 0); eq(INDICATORS.spo2.ev(93), 1); eq(INDICATORS.spo2.ev(90), 2);
});
test("Rangos", "Temperatura 38.2 °C = rojo (fiebre)", () => eq(INDICATORS.temp.ev(38.2), 2));
test("Rangos", "Glucosa 105 = amarillo, 50 = rojo (hipoglucemia)", () => { eq(INDICATORS.glu.ev(105), 1); eq(INDICATORS.glu.ev(50), 2); });
test("Rangos", "Sueño 7.5 h = verde, 6.5 h = amarillo, 5 h = rojo", () => { eq(INDICATORS.sleep.ev(7.5), 0); eq(INDICATORS.sleep.ev(6.5), 1); eq(INDICATORS.sleep.ev(5), 2); });

// 2. Trend math
test("Tendencias", "La pendiente de 1,2,3…14 es 1 por día", () => near(slope([1,2,3,4,5,6,7,8,9,10,11,12,13,14]), 1, 1e-9));
test("Tendencias", "La pendiente de valores constantes es 0", () => near(slope(Array(14).fill(120)), 0, 1e-9));

// 3. Evaluator with the demo scenarios
test("Evaluador", "Misión estable: las 8 zonas en verde", async () => { const { r } = await scenario("steady"); eq(r.overall, 0, "nivel general"); });
test("Evaluador", "Tendencia oculta: amarillo y detecta la presión subiendo", async () => {
  const { r, c } = await scenario("hidden");
  eq(r.overall, 1, "nivel general");
  ok(INDICATORS.sys.ev(c.last().sys) === 0, "la presión de hoy debe verse normal");
  ok(r.zones.heart.findings.some((f) => f.trend), "debe haber una alerta de tendencia en el corazón");
});
test("Evaluador", "Emergencia: rojo y lo primero es la radiación", async () => {
  const { r } = await scenario("emergency"); eq(r.overall, 2, "nivel general"); eq(r.worst, "rad", "zona prioritaria");
});
test("Evaluador", "Dolor de pecho pone el corazón en rojo", async () => {
  const { c } = await scenario("steady"); c.last().sym = { chest: true };
  eq(evaluateAll(c, "iss").zones.heart.lvl, 2);
});

// 4. Radiation and bones
test("Radiación", "30 días rumbo a Marte = 55.2 mSv", () => near(cumulativeDose(generateHistory("steady"), "mars"), 55.2, 0.01));
test("Radiación", "Estación Espacial: 0.35 mSv/día → 30 días = 10.5 mSv", () => near(cumulativeDose(generateHistory("steady"), "iss"), 10.5, 0.01));
test("Radiación", "El dosímetro no inventa dosis extra en tormenta: solo avisa con la escala de NOAA", () => {
  const days = generateHistory("emergency");
  near(cumulativeDose(days, "iss"), 10.5, 0.01, "misma dosis estimada");
  const r = radiationStatus(days, "iss");
  eq(r.storm.scale, 3); eq(r.stormLevel, 2, "S3 = rojo");
  eq(radiationStatus(generateHistory("steady"), "iss").storm, null, "sin lectura de NOAA no hay tormenta");
});
test("Huesos", "120 min de ejercicio diario 30 días = 0.45% de pérdida", () => near(boneLoss(Array(30).fill({ ex: 120 })), 0.45, 1e-9));

// 5. Database
test("Base de datos", "Guarda y busca documentos estilo MongoDB", async () => {
  const db = await new Database({ memory: true }).open();
  await db.put("crew", { _id: "MS-2", name: "A. Prueba" });
  eq((await db.find("crew", { name: "A. Prueba" })).length, 1);
});
test("Base de datos", "Un check-in se convierte a documento y regresa igual", () => {
  const rec = generateHistory("emergency").at(-1);
  const back = fromDoc(toDoc("CDR-1", rec, "mars"));
  ["sys", "dia", "hr", "glu", "temp", "spo2", "sleep", "mood", "ex"].forEach((k) => eq(back[k], rec[k], k));
  eq(back.storm.scale, 3, "tormenta guardada");
  eq(Object.keys(back.sym).sort().join(","), "head,nausea,vision", "síntomas");
});
test("Base de datos", "Agregar un check-in aumenta el día", async () => {
  const { c } = await scenario("steady");
  await c.add({ ...readWearable(c.last()), mood: 4, sym: {}, src: "user" }, "mars");
  eq(c.last().day, 31);
});

// 6. Crew
test("Tripulación", "Crea astronautas con código por rol y valida datos", async () => {
  const db = await new Database({ memory: true }).open();
  const crew = new CrewModel(db); await crew.load();
  eq(crew.list.length, 0, "sin astronautas de ejemplo al empezar");
  ok(!crew.active(), "nadie activo");
  const d = await crew.save({ name: "L. Kim", role: "cmo", age: 35, weight: 60, height: 165 });
  eq(d._id, "CMO-1", "código");
  eq(crew.validate({ name: "", role: "ms" }), "crewNeedName");
  eq(crew.validate({ name: "X", role: "ms", age: 5 }), "crewBadNumber");
  near(CrewModel.bmi({ weight: 72, height: 175 }), 23.5, 0.05, "IMC");
});
test("Tripulación", "Eliminar un astronauta borra su historial", async () => {
  const db = await new Database({ memory: true }).open();
  const crew = new CrewModel(db); await crew.load();
  const d = await crew.save({ name: "Borrar", role: "ms" });
  const c = new CheckinModel(db, d._id); await seedHistory(c, "steady", "iss");
  await crew.remove(d._id);
  eq((await db.find("checkins", { crewId: d._id })).length, 0);
});

// 7. Missions and report
test("Reporte", "El reporte de emergencia dice ROJO y trae el perfil", async () => {
  const { c, r } = await scenario("emergency");
  const rep = buildReport(c, r, "mars", { _id: "CDR-1", name: "M. Rivera", role: "cdr", age: 41, weight: 72, height: 175 });
  ok(rep.text.includes("Estado general: ROJO"), "estado"); ok(rep.text.includes("Comandante · 41 años"), "perfil");
  eq(rep.payload.overall, 2);
});

// 8. Camera pulse (POS) with synthetic skin-color signals
function synth(bpm, secs, noise) {
  const out = []; let t = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  while (t < secs) {
    const p = Math.sin(2 * Math.PI * (bpm / 60) * t), drift = 3 * Math.sin(2 * Math.PI * 0.08 * t);
    out.push({ t, r: 150 + drift + 0.25 * p + rnd() * noise, g: 110 + drift + 0.6 * p + rnd() * noise, b: 90 + drift + 0.15 * p + rnd() * noise });
    t += 1 / 29;
  }
  return out;
}
test("Pulso con cámara", "Señal de 62 lpm → estima 62 ± 2 con señal buena", () => { const r = estimateHeartRate(synth(62, 30, 0.3)); near(r.bpm, 62, 2); eq(r.quality, "good"); });
test("Pulso con cámara", "Señal de 98 lpm → estima 98 ± 2", () => near(estimateHeartRate(synth(98, 30, 0.6)).bpm, 98, 2));
test("Pulso con cámara", "Mucho ruido → marca señal mala", () => eq(estimateHeartRate(synth(75, 30, 8)).quality, "poor"));
test("Pulso con cámara", "Menos de 8 s de video no da lectura", () => eq(estimateHeartRate(synth(70, 5, 0.3)), null));

// 9. "I don't know" and profile input
test("No sé", "Sueño vacío no genera alerta ni errores", async () => {
  const { c } = await scenario("steady");
  c.last().sleep = null;
  eq(levelOf("sleep", null), 0);
  const r = evaluateAll(c, "iss");
  ok(!Number.isNaN(r.overall), "nivel válido"); eq(r.zones.mind.vals.find((v) => v.k === "sleep").l, 0);
});
test("Tripulación", "Acepta la estatura en metros (1.72 → 172 cm)", async () => {
  const db = await new Database({ memory: true }).open();
  const crew = new CrewModel(db); await crew.load();
  eq(crew.validate({ name: "Tú", role: "ms", age: 21, weight: 75, height: 1.72 }), null, "validación");
  const d = await crew.save({ name: "Tú", role: "ms", age: 21, weight: 75, height: 1.72 });
  eq(d.height, 172);
});
test("Tripulación", "Los datos de cada tripulante están separados", async () => {
  const db = await new Database({ memory: true }).open();
  const a = new CheckinModel(db, "CDR-1"), b = new CheckinModel(db, "MS-2");
  await seedHistory(a, "emergency", "mars");
  await b.add({ ...readWearable(null), mood: 4, sym: {}, src: "user" }, "mars");
  await a.load(); await b.load();
  eq(a.days.length, 30, "CDR-1 conserva sus 30 días"); eq(b.days.length, 1, "MS-2 solo tiene su chequeo");
  eq((await db.find("checkins", { crewId: "MS-2" })).length, 1);
  await a.remove(30); await b.load();
  eq(b.days.length, 1, "borrar un chequeo de CDR-1 no toca a MS-2");
  const emg = new EmergencyModel(db);
  emg.start("heart", { _id: "CDR-1", name: "A" }, "manual"); emg.done(); await emg.finish();
  eq((await emg.list("CDR-1")).length, 1); eq((await emg.list("MS-2")).length, 0, "las emergencias también van por tripulante");
});

// 10. Mind: PVT-B, scales, PSS-4
test("Mente", "PVT-B: lapsos desde 355 ms, anticipaciones y desempeño", () => {
  const r = scorePvt([250, 300, 354, 355, 400, 280, 260, 290, 310, 270], 1, 180);
  eq(r.n, 10); eq(r.lapses, 2, "lapsos"); eq(r.falseStarts, 1);
  eq(r.score, Math.round(100 * (1 - 3 / 11)), "desempeño"); eq(r.practice, false);
});
test("Mente", "PVT de 30 s queda marcado como práctica", () => eq(scorePvt([300, 320], 0, PVT.practiceS).practice, true));
test("Mente", "PSS-4: las preguntas 2 y 3 se califican al revés (0–16)", () => {
  eq(scorePss4([0, 4, 4, 0]), 0, "mínimo"); eq(scorePss4([4, 0, 0, 4]), 16, "máximo"); eq(scorePss4([2, 2, 2, 2]), 8);
  eq(scorePss4([1, null, 2, 3]), null, "incompleto");
});
test("Mente", "Ánimo 0–100 se convierte a 1–5", () => { eq(vasToMood(0), 1); eq(vasToMood(45), 3); eq(vasToMood(100), 5); });
test("Mente", "Estrés de 75/100 pone amarillo en Mente y sueño", async () => {
  const { c } = await scenario("steady"); c.last().stressVas = 75;
  eq(evaluateAll(c, "iss").zones.mind.lvl, 1);
});
test("Mente", "La prueba y las escalas se guardan y regresan de la base de datos", async () => {
  const db = await new Database({ memory: true }).open();
  const c = new CheckinModel(db, "MS-2");
  const pvt = scorePvt([250, 400], 0, 180);
  await c.add({ ...readWearable(null), mood: 4, moodVas: 70, stressVas: 20, pvt, pss4: { answers: [1, 3, 3, 1], score: 4 }, sym: {}, src: "user" }, "iss");
  await c.load(); const d = c.last();
  eq(d.moodVas, 70); eq(d.stressVas, 20); eq(d.pvt.lapses, 1); eq(d.pss4.score, 4);
  eq(c.lastPss().day, 1, "PSS-4 de esta semana");
});

// 11. Data management
test("Datos", "Borrar un chequeo quita solo ese día", async () => {
  const { db, c } = await scenario("steady");
  await c.remove(15); await c.load();
  eq(c.days.length, 29); ok(!c.days.some((d) => d.day === 15));
});
test("Datos", "La app empieza vacía: sin astronautas, chequeos ni mensajes de ejemplo", async () => {
  const db = await new Database({ memory: true }).open();
  const crew = new CrewModel(db); await crew.load();
  for (const st of ["crew", "checkins", "messages", "events"]) eq((await db.all(st)).length, 0, st);
});
test("Datos", "Respaldo: se exporta y se carga igual", async () => {
  const a = await new Database({ memory: true }).open();
  const crew = new CrewModel(a); await crew.load(); await crew.save({ name: "Ana", role: "cmo", age: 21 });
  const c = new CheckinModel(a, "CDR-1"); await seedHistory(c, "emergency", "mars");
  const backup = JSON.parse(JSON.stringify(await exportAll(a)));
  eq(validateBackup(backup), null, "respaldo válido");
  const b = await new Database({ memory: true }).open();
  await importAll(b, backup);
  eq((await b.all("crew")).length, 1); eq((await b.all("checkins")).length, 30);
  eq(validateBackup({ hola: 1 }), "backupInvalid", "rechaza archivos ajenos");
});
test("Datos", "Empezar desde cero borra todo", async () => {
  const { db } = await scenario("steady");
  await resetAll(db);
  eq((await db.all("checkins")).length, 0); eq((await db.all("crew")).length, 0);
});
test("Datos", "Recuerda el último tripulante elegido", async () => {
  const db = await new Database({ memory: true }).open();
  const crew = new CrewModel(db); await crew.load();
  const d = await crew.save({ name: "Recordar", role: "ms" });
  const before = (() => { try { return localStorage.getItem("astrovital-active-crew"); } catch (e) { return null; } })();
  crew.setActive(d._id);
  const again = new CrewModel(db); await again.load();
  eq(again.activeId, d._id);
  try { if (before) localStorage.setItem("astrovital-active-crew", before); else localStorage.removeItem("astrovital-active-crew"); } catch (e) {}
});

// Wristband and symptoms
test("Pulsera", "La pulsera virtual cambia en cada lectura y se queda en rangos posibles", async () => {
  let prev = readWearable(null), changed = 0;
  for (let i = 0; i < 30; i++) {
    const r = readWearable(prev);
    if (r.sys !== prev.sys || r.hr !== prev.hr || r.glu !== prev.glu) changed++;
    ok(r.sys >= 95 && r.sys <= 160 && r.hr >= 48 && r.hr <= 115 && r.spo2 >= 93 && r.spo2 <= 100, "en rango");
    ok(!!r.readAt, "hora de lectura");
    prev = r;
  }
  ok(changed >= 25, `cambió ${changed} de 30 veces`);
});
test("Pulsera", "Diez días seguidos no regresan siempre los mismos números", async () => {
  const c = new CheckinModel(await new Database({ memory: true }).open(), "T-1");
  for (let i = 0; i < 10; i++) await c.add({ ...readWearable(c.days.length ? c.last() : null), mood: 4, sym: {}, src: "user" }, "iss");
  ok(new Set(c.days.map((d) => d.sys)).size >= 5, "presión distinta entre días");
});

// Emergencies
test("Emergencias", "Hay protocolo para tormenta, corazón, oxígeno y temperatura, y cada zona roja tiene pasos", () => {
  ["storm", "heart", "oxygen", "temp"].forEach((k) => ok(PROTOCOLS[k].steps.length >= 4, k));
  eq(protocolFor("rad").type, "storm"); eq(protocolFor("lungs").type, "oxygen"); eq(protocolFor("immune").type, "temp");
  ["mind", "brain", "blood", "bones"].forEach((z) => ok(protocolFor(z).steps.length >= 2, z));
});
test("Emergencias", "Se guarda qué pasos se hicieron y a qué hora, y sale en el reporte", async () => {
  const { db, c, r } = await scenario("emergency");
  const emg = new EmergencyModel(db), crew = { _id: "TEST-1", name: "Prueba", role: "ms" };
  emg.start("heart", crew, "auto", { context: "Presión 154/97" });
  eq(emg.done(), false); eq(emg.done(), false);
  const doc = await emg.finish();
  eq(doc.steps.filter((x) => x.doneAt).length, 2, "2 pasos hechos");
  const saved = await emg.list("TEST-1");
  eq(saved.length, 1); eq(saved[0].type, "heart");
  ok(emergencyText(doc).includes("2/6"), "resumen 2/6");
  const rep = buildReport(c, r, "mars", crew, { events: saved });
  ok(rep.text.includes("EMERGENCIAS ATENDIDAS"), "sección en el reporte"); ok(rep.text.includes("[x] 1."), "paso marcado");
  eq(rep.payload.emergencies, 1);
});
test("Emergencias", "Sin astronauta los pasos funcionan pero no se guarda nada", async () => {
  const db = await new Database({ memory: true }).open();
  const emg = new EmergencyModel(db);
  emg.start("storm", null, "drill"); while (!emg.done()) {}
  const doc = await emg.finish();
  eq(doc.drill, true); eq((await db.all("events")).length, 0);
});

// Space weather
test("Clima espacial", "Escala S de NOAA: 9 = sin tormenta, 10 = S1, 206 = S2, 1000 = S3, 100000 = S5", () => {
  eq(sScale(9), 0); eq(sScale(10), 1); eq(sScale(206), 2); eq(sScale(1000), 3); eq(sScale(1e5), 5); eq(sScale(null), null);
  eq(stormLevel(0), 0); eq(stormLevel(2), 1); eq(stormLevel(3), 2);
  eq(sScale(STORED_EVENT.flux), STORED_EVENT.scale, "el evento real guardado (10 may 2024) es S2");
});
test("Clima espacial", "Lee el formato real de NOAA (protones ≥10 MeV) y el de NASA DONKI", () => {
  const noaa = [
    { time_tag: "2026-11-12T16:15:00Z", satellite: 18, flux: 23.87, energy: ">=1 MeV" },
    { time_tag: "2026-11-12T16:15:00Z", satellite: 18, flux: 0.197, energy: ">=10 MeV" },
    { time_tag: "2026-11-13T02:00:00Z", satellite: 18, flux: 0.222, energy: ">=10 MeV" },
    { time_tag: "2026-11-13T01:00:00Z", satellite: 18, flux: 12.5, energy: ">=10 MeV" },
  ];
  const p = parseProtons(noaa);
  near(p.flux, 0.222, 1e-9, "última lectura"); eq(p.at, "2026-11-13T02:00:00Z"); eq(p.satellite, 18); near(p.max24, 12.5, 1e-9, "máximo");
  eq(parseProtons([]), null); eq(parseProtons({ error: 1 }), null);
  const f = parseFlares([{ classType: "M1.2", peakTime: "2026-11-10T01:00Z" }, { classType: "X3.0", peakTime: "2026-11-11T06:54Z" }, { classType: "C9.9" }]);
  eq(f.classType, "X3.0"); eq(f.count, 3); eq(parseFlares([]), null);
});
test("Clima espacial", "Sin internet dice 'sin datos' y no inventa una tormenta", async () => {
  try { localStorage.removeItem("astrovital-spaceweather"); } catch (e) {}
  const w = new SpaceWeather(async () => { throw new Error("offline"); });
  const st = await w.refresh();
  eq(st.status, "offline"); eq(st.protons, null); eq(w.current(), null);
});
test("Clima espacial", "Con internet clasifica la lectura; si luego se cae, conserva la última real marcada como guardada", async () => {
  try { localStorage.removeItem("astrovital-spaceweather"); } catch (e) {}
  let online = true;
  const w = new SpaceWeather(async (url) => {
    if (!online) throw new Error("offline");
    return { ok: true, json: async () => (url.includes("noaa") ? [{ time_tag: "2026-11-15T06:00:00Z", satellite: 18, flux: 1500, energy: ">=10 MeV" }] : [{ classType: "X1.0", peakTime: "2026-11-15T05:00Z" }]) };
  });
  let st = await w.refresh();
  eq(st.status, "live"); eq(st.scale, 3); eq(st.flare.classType, "X1.0"); eq(w.current().scale, 3);
  online = false; st = await w.refresh();
  eq(st.status, "cached"); eq(st.scale, 3, "se conserva el dato real"); eq(w.current(), null, "pero un dato viejo no cuenta como en vivo");
  try { localStorage.removeItem("astrovital-spaceweather"); } catch (e) {}
});
test("Clima espacial", "Una tormenta S3 en vivo pone Radiación en rojo; S1 en amarillo", async () => {
  const { c } = await scenario("steady");
  eq(evaluateAll(c, "mars", { scale: 3, flux: 1500, at: "2026-11-15T06:00:00Z" }).zones.rad.lvl, 2);
  eq(evaluateAll(c, "mars", { scale: 1, flux: 20, at: "2026-11-15T06:00:00Z" }).zones.rad.lvl, 1);
  eq(evaluateAll(c, "mars", null).zones.rad.lvl, 0);
});

// Real distance to Mars (JPL)
test("Marte", "Distancia con la tabla de JPL: 27 ago 2003 ≈ 0.373 UA y 6 oct 2020 ≈ 0.415 UA (acercamientos reales)", () => {
  near(marsDistanceAU(new Date("2003-08-27T10:00:00Z")), 0.3727, 0.004);
  near(marsDistanceAU(new Date("2020-10-06T14:00:00Z")), 0.4149, 0.004);
});
test("Marte", "El retraso sale de la distancia: entre 3 y 22.5 minutos por tramo todo el año", () => {
  for (let m = 0; m < 26; m++) {
    const s = marsLightSeconds(new Date(Date.UTC(2026, m, 15))) / 60;
    ok(s > 3 && s < 22.5, `mes ${m}: ${s.toFixed(1)} min`);
  }
});
test("Marte", "El enlace usa ese retraso (1 min real = 1 s en la demo); Luna 1.3 s", () => {
  const d = linkDelay("mars", new Date("2026-11-15T07:00:00Z"));
  near(d.detail.au, 1.313, 0.01); near(d.seconds / 60, 10.9, 0.15); near(d.demoMs, d.seconds / 60 * 1000, 1);
  eq(linkDelay("moon").demoMs, 1300); eq(linkDelay("iss").demoMs, 500);
});

// Personal normal
test("Normal personal", "Con menos de 5 chequeos dice cuántos lleva y no compara", () => {
  const b = computeBaseline(generateHistory("steady").slice(0, 2));
  eq(b.ready, false); eq(b.count, 2); eq(b.needed, 5); eq(compareToBaseline({ hr: 90 }, b).length, 0);
});
test("Normal personal", "El normal es el promedio de los primeros 5 chequeos", () => {
  const days = [60, 62, 64, 66, 68, 99, 99].map((hr, i) => ({ day: i + 1, hr, sys: 110, dia: 70, temp: 36.6, glu: 90, spo2: 98, sleep: 7.5 }));
  const b = computeBaseline(days);
  eq(b.ready, true); near(b.normal.hr, 64, 1e-9, "los días 6 y 7 no cambian el normal");
});
test("Normal personal", "Pulso 12 arriba se marca; 4 arriba no; oxígeno solo se marca si baja", () => {
  const days = Array.from({ length: 5 }, (_, i) => ({ day: i + 1, hr: 64, sys: 110, dia: 70, temp: 36.6, glu: 90, spo2: 98, sleep: 7.5 }));
  const b = computeBaseline(days);
  const c1 = compareToBaseline({ ...days[0], hr: 76, spo2: 95 }, b);
  const hr = c1.find((x) => x.k === "hr"), ox = c1.find((x) => x.k === "spo2");
  eq(hr.diff, 12); eq(hr.flagged, true); ok(hr.txt.includes("pulso 12 arriba de lo normal para ti"), hr.txt);
  eq(ox.flagged, true, "oxígeno 3 abajo");
  const c2 = compareToBaseline({ ...days[0], hr: 68, spo2: 100 }, b);
  eq(c2.find((x) => x.k === "hr").flagged, false); eq(c2.find((x) => x.k === "spo2").flagged, false);
});
test("Normal personal", "Si casi siempre contestó 'No sé' en sueño, no hay normal de sueño", () => {
  const days = Array.from({ length: 5 }, (_, i) => ({ day: i + 1, hr: 64, sys: 110, dia: 70, temp: 36.6, glu: 90, spo2: 98, sleep: i < 2 ? 7 : null }));
  eq(computeBaseline(days).normal.sleep, null);
});

// 12. DTN link
test("Enlace", "Un mensaje llega solo después del retraso", async () => {
  const before = getMission(); setMission("iss");
  const db = await new Database({ memory: true }).open();
  const ship = new LinkModel(db, "ship"), earth = new LinkModel(db, "earth");
  await ship.setUp(true);
  await ship.send({ type: "report", crewId: "T", body: "x" });
  await earth.tick(); eq((await earth.received()).length, 0, "antes del retraso");
  await sleep(650); await earth.tick(); eq((await earth.received()).length, 1, "después del retraso");
  setMission(before);
});
test("Enlace", "Sin señal el mensaje espera en cola y sale al volver la señal", async () => {
  const before = getMission(); setMission("iss");
  const db = await new Database({ memory: true }).open();
  const ship = new LinkModel(db, "ship");
  await ship.setUp(false);
  const m = await ship.send({ type: "report", crewId: "T", body: "x" });
  eq(m.status, "queued");
  await ship.setUp(true); await sleep(650); await ship.tick();
  eq((await ship.sent())[0].status, "delivered");
  setMission(before);
});

// Runner
const out = document.getElementById("out");
let pass = 0, fail = 0, group = "";
for (const r of results) {
  if (r.group !== group) { group = r.group; out.insertAdjacentHTML("beforeend", `<h3>${group}</h3>`); }
  try { await r.fn(); pass++; out.insertAdjacentHTML("beforeend", `<div class="t ok">✓ ${r.name}</div>`); }
  catch (e) { fail++; out.insertAdjacentHTML("beforeend", `<div class="t bad">✗ ${r.name}<br><small>${e.message}</small></div>`); }
}
try { KEEP.forEach((k) => { if (saved[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); }); } catch (e) {}
const sum = document.getElementById("sum");
sum.textContent = `${pass} de ${results.length} pruebas pasaron${fail ? ` · ${fail} fallaron` : ""}`;
sum.dataset.ok = String(fail === 0);
document.title = `${fail ? "✗" : "✓"} AstroVital · Pruebas`;
window.__results = { pass, fail, total: results.length };
