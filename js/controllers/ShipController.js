// AstroVital · ShipController (Controller layer).
// Receives the astronaut's actions, asks the models to compute and save, and tells the views what to draw.
// The check-up is a guided path, one screen at a time:
// astronaut → pulse (camera) → wristband → reaction → questions → result (send to Earth).

import { t, tr, setLang, L } from "../config/i18n.js";
import { CheckinModel } from "../models/CheckinModel.js";
import { CrewModel } from "../models/CrewModel.js";
import { LinkModel, getMission, setMission } from "../models/LinkModel.js";
import { evaluateAll, trendAlerts, toAssessment } from "../models/HealthEvaluator.js";
import { radiationStatus, boneLoss } from "../models/RadiationModel.js";
import { buildReport } from "../models/ReportBuilder.js";
import { readWearable } from "../models/SensorSimulator.js";
import { CameraPulse } from "../models/CameraPulse.js";
import { PVT, PSS4, PvtSession } from "../models/MindModel.js";
import { exportAll, validateBackup, importAll, resetAll, counts } from "../models/DataModel.js";
import { SpaceWeather, S_NAMES } from "../models/SpaceWeather.js";
import { computeBaseline, compareToBaseline } from "../models/BaselineModel.js";
import { EmergencyModel, emergencyText } from "../models/EmergencyModel.js";
import { showEmergency, renderEmergencyPicker, renderEmergencyStep, renderEmergencySummary, renderEmergencyLog } from "../views/nave/EmergencyView.js";
import { renderShell, renderTabs, renderEmpty, toast } from "../views/nave/ShellView.js";
import { renderZoneChips, renderZoneDetail } from "../views/nave/BodyMapView.js";
import { renderAstronaut, scanAstronaut, setStorm, setAct } from "../views/nave/AstronautStage.js";
import { renderHome, renderTelemetry, showDetail, detailOpen, renderWeather, commNote, zoneValue, briefText } from "../views/nave/HomeView.js";
import { renderCheckinChoices, onSymptomChange, keepManual, readForm, resetForm, setError, renderWear, renderCamera, setSleepUnknown } from "../views/nave/CheckinView.js";
import { renderPvtLength, renderPvt, tickCounter, renderVas, renderPss } from "../views/nave/MindView.js";
import { showStep, renderStart, renderPick, renderResult, LAST_INPUT_STEP, RESULT_STEP } from "../views/nave/WizardView.js";
import { renderWho, renderLog, renderDataConfirm, downloadJson } from "../views/nave/DataView.js";
import { renderTrends } from "../views/nave/TrendsView.js";
import { renderReportText, renderLinkPanel } from "../views/nave/ReportView.js";
import { renderCrewList, openCrewForm, closeCrewForm, readCrewForm, setCrewError, renderCrewSelect } from "../views/nave/CrewView.js";
import { speak, stopSpeaking } from "../utils/speech.js";

const STORM_ACK_KEY = "astrovital-storm-ack";
const WEATHER_EVERY_MS = 5 * 60 * 1000; // NOAA publishes a new reading every 5 minutes
const $ = (id) => document.getElementById(id);

export class ShipController {
  constructor(db) {
    this.db = db;
    this.state = { mission: getMission(), tab: "panel", zone: "heart", chart: "sys", unread: 0, confirmId: null, logConfirm: null, ci: ShipController.freshCheckup() };
    this.camera = null;
    this.pvt = null;
    this.crewModel = new CrewModel(db);
    this.checkins = new CheckinModel(db, null);
    this.link = new LinkModel(db, "ship");
    this.weather = new SpaceWeather();
    this.emg = new EmergencyModel(db);
    this.events = [];      // emergency log of the active astronaut
    this.voice = true;     // read emergency steps aloud
    this.busyLink = false; // messages still travelling: keep the countdown moving
    this.known = null;
    this.report = null;
    this.sentDays = new Set(); // days already reported to Earth (active astronaut)
  }

  /** A check-up in progress. step: 0 astronaut · 1 pulse · 2 wristband · 3 reaction · 4 questions · 5 result */
  static freshCheckup() {
    return { step: 0, showPicker: false, wear: null, manual: false, cam: null, sleepUnknown: false, pvtLen: PVT.durationS, send: null,
      mind: { moodVas: 50, stressVas: 50, moodTouched: false, stressTouched: false, pvt: null, pvtSkipped: false, pssAnswers: [null, null, null, null], pssDue: true } };
  }

  get crew() { return this.crewModel.active() || null; }
  get hasData() { return this.checkins.days.length > 0; }
  lang(es, en) { return document.documentElement.lang === "en" ? en : es; }

