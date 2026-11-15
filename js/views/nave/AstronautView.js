// AstroVital · AstronautView (View layer): the floating astronaut on the Today screen.
// It is the body map: each body zone is drawn on the suit as a scan glyph that lights up green, yellow or red.
// Affected zones pulse and get a callout with the value; choosing a zone flies the "camera" to that part of the body.
// The SVG is built once and then only its attributes change, so the idle animation never restarts.
import { tr, LEVELS, L } from "../../config/i18n.js";
import { ZONES } from "../../config/zones.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);
const W = 460, H = 600; // the body is drawn in 460 x 600; the viewBox adds side margins for the callouts

/** Where each zone sits on the body (anchor), where its callout goes, and where the camera looks when it is chosen. */
const SPOTS = {
  mind:   { at: [204, 74],  label: [-46, 40],  side: "l", cam: [230, 108, 2.1] },
  brain:  { at: [250, 118], label: [506, 72],  side: "r", cam: [230, 112, 2.1] },
  lungs:  { at: [206, 208], label: [-46, 168], side: "l", cam: [230, 216, 1.9] },
  heart:  { at: [254, 208], label: [506, 170], side: "r", cam: [230, 216, 1.9] },
  blood:  { at: [117, 320], label: [-46, 418], side: "l", cam: [160, 300, 1.8] },
  immune: { at: [230, 304], label: [506, 372], side: "r", cam: [230, 290, 1.8] },
  bones:  { at: [271, 438], label: [506, 452], side: "r", cam: [236, 440, 1.6] },
  rad:    { at: [66, 500],  label: [-46, 548], side: "l", cam: [230, 300, 1] },
};

/** Small line drawings for each zone, centered on (0,0). They look like a medical scan on the suit. */
export const GLYPHS = {
  mind: `<path d="M5 -9a10 10 0 1 0 6 16a8 8 0 0 1 -6 -16z"/>`,                                             // crescent: mind & sleep
  brain: `<path d="M-13 0q13 -12 26 0q-13 12 -26 0z"/><circle r="3.6"/>`,                                     // eye: brain & eyes
  lungs: `<path d="M-2 -11v9M-2 -4q-9 2 -10 13q5 3 10 -1zM-2 -4"/><path d="M2 -11v9M2 -4q9 2 10 13q-5 3 -10 -1z"/>`,
  heart: `<path d="M0 10q-14 -9 -11 -17q3 -7 11 0q8 -7 11 0q3 8 -11 17z"/>`,
  blood: `<path d="M0 -11q9 11 9 15a9 9 0 0 1 -18 0q0 -4 9 -15z"/>`,
  immune: `<path d="M0 -12l11 4v7q0 9 -11 13q-11 -4 -11 -13v-7z"/><path d="M-4 -1l3 4l6 -7"/>`,
  bones: `<path d="M-6 -11a3.5 3.5 0 1 1 5 -3a3.5 3.5 0 1 1 5 5l-4 18a3.5 3.5 0 1 1 -5 3a3.5 3.5 0 1 1 -5 -5z" transform="rotate(8)"/>`,
  rad: `<circle r="3"/><path d="M0 -6a6 6 0 0 1 5.2 3l5 -3a12 12 0 0 0 -10.2 -6z"/><path d="M0 -6a6 6 0 0 1 5.2 3l5 -3a12 12 0 0 0 -10.2 -6z" transform="rotate(120)"/><path d="M0 -6a6 6 0 0 1 5.2 3l5 -3a12 12 0 0 0 -10.2 -6z" transform="rotate(240)"/>`,
};

/** A limb drawn as a thick rounded tube: dark outline underneath, light suit on top, a ring at the joint. */
const tube = (d, w) => `<path d="${d}" class="suit-edge" stroke-width="${w + 7}"/><path d="${d}" class="suit-fill" stroke-width="${w}"/>`;

