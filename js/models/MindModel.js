// AstroVital · MindModel (Model layer): reaction test (PVT-B), mood and stress scales (0–100) and PSS-4.

/**
 * PVT-B, the 3-minute Psychomotor Vigilance Test used on the ISS (NASA Cognition battery).
 * Basner, Mollicone & Dinges, Acta Astronautica 69:949–959 (2011):
 * 3 min, stimuli every 1–4 s, lapse = reaction time ≥ 355 ms, false start = response with no stimulus or < 100 ms.
 */
export const PVT = { durationS: 180, practiceS: 30, lapseMs: 355, falseStartMs: 100, isiMin: 1000, isiMax: 4000, timeoutMs: 10000 };

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

/** Scores a PVT-B run. rts: valid reaction times (ms). */
export function scorePvt(rts, falseStarts, durationS) {
  const n = rts.length;
  if (!n) return null;
  const sorted = [...rts].sort((a, b) => a - b);
  const k = Math.max(1, Math.round(n * 0.1));
  const lapses = rts.filter((r) => r >= PVT.lapseMs).length;
  return {
    n,
    meanRT: Math.round(mean(rts)),
    medianRT: Math.round(sorted[Math.floor((n - 1) / 2)]),
    speed: +mean(rts.map((r) => 1000 / r)).toFixed(2),          // mean 1/RT (responses per second), main PVT-B outcome
    fastest10: Math.round(mean(sorted.slice(0, k))),
    slowest10Speed: +mean(sorted.slice(-k).map((r) => 1000 / r)).toFixed(2),
    lapses,
    falseStarts,
    // Performance score: 100 % minus lapses and false starts relative to stimuli (incl. false starts).
    score: Math.round(100 * (1 - (lapses + falseStarts) / (n + falseStarts))),
    durationS,
    practice: durationS < PVT.durationS,
  };
}

/** Runs one PVT session. The view gets callbacks; press() is called on tap or space bar. */
export class PvtSession {
  constructor(durationS, cb) {
    this.durationS = durationS; this.cb = cb;
    this.rts = []; this.falseStarts = 0; this.stimulusAt = null; this.timer = null; this.running = false;
  }
  start() {
    this.running = true; this.t0 = performance.now();
    this.next();
  }
  elapsed() { return (performance.now() - this.t0) / 1000; }
  next() {
    clearTimeout(this.timer);
    if (!this.running) return;
    if (this.elapsed() >= this.durationS) { this.end(); return; }
    this.cb.onWait && this.cb.onWait();
    const isi = PVT.isiMin + Math.random() * (PVT.isiMax - PVT.isiMin);
    this.timer = setTimeout(() => {
      if (!this.running) return;
      this.stimulusAt = performance.now();
      this.cb.onStimulus && this.cb.onStimulus(this.stimulusAt);
      // No answer in 10 s: counts as a (very long) lapse so the test never gets stuck.
      this.timer = setTimeout(() => this.respond(PVT.timeoutMs), PVT.timeoutMs);
    }, isi);
  }
  press() {
    if (!this.running) return;
    if (this.stimulusAt === null) { this.falseStarts++; this.cb.onFalseStart && this.cb.onFalseStart(); this.next(); return; }
    this.respond(performance.now() - this.stimulusAt);
  }
  respond(rt) {
    clearTimeout(this.timer);
    this.stimulusAt = null;
    if (rt < PVT.falseStartMs) { this.falseStarts++; this.cb.onFalseStart && this.cb.onFalseStart(); }
    else { this.rts.push(Math.round(rt)); this.cb.onResponse && this.cb.onResponse(Math.round(rt)); }
    this.timer = setTimeout(() => this.next(), 700); // show the reaction time briefly
  }
  end() {
    this.running = false; clearTimeout(this.timer);
    this.cb.onEnd && this.cb.onEnd(scorePvt(this.rts, this.falseStarts, this.durationS));
  }
  cancel() { this.running = false; clearTimeout(this.timer); }
}

/** Mood 0–100 → 1–5 (used by the rules that already worked with 1–5). */
export const vasToMood = (v) => Math.min(5, 1 + Math.floor(v / 20));

/**
 * PSS-4, Perceived Stress Scale, 4-item version (Cohen, Kamarck & Mermelstein 1983; Cohen & Williamson 1988).
 * Free for academic and educational use. Answers 0 = never … 4 = very often. Items 2 and 3 are reverse-scored.
 * Score 0–16: higher = more perceived stress. There is no official clinical cut-off.
 */
export const PSS4 = {
  items: [
    { es: "En el último mes, ¿con qué frecuencia has sentido que no podías controlar las cosas importantes de tu vida?", en: "In the last month, how often have you felt that you were unable to control the important things in your life?", reverse: false },
    { es: "En el último mes, ¿con qué frecuencia te has sentido seguro de tu capacidad para manejar tus problemas personales?", en: "In the last month, how often have you felt confident about your ability to handle your personal problems?", reverse: true },
    { es: "En el último mes, ¿con qué frecuencia has sentido que las cosas te van bien?", en: "In the last month, how often have you felt that things were going your way?", reverse: true },
    { es: "En el último mes, ¿con qué frecuencia has sentido que las dificultades se acumulan tanto que no puedes superarlas?", en: "In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?", reverse: false },
  ],
  options: [
    { es: "Nunca", en: "Never" }, { es: "Casi nunca", en: "Almost never" }, { es: "A veces", en: "Sometimes" },
    { es: "A menudo", en: "Fairly often" }, { es: "Muy a menudo", en: "Very often" },
  ],
  everyDays: 7, // asked once a week in the check-up
};

export function scorePss4(answers) {
  if (!answers || answers.length !== 4 || answers.some((a) => a === null || a === undefined)) return null;
  return answers.reduce((s, a, i) => s + (PSS4.items[i].reverse ? 4 - a : a), 0);
}
