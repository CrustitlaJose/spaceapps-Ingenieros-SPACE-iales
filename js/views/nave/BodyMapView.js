// AstroVital · BodyMapView (View layer): zone detail drawer (the body map itself is AstronautView).
import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { ZONES, ZONE_BY_ID, HAZARDS } from "../../config/zones.js";
import { INDICATORS, SYMPTOMS } from "../../config/ranges.js";
import { esc, fmt, unit, COLORS } from "../../utils/format.js";
import { sourceLabel } from "./CheckinView.js";

const $ = (id) => document.getElementById(id);

/** Zone chips at the top of the detail drawer, to jump from one zone to another. */
export function renderZoneChips(result, selected) {
  $("chips").innerHTML = ZONES.map((z) =>
    `<button type="button" data-zone="${z.id}" aria-pressed="${selected === z.id}"><i style="background:${COLORS[result.zones[z.id].lvl]}"></i>${esc(tr(z.n))}</button>`).join("");
}

/** extra: { rad: radiationStatus, bone: number, day: last record, baseline, compare } */
export function renderZoneDetail(zoneId, result, extra) {
  const z = ZONE_BY_ID[zoneId], r = result.zones[zoneId];
  const card = (l, label, n, u, sub) => `<div class="val" data-l="${l}"><div class="label">${esc(label)}</div><div><span class="n">${n}</span><span class="u">${esc(u)}</span></div>${sub ? `<div class="r">${esc(sub)}</div>` : ""}</div>`;
  const srcOf = (k) => { const s = extra.day.sources && extra.day.sources[k]; return s ? ` · ${sourceLabel(s)}` : ""; };
  const shown = zoneId === "mind" && extra.day.moodVas != null ? r.vals.filter((v) => v.k !== "mood") : r.vals; // mood shown as 0–100 below
  let vals = shown.map((v) => card(v.l, tr(INDICATORS[v.k].n), fmt(v.k, v.v), unit(v.k), `${t("normal")}: ${INDICATORS[v.k].band[0]}–${INDICATORS[v.k].band[1]}${srcOf(v.k)}`)).join("");
  if (zoneId === "rad") {
    const R = extra.rad;
    vals = card(R.stormLevel, L("Tormenta de radiación", "Radiation storm"), R.storm ? `S${R.storm.scale}` : "–", "", R.storm ? `${Number(R.storm.flux).toFixed(1)} pfu · NOAA GOES` : L("sin datos en vivo", "no live data"))
      + card(0, L("Dosis diaria estimada", "Estimated daily dose"), R.today.toFixed(2), "mSv", L("promedio publicado de esta misión", "published average for this mission"))
      + card(R.pct >= 80 ? 2 : R.pct >= 50 ? 1 : 0, L("Dosímetro virtual", "Virtual dosimeter"), R.cum.toFixed(1), "mSv", `${R.days} ${t("days")} · ${R.pct.toFixed(1)}% ${L("del límite", "of limit")} (${R.limit})`)
      + card(R.projDose > R.limit ? 1 : 0, L("Proyección misión", "Mission projection"), R.projDose, "mSv", `${R.projDays} ${t("days")}`);
  }
  if (zoneId === "mind") {
    const d = extra.day;
    if (d.moodVas != null) vals += card(d.moodVas < 30 ? 1 : 0, L("Ánimo (0–100)", "Mood (0–100)"), d.moodVas, "/100", L("escala visual", "visual scale"));
    if (d.stressVas != null) vals += card(d.stressVas >= 70 ? 1 : 0, L("Estrés (0–100)", "Stress (0–100)"), d.stressVas, "/100", L("escala visual", "visual scale"));
    if (d.pvt) vals += card(!d.pvt.practice && d.pvt.lapses >= 3 ? 1 : 0, L("Reacción (PVT-B)", "Reaction (PVT-B)"), d.pvt.meanRT, "ms", `${d.pvt.lapses} ${L("lapsos", "lapses")}${d.pvt.practice ? ` · ${L("práctica", "practice")}` : ""}`);
    if (d.pss4) vals += card(0, "PSS-4", d.pss4.score, "/16", L("estrés percibido", "perceived stress"));
  }
  if (zoneId === "bones") vals += card(extra.bone > 1.2 ? 1 : 0, L("Pérdida ósea estimada", "Estimated bone loss"), extra.bone.toFixed(2), "%", L("modelo ilustrativo", "illustrative model"));
  if (zoneId === "brain") {
    const s = extra.day.sym || {};
    vals = ["head", "vision", "dizzy", "nausea"].map((k) => card(s[k] ? 1 : 0, tr(SYMPTOMS[k]), s[k] ? L("Sí", "Yes") : "No", "", "")).join("");
  }
  // Out-of-range values are already shown in the cards above: list only what the cards do not say (trends, symptoms, storms).
  const extraF = r.findings.filter((f) => !f.range);
  const fl = extraF.length ? `<div><span class="label">${esc(t("findingsLbl"))}</span><div style="margin-top:6px"><ul class="findings">${extraF.map((f) => `<li><b style="background:${COLORS[f.l]}"></b><span>${esc(f.txt)}</span></li>`).join("")}</ul></div></div>`
    : r.lvl === 0 ? `<p class="why">${esc(t("allGood"))}</p>` : "";
  // Personal normal: comparison for the values of this zone
  const keys = zoneId === "mind" ? ["sleep"] : z.inds;
  const cmp = (extra.compare || []).filter((c) => keys.includes(c.k));
  const base = extra.baseline;
  const baseBlock = !base || !keys.some((k) => ["hr", "sys", "dia", "temp", "glu", "spo2", "sleep"].includes(k)) ? ""
    : !base.ready ? `<div><span class="label">${esc(t("baseTitle"))}</span><p class="why">${esc(t("baseCalc"))}: ${base.count} ${esc(t("baseOf"))} ${base.needed} ${esc(t("baseCheckups"))}.</p></div>`
    : cmp.length ? `<div><span class="label">${esc(t("baseTitle"))}</span>
        <table class="base-table"><thead><tr><th></th><th>${esc(t("baseToday"))}</th><th>${esc(t("baseNormal"))}</th><th>${esc(t("baseDiff"))}</th></tr></thead><tbody>
        ${cmp.map((c) => `<tr data-flag="${c.flagged}"><td>${esc(tr(INDICATORS[c.k].n))}</td><td>${fmt(c.k, c.value)}</td><td>${fmt(c.k, c.normal)}</td><td>${c.diff > 0 ? "+" : ""}${fmt(c.k, c.diff)} ${esc(unit(c.k))}</td></tr>`).join("")}
        </tbody></table><p class="note">${esc(t("baseNote"))}</p></div>` : "";
  $("zone").innerHTML = `<div class="zd-head"><div><h2>${esc(tr(z.n))}</h2></div><span class="pill" data-l="${r.lvl}">${esc(tr(LEVELS[r.lvl]))}</span></div>
    <div class="vals">${vals}</div>
    ${fl}
    ${baseBlock}
    <div class="do"><span class="label">${esc(t("whatToDo"))}</span><ul>${tr(z.act[r.lvl]).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    <p class="why">${esc(tr(z.why))}</p>
    <div class="meta"><span class="label" style="width:100%">${esc(t("hazardsLbl"))} · ${esc(t("risksLbl"))}</span>${z.hz.map((h) => `<span class="tag hz">${esc(tr(HAZARDS[h]))}</span>`).join("")}${tr(z.risks).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>`;
}