  async start() {
    await this.crewModel.load();
    await this.loadCrewData();
    if (!this.crew || !this.hasData) this.state.tab = "checkin"; // nothing yet: start with the check-up
    renderShell(this.state);
    renderCheckinChoices();
    await this.renderCrew();
    this.renderAll();
    this.prepareCheckup();
    this.bindEvents();
    this.link.onChange(() => this.refreshLink());
    await this.refreshLink();
    // The link is checked twice a second, but the screen is only redrawn when something changed or is travelling.
    setInterval(async () => { const changed = await this.link.tick(); if (changed || this.busyLink) await this.refreshLink(); }, 500);
    this.refreshWeather();
    setInterval(() => this.refreshWeather(), WEATHER_EVERY_MS);
    setTimeout(scanAstronaut, 500); // the one orchestrated moment on load: a scan pass over the astronaut
  }

  /** Live space weather (NOAA + NASA DONKI). A strong storm (S3+) opens the storm protocol by itself, once per storm. */
  async refreshWeather() {
    const before = this.weather.current();
    const w = await this.weather.refresh();
    const now = this.weather.current();
    if ((before ? before.scale : null) !== (now ? now.scale : null) && this.hasData) { this.evaluate(); this.renderAll(); }
    else this.drawWeather();
    if (now && now.scale >= 3 && !this.emg.active) {
      const key = `${now.scale}-${String(w.protons.at).slice(0, 10)}`;
      let ack = null; try { ack = localStorage.getItem(STORM_ACK_KEY); } catch (e) {}
      if (ack !== key) {
        try { localStorage.setItem(STORM_ACK_KEY, key); } catch (e) {}
        this.startEmergency("storm", "storm", `NOAA GOES: ${tr(S_NAMES[now.scale])}, ${Math.round(now.flux)} pfu`);
      }
    }
  }

  /** Voice summary of Today: status, the reason, and what to do next (works offline, no AI service). */
  speakBrief() {
    if (!this.result || !this.homeCtx) return;
    if (this.briefing) { stopSpeaking(); this.briefing = false; return; }
    this.briefing = true;
    speak(briefText(this.result, this.homeCtx), () => { this.briefing = false; });
  }

  drawWeather() {
    renderWeather(this.weather.state, this.hasData ? radiationStatus(this.checkins.days, this.state.mission, this.weather.current()) : null);
  }

  /** Loads the active astronaut's check-ups. */
  async loadCrewData() {
    this.checkins.setCrew(this.crew ? this.crew._id : null);
    if (this.crew) await this.checkins.load(); else this.checkins.days = [];
    this.events = this.crew ? await this.emg.list(this.crew._id) : [];
    this.evaluate();
    this.state.zone = (this.result && this.result.worst) || "heart";
    this.known = null;
  }

  evaluate() { this.result = this.hasData ? evaluateAll(this.checkins, this.state.mission, this.weather.current()) : null; }

  // ---------- Today, history, comms ----------

  /** Today's routine: what the astronaut has to do and what is already done. */
  buildPlan(last) {
    return [
      { id: "checkin", label: L("Chequeo de la mañana", "Morning check-up"), done: last.src === "user",
        action: 'data-tab="checkin"', actionLabel: L("Hacer chequeo", "Do check-up") },
      { id: "ex", label: L("Ejercicio: 90 min (resistencia + cardio)", "Exercise: 90 min (resistance + cardio)"), done: last.ex >= 90 },
      { id: "sleep", label: L("Dormir 7 horas o más", "Sleep 7 hours or more"), done: last.sleep >= 7 },
      { id: "report", label: L("Enviar resumen a la Tierra", "Send summary to Earth"), done: this.sentDays.has(last.day),
        action: 'data-action="send-report"', actionLabel: L("Enviar a la Tierra", "Send to Earth") },
    ];
  }

  /** Real check-ups in a row, counting back from the last one. */
  streak() {
    let n = 0;
    for (let i = this.checkins.days.length - 1; i >= 0 && this.checkins.days[i].src === "user"; i--) n++;
    return n;
  }

  renderTelemetryLine() {
    renderTelemetry({ crew: this.crew, mission: this.state.mission, day: this.hasData ? this.checkins.last().day : 0, linkUp: this.link.isUp() });
  }

  renderLogList() {
    const levels = {};
    this.checkins.days.forEach((d) => { if (d.lvl != null) levels[d.day] = d.lvl; });
    renderLog(this.checkins.days, levels, this.state.logConfirm, this.state.logOpen);
  }

