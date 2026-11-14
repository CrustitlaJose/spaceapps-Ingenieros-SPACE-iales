// AstroVital · BodyMapView (View layer): triage banner, interactive body map and zone detail.
import { t, tr, L, LEVELS } from "../../config/i18n.js";
import { ZONES, ZONE_BY_ID, HAZARDS, PRIORITY } from "../../config/zones.js";
import { INDICATORS, SYMPTOMS } from "../../config/ranges.js";
import { MISSIONS } from "../../config/missions.js";
import { esc, fmt, unit, COLORS } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);

// Hotspot dot on the figure + label position (viewBox 520 x 560).
const HOTS = {
  mind: { dot: [236, 50], lab: [18, 40], side: "l" },
  brain: { dot: [290, 86], lab: [502, 62], side: "r" },
  lungs: { dot: [230, 230], lab: [18, 212], side: "l" },
  heart: { dot: [284, 222], lab: [502, 180], side: "r" },
  blood: { dot: [262, 262], lab: [18, 300], side: "l" },
  immune: { dot: [338, 250], lab: [502, 282], side: "r" },
  bones: { dot: [232, 390], lab: [18, 410], side: "l" },
  rad: { dot: [390, 420], lab: [502, 440], side: "r" },
};

export function renderTriage(result, mission, canSend) {
  const overall = result.overall, m = MISSIONS[mission];
  const heads = [
    { es: "Todo en orden: lo manejas tú", en: "All clear: self-managed" },
    { es: "Atención: avisa al oficial médico de la tripulación", en: "Caution: notify the Crew Medical Officer" },
    { es: "Crítico: contacta a los cirujanos de vuelo", en: "Critical: contact flight surgeons" },
  ];
  const flagged = PRIORITY.filter((id) => result.zones[id].lvl === overall && overall > 0).map((id) => ZONE_BY_ID[id]);
  const yellow = overall === 2 ? ZONES.filter((z) => result.zones[z.id].lvl === 1).map((z) => tr(z.n)) : [];
  const sub = overall === 0
    ? L("Las 8 zonas están en verde y no hay tendencias preocupantes.", "All 8 zones are green with no concerning trends.")
    : L("Zonas a revisar: ", "Zones to review: ") + flagged.map((z) => tr(z.n)).join(", ") + (yellow.length ? L(". También en amarillo: ", ". Also yellow: ") + yellow.join(", ") : "");
  let extra = "";
  if (overall === 2) {
    const z = flagged[0];
    extra = `<p class="delay">${esc(tr(m.comm))}</p><span class="label">${esc(L("Primero", "First"))}: ${esc(tr(z.n))}</span>
      <ol>${tr(z.act[2]).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      ${canSend ? `<div class="row" style="margin-top:6px"><button type="button" class="btn primary small" data-action="send-report">${esc(t("send"))}</button></div>` : ""}`;
  } else if (overall === 1) {
    extra = `<p class="delay">${esc(L("Abre la zona marcada para ver qué hacer.", "Open the flagged zone to see what to do."))}</p>`;
  }
  const el = $("triage");
  el.dataset.l = overall;
  el.innerHTML = `<div class="lamp" data-l="${overall}" aria-hidden="true">${overall === 0 ? "OK" : overall === 1 ? "!" : "!!"}</div>
    <div class="body"><span class="label">${esc(L("Estado general", "Overall status"))} · ${esc(tr(LEVELS[overall]))}</span>
    <h2>${esc(tr(heads[overall]))}</h2><p>${esc(sub)}</p>${extra}</div>`;
}

