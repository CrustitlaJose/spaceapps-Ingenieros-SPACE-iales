// AstroVital · ShellView (View layer): header controls, status strip, tabs and static texts of the Ship app.
import { t, tr, getLang } from "../../config/i18n.js";
import { MISSIONS } from "../../config/missions.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);
export const TABS = [["panel", "tPanel"], ["checkin", "tCheckin"], ["trends", "tTrends"], ["report", "tReport"], ["crew", "tCrew"], ["more", "tMore"]];

export function renderShell(s) {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $("missionSeg").innerHTML = Object.entries(MISSIONS).map(([k, m]) =>
    `<button type="button" data-mission="${k}" aria-pressed="${s.mission === k}">${esc(tr(m.name))}</button>`).join("");
  document.querySelectorAll("#langSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
  renderTabs(s);
}

export function renderTabs(s) {
  $("tabs").innerHTML = TABS.map(([k, l]) => {
    const badge = k === "report" && s.unread ? `<span class="badge-n" aria-label="${s.unread}">${s.unread}</span>` : "";
    return `<button type="button" role="tab" data-tab="${k}" aria-selected="${s.tab === k}" aria-controls="v-${k}">${esc(t(l))}${badge}</button>`;
  }).join("");
  TABS.forEach(([k]) => { $("v-" + k).hidden = s.tab !== k; });
}

/** Shown when the active astronaut has no check-ins yet. */
export function renderEmpty(hasCrew = true) {
  const sub = t(hasCrew ? "noDataSub" : "noCrewSub");
  const msg = `<p class="empty">${esc(sub)}</p>`;
  $("hero").dataset.l = "none";
  $("heroBody").innerHTML = `<p class="hero-meta"><span>${esc(t("noDataTitle"))}</span></p>
    <h2 class="hero-title">${esc(hasCrew ? t("emptyTitle") : t("welcomeTitle"))}</h2>
    <p class="hero-sub">${esc(hasCrew ? sub : t("welcomeSub"))}</p>
    <div class="row hero-actions"><button type="button" class="btn primary" data-tab="checkin">${esc(t(hasCrew ? "goCheckin" : "addCrew"))}</button></div>`;
  $("plan").innerHTML = `<li class="plan-empty">${esc(sub)}</li>`; if ($("streak")) $("streak").textContent = "";
  $("chips").innerHTML = ""; $("zone").innerHTML = msg;
  $("trAlerts").innerHTML = `<li style="border-left-color:var(--line)">${esc(sub)}</li>`;
  $("sparks").innerHTML = ""; $("chart").innerHTML = ""; $("chartTitle").textContent = "";
  $("report").textContent = sub;
}

let toastTimer;
export function toast(msg) {
  const el = $("toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
