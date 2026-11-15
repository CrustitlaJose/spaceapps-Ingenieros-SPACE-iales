// AstroVital · HomeView (View layer): the "Today" screen.
// One big status, one main action, today's plan and a compact view of the 8 zones.
// The body map and the full zone detail only open when the astronaut asks for them.

import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { ZONES, ZONE_BY_ID, PRIORITY } from "../../config/zones.js";
import { MISSIONS } from "../../config/missions.js";
import { esc, COLORS } from "../../utils/format.js";
import { linkDelay } from "../../models/DelayModel.js";
import { canSpeak } from "../../utils/speech.js";
import { S_NAMES } from "../../models/SpaceWeather.js";

const $ = (id) => document.getElementById(id);

const HEADS = [
  { es: "Todo en orden", en: "All clear" },
  { es: "Avisa al oficial médico", en: "Notify the medical officer" },
  { es: "Contacta a los médicos en Tierra", en: "Contact the doctors on Earth" },
];
const SUBS = [
  { es: "Lo manejas tú: sigue tu rutina.", en: "Self-managed: keep your routine." },
  { es: "Algo está cambiando. Un compañero con entrenamiento médico debe saberlo.", en: "Something is changing. A crewmate with medical training should know." },
  { es: "Es serio. Sigue los pasos de abajo mientras responden desde la Tierra.", en: "It is serious. Follow the steps below while Earth answers." },
];

/** One short line about the astronaut's personal normal. */
function baseLine(ctx) {
  const b = ctx.baseline;
  if (!b) return "";
  if (!b.ready) return `<p class="hero-base">${esc(t("baseCalc"))}: ${b.count} ${esc(t("baseOf"))} ${b.needed} ${esc(t("baseCheckups"))}</p>`;
  const out = (ctx.compare || []).filter((c) => c.flagged);
  return out.length ? `<p class="hero-base" data-flag="true">▲ ${esc(out.map((c) => c.txt).join(" · "))}</p>` : `<p class="hero-base">${esc(t("baseOk"))}</p>`;
}

/** How long Earth takes to answer today. */
export function commNote(mission) {
  const d = linkDelay(mission);
  if (!d.detail) return L("Los médicos en la Tierra responden casi en tiempo real.", "The doctors on Earth answer almost in real time.");
  const rt = Math.round(d.detail.minutes * 2);
  return L(`Hoy Marte está a ${d.detail.millionKm} millones de km: un mensaje tarda ${d.detail.minutes} min en llegar y la respuesta otros ${d.detail.minutes}. Sigue los pasos mientras tanto (≈${rt} min).`,
    `Today Mars is ${d.detail.millionKm} million km away: a message takes ${d.detail.minutes} min to arrive and the answer another ${d.detail.minutes}. Follow the steps meanwhile (≈${rt} min).`);
}

/** Short value shown on each zone tile. */
export function zoneValue(id, day, rad) {
  switch (id) {
    case "mind": return `${day.sleep == null ? "–" : Number(day.sleep).toFixed(1)} h · ${day.moodVas != null ? `${L("ánimo", "mood")} ${day.moodVas}` : `${day.mood}/5`}`;
    case "brain": { const n = ["head", "vision", "dizzy", "nausea"].filter((k) => day.sym && day.sym[k]).length; return n ? `${n} ${L(n === 1 ? "síntoma" : "síntomas", n === 1 ? "symptom" : "symptoms")}` : L("Sin síntomas", "No symptoms"); }
    case "heart": return `${day.sys}/${day.dia} · ${day.hr} ${L("lpm", "bpm")}`;
    case "lungs": return `SpO₂ ${day.spo2}%`;
    case "blood": return `${day.glu} mg/dL`;
    case "bones": return `${day.ex} min`;
    case "immune": return `${Number(day.temp).toFixed(1)} °C`;
    case "rad": return `${rad.cum.toFixed(1)} mSv`;
    default: return "";
  }
}

/**
 * ctx: { crew, mission, day (last record), rad, plan: [{id, label, done, action}], linkUp }
 */
