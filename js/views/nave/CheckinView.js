// AstroVital · CheckinView (View layer): the 3-step morning check-up.
// 1. Pulse with the camera · 2. Virtual wristband (simulated) · 3. Your answers (sleep, mood, symptoms).
import { t, tr, L } from "../../config/i18n.js";
import { SYMPTOMS, INDICATORS, HOW } from "../../config/ranges.js";
import { esc, fmt, unit } from "../../utils/format.js";
import { vasToMood, scorePss4 } from "../../models/MindModel.js";
import { readPss } from "./MindView.js";

const $ = (id) => document.getElementById(id);
/** Values the wristband fills in. Pulse is added when the camera is not used. */
const WEAR_KEYS = ["sys", "dia", "spo2", "temp", "glu", "ex"];
const LIMITS = { sys: [60, 250], dia: [30, 160], hr: [25, 220], glu: [20, 600], temp: [33, 43], spo2: [50, 100], ex: [0, 400] };

export function renderCheckinChoices() {
  const prev = {};
  document.querySelectorAll("#syms input").forEach((i) => { prev[i.value] = i.checked; });
  $("syms").innerHTML = `<label class="sym-none"><input type="checkbox" id="sym-none" value="none"${prev.none ? " checked" : ""}> ${esc(t("symNone"))}</label>` +
    Object.entries(SYMPTOMS).map(([k, v]) =>
    `<label><input type="checkbox" id="sym-${k}" value="${k}"${prev[k] ? " checked" : ""}> ${esc(tr(v))}</label>`).join("");
}

/** "I feel fine, none" and the symptoms exclude each other. */
export function onSymptomChange(target) {
  if (!target || target.type !== "checkbox") return;
  if (target.value === "none" && target.checked) document.querySelectorAll("#syms input").forEach((i) => { if (i.value !== "none") i.checked = false; });
  if (target.value !== "none" && target.checked) $("sym-none").checked = false;
}


/** ci: { wear, manual, cam } — the wristband grid, read-only (simulated) or editable (manual). */
export function renderWear(ci) {
  const keys = ci.cam && ci.cam !== "skipped" ? WEAR_KEYS : ["hr", ...WEAR_KEYS];
  $("wearGrid").innerHTML = keys.map((k) => {
    const I = INDICATORS[k], v = ci.wear[k];
    const value = ci.manual
      ? `<input id="w-${k}" type="number" step="${I.dec ? "0.1" : "1"}" value="${v ?? ""}" inputmode="decimal" aria-label="${esc(tr(I.n))}">`
      : `<span class="n">${fmt(k, v)}</span>`;
    return `<div class="wear">
      <div class="wear-top"><span class="label">${esc(tr(I.n))}</span><span class="src-tag small" data-src="${ci.manual ? "manual" : "sim"}">${esc(ci.manual ? t("srcManual") : t("srcSim"))}</span></div>
      <div class="wear-val">${value}<span class="u">${esc(unit(k))}</span></div>
      <details class="help"><summary>${esc(t("howMeasure"))}</summary><p>${esc(tr(HOW[k]))}</p></details></div>`;
  }).join("");
  if (ci.wear.readAt && !ci.manual) $("wearGrid").insertAdjacentHTML("afterbegin", `<p class="note wear-at">${esc(t("wearAt"))} ${new Date(ci.wear.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>`);
  $("manualBtn").textContent = ci.manual ? t("wearAuto") : t("wearManual");
  $("wearTag").dataset.src = ci.manual ? "manual" : "sim";
  $("wearTag").textContent = ci.manual ? t("srcManual") : t("srcSim");
  $("syncBtn").hidden = ci.manual;
}

/**
 * Hand-typed values: checks them and keeps them in ci.wear so they survive moving between steps.
 * strict = false (going back) keeps what is valid without complaining. Returns null or { error, field }.
 */
export function keepManual(ci, strict = true) {
  if (!ci.manual) return null;
  for (const el of document.querySelectorAll("#wearGrid input")) {
    const k = el.id.slice(2), v = parseFloat(el.value);
    const bad = el.value === "" || Number.isNaN(v) ? t("missing") : v < LIMITS[k][0] || v > LIMITS[k][1] ? t("outOfRange") + tr(INDICATORS[k].n) : null;
    if (bad) { if (strict) return { error: bad, field: el }; continue; }
    ci.wear[k] = v;
  }
  return null;
}

