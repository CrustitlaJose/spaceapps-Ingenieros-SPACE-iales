// AstroVital · ReportView (View layer): flight-surgeon report, link status, outbox and instructions from Earth.
import { t, tr, L } from "../../config/i18n.js";
import { MISSIONS } from "../../config/missions.js";
import { esc, clock, secs } from "../../utils/format.js";
import { linkDelay } from "../../models/DelayModel.js";

const $ = (id) => document.getElementById(id);

export function renderReportText(text) { $("report").textContent = text; }

export function statusChip(m, now) {
  let extra = "";
  if (m.status === "inTransit") {
    const left = m.deliverAt - now, pct = Math.min(100, Math.max(0, 100 - (left / m.delayMs) * 100));
    extra = ` <span class="count">${esc(t("arrivesIn"))} ${secs(left)}</span><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div>`;
  }
  return `<span class="st" data-s="${m.status}">${esc(t("st_" + m.status))}</span>${extra}`;
}

/** "Delay per leg" text; for Mars it comes from today's real distance (JPL orbits). */
export function delayLine(mission) {
  const d = linkDelay(mission);
  return d.detail
    ? L(`Retraso real hoy: ${d.text} por tramo · Marte a ${d.detail.au} UA (${d.detail.millionKm} millones de km, órbitas de JPL) · en la demo 1 min = 1 s`,
        `Real delay today: ${d.text} per leg · Mars at ${d.detail.au} au (${d.detail.millionKm} million km, JPL orbits) · in the demo 1 min = 1 s`)
    : `${L("Retraso por tramo", "Delay per leg")}: ${d.text}`;
}

export function renderLinkPanel({ mission, up, sent, received, now }) {
  const m = MISSIONS[mission];
  $("linkInfo").innerHTML = `<span class="linkstate" data-up="${up}">${esc(up ? t("linkUp") : t("linkDown"))}</span>
    <span class="note">${esc(delayLine(mission))}</span>
    <p class="note" style="flex-basis:100%">${esc(t("linkQueueNote"))}</p>`;
  $("linkToggle").textContent = up ? t("toggleLink") : t("restoreLink");
  $("outbox").innerHTML = sent.length ? sent.map((s) => `<li class="msg">
      <div class="mh"><strong>${esc(s.type === "emergency" ? `🆘 ${L("Emergencia", "Emergency")}` : L("Reporte", "Report"))} · ${esc(L("Día", "Day"))} ${s.payload ? s.payload.day : "–"}</strong><span class="note">${clock(s.sentAt)}</span></div>
      <div>${statusChip(s, now)}</div></li>`).join("")
    : `<li class="empty">${esc(t("noMsgs"))}</li>`;
  $("inboxShip").innerHTML = received.length ? received.map((r) => `<li class="msg" data-new="${r.status === "delivered"}">
      <div class="mh"><strong>${esc(L("Cirujano de vuelo", "Flight surgeon"))}</strong><span class="note">${clock(r.deliveredAt || r.sentAt)}</span></div>
      <div class="mb">${esc(r.body)}</div>
      <div>${statusChip(r, now)}</div></li>`).join("")
    : `<li class="empty">${esc(t("noMsgs"))}</li>`;
}