/** Text of the spoken summary: who, status, why, and what to do next. */
export function briefText(result, ctx) {
  const lvl = result.overall, worst = result.worst ? ZONE_BY_ID[result.worst] : null;
  const reason = worst && lvl > 0 ? (result.zones[worst.id].findings.find((f) => f.l === lvl) || {}).txt : null;
  const out = [`${ctx.crew.name}. ${t("flightDay")} ${ctx.day.day}. ${L("Estado", "Status")}: ${tr(LEVELS[lvl])}. ${tr(HEADS[lvl])}.`];
  if (reason) out.push(`${tr(worst.n)}: ${reason}.`);
  const flagged = (ctx.compare || []).filter((c) => c.flagged);
  if (ctx.baseline && !ctx.baseline.ready) out.push(`${t("baseCalc")}: ${ctx.baseline.count} ${t("baseOf")} ${ctx.baseline.needed} ${t("baseCheckups")}.`);
  else if (flagged.length) out.push(flagged.map((c) => c.txt).join(". ") + ".");
  if (lvl > 0) out.push(`${L("Qué hacer", "What to do")}: ${tr(worst.act[lvl]).join(" ")}`);
  else { const next = ctx.plan.find((p) => !p.done); out.push(next ? `${L("Lo que sigue", "Next")}: ${next.label}.` : L("Completaste tu plan de hoy.", "You completed today's plan.")); }
  return out;
}

export function renderHome(result, ctx) {
  const lvl = result.overall;
  const greens = ZONES.filter((z) => result.zones[z.id].lvl === 0).length;
  const worst = result.worst ? ZONE_BY_ID[result.worst] : null;
  const reason = worst && lvl > 0 ? (result.zones[worst.id].findings.find((f) => f.l === lvl) || {}).txt : null; // no "reason" line when all is green

  // Main action: one button with what to do now.
  let action;
  if (lvl === 2) action = { label: `🆘 ${t("emgOpen")}`, attrs: `data-emg-zone="${worst.id}"` };
  else if (lvl > 0) action = { label: `${L("Ver qué hacer", "See what to do")}: ${tr(worst.n)}`, attrs: `data-open-zone="${worst.id}"` };
  else {
    const next = ctx.plan.find((p) => !p.done && p.action);
    action = next ? { label: next.actionLabel, attrs: next.action } : { label: t("seeAllZones"), attrs: `data-open-zone="heart"` };
  }
  const steps = lvl === 2
    ? `<ol class="hero-steps">${tr(worst.act[2]).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
       <p class="note">${esc(commNote(ctx.mission))}</p>`
    : "";
  const second = lvl === 2 ? `<button type="button" class="btn" data-action="send-report">${esc(t("send"))}</button><button type="button" class="btn small" data-open-zone="${worst.id}">${esc(L("Ver detalle", "See detail"))}: ${esc(tr(worst.n))}</button>` : "";

  const hero = $("hero");
  hero.dataset.l = lvl;
  hero.dataset.mission = ctx.mission;
  $("heroBody").innerHTML = `
      <p class="hero-meta"><span class="status-chip" data-l="${lvl}">${esc(tr(LEVELS[lvl]))}</span>
        <span>${greens} ${esc(L("de", "of"))} 8 ${esc(t("zonesGreen"))}</span><span>${esc(t("flightDay"))} ${ctx.day.day}</span></p>
      <h2 class="hero-title">${esc(tr(HEADS[lvl]))}</h2>
      <p class="hero-sub">${esc(tr(SUBS[lvl]))}</p>
      ${reason ? `<p class="hero-reason"><b style="background:${COLORS[lvl]}"></b><span>${esc(tr(worst.n))}: ${esc(reason)}</span></p>` : ""}
      ${baseLine(ctx)}
      ${steps}
      <div class="row hero-actions"><button type="button" class="btn primary" ${action.attrs}>${esc(action.label)}</button>${second}
        ${canSpeak() ? `<button type="button" class="btn" data-action="brief">🔊 ${esc(t("briefBtn"))}</button>` : ""}</div>`;

  const streak = $("streak");
  if (streak) streak.innerHTML = ctx.streak ? `${esc(t("streakLine"))}: <b>${ctx.streak}</b> ${esc(t(ctx.streak === 1 ? "streakUnit1" : "streakUnit"))}` : "";
  $("plan").innerHTML = ctx.plan.map((p) => `<li data-done="${p.done}">
      <span class="tick" aria-hidden="true">${p.done ? "✓" : ""}</span>
      <span class="ptxt">${esc(p.label)}</span>
      ${p.done ? `<span class="pstate">${esc(t("done"))}</span>`
        : p.action ? `<button type="button" class="btn small" ${p.action}>${esc(p.actionLabel)}</button>` : `<span class="pstate">${esc(t("pending"))}</span>`}
    </li>`).join("");
}