  renderAll() {
    const s = this.state;
    this.renderTelemetryLine();
    this.renderLogList();
    renderEmergencyLog(this.events);
    this.drawWeather();
    $("hero").dataset.mission = s.mission;
    if (!this.hasData) { showDetail(false); renderEmpty(!!this.crew); renderAstronaut(null); this.report = null; return; }
    const days = this.checkins.days, last = this.checkins.last(), storm = this.weather.current();
    const rad = radiationStatus(days, s.mission, storm);
    const baseline = computeBaseline(days), compare = compareToBaseline(last, baseline);
    this.homeCtx = { crew: this.crew, mission: s.mission, day: last, rad, plan: this.buildPlan(last), streak: this.streak(), baseline, compare };
    renderHome(this.result, this.homeCtx);
    renderAstronaut(this.result, Object.fromEntries(Object.keys(this.result.zones).map((id) => [id, zoneValue(id, last, rad)])), s.zone, detailOpen());
    renderZoneChips(this.result, s.zone);
    this.updateStormFx();
    renderZoneDetail(s.zone, this.result, { rad, bone: boneLoss(days), day: last, baseline, compare });
    renderTrends(trendAlerts(this.result), this.checkins, s.chart);
    this.report = buildReport(this.checkins, this.result, s.mission, this.crew, { storm, baseline, events: this.events });
    renderReportText(this.report.text);
  }

  async renderCrew() {
    // per astronaut: how many check-ups are saved and which was the last one
    const info = {}, c = {};
    (await this.db.all("checkins")).forEach((d) => {
      const i = info[d.crewId] || (info[d.crewId] = { count: 0, last: null });
      i.count++;
      if (!i.last || d.day > i.last.day) i.last = { day: d.day, createdAt: d.createdAt || null, lvl: d.assessment ? d.assessment.overall : null };
    });
    Object.keys(info).forEach((k) => { c[k] = info[k].count; });
    this.crewInfo = info;
    renderCrewList(this.crewModel.list, this.crewModel.activeId, c, this.state.confirmId);
    renderCrewSelect(this.crewModel.list, this.crewModel.activeId);
    renderPick(this.crewModel.list, this.crewModel.activeId, info);
  }

  async refreshLink() {
    const id = this.crew ? this.crew._id : null;
    const sent = id ? (await this.link.sent()).filter((m) => m.crewId === id) : [];
    const received = id ? (await this.link.received()).filter((m) => m.crewId === id) : [];
    const delivered = received.filter((m) => m.status === "delivered");
    this.busyLink = sent.some((m) => m.status === "inTransit");
    if (this.known) {
      const fresh = received.filter((m) => !this.known.has(m._id));
      if (fresh.length) toast(this.lang("📡 Nueva indicación de la Tierra", "📡 New instruction from Earth"));
    }
    this.known = new Set(received.map((m) => m._id));
    if (delivered.length !== this.state.unread) { this.state.unread = delivered.length; renderTabs(this.state); }
    const days = new Set(sent.filter((m) => m.type === "report" && m.payload).map((m) => m.payload.day));
    const changed = days.size !== this.sentDays.size || [...days].some((d) => !this.sentDays.has(d));
    this.sentDays = days;
    if (changed && this.hasData) this.renderAll(); else this.renderTelemetryLine();
    renderLinkPanel({ mission: this.state.mission, up: this.link.isUp(), sent, received, now: Date.now() });
  }

  /** Sends the summary to Earth. Without signal it waits in the queue and leaves on its own later. */
  async sendReport() {
    if (!this.report || !this.crew) { toast(t("noDataSub")); return null; }
    const msg = await this.link.send({ type: "report", crewId: this.crew._id, body: this.report.text, payload: this.report.payload });
    toast(msg.status === "queued" ? t("sentNoSignal") : t("sentQueued"));
    await this.refreshLink();
    return msg;
  }

  // ---------- Check-up: one screen at a time ----------

  /** Draws the current step of the check-up. */
  prepareCheckup() {
    const ci = this.state.ci;
    if (!this.crew) ci.step = 0;
    showStep(ci.step);
    renderStart(this.crew, this.crew && this.crewInfo ? this.crewInfo[this.crew._id] : null, ci.showPicker);
    if (this.crew) renderWho(this.crew);
    if (!ci.wear) ci.wear = readWearable(this.hasData ? this.checkins.last() : null);
    renderWear(ci);
    renderCamera(ci.cam === "skipped" ? "skipped" : ci.cam ? "done" : "idle", ci.cam || {});
    setSleepUnknown(ci.sleepUnknown);
    renderPvtLength(ci.pvtLen);
    if (!this.pvt || !this.pvt.running) renderPvt(ci.mind.pvtSkipped ? "skipped" : ci.mind.pvt ? "done" : "idle", { result: ci.mind.pvt });
    renderVas(ci.mind);
    const today = this.hasData ? this.checkins.last().day + 1 : 1;
    ci.mind.pssDue = renderPss(ci.mind, this.checkins.lastPss(), today);
    if (ci.step === RESULT_STEP && this.result && this.crew) renderResult(this.result, this.crew, ci.send);
  }

