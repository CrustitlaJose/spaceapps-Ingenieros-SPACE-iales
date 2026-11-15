// AstroVital · EarthController (Controller layer): flight surgeons receive reports and send instructions back.
import { t, tr, setLang } from "../config/i18n.js";
import { LinkModel, getMission } from "../models/LinkModel.js";
import { renderEarthShell, renderEarthStrip, renderInbox, renderDetail } from "../views/tierra/InboxView.js";
import { QUICK, renderQuick, setReply, readReply, clearReply, setReplyError, renderSent } from "../views/tierra/ReplyView.js";
import { toast } from "../views/nave/ShellView.js";

export class EarthController {
  constructor(db) {
    this.db = db;
    this.link = new LinkModel(db, "earth");
    this.selected = null;
    this.known = null;
  }

  async start() {
    renderEarthShell();
    renderQuick();
    this.bindEvents();
    this.link.onChange(() => this.refresh());
    await this.refresh();
    // Redraw only when something arrived or is still travelling (keeps typing in the reply box smooth).
    setInterval(async () => { const changed = await this.link.tick(); if (changed || this.busy) await this.refresh(); }, 500);
  }

  async refresh() {
    const now = Date.now();
    const inbound = await this.link.inbound();
    const received = inbound.filter((m) => m.status === "delivered" || m.status === "read");
    const pending = inbound.filter((m) => m.status === "inTransit" || m.status === "queued");
    if (this.known) {
      const fresh = received.filter((m) => !this.known.has(m._id));
      if (fresh.length) { const emg = fresh.find((m) => m.type === "emergency");
        toast(emg ? (document.documentElement.lang === "en" ? "🆘 Emergency notice from the spacecraft" : "🆘 Aviso de emergencia de la nave") : (document.documentElement.lang === "en" ? "📡 New report from the spacecraft" : "📡 Nuevo reporte de la nave"));
        if (emg) { this.selected = emg._id; this.shownId = undefined; } else if (!this.selected) this.selected = fresh[0]._id; }
    }
    this.known = new Set(received.map((m) => m._id));
    if (!this.selected && received.length) this.selected = received[0]._id;
    renderEarthStrip(getMission(), this.link.isUp(), pending.length);
    renderInbox(received, pending, this.selected, now);
    const sel = received.find((m) => m._id === this.selected) || null;
    this.selectedCrew = sel && sel.payload ? sel.payload.crewId : null;
    document.getElementById("eCrew").textContent = sel && sel.payload ? `${sel.payload.crewId} · ${sel.payload.crewName}` : "–";
    if (sel && sel._id !== this.shownId) { renderDetail(sel); this.shownId = sel._id; }
    if (!sel && this.shownId !== null) { renderDetail(null); this.shownId = null; }
    const sent = await this.link.sent();
    this.busy = pending.some((m) => m.status === "inTransit") || sent.some((m) => m.status === "inTransit");
    renderSent(sent, now);
  }

  async sendReply() {
    const body = readReply();
    if (!body) { setReplyError(t("emptyReply")); return; }
    if (!this.selectedCrew) { setReplyError(t("selectReport")); return; }
    setReplyError("");
    const msg = await this.link.send({ type: "instruction", crewId: this.selectedCrew, body });
    clearReply();
    toast(msg.status === "queued" ? t("sentNoSignal") : t("replySent"));
    await this.refresh();
  }

  bindEvents() {
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const d = b.dataset;
      if (d.lang) { setLang(d.lang); renderEarthShell(); renderQuick(); this.shownId = undefined; await this.refresh(); return; }
      if (d.report) { this.selected = d.report; this.shownId = undefined; await this.link.markRead(d.report); await this.refresh(); return; }
      if (d.quick) { setReply(tr(QUICK[+d.quick])); return; }
      if (b.id === "replyBtn") { await this.sendReply(); return; }
      if (b.id === "eToggle") { await this.link.setUp(!this.link.isUp()); return; }
    });
  }
}
