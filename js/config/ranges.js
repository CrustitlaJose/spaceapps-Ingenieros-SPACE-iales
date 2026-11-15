// AstroVital · health indicator ranges.
// ev(value) returns 0 = green, 1 = yellow, 2 = red.
// Sources: American Heart Association (blood pressure), American Diabetes Association (fasting glucose),
// general adult clinical references for the rest. Edit numbers here; no other file needs to change.

export const INDICATORS = {
  sleep: { n: { es: "Sueño", en: "Sleep" }, u: "h", band: [7, 9], dec: 1, lo: 3, hi: 10,
    ev: (v) => (v >= 7 ? 0 : v >= 6 ? 1 : 2) },
  mood: { n: { es: "Ánimo", en: "Mood" }, u: "/5", band: [4, 5], dec: 0, lo: 1, hi: 5,
    ev: (v) => (v >= 4 ? 0 : v >= 3 ? 1 : 2) },
  sys: { n: { es: "Presión sistólica", en: "Systolic BP" }, u: "mmHg", band: [90, 129], dec: 0, lo: 80, hi: 170,
    ev: (v) => (v >= 140 || v < 85 ? 2 : v >= 130 || v < 90 ? 1 : 0) },
  dia: { n: { es: "Presión diastólica", en: "Diastolic BP" }, u: "mmHg", band: [60, 79], dec: 0, lo: 45, hi: 110,
    ev: (v) => (v >= 90 || v < 50 ? 2 : v >= 80 || v < 60 ? 1 : 0) },
  hr: { n: { es: "Frecuencia cardiaca en reposo", en: "Resting heart rate" }, u: { es: "lpm", en: "bpm" }, band: [50, 100], dec: 0, lo: 40, hi: 130,
    ev: (v) => (v > 120 || v < 40 ? 2 : v > 100 || v < 50 ? 1 : 0) },
  glu: { n: { es: "Glucosa", en: "Glucose" }, u: "mg/dL", band: [70, 99], dec: 0, lo: 50, hi: 160,
    ev: (v) => (v >= 126 || v < 54 ? 2 : v >= 100 || v < 70 ? 1 : 0) },
  temp: { n: { es: "Temperatura", en: "Temperature" }, u: "°C", band: [36.1, 37.4], dec: 1, lo: 35.5, hi: 39,
    ev: (v) => (v >= 38 || v < 35.5 ? 2 : v >= 37.5 || v < 36.1 ? 1 : 0) },
  spo2: { n: { es: "Oxígeno (SpO₂)", en: "Oxygen (SpO₂)" }, u: "%", band: [95, 100], dec: 0, lo: 85, hi: 100,
    ev: (v) => (v < 92 ? 2 : v < 95 ? 1 : 0) },
  ex: { n: { es: "Ejercicio", en: "Exercise" }, u: "min", band: [90, 150], dec: 0, lo: 0, hi: 160,
    ev: (v) => (v >= 90 ? 0 : v >= 45 ? 1 : 2) },
};

/** Level of a value; a missing value ("I don't know") counts as no alert. */
export const levelOf = (k, v) => (v === null || v === undefined || Number.isNaN(v) ? 0 : INDICATORS[k].ev(v));

/** How to measure each wristband value (help text in the check-up). */
export const HOW = {
  sys: { es: "Baumanómetro de brazo: sentado 5 minutos, brazo a la altura del corazón. Es el número de arriba.", en: "Arm cuff monitor: seated for 5 minutes, arm at heart level. It is the top number." },
  dia: { es: "El número de abajo del baumanómetro.", en: "The bottom number of the cuff monitor." },
  hr: { es: "Latidos por minuto en calma. A mano: cuenta los latidos en la muñeca 15 segundos y multiplica por 4.", en: "Beats per minute at rest. By hand: count wrist beats for 15 seconds and multiply by 4." },
  glu: { es: "Glucómetro con una gota de sangre del dedo, de preferencia en ayunas.", en: "Glucose meter with a drop of blood from the finger, ideally fasting." },
  spo2: { es: "Oxímetro de dedo: mano quieta y tibia unos 30 segundos.", en: "Finger pulse oximeter: hand still and warm for about 30 seconds." },
  temp: { es: "Termómetro bajo la lengua o en la frente.", en: "Thermometer under the tongue or on the forehead." },
  ex: { es: "Minutos de ejercicio que registró la pulsera hoy (resistencia y cardio).", en: "Minutes of exercise the wristband recorded today (resistance and cardio)." },
};

/** Indicators shown as charts in the Trends tab. */
export const CHART_KEYS = ["sys", "hr", "sleep", "mood", "glu", "temp", "spo2", "ex"];

/** Check-in fields typed by the astronaut (mood and symptoms are picked separately). */
export const FIELDS = ["sleep", "sys", "dia", "hr", "glu", "temp", "spo2", "ex"];

export const SYMPTOMS = {
  head: { es: "Dolor de cabeza", en: "Headache" },
  vision: { es: "Visión borrosa", en: "Blurred vision" },
  dizzy: { es: "Mareo", en: "Dizziness" },
  nausea: { es: "Náuseas", en: "Nausea" },
  rash: { es: "Erupción en la piel", en: "Skin rash" },
  chest: { es: "Dolor de pecho", en: "Chest pain" },
};

/** Trend thresholds used by the evaluator. */
export const TRENDS = {
  sysSlope: 0.4,     // mmHg per day over 14 days
  hrSlope: 0.3,      // bpm per day over 14 days
  gluSlope: 0.6,     // mg/dL per day over 14 days
  sleepAvg5: 6.8,    // hours, 5-day average
  moodAvg5: 3.2,     // 1–5, 5-day average
  exAvg5Yellow: 80,  // minutes, 5-day average
  exAvg5Red: 45,
};