  goStep(step) {
    stopSpeaking();
    this.state.ci.step = step;
    this.prepareCheckup();
    window.scrollTo({ top: 0 });
  }

  /** "Next": closes the current step and moves on. An optional step left untouched counts as skipped. */
  nextStep() {
    const ci = this.state.ci;
    if (ci.step === 1) {
      if (this.camera && this.camera.running) { setError(t("waitCam")); return; }
      if (!ci.cam) ci.cam = "skipped";
    }
    if (ci.step === 2) {
      const bad = keepManual(ci);
      if (bad) { setError(bad.error, bad.field); return; }
    }
    if (ci.step === 3) {
      if (this.pvt && this.pvt.running) { setError(t("waitPvt")); return; }
      if (!ci.mind.pvt) ci.mind.pvtSkipped = true;
    }
    this.goStep(Math.min(LAST_INPUT_STEP, ci.step + 1));
  }

  backStep() {
    if (this.camera && this.camera.running) { this.camera.cancel(); this.camera.close(); }
    if (this.pvt && this.pvt.running) this.cancelPvt();
    if (this.state.ci.step === 2) keepManual(this.state.ci, false);
    this.goStep(Math.max(0, this.state.ci.step - 1));
  }

  /** A new, empty check-up starting at the astronaut step. */
  newCheckup() {
    this.state.ci = ShipController.freshCheckup();
    resetForm();
    renderCheckinChoices();
  }

  /** Choosing an astronaut shows their start screen (their saved check-ups and the "Start" button). */
  async pickAstronaut(id) {
    if (!this.crew || this.crew._id !== id) await this.switchCrew(id, true);
    this.newCheckup();
    this.goStep(0);
  }

  /** Shows the result of the last saved check-up again, without starting a new one. */
  viewLastResult() {
    if (!this.hasData || !this.result) return;
    this.newCheckup();
    this.state.ci.send = this.sentDays.has(this.checkins.last().day) ? "sent" : null;
    this.goStep(RESULT_STEP);
  }

  async measurePulse() {
    if (!CameraPulse.supported()) { renderCamera("error", { msg: t("camNoSupport") }); return; }
    this.camera = this.camera || new CameraPulse($("camVideo"));
    renderCamera("opening");
    try { await this.camera.open(); }
    catch (err) { this.camera.close(); renderCamera("error", { msg: t("camDenied") }); return; }
    const total = 30;
    renderCamera("measuring", { elapsed: 0, total, light: 128 });
    const result = await this.camera.measure(total, (p) => renderCamera("measuring", { ...p, total }));
    this.camera.close();
    const prev = this.state.ci.cam;
    if (!result) { renderCamera(prev && prev !== "skipped" ? "done" : "idle", prev || {}); return; } // cancelled
    if (!result.bpm || result.bpm < 40 || result.bpm > 180) { renderCamera("error", { msg: t("camFailed") }); return; }
    this.state.ci.cam = result;
    renderWear(this.state.ci);
    renderCamera("done", result);
  }

  /** PVT-B: random 1–4 s waits, a running millisecond counter, tap or space bar to respond. */
  startPvt() {
    const ci = this.state.ci, total = +$("pvtLen").value || PVT.durationS;
    ci.pvtLen = total; ci.mind.pvtSkipped = false;
    const left = () => Math.max(0, total - this.pvt.elapsed());
    let raf = null;
    const stopCounter = () => { if (raf) cancelAnimationFrame(raf); raf = null; };
    this.pvt = new PvtSession(total, {
      onWait: () => renderPvt("wait", { left: left(), total }),
      onStimulus: (at) => {
        renderPvt("stimulus", { left: left(), total });
        const loop = () => { tickCounter(performance.now() - at); raf = requestAnimationFrame(loop); };
        loop();
      },
      onResponse: (rt) => { stopCounter(); renderPvt("response", { left: left(), total, rt }); },
      onFalseStart: () => { stopCounter(); renderPvt("falsestart", { left: left(), total }); },
      onEnd: (result) => { stopCounter(); ci.mind.pvt = result; renderPvt("done", { result }); },
    });
    this.pvt.start();
    $("pvtBox").focus();
  }

  cancelPvt() {
    if (this.pvt && this.pvt.running) this.pvt.cancel();
    const m = this.state.ci.mind;
    renderPvt(m.pvt ? "done" : "idle", { result: m.pvt });
  }