/** One line of mission telemetry under the header, no boxes. */
export function renderTelemetry({ crew, mission, day, linkUp }) {
  const m = MISSIONS[mission];
  const item = (label, value, cls = "") => `<span class="tm ${cls}"><span class="tl">${esc(label)}</span> ${value}</span>`;
  $("telemetry").innerHTML = [
    `<span class="tm link" data-up="${linkUp}">${esc(linkUp ? t("linkUp") : t("linkDown"))}</span>`,
    item(t("flightDay"), `<b>${day ?? 0}</b>`),
    item(t("bound"), esc(tr(m.name))),
    item(t("gravity"), esc(m.grav)),
    item(t("delay"), esc(linkDelay(mission).text)),
    `<span class="tm sim">${esc(t("simulated"))}</span>`,
  ].join("");
}

/** Opens or closes the zone detail drawer (it slides in from the right while the astronaut zooms on that zone). */
export function showDetail(open) {
  const d = $("detail");
  d.classList.toggle("open", open);
  d.inert = !open;
  document.body.classList.toggle("detail-open", open);
  if (open) { window.scrollTo({ top: 0, behavior: "smooth" }); $("hideDetail").focus({ preventScroll: true }); }
}
export const detailOpen = () => $("detail").classList.contains("open");

/**
 * Space weather strip on Today. w: SpaceWeather.state · rad: radiationStatus or null (no check-ups yet).
 * Every value says where it came from and when.
 */
export function renderWeather(w, rad) {
  const el = $("weather");
  if (!el) return;
  const utc = (iso) => new Date(iso).toISOString().slice(11, 16) + " UTC";
  const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? L("ahora", "now") : m < 90 ? L(`hace ${m} min`, `${m} min ago`) : L(`hace ${Math.round(m / 60)} h`, `${Math.round(m / 60)} h ago`); };
  let main, lvl = 0;
  if (w.protons) {
    lvl = w.scale >= 3 ? 2 : w.scale >= 1 ? 1 : 0;
    main = `<span class="wx-val" data-l="${lvl}"><b>${esc(tr(S_NAMES[w.scale]))}</b> · ${Number(w.protons.flux).toFixed(2)} ${esc(t("wxPfu"))}</span>
      <span class="note">${esc(w.status === "live" ? t("wxLive") : t("wxCached"))} · NOAA GOES${w.protons.satellite ? "-" + w.protons.satellite : ""} · ${utc(w.protons.at)} (${esc(ago(w.protons.at))})</span>`;
  } else {
    main = `<span class="wx-val"><b>${esc(w.status === "loading" ? t("wxLoading") : t("wxOffline"))}</b></span>
      <span class="note">${esc(w.status === "loading" ? "NOAA · NASA DONKI" : t("wxOfflineSub"))}</span>`;
  }
  const flare = w.flare ? `<div class="wx-item"><span class="label">${esc(t("wxFlare"))}</span><span class="wx-val"><b>${esc(w.flare.classType)}</b></span><span class="note">NASA DONKI${w.flare.at ? " · " + new Date(w.flare.at).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""}</span></div>` : "";
  const dose = rad ? `<div class="wx-item"><span class="label">${esc(t("wxDose"))}</span><span class="wx-val"><b>${rad.cum.toFixed(1)} mSv</b></span><span class="note">${rad.days} ${esc(rad.days === 1 ? L("día", "day") : t("days"))} × ${rad.today} mSv · ${esc(t("wxEstimate"))}</span></div>` : "";
  el.dataset.l = lvl;
  el.innerHTML = `<div class="wx-item wx-main"><span class="label">${esc(t("wxTitle"))}</span>${main}</div>${flare}${dose}
    <button type="button" class="btn small" id="stormDrill" title="${esc(t("wxDrillSub"))}">${esc(t("wxDrill"))}</button>`;
}