export function renderBodyMap(result, selected) {
  $("hots").innerHTML = ZONES.map((z) => {
    const h = HOTS[z.id], c = COLORS[result.zones[z.id].lvl];
    const [dx, dy] = h.dot, [lx, ly] = h.lab;
    const name = tr(z.n);
    const lineEnd = h.side === "l" ? lx + name.length * 9.3 + 8 : lx - name.length * 9.3 - 8;
    return `<g class="hot${selected === z.id ? " sel" : ""}" data-zone="${z.id}" tabindex="0" role="button" aria-label="${esc(name)}: ${esc(tr(LEVELS[result.zones[z.id].lvl]))}">
      <line class="lead" x1="${dx}" y1="${dy}" x2="${lineEnd}" y2="${ly - 5}" stroke="${c}"/>
      <circle class="ring" cx="${dx}" cy="${dy}" r="17" stroke="${c}"/>
      <circle class="dot" cx="${dx}" cy="${dy}" r="10" fill="${c}"/>
      <text x="${lx}" y="${ly}" text-anchor="${h.side === "l" ? "start" : "end"}">${esc(name)}</text></g>`;
  }).join("");
  $("aura").setAttribute("stroke", COLORS[result.zones.rad.lvl]);
  $("figTitle").textContent = L("Mapa del cuerpo del astronauta", "Astronaut body map");
  $("chips").innerHTML = ZONES.map((z) =>
    `<button type="button" data-zone="${z.id}" aria-pressed="${selected === z.id}"><i style="background:${COLORS[result.zones[z.id].lvl]}"></i>${esc(tr(z.n))}</button>`).join("");
}

/** extra: { rad: radiationStatus, bone: number, day: last record } */
export function renderZoneDetail(zoneId, result, extra) {
  const z = ZONE_BY_ID[zoneId], r = result.zones[zoneId];
  const card = (l, label, n, u, sub) => `<div class="val" data-l="${l}"><div class="label">${esc(label)}</div><div><span class="n">${n}</span><span class="u">${esc(u)}</span></div>${sub ? `<div class="r">${esc(sub)}</div>` : ""}</div>`;
  let vals = r.vals.map((v) => card(v.l, tr(INDICATORS[v.k].n), fmt(v.k, v.v), unit(v.k), `${t("normal")}: ${INDICATORS[v.k].band[0]}–${INDICATORS[v.k].band[1]}`)).join("");
  if (zoneId === "rad") {
    const R = extra.rad;
    vals = card(R.solar ? 2 : 0, L("Dosis de hoy", "Today's dose"), R.today.toFixed(2), "mSv", `${L("esperado", "expected")}: ${R.expected} mSv`)
      + card(R.pct >= 80 ? 2 : R.pct >= 50 ? 1 : 0, L("Acumulada", "Cumulative"), R.cum.toFixed(0), "mSv", `${R.pct.toFixed(1)}% ${L("del límite", "of limit")} (${R.limit})`)
      + card(R.projDose > R.limit ? 1 : 0, L("Proyección misión", "Mission projection"), R.projDose, "mSv", `${R.projDays} ${t("days")}`);
  }
  if (zoneId === "bones") vals += card(extra.bone > 1.2 ? 1 : 0, L("Pérdida ósea estimada", "Estimated bone loss"), extra.bone.toFixed(2), "%", L("modelo ilustrativo", "illustrative model"));
  if (zoneId === "brain") {
    const s = extra.day.sym || {};
    vals = ["head", "vision", "dizzy", "nausea"].map((k) => card(s[k] ? 1 : 0, tr(SYMPTOMS[k]), s[k] ? L("Sí", "Yes") : "No", "", "")).join("");
  }
  const fl = r.findings.length
    ? `<ul class="findings">${r.findings.map((f) => `<li><b style="background:${COLORS[f.l]}"></b><span>${esc(f.txt)}</span></li>`).join("")}</ul>`
    : `<p class="why">${esc(t("allGood"))}</p>`;
  $("zone").innerHTML = `<div class="zd-head"><div><span class="label">${esc(t("zonesLbl"))}</span><h2>${esc(tr(z.n))}</h2></div><span class="pill" data-l="${r.lvl}">${esc(tr(LEVELS[r.lvl]))}</span></div>
    <div class="vals">${vals}</div>
    <div><span class="label">${esc(t("findingsLbl"))}</span><div style="margin-top:6px">${fl}</div></div>
    <div class="do"><span class="label">${esc(t("whatToDo"))}</span><ul>${tr(z.act[r.lvl]).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    <p class="why">${esc(tr(z.why))}</p>
    <div class="meta"><span class="label" style="width:100%">${esc(t("hazardsLbl"))} · ${esc(t("risksLbl"))}</span>${z.hz.map((h) => `<span class="tag hz">${esc(tr(HAZARDS[h]))}</span>`).join("")}${tr(z.risks).map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>`;
}