function buildSvg() {
  const zones = ZONES.map((z) => {
    const s = SPOTS[z.id], [x, y] = s.at;
    return `<g class="zn" data-zone="${z.id}" data-l="none">
      <circle class="zn-glow" cx="${x}" cy="${y}" r="${z.id === "bones" ? 34 : 28}"/>
      <g class="zn-callout"><path class="zn-lead" d=""/><text class="zn-name" y="${s.label[1]}"></text><text class="zn-val" y="${s.label[1] + 16}"></text></g>
      <g class="hot" data-open-zone="${z.id}" tabindex="0" role="button">
        <circle class="zn-hit" cx="${x}" cy="${y}" r="24"/>
        <circle class="zn-ring" cx="${x}" cy="${y}" r="19"/>
        <g class="zn-glyph" transform="translate(${x} ${y})">${GLYPHS[z.id]}</g>
      </g></g>`;
  }).join("");
  return `<svg id="astroSvg" viewBox="-56 0 572 ${H}" role="group" aria-label="${esc(L("Mapa del cuerpo del astronauta", "Astronaut body map"))}">
    <defs>
      <linearGradient id="avSuit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7F9FC"/><stop offset=".55" stop-color="#D9DFEA"/><stop offset="1" stop-color="#9CA6BA"/></linearGradient>
      <linearGradient id="avPack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8E98AD"/><stop offset="1" stop-color="#565F73"/></linearGradient>
      <radialGradient id="avVisor" cx=".32" cy=".28" r=".95"><stop offset="0" stop-color="#3A4A78"/><stop offset=".4" stop-color="#121A33"/><stop offset="1" stop-color="#05070F"/></radialGradient>
      <radialGradient id="avHelmet" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".6" stop-color="#DDE3EE"/><stop offset="1" stop-color="#A3ADC1"/></radialGradient>
      <filter id="avBlur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
      <clipPath id="avVisorClip"><path d="M184 112q0 -40 46 -40q46 0 46 40q0 42 -46 42q-46 0 -46 -42z"/></clipPath>
    </defs>
    <g class="astro-cam">
      <ellipse class="aura" cx="230" cy="300" rx="196" ry="280"/>
      <g class="astro-float">
        <g class="limb arm-l">${tube("M170 204L130 284", 40)}${tube("M130 284L116 352", 36)}<circle class="joint" cx="130" cy="284" r="9"/><circle class="glove" cx="113" cy="372" r="19"/><path class="cuff" d="M98 352h36"/></g>
        <g class="limb arm-r">${tube("M290 204L336 266", 40)}${tube("M336 266L372 318", 36)}<circle class="joint" cx="336" cy="266" r="9"/><circle class="glove" cx="384" cy="334" r="19"/><path class="cuff" d="M362 332l22 -24"/></g>
        <g class="limb leg-l">${tube("M204 340L196 430", 50)}${tube("M196 430L190 512", 44)}<path class="knee" d="M174 430h44"/><rect class="boot" x="164" y="508" width="54" height="38" rx="14"/></g>
        <g class="limb leg-r">${tube("M256 340L268 428", 50)}${tube("M268 428L280 508", 44)}<path class="knee" d="M246 430h44"/><rect class="boot" x="254" y="504" width="54" height="38" rx="14"/></g>
        <rect class="pack" x="148" y="168" width="164" height="156" rx="26"/>
        <path class="torso" d="M172 180Q230 166 288 180Q304 186 304 206L296 320Q294 340 276 342L184 342Q166 340 164 320L156 206Q156 186 172 180Z"/>
        <path class="seam" d="M168 322h124M230 180v52"/>
        <g class="unit"><rect x="203" y="238" width="54" height="38" rx="7"/><rect class="unit-screen" x="209" y="244" width="26" height="14" rx="3"/><circle class="led led-1" cx="244" cy="248" r="3"/><circle class="led led-2" cx="244" cy="258" r="3"/><path class="unit-line" d="M209 267h40"/></g>
        <path class="hose" d="M203 258Q178 262 176 300"/>
        <rect class="collar" x="192" y="164" width="76" height="20" rx="10"/>
        <circle class="helmet" cx="230" cy="108" r="66"/>
        <path class="visor" d="M184 112q0 -40 46 -40q46 0 46 40q0 42 -46 42q-46 0 -46 -42z"/>
        <g clip-path="url(#avVisorClip)">
          <circle class="visor-planet" cx="262" cy="150" r="38"/>
          <path class="visor-shine" d="M196 96q10 -18 34 -20" /><path class="visor-shine thin" d="M192 116q0 -8 3 -14"/>
        </g>
        <path class="helmet-rim" d="M184 112q0 -40 46 -40q46 0 46 40q0 42 -46 42q-46 0 -46 -42z"/>
        <g class="zones">${zones}</g>
      </g>
      <ellipse class="hoop" cx="230" cy="0" rx="170" ry="18"/>
    </g>
  </svg>`;
}

