// AstroVital · InboxView (View layer, Earth Control): strip, reports received, reports in transit and report detail.
import { t, tr, L, LEVELS, getLang } from "../../config/i18n.js";
import { MISSIONS } from "../../config/missions.js";
import { ZONES } from "../../config/zones.js";
import { esc, clock, COLORS } from "../../utils/format.js";
import { statusChip } from "../nave/ReportView.js";
import { linkDelay } from "../../models/DelayModel.js";

const $ = (id) => document.getElementById(id);

export function renderEarthShell() {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("#langSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
}

export function renderEarthStrip(mission, up, inTransit) {
  const m = MISSIONS[mission];
  $("eMission").textContent = tr(m.name);
  $("eDelay").textContent = linkDelay(mission).detail ? `${linkDelay(mission).text} (demo: ${linkDelay(mission).demoText})` : linkDelay(mission).text;
  const ls = $("eLink");
  ls.dataset.up = String(up);
  ls.textContent = up ? t("linkUp") : t("linkDown");
  $("eTransit").textContent = String(inTransit);
  $("eToggle").textContent = up ? t("toggleLink") : t("restoreLink");
}

export function renderInbox(received, pending, selectedId, now) {
  $("pending").innerHTML = pending.length ? pending.map((p) => `<li class="msg">
      <div class="mh"><strong>${esc(p.type === "emergency" ? `🆘 ${L("Emergencia", "Emergency")}` : L("Reporte", "Report"))} · ${esc(L("Día", "Day"))} ${p.payload ? p.payload.day : "–"}</strong><span class="note">${clock(p.sentAt)}</span></div>
      <div>${statusChip(p, now)}</div></li>`).join("") : `<li class="empty">${esc(L("Nada en camino.", "Nothing on the way."))}</li>`;
  $("reports").innerHTML = received.length ? received.map((r) => {
    const lvl = r.payload ? r.payload.overall : 0;
    return `<li><button type="button" class="msg" data-report="${r._id}" aria-pressed="${selectedId === r._id}" data-new="${r.status === "delivered"}">
      <div class="mh"><strong>${r.type === "emergency" ? "🆘 " : ""}${esc(r.payload ? r.payload.crewId : "")} · ${esc(r.type === "emergency" ? L("Emergencia", "Emergency") : `${L("Día", "Day")} ${r.payload ? r.payload.day : "–"}`)}</strong><span class="pill" data-l="${lvl}">${esc(tr(LEVELS[lvl]))}</span></div>
      <div class="mh"><span class="note">${esc(L("Recibido", "Received"))} ${clock(r.deliveredAt || r.sentAt)}</span>${statusChip(r, now)}</div></button></li>`;
  }).join("") : `<li class="empty">${esc(t("waiting"))}</li>`;
}

export function renderDetail(report) {
  if (!report) { $("detail").innerHTML = `<p class="empty">${esc(t("selectReport"))}</p>`; return; }
  const p = report.payload || {};
  const lag = report.deliveredAt ? ((Date.parse(report.deliveredAt) - Date.parse(report.sentAt)) / 1000).toFixed(1) : "–";
  const real = report.realDelayS ? ` · ${L("retraso real", "real delay")}: ${report.realDelayS >= 60 ? (report.realDelayS / 60).toFixed(1) + " min" : report.realDelayS.toFixed(1) + " s"}` : "";
  if (report.type === "emergency") {
    $("detail").innerHTML = `<div class="zd-head"><div><span class="label">${esc(L("Aviso de emergencia de", "Emergency notice from"))} ${esc(p.crewId || "")} · ${esc(p.crewName || "")}</span>
        <h2>🆘 ${esc(tr(p.title) || L("Emergencia", "Emergency"))} · ${esc(tr(MISSIONS[p.mission || "mars"].name))}</h2></div>
        <span class="pill" data-l="2">${esc(tr(LEVELS[2]))}</span></div>
      <p class="note">${esc(L("Enviado", "Sent"))} ${clock(report.sentAt)} · ${esc(L("tardó", "took"))} ${lag} s ${esc(L("en llegar (demo)", "to arrive (demo)"))}${esc(real)}</p>
      <pre class="report" tabindex="0">${esc(report.body)}</pre>`;
    return;
  }
  const zones = p.zones ? ZONES.map((z) => `<span><i style="background:${COLORS[p.zones[z.id]]}"></i>${esc(tr(z.n))}</span>`).join("") : "";
  const v = p.vitals || {};
  const lagS = report.deliveredAt ? ((Date.parse(report.deliveredAt) - Date.parse(report.sentAt)) / 1000).toFixed(1) : "–";
  $("detail").innerHTML = `<div class="zd-head"><div><span class="label">${esc(L("Reporte de", "Report from"))} ${esc(p.crewId || "")} · ${esc(p.crewName || "")}</span>
      <h2>${esc(L("Día", "Day"))} ${p.day ?? "–"} · ${esc(tr(MISSIONS[p.mission || "mars"].name))}</h2></div>
      <span class="pill" data-l="${p.overall ?? 0}">${esc(tr(LEVELS[p.overall ?? 0]))}</span></div>
    <p class="note">${esc(L("Enviado", "Sent"))} ${clock(report.sentAt)} · ${esc(L("tardó", "took"))} ${lagS} s ${esc(L("en llegar (demo)", "to arrive (demo)"))}${esc(real)}</p>
    <div class="zlist">${zones}</div>
    <div class="vals">
      <div class="val"><div class="label">${esc(L("Presión", "BP"))}</div><div><span class="n">${v.sys}/${v.dia}</span><span class="u">mmHg</span></div></div>
      <div class="val"><div class="label">${esc(L("Frecuencia cardiaca", "Heart rate"))}</div><div><span class="n">${v.hr}</span><span class="u">${esc(L("lpm", "bpm"))}</span></div></div>
      <div class="val"><div class="label">SpO₂</div><div><span class="n">${v.spo2}</span><span class="u">%</span></div></div>
      <div class="val"><div class="label">Temp</div><div><span class="n">${Number(v.temp).toFixed(1)}</span><span class="u">°C</span></div></div>
    </div>
    <pre class="report" tabindex="0">${esc(report.body)}</pre>`;
}
