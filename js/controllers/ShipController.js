// AstroVital · ShipController (Controller layer).
// Receives the astronaut's actions, asks the models to compute and save, and tells the views what to draw.

import { t, setLang } from "../config/i18n.js";
import { CheckinModel } from "../models/CheckinModel.js";
import { GamificationModel } from "../models/GamificationModel.js";
import { LinkModel, getMission, setMission } from "../models/LinkModel.js";
import { evaluateAll, trendAlerts, toAssessment } from "../models/HealthEvaluator.js";
import { radiationStatus, boneLoss } from "../models/RadiationModel.js";
import { buildReport } from "../models/ReportBuilder.js";
import { readWearable } from "../models/SensorSimulator.js";
import { renderShell, renderTabs, renderStrip, toast } from "../views/nave/ShellView.js";
import { renderTriage, renderBodyMap, renderZoneDetail } from "../views/nave/BodyMapView.js";
import { renderCheckinChoices, setMood, fillReading, readForm, resetForm, setError } from "../views/nave/CheckinView.js";
import { renderTrends } from "../views/nave/TrendsView.js";
import { renderMissions } from "../views/nave/MissionsView.js";
import { renderReportText, renderLinkPanel } from "../views/nave/ReportView.js";
import { renderScience } from "../views/nave/ScienceView.js";

const SCENARIO_KEY = "astrovital-scenario";
const $ = (id) => document.getElementById(id);

export class ShipController {
  constructor(db) {
    this.db = db;
    this.crew = { id: "CDR-1", name: "M. Rivera" };
    let scenario = "hidden";
    try { scenario = localStorage.getItem(SCENARIO_KEY) || "hidden"; } catch (e) {}
    this.state = { mission: getMission(), scenario, tab: "panel", zone: "heart", chart: "sys", mood: null, unread: 0 };
    this.checkins = new CheckinModel(db, this.crew.id);
    this.game = new GamificationModel(db, this.crew.id);
    this.link = new LinkModel(db, "ship");
    this.known = null; // ids of instructions already delivered
  }

  async start() {
    await this.checkins.load();
    if (!this.checkins.days.length) await this.checkins.seed(this.state.scenario, this.state.mission);
    await this.game.load();
    this.evaluate();
    this.state.zone = this.result.worst || "heart";
    renderShell(this.state);
    renderScience();
    renderCheckinChoices(this.state.mood);
    this.renderAll();
    this.bindEvents();
    this.link.onChange(() => this.refreshLink());
    await this.refreshLink();
    setInterval(async () => { await this.link.tick(); await this.refreshLink(); }, 500);
  }

  evaluate() { this.result = evaluateAll(this.checkins, this.state.mission); }

  renderAll() {
    const s = this.state, days = this.checkins.days, last = this.checkins.last();
    renderStrip(s, last.day, this.link.isUp());
    renderTriage(this.result, s.mission, true);
    renderBodyMap(this.result, s.zone);
    renderZoneDetail(s.zone, this.result, { rad: radiationStatus(days, s.mission), bone: boneLoss(days), day: last });
    renderTrends(trendAlerts(this.result), this.checkins, s.chart);
    const greens = Object.values(this.result.zones).filter((z) => z.lvl === 0).length;
    renderMissions(this.game.summary(days, greens), (tk) => this.game.isDone(last, tk));
    this.report = buildReport(this.checkins, this.result, s.mission, this.crew);
    renderReportText(this.report.text);
  }

  async refreshLink() {
    const sent = await this.link.sent();
    const received = await this.link.received();
    const delivered = received.filter((m) => m.status === "delivered");
    if (this.known) {
      const fresh = received.filter((m) => !this.known.has(m._id));
      if (fresh.length) toast(this.lang("📡 Nueva indicación de la Tierra", "📡 New instruction from Earth"));
    }
    this.known = new Set(received.map((m) => m._id));
    if (delivered.length !== this.state.unread) { this.state.unread = delivered.length; renderTabs(this.state); }
    renderStrip(this.state, this.checkins.last().day, this.link.isUp());
    renderLinkPanel({ mission: this.state.mission, up: this.link.isUp(), sent, received, now: Date.now() });
  }