/** Callout geometry: an underline next to the label, joined to the body with one diagonal line. */
function layoutCallout(g, zoneId, name, value) {
  const s = SPOTS[zoneId], [ax, ay] = s.at, [lx, ly] = s.label;
  const w = Math.max(name.length * 7.4, value.length * 6.6) + 6, uy = ly + 23;
  const x1 = s.side === "l" ? lx : lx - w, x2 = s.side === "l" ? lx + w : lx, near = s.side === "l" ? x2 : x1;
  g.querySelector(".zn-lead").setAttribute("d", `M${x1} ${uy}H${x2}M${near} ${uy}L${ax} ${ay}`);
  for (const [cls, txt] of [[".zn-name", name], [".zn-val", value]]) {
    const el = g.querySelector(cls);
    el.setAttribute("x", lx); el.setAttribute("text-anchor", s.side === "l" ? "start" : "end"); el.textContent = txt;
  }
}

/**
 * Draws or updates the astronaut.
 * result: evaluateAll() result or null (no check-ups yet) · values: { zoneId: short text } · selected: zone id · focus: zoom on the selected zone.
 */
export function renderAstronaut(result, values = {}, selected = null, focus = false) {
  const stage = $("astro");
  if (!stage) return;
  if (!stage.firstElementChild) stage.innerHTML = buildSvg();
  const overall = result ? result.overall : "none";
  stage.dataset.l = overall;
  stage.dataset.focus = String(!!(focus && selected));
  ZONES.forEach((z) => {
    const g = stage.querySelector(`.zn[data-zone="${z.id}"]`);
    const lvl = result ? result.zones[z.id].lvl : "none";
    g.dataset.l = lvl;
    g.dataset.sel = String(selected === z.id && focus);
    const name = tr(z.n), value = values[z.id] || "";
    layoutCallout(g, z.id, name, value);
    g.querySelector(".hot").setAttribute("aria-label", result ? `${name}: ${tr(LEVELS[lvl])}${value ? ", " + value : ""}` : name);
  });
  stage.querySelector(".aura").dataset.l = result ? result.zones.rad.lvl : "none";
  // Camera: fly to the chosen part of the body
  const cam = stage.querySelector(".astro-cam");
  if (focus && selected && SPOTS[selected]) {
    const [cx, cy, s] = SPOTS[selected].cam;
    cam.style.transform = `translate(${(W / 2 - cx * s).toFixed(1)}px, ${(H / 2 - cy * s).toFixed(1)}px) scale(${s})`;
  } else cam.style.transform = "";
}

/** One scan pass over the body (after a check-up is saved, or when a crew member is opened). */
export function scanAstronaut() {
  const stage = $("astro");
  if (!stage || !stage.firstElementChild) return;
  stage.classList.remove("scanning");
  void stage.offsetWidth; // restart the animation
  stage.classList.add("scanning");
  clearTimeout(scanAstronaut.timer);
  scanAstronaut.timer = setTimeout(() => stage.classList.remove("scanning"), 2400);
}