  /** Reads the PSS-4 aloud: each question followed by its answer options. index: one question only. */
  readPss(index = null) {
    const opts = PSS4.options.map((o) => tr(o)).join(", ");
    const one = (i) => [`${i + 1}. ${tr(PSS4.items[i])}`, opts];
    const texts = index === null ? [t("pssTitle"), ...PSS4.items.flatMap((_, i) => one(i))] : one(index);
    const stop = $("pssStop"), go = $("pssSpeak");
    if (stop) stop.hidden = false;
    if (go) go.hidden = true;
    speak(texts, () => { if (stop) stop.hidden = true; if (go) go.hidden = false; });
  }

  /** "Save and see result" (end of step 4). */
  async saveCheckin(e) {
    e.preventDefault();
    if (this.state.ci.step !== LAST_INPUT_STEP) return;
    if (this.pvt && this.pvt.running) { setError(t("waitPvt")); return; }
    const res = readForm(this.state.ci);
    if (!res.ok) { setError(res.error, res.field); return; }
    stopSpeaking();
    res.rec.storm = this.weather.current(); // NOAA reading at this moment, or null without internet
    const rec = await this.checkins.add(res.rec, this.state.mission);
    this.evaluate();
    await this.checkins.saveAssessment(rec.day, toAssessment(this.result));
    this.checkins.last().lvl = this.result.overall;
    this.state.zone = this.result.worst || "heart";
    this.renderAll();
    await this.renderCrew();
    toast(t("saved"));
    this.goStep(RESULT_STEP);
    // A red zone opens the emergency steps by itself
    if (this.result.overall === 2 && !this.emg.active) {
      const z = this.result.worst, f = this.result.zones[z].findings.find((x) => x.l === 2);
      this.startEmergency(z, "auto", f ? f.txt : null);
    }
  }

  // ---------- Emergencies ----------

  /**
   * How the radiation storm looks on the astronaut and the background.
   * During the storm protocol it follows the steps: storm at full strength, the refuge shield goes up when the crew
   * reaches the shelter, and the storm fades at the last step. Otherwise it follows the radiation zone (NOAA data).
   */
  updateStormFx() {
    const a = this.emg.active;
    let level = 0, shield = 0, act = null;
    if (a && a.type === "storm") {
      const last = a.index === a.steps.length - 1;
      level = last ? 0.4 : 1; shield = a.index >= 2 ? 1 : a.index >= 1 ? 0.45 : 0;
    } else if (a) {
      // heart, oxygen, fever and the other zones: the camera goes to the zone and the guide animates on the suit
      const type = ["heart", "oxygen", "temp"].includes(a.type) ? a.type : "zone";
      act = { type, zone: a.zone, progress: a.steps.length > 1 ? a.index / (a.steps.length - 1) : 0, drill: a.drill, breath: !!a.steps[a.index].breath };
    } else if (this.result) {
      const l = this.result.zones.rad.lvl;
      level = l === 2 ? 0.85 : l === 1 ? 0.35 : 0;
    }
    setStorm(level, shield);
    setAct(act);
  }

  emgUi() {
    const a = this.emg.active;
    return { voice: this.voice, comm: commNote(this.state.mission), why: a.trigger === "auto" ? t("emgAuto") : a.trigger === "storm" ? t("emgStormAuto") : "" };
  }

  sayStep() { if (this.voice && this.emg.step) speak([tr(this.emg.step)]); }

  /** Red button: with a zone in red it starts that protocol; otherwise it asks which emergency it is. */
  openEmergency() {
    this.leaveCheckin();
    if (this.result && this.result.overall === 2) {
      const z = this.result.worst, f = this.result.zones[z].findings.find((x) => x.l === 2);
      this.startEmergency(z, "manual", f ? f.txt : null);
      return;
    }
    showEmergency(true);
    renderEmergencyPicker(this.crew);
  }

  /** trigger: auto | storm | manual | drill */
  startEmergency(typeOrZone, trigger, context = null) {
    const a = this.emg.start(typeOrZone, this.crew, trigger, { context });
    if (!a) return;
    // Every emergency is shown on the astronaut: go to Today and keep the guide on the right
    this.leaveCheckin(); if (detailOpen()) showDetail(false);
    this.state.tab = "panel"; renderTabs(this.state); window.scrollTo({ top: 0 });
    showEmergency(true, true);
    this.updateStormFx();
    renderEmergencyStep(a, this.emgUi());
    if (this.voice) speak([`${a.drill ? t("emgDrillTag") : t("emgTag")}. ${tr(a.protocol.name)}.`, tr(this.emg.step)]);
  }

  async emergencyDone() {
    if (!this.emg.active) return;
    if (!this.emg.done()) { renderEmergencyStep(this.emg.active, this.emgUi()); this.updateStormFx(); this.sayStep(); return; }
    await this.finishEmergency();
  }