  lang(es, en) { return document.documentElement.lang === "en" ? en : es; }

  async sendReport() {
    const msg = await this.link.send({ type: "report", crewId: this.crew.id, body: this.report.text, payload: this.report.payload });
    toast(msg.status === "queued" ? t("sentNoSignal") : t("sentQueued"));
    await this.refreshLink();
  }

  async saveCheckin(e) {
    e.preventDefault();
    const res = readForm(this.state.mood);
    if (!res.ok) { setError(res.error, res.field); return; }
    const rec = await this.checkins.add(res.rec, this.state.mission);
    this.evaluate();
    await this.checkins.saveAssessment(rec.day, toAssessment(this.result));
    Object.assign(this.state, { zone: this.result.worst || "heart", tab: "panel", mood: null });
    resetForm();
    renderCheckinChoices(null);
    renderTabs(this.state);
    this.renderAll();
    toast(t("saved"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async changeScenario(scenario) {
    this.state.scenario = scenario;
    try { localStorage.setItem(SCENARIO_KEY, scenario); } catch (e) {}
    await this.checkins.seed(scenario, this.state.mission);
    this.evaluate();
    this.state.zone = this.result.worst || "heart";
    this.renderAll();
  }

  bindEvents() {
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("button, .hot");
      if (!b) return;
      const s = this.state, d = b.dataset;
      if (d.mission) {
        s.mission = d.mission; setMission(d.mission);
        this.evaluate(); renderShell(s); this.renderAll(); await this.refreshLink(); return;
      }
      if (d.lang) {
        setLang(d.lang); renderShell(s); renderScience(); renderCheckinChoices(s.mood); this.renderAll(); await this.refreshLink(); return;
      }
      if (d.tab) {
        s.tab = d.tab; renderTabs(s);
        if (d.tab === "report") setTimeout(async () => {
          for (const m of await this.link.received()) if (m.status === "delivered") await this.link.markRead(m._id);
        }, 4000);
        return;
      }
      if (d.zone) { s.zone = d.zone; this.renderAll(); return; }
      if (d.chart) { s.chart = d.chart; this.renderAll(); return; }
      if (d.mood) { s.mood = +d.mood; setMood(s.mood); return; }
      if (d.task) { await this.game.toggle(this.checkins.last().day, d.task); this.renderAll(); return; }
      if (d.action === "send-report" || b.id === "sendBtn") { await this.sendReport(); return; }
      if (b.id === "syncBtn") { fillReading(readWearable(this.checkins.last())); toast(this.lang("Datos de la pulsera simulada recibidos", "Simulated wearable data received")); return; }
      if (b.id === "linkToggle") { await this.link.setUp(!this.link.isUp()); return; }
      if (b.id === "clearMsgs") { await this.link.clearAll(); return; }
      if (b.id === "copyBtn") {
        const fallback = () => { const sel = window.getSelection(), rg = document.createRange(); rg.selectNodeContents($("report")); sel.removeAllRanges(); sel.addRange(rg); toast(t("copyFail")); };
        try { navigator.clipboard.writeText(this.report.text).then(() => toast(t("copied")), fallback); } catch (err) { fallback(); }
      }
    });
    document.addEventListener("keydown", (e) => {
      const h = e.target.closest && e.target.closest(".hot");
      if (h && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault(); this.state.zone = h.dataset.zone; this.renderAll();
        const n = document.querySelector(`.hot[data-zone="${this.state.zone}"]`); if (n) n.focus();
      }
    });
    $("scenario").addEventListener("change", (e) => this.changeScenario(e.target.value));
    $("ciForm").addEventListener("submit", (e) => this.saveCheckin(e));
  }
}
