// AstroVital · DataView (View layer): who the check-up is for, the check-up log, and "Your data" (backup, delete).
import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { ROLES } from "../../config/crew.js";
import { ZONES } from "../../config/zones.js";
import { INDICATORS, SYMPTOMS } from "../../config/ranges.js";
import { esc, fmt, unit, COLORS } from "../../utils/format.js";
import { sourceLabel } from "./CheckinView.js";

const $ = (id) => document.getElementById(id);

/** Banner on top of the check-up: whose data this is. */
export function renderWho(crew) {
  $("ciWho").innerHTML = `<span class="who-dot" aria-hidden="true"></span>
    <span class="who-text"><span class="label">${esc(t("ciWho"))}</span><span><strong>${esc(crew.name)}</strong> <span class="mono">${esc(crew._id)}</span> · ${esc(tr(ROLES[crew.role || "ms"].n))}</span></span>
    <button type="button" class="btn small" data-go-pick="1">${esc(t("ciChange"))}</button>`;
}

/** Everything that was captured in one check-up. */
function logDetail(d) {
  const src = d.sources || {};
  const tag = (k) => (src[k] ? `<span class="src-tag small" data-src="${src[k] === "sim" ? "sim" : src[k] === "manual" ? "manual" : "self"}">${esc(sourceLabel(src[k]))}</span>` : "");
  const cell = (label, value, extra = "") => `<div class="ld-cell"><span class="label">${esc(label)}</span><span class="ld-val">${value}</span>${extra}</div>`;
  const sym = Object.keys(d.sym || {}).filter((k) => d.sym[k]).map((k) => tr(SYMPTOMS[k]));
  const vit = ["hr", "sys", "dia", "spo2", "temp", "glu", "ex"].map((k) => cell(tr(INDICATORS[k].n), `${fmt(k, d[k])} <small>${esc(unit(k))}</small>`, tag(k))).join("");
  const ans = cell(tr(INDICATORS.sleep.n), d.sleep == null ? esc(L("No sabe", "Unknown")) : `${fmt("sleep", d.sleep)} <small>h</small>`)
    + (d.moodVas != null ? cell(L("Ánimo", "Mood"), `${d.moodVas}<small>/100</small>`) : cell(L("Ánimo", "Mood"), `${d.mood}<small>/5</small>`))
    + (d.stressVas != null ? cell(L("Estrés", "Stress"), `${d.stressVas}<small>/100</small>`) : "")
    + cell(L("Síntomas", "Symptoms"), esc(sym.length ? sym.join(", ") : L("Ninguno", "None")));
  const pvt = d.pvt ? cell(L("Reacción promedio", "Mean reaction"), `${d.pvt.meanRT} <small>ms</small>`) + cell(L("Lapsos", "Lapses"), d.pvt.lapses) + cell(L("Salidas en falso", "False starts"), d.pvt.falseStarts) + cell(L("Puntaje", "Score"), `${d.pvt.score}<small>%</small>`, d.pvt.practice ? `<span class="note">${esc(L("práctica", "practice"))}</span>` : "")
    : cell(L("Prueba de reacción", "Reaction test"), esc(L("No se hizo", "Not taken")));
  const pss = d.pss4 ? cell("PSS-4", `${d.pss4.score}<small>/16</small>`) : "";
  const storm = cell(L("Clima espacial (NOAA)", "Space weather (NOAA)"), d.storm ? `S${d.storm.scale} <small>${Number(d.storm.flux).toFixed(1)} pfu</small>` : esc(L("Sin datos en vivo", "No live data")));
  const zones = d.zonesLvl ? `<div class="ld-zones">${ZONES.map((z) => `<span><i style="background:${COLORS[d.zonesLvl[z.id] ?? 0]}"></i>${esc(tr(z.n))}</span>`).join("")}</div>` : "";
  return `<div class="log-detail">
    <div><span class="label">${esc(L("Signos", "Vitals"))}</span><div class="ld-grid">${vit}</div></div>
    <div><span class="label">${esc(L("Respuestas", "Answers"))}</span><div class="ld-grid">${ans}</div></div>
    <div><span class="label">${esc(L("Mente", "Mind"))}</span><div class="ld-grid">${pvt}${pss}${storm}</div></div>
    ${zones ? `<div><span class="label">${esc(L("Resultado por zona", "Result by zone"))}</span>${zones}</div>` : ""}</div>`;
}

/** Check-up log, newest first: only what the crew captured. Each one can be opened to see everything that was saved. */
export function renderLog(days, levels, confirmDay, openDay) {
  $("ciLog").innerHTML = days.length ? [...days].reverse().map((d) => {
    const lvl = levels[d.day], open = openDay === d.day;
    const when = d.createdAt ? new Date(d.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    const vitals = `${d.sys}/${d.dia} mmHg · ${d.hr} ${L("lpm", "bpm")} · SpO₂ ${d.spo2}% · ${d.sleep == null ? "–" : d.sleep} h`;
    const actions = confirmDay === d.day
      ? `<button type="button" class="btn small danger" data-log-confirm="${d.day}">${esc(t("logConfirm"))}</button><button type="button" class="btn small" data-log-cancel="1">${esc(t("cancel"))}</button>`
      : `<button type="button" class="btn small" data-log-open="${d.day}" aria-expanded="${open}">${esc(open ? t("logHide") : t("logView"))}</button><button type="button" class="btn small" data-log-delete="${d.day}">${esc(t("logDelete"))}</button>`;
    return `<li class="msg log-row" data-open="${open}">
      <div class="mh"><strong>${esc(L("Día", "Day"))} ${d.day}${lvl != null ? ` <span class="pill" data-l="${lvl}">${esc(tr(LEVELS[lvl]))}</span>` : ""}</strong><span class="note">${esc(when)}</span></div>
      <div class="note">${esc(vitals)}</div>
      ${open ? logDetail(d) : ""}
      <div class="row">${actions}</div></li>`;
  }).join("") : `<li class="empty">${esc(t("noDataSub"))}</li>`;
}

/** In-page confirmation for "Your data" actions. kind: reset | load | null */
export function renderDataConfirm(kind, c) {
  const box = $("dataConfirm");
  box.hidden = !kind;
  if (!kind) { box.innerHTML = ""; return; }
  const what = kind === "reset" ? `${c.crew} ${L("astronautas", "astronauts")}, ${c.checkins} ${L("chequeos", "check-ups")} ${L("y", "and")} ${c.messages} ${L("mensajes", "messages")}`
    : L("todos los datos actuales de este navegador", "all current data in this browser");
  const btn = kind === "reset" ? "resetConfirm" : "bkConfirm";
  box.innerHTML = `<p><strong>${esc(t("willDelete"))}: ${esc(what)}.</strong> ${esc(t("cantUndo"))}</p>
    <div class="row"><button type="button" class="btn small danger" data-data-confirm="${kind}">${esc(t(btn))}</button>
    <button type="button" class="btn small" data-data-cancel="1">${esc(t("cancel"))}</button></div>`;
}

/** Triggers a file download (works on GitHub Pages and Live Server). */
export function downloadJson(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
