// AstroVital · EmergencyView (View layer): full-screen emergency guide, one step at a time, and the emergency log.
import { t, tr, L } from "../../config/i18n.js";
import { PROTOCOLS } from "../../config/protocols.js";
import { esc, clock } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);

/** dock: put the guide on the right so the astronaut and the storm stay visible on the left. */
export function showEmergency(open, dock = false) {
  $("emg").hidden = !open;
  $("emg").dataset.dock = open && dock ? "right" : "";
  document.body.classList.toggle("emg-docked", !!(open && dock));
  document.body.classList.toggle("emg-open", open);
}

/** Step 0 (red button with nothing in red): which emergency? */
export function renderEmergencyPicker(crew) {
  $("emgBox").dataset.mode = "pick";
  $("emgBox").innerHTML = `<span class="emg-tag">${esc(t("emgTag"))}</span>
    <h2 id="emgTitle">${esc(t("emgPick"))}</h2>
    <p class="note">${esc(t("emgPickSub"))} ${crew ? `${esc(t("emgFor"))}: ${esc(crew.name)} (${esc(crew._id)}).` : esc(t("emgNoCrew"))}</p>
    <label class="emg-drill"><input type="checkbox" id="emgDrill"> <span><strong>${esc(t("emgDrillOpt"))}</strong> ${esc(t("emgDrillOptSub"))}</span></label>
    <div class="emg-types">${Object.entries(PROTOCOLS).map(([k, p]) => `<button type="button" class="emg-type" data-emg-type="${k}">
      <span class="emg-ic" aria-hidden="true">${esc(p.icon)}</span><strong>${esc(tr(p.name))}</strong><span class="note">${esc(tr(p.goal))}</span></button>`).join("")}</div>
    <div class="row"><button type="button" class="btn" data-emg-close="1">${esc(t("cancel"))}</button></div>`;
  const first = $("emgBox").querySelector(".emg-type"); if (first) first.focus();
}

/** One step. a: EmergencyModel.active · ui: { voice, comm, why } */
export function renderEmergencyStep(a, ui) {
  const n = a.steps.length, i = a.index, last = i === n - 1;
  $("emgBox").dataset.mode = a.drill ? "drill" : "run";
  $("emgBox").innerHTML = `<div class="emg-head">
      <span class="emg-tag" data-drill="${a.drill}">${esc(a.drill ? t("emgDrillTag") : t("emgTag"))}</span>
      <button type="button" class="btn small" data-emg-voice="1" aria-pressed="${ui.voice}">${ui.voice ? "🔊" : "🔇"} ${esc(ui.voice ? t("emgVoiceOn") : t("emgVoiceOff"))}</button>
    </div>
    <h2 id="emgTitle">${esc(tr(a.protocol.name))}</h2>
    <p class="note">${a.crewName ? `${esc(t("emgFor"))}: <strong>${esc(a.crewName)}</strong> (${esc(a.crewId)})` : esc(t("emgNoCrew"))}${ui.why ? ` · ${esc(ui.why)}` : ""}</p>
    ${a.context ? `<p class="emg-ctx">${esc(a.context)}</p>` : ""}
    <ol class="emg-dots" aria-hidden="true">${a.steps.map((s, k) => `<li data-state="${s.doneAt ? "done" : k === i ? "now" : "todo"}">${s.doneAt ? "✓" : k + 1}</li>`).join("")}</ol>
    <div class="emg-step" aria-live="assertive">
      <span class="label">${esc(t("emgStep"))} ${i + 1} ${esc(t("emgOf"))} ${n}</span>
      <p class="emg-text">${esc(tr(a.steps[i]))}</p>
      ${a.steps[i].breath ? `<div class="pacer" aria-hidden="true"><i></i><span class="pacer-in">${esc(t("breathIn"))}</span><span class="pacer-out">${esc(t("breathOut"))}</span></div>` : ""}
    </div>
    <div class="row emg-actions">
      <button type="button" class="btn primary emg-go" data-emg-done="1">${esc(last ? t("emgLast") : t("emgDone"))}</button>
      <button type="button" class="btn" data-emg-repeat="1">🔊 ${esc(t("emgRepeat"))}</button>
      <button type="button" class="btn" data-emg-back="1" ${i === 0 ? "disabled" : ""}>${esc(t("emgBack"))}</button>
    </div>
    <p class="note">${esc(ui.comm)}</p>
    <div class="row"><button type="button" class="btn small" data-emg-abort="1">${esc(t("emgAbort"))}</button></div>`;
  const go = $("emgBox").querySelector(".emg-go"); if (go) go.focus();
}

/** After the last step. send: null | "sent" | "queued" */
export function renderEmergencySummary(doc, send) {
  const done = doc.steps.filter((s) => s.doneAt).length;
  $("emgBox").dataset.mode = "summary";
  $("emgBox").innerHTML = `<span class="emg-tag" data-drill="${doc.drill}" data-ok="true">${esc(doc.drill ? t("emgDrillTag") : t("emgTag"))}</span>
    <h2 id="emgTitle">${esc(t("emgSummary"))}: ${esc(tr(doc.name))}</h2>
    <p class="note">${done}/${doc.steps.length} ${esc(t("emgStepsDone"))} · ${clock(doc.startedAt)} – ${clock(doc.endedAt)}</p>
    <ul class="emg-list">${doc.steps.map((s, k) => `<li data-done="${!!s.doneAt}"><span>${s.doneAt ? "✓" : "–"}</span><span>${k + 1}. ${esc(tr(s))}</span><span class="note">${s.doneAt ? clock(s.doneAt) : ""}</span></li>`).join("")}</ul>
    <p class="${send === "queued" ? "send-wait" : "send-ok"}">${esc(!doc.crewId ? t("emgNoCrew") : doc.drill ? t("emgDrillNote") : `${t("emgSaved")} ${send === "queued" ? t("emgQueued") : send === "sent" ? t("emgSent") : ""}`)}</p>
    <div class="row"><button type="button" class="btn primary" data-emg-close="1">${esc(t("emgClose"))}</button></div>`;
  const b = $("emgBox").querySelector("[data-emg-close]"); if (b) b.focus();
}

/** Emergency log of the active astronaut (History tab). */
export function renderEmergencyLog(events) {
  $("emgLog").innerHTML = events.length ? events.map((e) => {
    const done = e.steps.filter((s) => s.doneAt).length;
    return `<li class="msg"><div class="mh"><strong>${esc(tr(e.name))}</strong><span class="src-tag small" data-src="${e.drill ? "sim" : "manual"}">${esc(e.drill ? t("emgDrillTag") : t("emgTag"))}</span></div>
      <div class="note">${new Date(e.startedAt).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · ${done}/${e.steps.length} ${esc(t("emgStepsDone"))}${e.context ? ` · ${esc(e.context)}` : ""}</div></li>`;
  }).join("") : `<li class="empty">${esc(t("emgLogEmpty"))}</li>`;
}