  /** Saves the log and, if it was real, tells Earth right away (it waits in the queue without signal). */
  async finishEmergency() {
    stopSpeaking();
    const doc = await this.emg.finish();
    this.updateStormFx();
    if (!doc) return;
    let send = null;
    if (doc.crewId) {
      this.events = await this.emg.list(doc.crewId);
      if (!doc.drill) {
        const day = this.hasData ? this.checkins.last().day : 0;
        const msg = await this.link.send({ type: "emergency", crewId: doc.crewId, body: emergencyText(doc),
          payload: { kind: "emergency", crewId: doc.crewId, crewName: doc.crewName, day, mission: this.state.mission, overall: 2, title: doc.name } });
        send = msg.status === "queued" ? "queued" : "sent";
      }
      this.renderAll();
      await this.refreshLink();
    }
    renderEmergencySummary(doc, send);
    if (this.voice) speak([t("emgSummary")]);
  }

  closeEmergency() {
    stopSpeaking();
    this.emg.cancel();
    showEmergency(false);
    this.updateStormFx();
  }

  // ---------- Crew ----------

  async switchCrew(id, quiet = false) {
    this.crewModel.setActive(id || null);
    this.state.confirmId = null;
    this.newCheckup();
    await this.loadCrewData();
    await this.renderCrew();
    this.renderAll();
    this.prepareCheckup();
    await this.refreshLink();
    if (!quiet && this.crew) toast(`${this.crew._id} · ${this.crew.name}`);
  }

  async saveCrew(e) {
    e.preventDefault();
    const profile = readCrewForm();
    const err = this.crewModel.validate(profile);
    if (err) { setCrewError(t(err)); return; }
    const isNew = !profile._id;
    const doc = await this.crewModel.save(profile);
    closeCrewForm();
    if (isNew) {
      this.crewModel.setActive(doc._id);
      this.checkins.setCrew(doc._id);
      await this.loadCrewData();
      // A new astronaut goes straight into their first check-up (pulse step)
      this.newCheckup();
      this.state.ci.step = 1;
      this.state.tab = "checkin";
      renderTabs(this.state);
    }
    await this.renderCrew();
    this.renderAll();
    this.prepareCheckup();
    await this.refreshLink();
    toast(t("crewSaved"));
    window.scrollTo({ top: 0 });
  }

  // ---------- Settings: your data ----------

  async reloadAll() {
    await this.crewModel.load();
    this.newCheckup();
    await this.loadCrewData();
    await this.renderCrew();
    this.renderAll();
    this.prepareCheckup();
    await this.refreshLink();
  }

  async doDataAction(kind) {
    if (kind === "reset") { await resetAll(this.db); toast(t("resetDone")); }
    if (kind === "load" && this.pendingBackup) { await importAll(this.db, this.pendingBackup); this.pendingBackup = null; toast(t("bkLoaded")); }
    renderDataConfirm(null);
    await this.reloadAll();
  }

  // ---------- Events ----------

  leaveCheckin() {
    if (this.camera && this.camera.running) { this.camera.cancel(); this.camera.close(); }
    if (this.pvt && this.pvt.running) this.cancelPvt();
    stopSpeaking();
  }

