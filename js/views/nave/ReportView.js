// AstroVital · ReportView (View layer): flight-surgeon report, link status, outbox and instructions from Earth.
import { t, tr, L } from "../../config/i18n.js";
import { MISSIONS } from "../../config/missions.js";
import { esc, clock, secs } from "../../utils/format.js";

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

export function renderLinkPanel({ mission, up, sent, received, now }) {
  const m = MISSIONS[mission];
  $("linkInfo").innerHTML = `<span class="linkstate" data-up="${up}">${esc(up ? t("linkUp") : t("linkDown"))}</span>
    <span class="note">${esc(L("Retraso por tramo", "Delay per leg"))}: ${esc(tr(m.demo))}</span>`;
  $("linkToggle").textContent = up ? t("toggleLink") : t("restoreLink");
  $("outbox").innerHTML = sent.length ? sent.map((s) => `<li class="msg">
      <div class="mh"><strong>${esc(L("Reporte", "Report"))} · ${esc(L("Día", "Day"))} ${s.payload ? s.payload.day : "–"}</strong><span class="note">${clock(s.sentAt)}</span></div>
      <div>${statusChip(s, now)}</div></li>`).join("")
    : `<li class="empty">${esc(t("noMsgs"))}</li>`;
  $("inboxShip").innerHTML = received.length ? received.map((r) => `<li class="msg" data-new="${r.status === "delivered"}">
      <div class="mh"><strong>${esc(L("Cirujano de vuelo", "Flight surgeon"))}</strong><span class="note">${clock(r.deliveredAt || r.sentAt)}</span></div>
      <div class="mb">${esc(r.body)}</div>
      <div>${statusChip(r, now)}</div></li>`).join("")
    : `<li class="empty">${esc(t("noMsgs"))}</li>`;
}
