// AstroVital · MindView (View layer): reaction test (PVT-B), mood and stress bars, weekly PSS-4.
import { t, tr, L } from "../../config/i18n.js";
import { PVT, PSS4 } from "../../models/MindModel.js";
import { esc } from "../../utils/format.js";
import { canSpeak } from "../../utils/speech.js";

const $ = (id) => document.getElementById(id);

export function renderPvtLength(len) {
  $("pvtLen").innerHTML = `<option value="${PVT.durationS}"${len === PVT.durationS ? " selected" : ""}>${esc(t("pvtOfficial"))}</option>
    <option value="${PVT.practiceS}"${len === PVT.practiceS ? " selected" : ""}>${esc(t("pvtPractice"))}</option>`;
}

/** state: idle | wait | stimulus | response | falsestart | done | skipped. data: { left, total, rt, result } */
export function renderPvt(state, data = {}) {
  const box = $("pvtBox"), running = ["wait", "stimulus", "response", "falsestart"].includes(state);
  box.dataset.state = state;
  $("pvtStart").hidden = running;
  $("pvtStart").textContent = state === "done" || state === "skipped" ? t("pvtAgain") : t("pvtStart");
  $("pvtCancel").hidden = !running;
  $("pvtSkip").hidden = running || state === "skipped";
  $("pvtLen").disabled = running;
  $("pvtBar").hidden = !running;
  if (running && data.total) $("pvtBarFill").style.width = `${Math.min(100, (1 - data.left / data.total) * 100).toFixed(0)}%`;
  const left = running && data.left != null ? `<span class="pvt-left">${Math.ceil(data.left)} s ${esc(t("pvtLeft"))}</span>` : "";
  if (state === "idle" || state === "done" || state === "skipped") box.innerHTML = `<span class="pvt-msg">${esc(t("pvtIdle"))}</span>`;
  if (state === "wait") box.innerHTML = `${left}<span class="pvt-msg">${esc(t("pvtWait"))}</span>`;
  if (state === "stimulus") box.innerHTML = `${left}<span class="pvt-counter" id="pvtCounter">0</span>`;
  if (state === "response") box.innerHTML = `${left}<span class="pvt-counter done" data-lapse="${data.rt >= PVT.lapseMs}">${data.rt} ms</span>`;
  if (state === "falsestart") box.innerHTML = `${left}<span class="pvt-msg warn">${esc(t("pvtTooSoon"))}</span>`;
  const res = $("pvtResult");
  res.hidden = !(state === "done" || state === "skipped");
  if (state === "skipped") res.innerHTML = `<p class="note">${esc(t("pvtSkipped"))}</p>`;
  if (state === "done") {
    const r = data.result;
    res.innerHTML = r ? `<div class="pvt-stats">
        <div><span class="label">${esc(t("pvtMean"))}</span><span class="n">${r.meanRT}<small> ms</small></span></div>
        <div><span class="label">${esc(t("pvtLapses"))}</span><span class="n">${r.lapses}</span></div>
        <div><span class="label">${esc(t("pvtFalse"))}</span><span class="n">${r.falseStarts}</span></div>
        <div><span class="label">${esc(t("pvtScore"))}</span><span class="n">${r.score}<small> %</small></span></div>
      </div>
      <p class="note">${r.n} ${esc(t("pvtN"))} · ${esc(t("pvtNote"))}${r.practice ? ` ${esc(t("pvtPracticeNote"))}` : ""}</p>`
      : `<p class="err">${esc(t("pvtNone"))}</p>`;
  }
}

/** Live millisecond counter while the stimulus is on screen. */
export function tickCounter(ms) { const c = $("pvtCounter"); if (c) c.textContent = String(Math.round(ms)); }

export function renderVas(mind) {
  [["mood", mind.moodVas, mind.moodTouched], ["stress", mind.stressVas, mind.stressTouched]].forEach(([k, v, touched]) => {
    $("vas-" + k).value = v;
    $("vas-" + k + "-out").textContent = touched ? `${v}/100` : "–";
    $("vas-" + k).dataset.touched = String(!!touched);
  });
}

/** PSS-4: asked once a week. lastPss: last day with an answer, or null. */
export function renderPss(mind, lastPss, today) {
  const due = !lastPss || today - lastPss.day >= PSS4.everyDays;
  const box = $("pssBox");
  if (!due) {
    box.innerHTML = `<div class="pss-done"><strong>${esc(t("pssTitle"))}</strong><p class="note">${esc(t("pssDone"))} ${lastPss.day}: ${esc(t("pssScore"))} ${lastPss.pss4.score}/16).</p></div>`;
    return false;
  }
  box.innerHTML = `<details class="pss-q" ${mind.pssAnswers.some((a) => a !== null) ? "open" : ""}>
    <summary><strong>${esc(t("pssTitle"))}</strong> <span class="note">${esc(t("pssSub"))}</span></summary>
    ${canSpeak() ? `<div class="row" style="margin-top:8px"><button type="button" class="btn small" id="pssSpeak">🔊 ${esc(t("readAloud"))}</button><button type="button" class="btn small" id="pssStop" hidden>${esc(t("stopReading"))}</button></div>` : ""}
    ${PSS4.items.map((it, i) => `<fieldset class="pss-item"><legend>${canSpeak() ? `<button type="button" class="speak-q" data-speak-q="${i}" aria-label="${esc(t("readAloud"))} ${i + 1}">🔊</button> ` : ""}${i + 1}. ${esc(tr(it))}</legend>
      <div class="pss-opts">${PSS4.options.map((o, v) => `<label><input type="radio" name="pss-${i}" value="${v}"${mind.pssAnswers[i] === v ? " checked" : ""}> ${esc(tr(o))}</label>`).join("")}</div>
    </fieldset>`).join("")}
    <p class="note">${esc(t("pssNote"))}</p></details>`;
  return true;
}

export function readPss() {
  return [0, 1, 2, 3].map((i) => { const c = document.querySelector(`input[name="pss-${i}"]:checked`); return c ? +c.value : null; });
}
