// AstroVital · ScienceView (View layer): the 5 NASA hazards, key data and references.
import { t, tr, L } from "../../config/i18n.js";
import { ZONES, HAZARDS } from "../../config/zones.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);

const REFS = [
  ["NASA HRP · 5 Hazards of Human Spaceflight", "https://www.nasa.gov/hrp/hazards/"],
  ["NASA HRP · Human Spaceflight Risks", "https://www.nasa.gov/hrp/risks/"],
  ["NASA HRP · Ongoing HRP Research (ARCHeR, Standard Measures, Tempus Pro, Veggie, Spinal Health)", "https://www.nasa.gov/hrp/ongoing-hrp-research/"],
  ["NASA · Human Research Roadmap", "https://humanresearchroadmap.nasa.gov/"],
  ["Canadian Space Agency · Monitoring radiation for astronaut health (2026)", "https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp"],
  ["NASA Space Apps 2026 · Create Health Monitoring Software for Astronauts", "https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/"],
  ["American Heart Association · Blood pressure categories", "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings"],
  ["American Diabetes Association · Diagnosis", "https://diabetes.org/about-diabetes/diagnosis"],
];

export function renderScience() {
  $("hzGrid").innerHTML = Object.entries(HAZARDS).map(([k, v]) => {
    const zs = ZONES.filter((z) => z.hz.includes(k)).map((z) => tr(z.n));
    return `<div class="hz"><h3>${esc(tr(v))}</h3><span class="note">${esc(t("zonesLbl"))}</span><div class="meta">${zs.map((n) => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  }).join("");
  const F = [
    ["1.5% / " + L("mes", "month"), { es: "Masa ósea que se puede perder en el espacio (vs ~1%/año en adultos mayores en la Tierra). Fuente: CSA.", en: "Bone mass that can be lost in space (vs ~1%/year for older adults on Earth). Source: CSA." }],
    ["600 mSv", { es: "Límite de radiación de toda la carrera de un astronauta de la NASA.", en: "NASA's career radiation limit for an astronaut." }],
    ["1.84 mSv/" + L("día", "day"), { es: "Dosis medida por el instrumento RAD de Curiosity durante el viaje a Marte.", en: "Dose measured by Curiosity's RAD instrument during the cruise to Mars." }],
    ["1.37 mSv/" + L("día", "day"), { es: "Dosis medida en la superficie de la Luna por la misión Chang'e 4.", en: "Dose measured on the lunar surface by the Chang'e 4 mission." }],
    ["≈30%", { es: "Parte de la radiación en la Estación Espacial que viene de neutrones, los más dañinos (CSA).", en: "Share of ISS radiation that comes from neutrons, the most damaging kind (CSA)." }],
    ["4–24 min", { es: "Lo que tarda un mensaje entre Marte y la Tierra, según la posición de los planetas.", en: "How long a message takes between Mars and Earth, depending on planet positions." }],
  ];
  $("facts").innerHTML = F.map(([n, d]) => `<div class="fact"><div class="n">${esc(n)}</div><p class="note">${esc(tr(d))}</p></div>`).join("");
  $("refs").innerHTML = REFS.map(([n, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("");
}
