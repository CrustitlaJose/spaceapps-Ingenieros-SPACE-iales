// AstroVital · ShellView (View layer): header controls, status strip, tabs and static texts of the Ship app.
import { t, tr, getLang } from "../../config/i18n.js";
import { MISSIONS, SCENARIOS } from "../../config/missions.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);
export const TABS = [["panel", "tPanel"], ["checkin", "tCheckin"], ["trends", "tTrends"], ["missions", "tMissions"], ["report", "tReport"], ["science", "tScience"]];

export function renderShell(s) {
  document.documentElement.lang = getLang();
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $("missionSeg").innerHTML = Object.entries(MISSIONS).map(([k, m]) =>
    `<button type="button" data-mission="${k}" aria-pressed="${s.mission === k}">${esc(tr(m.name))}</button>`).join("");
  document.querySelectorAll("#langSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === getLang())));
  $("scenario").innerHTML = Object.entries(SCENARIOS).map(([k, v]) =>
    `<option value="${k}"${s.scenario === k ? " selected" : ""}>${esc(tr(v))}</option>`).join("");
  renderTabs(s);
}

export function renderTabs(s) {
  $("tabs").innerHTML = TABS.map(([k, l]) => {
    const badge = k === "report" && s.unread ? `<span class="badge-n" aria-label="${s.unread}">${s.unread}</span>` : "";
    return `<button type="button" role="tab" data-tab="${k}" aria-selected="${s.tab === k}" aria-controls="v-${k}">${esc(t(l))}${badge}</button>`;
  }).join("");
  TABS.forEach(([k]) => { $("v-" + k).hidden = s.tab !== k; });
}

export function renderStrip(s, lastDay, linkUp) {
  const m = MISSIONS[s.mission];
  $("sDay").textContent = lastDay;
  $("sGrav").textContent = m.grav;
  $("sDelay").textContent = tr(m.delay);
  const ls = $("sLink");
  ls.dataset.up = String(linkUp);
  ls.textContent = linkUp ? t("linkUp") : t("linkDown");
}

let toastTimer;
export function toast(msg) {
  const el = $("toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
