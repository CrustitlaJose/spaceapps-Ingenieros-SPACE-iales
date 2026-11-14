// AstroVital · TrendsView (View layer): early warnings, sparklines and the full chart.
import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { INDICATORS, CHART_KEYS } from "../../config/ranges.js";
import { esc, fmt, unit, sgn } from "../../utils/format.js";
import { sparkSvg, lineChartSvg } from "../../utils/charts.js";
import { slope } from "../../models/HealthEvaluator.js";

const $ = (id) => document.getElementById(id);

export function renderTrends(alerts, checkins, chartKey) {
  $("trAlerts").innerHTML = alerts.length
    ? alerts.map((a) => `<li data-l="${a.l}">${esc(a.txt)}</li>`).join("")
    : `<li style="border-left-color:var(--ok)">${esc(t("noTrends"))}</li>`;
  const last = checkins.last();
  $("sparks").innerHTML = CHART_KEYS.map((k) => {
    const I = INDICATORS[k], v = checkins.series(k, 14), s = slope(v), lv = I.ev(last[k]);
    const arrow = Math.abs(s) < (I.hi - I.lo) * 0.004 ? "→" : s > 0 ? "↗" : "↘";
    return `<button type="button" class="spark" data-chart="${k}" aria-pressed="${chartKey === k}">
      <div class="top2"><span class="label">${esc(tr(I.n))}</span><span class="pill" data-l="${lv}">${esc(tr(LEVELS[lv]))}</span></div>
      <div><span class="n">${fmt(k, last[k])}</span> <span class="note">${esc(unit(k))}</span></div>
      ${sparkSvg(k, v)}
      <span class="tr">${arrow} ${sgn(s)} ${esc(unit(k))}${esc(t("perDay"))} · ${esc(t("last14"))}</span></button>`;
  }).join("");
  $("chartTitle").textContent = `${tr(INDICATORS[chartKey].n)} (${unit(chartKey)}) · ${checkins.days.length} ${t("days")}`;
  $("chart").innerHTML = lineChartSvg(chartKey, checkins.days, L("D", "D"));
}