  bindEvents() {
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("button, .hot");
      if (!b) return;
      const s = this.state, d = b.dataset;
      // Emergencies
      if (b.id === "emgBtn") { this.openEmergency(); return; }
      if (d.emgZone) { this.startEmergency(d.emgZone, "manual", null); return; }
      if (d.emgType) { const drill = $("emgDrill") && $("emgDrill").checked; this.startEmergency(d.emgType, drill ? "drill" : "manual", drill ? t("emgDrillCtx") : null); return; }
      if (b.id === "stormDrill") { this.startEmergency("storm", "drill", t("wxDrillCtx")); return; }
      if (d.emgDone) { await this.emergencyDone(); return; }
      if (d.emgBack) { this.emg.back(); renderEmergencyStep(this.emg.active, this.emgUi()); this.updateStormFx(); this.sayStep(); return; }
      if (d.emgRepeat) { if (this.emg.step) speak([tr(this.emg.step)]); return; }
      if (d.emgVoice) { this.voice = !this.voice; if (!this.voice) stopSpeaking(); renderEmergencyStep(this.emg.active, this.emgUi()); this.sayStep(); return; }
      if (d.emgAbort) { if (this.emg.active && this.emg.active.steps.some((x) => x.doneAt)) await this.finishEmergency(); else this.closeEmergency(); return; }
      if (d.emgClose) { this.closeEmergency(); return; }
      if (d.mission) { s.mission = d.mission; setMission(d.mission); this.evaluate(); renderShell(s); this.renderAll(); await this.refreshLink(); return; }
      if (d.lang) { if (s.tab === "checkin" && s.ci.step === 2) keepManual(s.ci, false); setLang(d.lang); renderShell(s); renderCheckinChoices(); await this.renderCrew(); this.renderAll(); this.prepareCheckup(); await this.refreshLink(); return; }
      if (d.tab) {
        if (s.tab === "checkin" && d.tab !== "checkin") this.leaveCheckin();
        if (d.tab !== "panel" && detailOpen()) { showDetail(false); if (this.hasData) this.renderAll(); }
        if (d.tab === "panel" && s.tab !== "panel") setTimeout(scanAstronaut, 60); // one scan pass when Today opens
        // Opening the check-up after a finished one starts a new one
        if (d.tab === "checkin" && s.ci.step === RESULT_STEP) this.newCheckup();
        s.tab = d.tab; renderTabs(s);
        if (d.tab === "checkin") this.prepareCheckup();
        if (d.addCrew) openCrewForm(null);
        if (d.tab === "more") renderDataConfirm(null);
        if (d.tab === "report") setTimeout(async () => {
          if (!this.crew) return;
          for (const m of await this.link.received()) if (m.status === "delivered" && m.crewId === this.crew._id) await this.link.markRead(m._id);
        }, 4000);
        window.scrollTo({ top: 0 });
        return;
      }
      if (d.openZone) { if (!this.hasData) return; s.zone = d.openZone; if (s.tab !== "panel") { s.tab = "panel"; renderTabs(s); } showDetail(true); this.renderAll(); return; }
      if (b.id === "hideDetail") { showDetail(false); this.renderAll(); return; }
      if (d.zone) { s.zone = d.zone; this.renderAll(); return; }
      if (d.chart) { s.chart = d.chart; this.renderAll(); return; }
      // Check-up path
      if (d.pick) { await this.pickAstronaut(d.pick); return; }
      if (d.goPick) { this.leaveCheckin(); this.newCheckup(); s.ci.showPicker = true; this.goStep(0); return; }
      if (d.startCheckup) { this.newCheckup(); this.goStep(1); return; }
      if (d.viewLast) { this.viewLastResult(); return; }
      if (d.togglePicker) { s.ci.showPicker = !s.ci.showPicker; this.prepareCheckup(); return; }
      if (d.action === "brief") { this.speakBrief(); return; }
      if (b.id === "wizNext") { this.nextStep(); return; }
      if (b.id === "wizBack") { this.backStep(); return; }
      if (b.id === "camStart") { this.measurePulse(); return; }
      if (b.id === "camCancel") { if (this.camera) { this.camera.cancel(); this.camera.close(); } renderCamera(s.ci.cam && s.ci.cam !== "skipped" ? "done" : "idle", s.ci.cam || {}); return; }
      if (b.id === "camSkip") { s.ci.cam = "skipped"; renderWear(s.ci); renderCamera("skipped"); this.nextStep(); return; }
      if (b.id === "syncBtn") { s.ci.wear = readWearable(this.hasData ? this.checkins.last() : null); renderWear(s.ci); toast(this.lang("Pulsera virtual leída de nuevo", "Virtual wristband read again")); return; }
      if (b.id === "manualBtn") { keepManual(s.ci, false); s.ci.manual = !s.ci.manual; if (!s.ci.manual) s.ci.wear = readWearable(this.hasData ? this.checkins.last() : null); renderWear(s.ci); return; }
      if (b.id === "pvtStart") { this.startPvt(); return; }
      if (b.id === "pvtCancel") { this.cancelPvt(); return; }
      if (b.id === "pvtSkip") { s.ci.mind.pvt = null; s.ci.mind.pvtSkipped = true; renderPvt("skipped"); this.nextStep(); return; }
      if (b.id === "sleepUnknown") { s.ci.sleepUnknown = !s.ci.sleepUnknown; setSleepUnknown(s.ci.sleepUnknown); return; }
      if (b.id === "pssSpeak") { this.readPss(); return; }
      if (b.id === "pssStop") { stopSpeaking(); b.hidden = true; const g = $("pssSpeak"); if (g) g.hidden = false; return; }
      if (d.speakQ != null) { e.preventDefault(); this.readPss(+d.speakQ); return; }
      if (d.action === "send-report" || b.id === "sendBtn") {
        const msg = await this.sendReport();
        if (msg && s.tab === "checkin" && s.ci.step === RESULT_STEP) { s.ci.send = msg.status === "queued" ? "queued" : "sent"; renderResult(this.result, this.crew, s.ci.send); }
        return;
      }
      // History
      if (d.logOpen) { s.logOpen = s.logOpen === +d.logOpen ? null : +d.logOpen; this.renderLogList(); return; }
      if (d.logDelete) { s.logConfirm = +d.logDelete; this.renderLogList(); return; }
      if (d.logCancel) { s.logConfirm = null; this.renderLogList(); return; }
      if (d.logConfirm) {
        await this.checkins.remove(+d.logConfirm); s.logConfirm = null;
        this.evaluate(); s.zone = (this.result && this.result.worst) || "heart";
        this.renderAll(); await this.renderCrew(); toast(t("logDeleted")); return;
      }
      // Crew
      if (d.crewSelect) { await this.switchCrew(d.crewSelect); return; }
      if (d.crewEdit) { openCrewForm(this.crewModel.list.find((c) => c._id === d.crewEdit)); return; }
      if (d.crewRemove) { s.confirmId = d.crewRemove; await this.renderCrew(); return; }
      if (d.crewCancel) { s.confirmId = null; await this.renderCrew(); return; }
      if (d.crewConfirm) {
        await this.crewModel.remove(d.crewConfirm);
        s.confirmId = null;
        this.newCheckup();
        await this.loadCrewData(); await this.renderCrew(); this.renderAll(); this.prepareCheckup(); await this.refreshLink();
        toast(t("crewRemoved")); return;
      }
      if (b.id === "addCrewBtn") { openCrewForm(null); return; }
      if (b.id === "crewCancelBtn") { closeCrewForm(); return; }
      // Settings
      if (b.id === "bkSave") { downloadJson(await exportAll(this.db), `astrovital-respaldo-${new Date().toISOString().slice(0, 10)}.json`); toast(t("bkSaved")); return; }
      if (b.id === "resetAll") { renderDataConfirm("reset", await counts(this.db)); return; }
      if (d.dataConfirm) { await this.doDataAction(d.dataConfirm); return; }
      if (d.dataCancel) { this.pendingBackup = null; renderDataConfirm(null); return; }
      // Comms
      if (b.id === "linkToggle") { await this.link.setUp(!this.link.isUp()); return; }
      if (b.id === "clearMsgs") { await this.link.clearAll(); await this.refreshLink(); toast(t("clrMsgsDone")); return; }
      if (b.id === "copyBtn" && this.report) {
        const fallback = () => { const sel = window.getSelection(), rg = document.createRange(); rg.selectNodeContents($("report")); sel.removeAllRanges(); sel.addRange(rg); toast(t("copyFail")); };
        try { navigator.clipboard.writeText(this.report.text).then(() => toast(t("copied")), fallback); } catch (err) { fallback(); }
      }
    });

    // Reaction test: tap the box or press the space bar
    $("pvtBox").addEventListener("pointerdown", (e) => { if (this.pvt && this.pvt.running) { e.preventDefault(); this.pvt.press(); } });
    document.addEventListener("keydown", (e) => {
      if (this.pvt && this.pvt.running && (e.code === "Space" || e.key === " ")) { e.preventDefault(); if (!e.repeat) this.pvt.press(); return; }
      if (e.key === "Enter" && this.state.tab === "checkin" && e.target.tagName === "INPUT" && this.state.ci.step < LAST_INPUT_STEP) { e.preventDefault(); return; }
      if (e.key === "Escape" && detailOpen() && !this.emg.active) { showDetail(false); this.renderAll(); return; }
      const h = e.target.closest && e.target.closest(".hot");
      if (h && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); h.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
    });
    $("crewSel").addEventListener("change", (e) => { if (e.target.value) this.switchCrew(e.target.value); });
    $("ciForm").addEventListener("submit", (e) => this.saveCheckin(e));
    $("crewForm").addEventListener("submit", (e) => this.saveCrew(e));
    $("syms").addEventListener("change", (e) => onSymptomChange(e.target));
    ["mood", "stress"].forEach((k) => $("vas-" + k).addEventListener("input", (e) => {
      const m = this.state.ci.mind; m[k + "Vas"] = +e.target.value; m[k + "Touched"] = true; renderVas(m);
      if (m.moodTouched && m.stressTouched) setError("");
    }));
    $("pssBox").addEventListener("change", (e) => {
      const n = e.target.name && e.target.name.match(/^pss-(\d)$/);
      if (n) this.state.ci.mind.pssAnswers[+n[1]] = +e.target.value;
    });
    $("bkFile").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = "";
      if (!f) return;
      let obj = null;
      try { obj = JSON.parse(await f.text()); } catch (err) { obj = null; }
      const bad = validateBackup(obj);
      if (bad) { toast(t(bad)); return; }
      this.pendingBackup = obj;
      renderDataConfirm("load", await counts(this.db));
    });
  }
}
