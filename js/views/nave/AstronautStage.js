// AstroVital · AstronautStage (View layer): the astronaut on the Today screen.
// Shows NASA's 3D astronaut when the browser can draw it (WebGL); otherwise it falls back to the drawn SVG astronaut.
// Either way the rest of the app calls the same two functions: renderAstronaut() and scanAstronaut().
import { tr, LEVELS } from "../../config/i18n.js";
import { ZONES } from "../../config/zones.js";
import { esc } from "../../utils/format.js";
import { getMission } from "../../models/LinkModel.js";
import * as drawn from "./AstronautView.js";

const $ = (id) => document.getElementById(id);
let engine = null, booting = false, failed = false, lastArgs = null, layer = null;
const marks = {};
/** Which side each label opens to, so labels never cover the body. */
const SIDE = { mind: "l", lungs: "l", blood: "l", rad: "l", brain: "r", heart: "r", immune: "r", bones: "r" };

function buildLayer(stage) {
  layer = document.createElement("div");
  layer.className = "mk-layer";
  layer.innerHTML = ZONES.map((z) => `<button type="button" class="mk hot" data-open-zone="${z.id}" data-zone="${z.id}" data-side="${SIDE[z.id]}" data-l="none">
      <span class="mk-dot"><svg viewBox="-16 -16 32 32" aria-hidden="true">${drawn.GLYPHS[z.id]}</svg></span>
      <span class="mk-label"><b></b><i></i></span></button>`).join("");
  stage.append(layer);
  ZONES.forEach((z) => { marks[z.id] = layer.querySelector(`.mk[data-zone="${z.id}"]`); });
}

function paint(result, values = {}, selected = null, focus = false) {
  const stage = $("astro");
  if (actState) { selected = actState.zone; focus = true; } // during an emergency guide the marker of that zone stays in focus
  stage.dataset.l = result ? result.overall : "none";
  stage.dataset.focus = String(!!(focus && selected));
  const levels = {};
  ZONES.forEach((z) => {
    const lvl = result ? result.zones[z.id].lvl : "none", m = marks[z.id], name = tr(z.n), value = values[z.id] || "";
    levels[z.id] = lvl;
    m.dataset.l = lvl; m.dataset.sel = String(selected === z.id && focus);
    m.querySelector("b").textContent = name; m.querySelector("i").textContent = value;
    m.setAttribute("aria-label", result ? `${name}: ${tr(LEVELS[lvl])}${value ? ", " + value : ""}` : name);
  });
  engine.update(levels, selected, focus);
  if (engine.mission !== getMission()) engine.setMission(getMission());
}

async function boot() {
  if (engine || booting || failed) return;
  booting = true;
  const stage = $("astro");
  try {
    const { Astronaut3D } = await import("../../space/Astronaut3D.js");
    const e = new Astronaut3D(stage);
    await e.load();
    buildLayer(stage);
    e.onFrame = (pts) => { for (const id in pts) marks[id].style.transform = `translate3d(${pts[id].x.toFixed(1)}px, ${pts[id].y.toFixed(1)}px, 0)`; };
    engine = e;
    stage.classList.add("is-3d");
    if (lastArgs) paint(...lastArgs);
    engine.setStorm(stormState.level, stormState.shield);
    engine.setAct(actState);
    engine.scan();
  } catch (err) {
    failed = true; // no WebGL or the model could not be loaded: the drawn astronaut stays
    stage.querySelectorAll(".astro-gl, .mk-layer").forEach((n) => n.remove());
  }
  booting = false;
}

/** result: evaluateAll() result or null · values: { zoneId: short text } · selected: zone id · focus: zoom on it. */
export function renderAstronaut(result, values = {}, selected = null, focus = false) {
  lastArgs = [result, values, selected, focus];
  if (engine) paint(...lastArgs); else drawn.renderAstronaut(...lastArgs);
  boot();
}

/** Radiation storm look: level 0–1 (particles and the suit glowing) and shield 0–1 (the refuge). Also tells the background. */
let stormState = { level: 0, shield: 0 };
export function setStorm(level, shield = 0) {
  stormState = { level, shield };
  if (engine) engine.setStorm(level, shield);
  document.documentElement.classList.toggle("storm-on", level > 0.05);
  window.dispatchEvent(new CustomEvent("astrovital:storm", { detail: stormState }));
}

/** Emergency guide on the astronaut (camera on the zone, pulse, breathing, bubble). act: see Astronaut3D.setAct, or null. */
let actState = null;
export function setAct(act) {
  actState = act;
  if (engine) engine.setAct(act);
  if (lastArgs) { if (engine) paint(...lastArgs); }
}

export function scanAstronaut() { if (engine) engine.scan(); else drawn.scanAstronaut(); }