/** Camera step UI. state: idle | opening | measuring | done | skipped | error */
export function renderCamera(state, data = {}) {
  const wrap = $("camWrap"), bar = $("camBar"), res = $("camResult"), err = $("camErr");
  const start = $("camStart"), skip = $("camSkip"), cancel = $("camCancel");
  wrap.hidden = !(state === "opening" || state === "measuring");
  bar.hidden = state !== "measuring";
  cancel.hidden = !(state === "opening" || state === "measuring");
  start.hidden = state === "opening" || state === "measuring";
  skip.hidden = state === "opening" || state === "measuring" || state === "skipped";
  start.textContent = state === "done" || state === "error" ? t("camAgain") : t("camStart");
  err.textContent = state === "error" ? data.msg : "";
  res.hidden = !(state === "done" || state === "skipped");
  if (state === "opening") $("camHud").textContent = t("camOpening");
  if (state === "measuring") {
    const pct = Math.min(100, (data.elapsed / data.total) * 100);
    $("camBarFill").style.width = pct.toFixed(0) + "%";
    const light = data.light < 45 ? t("lightLow") : t("lightOk");
    $("camHud").innerHTML = `<b>${esc(t("camMeasuring"))} ${Math.floor(data.elapsed)} / ${data.total} s</b><br>${esc(t("camAlign"))}<br>${esc(t("camLight"))}: ${esc(light)}${data.live ? ` · ${esc(t("camLive"))}: ${data.live.bpm} ${esc(L("lpm", "bpm"))}` : ""}`;
  }
  if (state === "done") {
    res.innerHTML = `<div class="cam-bpm"><span class="n">${data.bpm}</span><span class="u">${esc(L("lpm", "bpm"))}</span></div>
      <div class="stack" style="gap:4px"><span class="q" data-q="${data.quality}">${esc(t("q_" + data.quality))} · SNR ${data.snr} dB</span>
      <span class="note">${esc(tr(INDICATORS.hr.n))} · ${esc(t("camNote"))}</span></div>`;
  }
  if (state === "skipped") res.innerHTML = `<p class="note">${esc(t("camSkipped"))}</p>`;
}

export function setSleepUnknown(unknown) {
  const el = $("f-sleep");
  el.disabled = unknown;
  if (unknown) el.value = "";
  $("sleepUnknown").setAttribute("aria-pressed", String(unknown));
}

/** Reads and validates everything. Returns { ok, rec } or { ok:false, error, field }. */
export function readForm(ci) {
  const rec = { sym: {}, solar: false, src: "user", sources: {} };
  // Pulse: camera if measured, else wristband / manual
  if (ci.cam && ci.cam !== "skipped") { rec.hr = ci.cam.bpm; rec.sources.hr = "camera"; rec.hrQuality = { snr: ci.cam.snr, quality: ci.cam.quality }; }
  const keys = rec.hr ? WEAR_KEYS : ["hr", ...WEAR_KEYS];
  for (const k of keys) {
    rec[k] = ci.wear[k]; // manual values were checked and kept by keepManual() when leaving the wristband step
    rec.sources[k] = ci.manual ? "manual" : "sim";
  }
  // Sleep: answered or "I don't know"
  if (ci.sleepUnknown) { rec.sleep = null; rec.sources.sleep = null; }
  else {
    const el = $("f-sleep"), v = parseFloat(el.value);
    if (el.value === "" || Number.isNaN(v)) return { ok: false, error: L("Escribe cuántas horas dormiste o presiona \"No sé\".", "Write how many hours you slept or press \"I don't know\"."), field: el };
    if (v < 0 || v > 16) return { ok: false, error: t("outOfRange") + tr(INDICATORS.sleep.n), field: el };
    rec.sleep = v; rec.sources.sleep = "self";
  }
  // Mood and stress (0–100): both bars must be moved
  const m = ci.mind;
  if (!m.moodTouched || !m.stressTouched) return { ok: false, error: t("vasTouch"), field: $(m.moodTouched ? "vas-stress" : "vas-mood") };
  rec.moodVas = m.moodVas; rec.stressVas = m.stressVas; rec.mood = vasToMood(m.moodVas); rec.sources.mood = "self";
  // Reaction test (optional) and weekly PSS-4 (all 4 answers or none)
  rec.pvt = m.pvt || null;
  if (m.pssDue) {
    const ans = readPss(), given = ans.filter((a) => a !== null).length;
    if (given > 0 && given < 4) return { ok: false, error: t("pssPartial") };
    rec.pss4 = given === 4 ? { answers: ans, score: scorePss4(ans) } : null;
  }
  const checked = [...document.querySelectorAll("#syms input")].filter((i) => i.checked).map((i) => i.value);
  if (!checked.length) return { ok: false, error: t("symNeed") };
  checked.filter((v) => v !== "none").forEach((v) => { rec.sym[v] = true; });
  return { ok: true, rec };
}

export function resetForm() {
  $("f-sleep").value = "";
  setSleepUnknown(false);
  document.querySelectorAll("#syms input").forEach((i) => { i.checked = false; });
  setError("");
}

export function setError(msg, field) {
  $("ciErr").textContent = msg;
  if (field) field.focus();
}

/** Label for where a value came from (shown in the zone detail). */
export const sourceLabel = (src) => ({ camera: t("srcCamera"), sim: t("srcSim"), manual: t("srcManual"), self: t("srcSelf") }[src] || "");
