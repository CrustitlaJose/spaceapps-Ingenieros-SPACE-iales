// AstroVital · GamificationModel (Model layer): daily health missions, points, level, badges.

export const TASKS = [
  { id: "checkin", pts: 50, auto: (d) => d.src === "user", n: { es: "Completa tu check-in de hoy", en: "Complete today's check-in" } },
  { id: "ex", pts: 40, auto: (d) => d.ex >= 90, n: { es: "90 min de ejercicio (resistencia + cardio)", en: "90 min of exercise (resistance + cardio)" } },
  { id: "sleep", pts: 30, auto: (d) => d.sleep >= 7, n: { es: "Dormir 7 horas o más", en: "Sleep 7 hours or more" } },
  { id: "garden", pts: 20, n: { es: "10 min en el huerto a bordo", en: "10 min at the on-board garden" } },
  { id: "water", pts: 15, n: { es: "Tomar 2 litros de agua", en: "Drink 2 liters of water" } },
  { id: "call", pts: 15, n: { es: "Llamada con familia o amigos", en: "Call with family or friends" } },
];

export class GamificationModel {
  constructor(db, crewId) {
    this.db = db;
    this.crewId = crewId;
    this.done = {}; // `${day}-${task}` -> true
  }

  async load() {
    const docs = await this.db.find("missions", { crewId: this.crewId });
    this.done = Object.fromEntries(docs.filter((d) => d.done).map((d) => [`${d.day}-${d.task}`, true]));
  }

  async toggle(day, taskId) {
    const key = `${day}-${taskId}`;
    const now = !this.done[key];
    if (now) this.done[key] = true; else delete this.done[key];
    const task = TASKS.find((t) => t.id === taskId);
    await this.db.put("missions", { _id: `${this.crewId}-${day}-${taskId}`, crewId: this.crewId, day, task: taskId, done: now, points: task.pts });
  }

  isDone(day, task) { return task.auto ? task.auto(day) : !!this.done[`${day.day}-${task.id}`]; }

  summary(days, greenZones) {
    const d = days[days.length - 1];
    const hist = days.length * 50 + days.reduce((s, x) => s + (x.ex >= 90 ? 40 : 0) + (x.sleep >= 7 ? 30 : 0), 0);
    const manual = TASKS.filter((t) => !t.auto && this.done[`${d.day}-${t.id}`]).reduce((s, t) => s + t.pts, 0);
    const points = hist + manual + greenZones * 10;
    const tail = (k, n) => days.slice(-n).map((x) => x[k]);
    const badges = [
      { on: days.length >= 1, ic: "01", n: { es: "Primer check-in", en: "First check-in" }, dsc: { es: "Empezaste a cuidar tu salud", en: "You started tracking your health" } },
      { on: days.length >= 7, ic: "07", n: { es: "Semana completa", en: "Full week" }, dsc: { es: "7 días seguidos de check-in", en: "7 check-ins in a row" } },
      { on: days.length >= 30, ic: "30", n: { es: "Mes en órbita", en: "Month in orbit" }, dsc: { es: "30 días de seguimiento", en: "30 days of tracking" } },
      { on: tail("ex", 7).every((v) => v >= 90), ic: "Ca", n: { es: "Guardián de huesos", en: "Bone guardian" }, dsc: { es: "90 min de ejercicio 7 días seguidos", en: "90 min of exercise 7 days in a row" } },
      { on: tail("sleep", 5).every((v) => v >= 7), ic: "Zz", n: { es: "Sueño de astronauta", en: "Astronaut sleep" }, dsc: { es: "7 h de sueño 5 noches seguidas", en: "7 h of sleep 5 nights in a row" } },
      { on: Object.keys(this.done).some((k) => k.endsWith("-garden")), ic: "🌱", n: { es: "Jardinero espacial", en: "Space gardener" }, dsc: { es: "Visitaste el huerto a bordo", en: "You visited the on-board garden" } },
    ];
    return { points, level: Math.floor(points / 1000) + 1, streak: days.length, greenZones, badges };
  }
}
