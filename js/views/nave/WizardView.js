// AstroVital · WizardView (View layer): the check-up as a guided path, one screen at a time.
// 0 Astronaut → 1 Pulse (camera) → 2 Wristband → 3 Reaction (PVT-B) → 4 Questions → 5 Result (send to Earth).
import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { ROLES } from "../../config/crew.js";
import { ZONES, ZONE_BY_ID, PRIORITY } from "../../config/zones.js";
import { esc, COLORS } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);
export const STEPS = ["stAstro", "stPulse", "stWear", "stReact", "stAns", "stResult"];
export const LAST_INPUT_STEP = 4;
export const RESULT_STEP = 5;

/** Shows one step and updates the stepper and the Back / Next / Save buttons. */
export function showStep(step) {
  document.querySelectorAll("#ciForm .step").forEach((el) => { el.hidden = +el.dataset.step !== step; });
  $("stepper").innerHTML = STEPS.map((k, i) => `<li data-state="${i < step ? "done" : i === step ? "now" : "todo"}"><span class="sn">${i < step ? "✓" : i + 1}</span><span class="sl">${esc(t(k))}</span></li>`).join("");
  $("ciWho").hidden = step === 0 || step === RESULT_STEP;
  $("wizBack").hidden = step === 0 || step === RESULT_STEP;
  $("wizNext").hidden = step === 0 || step >= LAST_INPUT_STEP;
  $("wizSave").hidden = step !== LAST_INPUT_STEP;
  $("ciErr").textContent = "";
  document.querySelector(".wiz-nav").hidden = step === 0 || step === RESULT_STEP; // no Back / Next bar on the start and result screens
}

/**
 * Step 0: start screen. With an active astronaut it says whose check-up this is, what was done before and what comes next;
 * the list of astronauts only shows when there is nobody active or the crew asks to change.
 * info: { count, last: { day, createdAt, lvl } | null }
 */
export function renderStart(crew, info, showPicker) {
  const box = $("ciStart");
  $("ciPicker").hidden = !!crew && !showPicker;
  box.hidden = !crew;
  if (!crew) { box.innerHTML = ""; return; }
  const n = info ? info.count : 0, last = info && info.last;
  const when = last && last.createdAt ? new Date(last.createdAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const steps = [["stPulse", "startPulse"], ["stWear", "startWear"], ["stReact", "startReact"], ["stAns", "startAns"], ["stResult", "startResult"]];
  box.innerHTML = `<div class="start-head">
      <span class="label">${esc(t("startFor"))}</span>
      <h3 class="start-name">${esc(crew.name)}</h3>
      <p class="note">${esc(crew._id)} · ${esc(tr(ROLES[crew.role || "ms"].n))} · <strong>${n}</strong> ${esc(n === 1 ? t("startSaved1") : t("startSaved"))}</p>
    </div>
    ${last ? `<p class="start-last"><span class="pill" data-l="${last.lvl ?? 0}">${esc(tr(LEVELS[last.lvl ?? 0]))}</span> ${esc(t("startLast"))}: ${esc(L("día", "day"))} ${last.day}${when ? " · " + esc(when) : ""}</p>`
      : `<p class="start-last">${esc(t("startNone"))}</p>`}
    <ol class="start-steps">${steps.map(([a, b]) => `<li><strong>${esc(t(a))}</strong><span>${esc(t(b))}</span></li>`).join("")}</ol>
    <div class="row">
      <button type="button" class="btn primary" data-start-checkup="1">${esc(last ? t("startAgain") : t("startGo"))}</button>
      ${last ? `<button type="button" class="btn" data-view-last="1">${esc(t("startViewLast"))}</button>` : ""}
      <button type="button" class="btn" data-toggle-picker="1">${esc(t("ciChange"))}</button>
    </div>`;
}

/** List of astronauts to choose from. */
export function renderPick(list, activeId, counts) {
  $("pickGrid").innerHTML = list.length ? list.map((c) => `<button type="button" class="pick" data-pick="${esc(c._id)}" aria-pressed="${c._id === activeId}">
      <span class="pick-name">${esc(c.name)}</span>
      <span class="note">${esc(c._id)} · ${esc(tr(ROLES[c.role || "ms"].n))}</span>
      <span class="note">${(counts[c._id] && counts[c._id].count) || 0} ${esc(((counts[c._id] && counts[c._id].count) || 0) === 1 ? t("startSaved1") : t("startSaved"))}</span>
      <span class="pick-go">${esc(t("pickMe"))} →</span></button>`).join("")
    : `<p class="empty">${esc(t("pickNone"))}</p>`;
}

/** Step 5: what the check-up found, and sending it to Earth. send: null | "sent" | "queued" */
export function renderResult(result, crew, send) {
  const lvl = result.overall;
  const heads = [{ es: "Todo en orden", en: "All clear" }, { es: "Avisa al oficial médico", en: "Notify the medical officer" }, { es: "Contacta a los médicos en Tierra", en: "Contact the doctors on Earth" }];
  const flagged = PRIORITY.filter((id) => result.zones[id].lvl > 0).map((id) => ZONE_BY_ID[id]);
  const list = flagged.length
    ? `<span class="label">${esc(t("resToReview"))}</span><ul class="findings">${flagged.map((z) => {
        const f = result.zones[z.id].findings.find((x) => x.l === result.zones[z.id].lvl);
        return `<li><b style="background:${COLORS[result.zones[z.id].lvl]}"></b><span><strong>${esc(tr(z.n))}:</strong> ${esc(f ? f.txt : tr(LEVELS[result.zones[z.id].lvl]))}</span></li>`;
      }).join("")}</ul>`
    : `<p>${esc(t("resAllGood"))}</p>`;
  const sendLine = send === "sent" ? `<p class="send-ok">${esc(t("resSent"))}</p>` : send === "queued" ? `<p class="send-wait">${esc(t("resQueued"))}</p>` : "";
  $("ciResult").innerHTML = `<div class="res-head" data-l="${lvl}">
      <span class="res-lamp" style="background:${COLORS[lvl]}"></span>
      <div><span class="label">${esc(t("resTitle"))} · ${esc(crew.name)}</span><h3 class="res-title">${esc(tr(heads[lvl]))}</h3></div>
      <span class="pill" data-l="${lvl}">${esc(tr(LEVELS[lvl]))}</span></div>
    ${list}
    ${sendLine}
    <div class="row">
      <button type="button" class="btn primary" data-action="send-report" ${send ? "disabled" : ""}>📡 ${esc(t("resSend"))}</button>
      <button type="button" class="btn" data-tab="panel">${esc(t("resGoToday"))}</button>
    </div>
    <p class="note">${esc(t("linkQueueNote"))}</p>`;
}
