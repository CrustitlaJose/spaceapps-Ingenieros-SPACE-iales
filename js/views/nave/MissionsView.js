// AstroVital · MissionsView (View layer): points, level, streak, daily missions and badges.
import { t, tr, getLang } from "../../config/i18n.js";
import { TASKS } from "../../models/GamificationModel.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);

export function renderMissions(summary, isDone) {
  $("gStats").innerHTML = `
    <div class="stat"><div class="label">${esc(t("points"))}</div><div class="n mono">${summary.points.toLocaleString(getLang() === "en" ? "en-US" : "es-MX")}</div></div>
    <div class="stat"><div class="label">${esc(t("level"))}</div><div class="n">${summary.level}</div></div>
    <div class="stat"><div class="label">${esc(t("streak"))}</div><div class="n">${summary.streak} <span class="note">${esc(t("days"))}</span></div></div>
    <div class="stat"><div class="label">${esc(t("greenZones"))}</div><div class="n">${summary.greenZones}/8</div></div>`;
  $("tasks").innerHTML = TASKS.map((tk) => {
    const on = isDone(tk);
    return `<li><button type="button" class="chk" ${tk.auto ? "disabled" : ""} data-task="${tk.id}" aria-pressed="${on}" aria-label="${esc(tr(tk.n))}">${on ? "✓" : ""}</button>
      <div class="txt"><div>${esc(tr(tk.n))}</div>${tk.auto ? `<div class="auto">${esc(t("auto"))}</div>` : ""}</div><span class="pts">+${tk.pts}</span></li>`;
  }).join("");
  $("badges").innerHTML = summary.badges.map((b) =>
    `<div class="badge${b.on ? " on" : ""}"><span class="ic">${b.ic}</span><strong>${esc(tr(b.n))}</strong><span class="note">${esc(tr(b.dsc))}</span></div>`).join("");
}
