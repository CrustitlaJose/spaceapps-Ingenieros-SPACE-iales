// AstroVital · Astronaut3D: the real-looking astronaut of the Today screen.
// NASA's own 3D model of the EMU spacewalk suit (NASA 3D Resources), lit by the sun and by the planet below,
// drifting and turning slowly as in weightlessness. Body zones are 3D points on the suit: the view pins its
// markers to them every frame, and affected zones cast a yellow or red glow on the suit itself.
import * as THREE from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { makeStreaks, makeShield, STORM_DIR } from "./StormFx.js";

const BREATH_CYCLE = 10, INHALE = 4; // slow breathing guide: 4 s in, 6 s out

// NASA's Extravehicular Mobility Unit (EMU), the white spacewalk suit, from NASA 3D Resources. Prepared for the app
// (see assets/space/CREDITS.md): jetpack removed, arms lowered to the sides. The file faces away from the camera, so it is turned around.
const MODEL = (typeof window !== "undefined" && window.__ASTRO_MODEL) || "assets/models/emu-nasa.glb";
const MODEL_TURN = Math.PI;
const DIST = 7.7;   // camera distance for the whole-body view
const PLATE = [0, 0.56, 0.4]; // chest name plate: x, y and width, in body units
const HEIGHT = 3.2; // the suit is scaled to this height; anchors below use the same units (0,0,0 = center of the body)

/** Where each body zone is on the suit (x: viewer's right, y: up, z: toward the viewer). */
export const ANCHORS = {
  mind:   [-0.24, 1.38, 0.34],
  brain:  [0.14, 1.26, 0.52],
  lungs:  [-0.24, 0.66, 0.52],
  heart:  [0.24, 0.66, 0.52],
  immune: [0.0, 0.2, 0.50],
  blood:  [-0.56, 0.36, 0.46],
  bones:  [0.30, -0.80, 0.34],
  rad:    [-0.32, -0.42, 0.46],
};
const LEVEL_COLOR = { 1: 0xf7b93e, 2: 0xff3b4e };
const PLANET_SHINE = { iss: 0x4f8dff, moon: 0xcfd6e6, mars: 0xff8a52 };

export class Astronaut3D {
  constructor(stage) {
    this.stage = stage;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "astro-gl"; this.canvas.setAttribute("aria-hidden", "true");
    stage.prepend(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, DIST);
    this.target = new THREE.Vector3(); this.camTo = new THREE.Vector3(0, 0, DIST); this.lookTo = new THREE.Vector3();
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.key = new THREE.DirectionalLight(0xffffff, 2.5); this.key.position.set(-5, 4, 5);
    this.shine = new THREE.DirectionalLight(PLANET_SHINE.mars, 0.5); this.shine.position.set(-2.5, -4.5, 2.5);
    this.rim = new THREE.DirectionalLight(0xdfe8ff, 1.3); this.rim.position.set(3.5, 2, -5);
    this.scene.add(this.key, this.shine, this.rim, new THREE.AmbientLight(0xdfe6f5, 0.3));
    this.glows = {}; this.levels = {}; this.selected = null; this.focus = false;
    this.points = {}; this.onFrame = null;
    this.storm = { level: 0, shield: 0 }; this.stormTo = { level: 0, shield: 0 };
    this.t = 0; this.last = 0; this.sway = 1; this.scanAt = -1; this.ready = false;
    this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.frame = this.frame.bind(this);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(MODEL);
    const model = gltf.scene;
    this.suitMats = [];
    // Every part of the suit gets its own material: white cloth, gray gloves, metal rings, brass and red fittings, gold mirror visor.
    const M = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    const cloth = M(0xf0f0ec, 0.9), glove = M(0x8a8f97, 0.82);
    this.visor = M(0xe2a93e, 0.04, 1, { envMapIntensity: 1.5 });          // reflects the landscape (see setMission)
    const patch = M(0xffffff, 0.8, 0, { map: this.logoTexture(true) });    // the suit's patches carry the AstroVital mark
    const parts = [
      [/justbody_blinn3SG$/, this.visor], [/glove$/, glove],
      [/blinn2SG$/, M(0xb4b9c1, 0.36, 0.85)], [/lambert4SG$/, M(0xc9ccd2, 0.85)],
      [/blinn12SG$|emusuit5_lambert3SG$/, M(0xc0382b, 0.42, 0.35)], [/blinn3SG$|blinn1SG$/, M(0xb88a3c, 0.34, 0.85)],
      [/lambert11SG$/, M(0x6f747c, 0.6, 0.4)], [/lambert3SG$/, M(0xdcdee2, 0.7)],
    ];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name || "", hit = parts.find(([re]) => re.test(name));
      if (hit) { o.material = hit[1]; return; }
      if (o.material.map) { o.material = patch; return; }
      o.material = cloth;
      if (!this.suitMats.includes(cloth)) this.suitMats.push(cloth);
    });
    // center and scale so the suit is HEIGHT tall
    const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const facing = new THREE.Group(); facing.add(model); facing.rotation.y = MODEL_TURN;
    this.body = new THREE.Group(); this.body.add(facing); this.body.scale.setScalar(HEIGHT / size.y);
    this.float = new THREE.Group(); this.float.add(this.body); this.root.add(this.float);
    // anchors and glow lights live in the body's own space (unscaled group so the units are the same as ANCHORS)
    this.pins = new THREE.Group(); this.float.add(this.pins);
    for (const [id, p] of Object.entries(ANCHORS)) {
      const light = new THREE.PointLight(0xffffff, 0, 0.95, 2); // short reach: the glow stays on that part of the suit
      light.position.set(p[0], p[1], p[2] + 0.3);
      this.pins.add(light); this.glows[id] = light;
    }
    // scan ring
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.rotation.x = Math.PI / 2; this.root.add(this.ring);
    this.ringLight = new THREE.PointLight(0xbfe0ff, 0, 3, 1.4); this.root.add(this.ringLight);
    // radiation storm: particle streaks, an orange light from the sun side and the refuge shield
    this.streaks = makeStreaks({ count: 520, box: [3.4, 3.2, 2.2], length: 0.55, speed: 6, span: 9 });
    this.shield = makeShield(2.05);
    this.stormLight = new THREE.DirectionalLight(0xff7a2a, 0); this.stormLight.position.copy(STORM_DIR).multiplyScalar(-8);
    this.root.add(this.streaks, this.shield, this.stormLight);
    // emergency guide effects: pulse rings on the affected zone, an isolation bubble, and oxygen flowing to the helmet
    this.rings = [0, 1, 2].map(() => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff3b4e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      r.renderOrder = 7; this.pins.add(r); return r;
    });
    this.bubble = makeShield(1.85); this.bubble.material.uniforms.uTint.value.set(0.3, 1.0, 0.72); this.root.add(this.bubble);
    this.oxygen = makeStreaks({ count: 90, box: [0.32, 0.5, 0.18], length: 0.1, speed: 0.8, span: 1.5, color: [0.35, 0.9, 1.0] });
    this.oxygen.material.uniforms.uDir.value.set(0, 1, 0); this.oxygen.material.uniforms.uRadius.value = 0; this.oxygen.position.set(0, 0.75, 0.62);
    this.float.add(this.oxygen);
    this.actColor = new THREE.Color();
    this.addChestUnit();
    this.ready = true;
    this.setMission(this.mission || "mars");
    requestAnimationFrame(this.frame);
  }

  /** The AstroVital mark drawn on a canvas: round patch (for the suit's patches) or wide name plate (for the chest unit). */
  logoTexture(round) {
    const c = document.createElement("canvas"); c.width = 512; c.height = round ? 512 : 160;
    const g = c.getContext("2d");
    g.textAlign = "center"; g.textBaseline = "middle";
    if (round) {
      g.fillStyle = "#f4f5f7"; g.fillRect(0, 0, 512, 512);
      g.strokeStyle = "#1e55c8"; g.lineWidth = 26; g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "#10255c"; g.lineWidth = 22; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath(); g.moveTo(92, 236); g.lineTo(170, 236); g.lineTo(204, 150); g.lineTo(262, 318); g.lineTo(306, 196); g.lineTo(330, 236); g.lineTo(420, 236); g.stroke();
      g.fillStyle = "#1e55c8"; g.font = "900 68px Archivo, Arial, sans-serif"; g.fillText("AstroVital", 256, 384, 360);
    } else {
      g.fillStyle = "#f5f6f8"; g.fillRect(0, 0, 512, 160);
      g.strokeStyle = "#9aa0a8"; g.lineWidth = 8; g.strokeRect(4, 4, 504, 152);
      g.fillStyle = "#1e55c8"; g.font = "900 92px Archivo, Arial, sans-serif"; g.fillText("AstroVital", 256, 86, 460);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (round) tex.flipY = false; // same convention as the model's own textures
    return tex;
  }

  /** Name plate on the chest control unit, like the plate on the reference suit. It sits on the unit's front face. */
  addChestUnit() {
    this.float.updateMatrixWorld(true);
    // the plate sits in front of the unit's front face: take the most forward point under the plate's width
    let zMax = -9;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
      const ray = new THREE.Raycaster(new THREE.Vector3(PLATE[0] + (i / 4 - 0.5) * PLATE[2], PLATE[1] + (j / 2 - 0.5) * PLATE[2] * 0.3, 6), new THREE.Vector3(0, 0, -1));
      const h = ray.intersectObject(this.body, true)[0];
      if (h) zMax = Math.max(zMax, h.point.z);
    }
    const hit = zMax > -9 ? { point: { z: zMax } } : null;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(PLATE[2], PLATE[2] * 160 / 512), new THREE.MeshStandardMaterial({ map: this.logoTexture(false), roughness: 0.5, metalness: 0.05 }));
    plate.position.set(PLATE[0], PLATE[1], (hit ? hit.point.z : 0.6) + 0.012);
    this.pins.add(plate);
  }

  /** The planet below tints the light from underneath and what the gold visor reflects. */
  setMission(mission) {
    this.mission = mission;
    const color = PLANET_SHINE[mission] || PLANET_SHINE.mars;
    this.shine.color.setHex(color);
    const c = document.createElement("canvas"); c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#020308"; g.fillRect(0, 0, 512, 256);
    const planet = g.createLinearGradient(0, 150, 0, 256); const hex = "#" + color.toString(16).padStart(6, "0");
    planet.addColorStop(0, "rgba(0,0,0,0)"); planet.addColorStop(0.25, hex); planet.addColorStop(1, hex);
    g.fillStyle = planet; g.fillRect(0, 150, 512, 106);
    const sun = g.createRadialGradient(150, 60, 0, 150, 60, 46); sun.addColorStop(0, "#ffffff"); sun.addColorStop(0.3, "#fff6dd"); sun.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sun; g.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(this.renderer);
    if (this.scene.environment) this.scene.environment.dispose();
    this.scene.environment = pm.fromEquirectangular(tex).texture; this.scene.environmentIntensity = 0.35;
    tex.dispose();
    // the visor gets its own, brighter reflection: dark sky with stars, a bright horizon and the ground lit by the planet
    const vc = document.createElement("canvas"); vc.width = 512; vc.height = 256; const vg = vc.getContext("2d");
    const sky = vg.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#05060c"); sky.addColorStop(0.46, "#0b0f1c"); sky.addColorStop(0.5, "#f6efe2"); sky.addColorStop(0.54, hex); sky.addColorStop(1, "#1a1410");
    vg.fillStyle = sky; vg.fillRect(0, 0, 512, 256);
    vg.fillStyle = "#ffffff"; for (let i = 0; i < 60; i++) vg.fillRect((i * 97) % 512, (i * 53) % 110, 2, 2);
    const vs = vg.createRadialGradient(140, 70, 0, 140, 70, 34); vs.addColorStop(0, "#ffffff"); vs.addColorStop(1, "rgba(255,255,255,0)"); vg.fillStyle = vs; vg.fillRect(0, 0, 512, 256);
    vg.fillStyle = "rgba(0,0,0,.28)"; for (let i = 0; i < 26; i++) { vg.beginPath(); vg.ellipse((i * 131) % 512, 150 + (i * 37) % 100, 10 + (i % 5) * 6, 3 + (i % 3) * 2, 0, 0, Math.PI * 2); vg.fill(); }
    const vt = new THREE.CanvasTexture(vc); vt.mapping = THREE.EquirectangularReflectionMapping; vt.colorSpace = THREE.SRGBColorSpace;
    if (this.visor) { if (this.visor.envMap) this.visor.envMap.dispose(); this.visor.envMap = pm.fromEquirectangular(vt).texture; this.visor.needsUpdate = true; }
    vt.dispose(); pm.dispose();
  }

  /** levels: { zoneId: 0 | 1 | 2 | "none" } · selected + focus: fly the camera to that zone. */
  update(levels, selected, focus) {
    this.levels = levels || {}; this.selected = selected; this.focus = !!(focus && selected && ANCHORS[selected]);
  }

  scan() { this.scanAt = this.t; }

  /**
   * Emergency guide on the astronaut. act: null or { type: "heart" | "oxygen" | "temp" | "zone", zone, progress 0–1, drill, breath }.
   * The camera goes to the zone and the zone pulses. In a drill the color goes from red to green as the steps are done;
   * in a real emergency the color always follows the real data.
   */
  setAct(act) { this.act = act && ANCHORS[act.zone] ? act : null; this.actAt = this.t; }

  /** level 0–1: how strong the radiation storm looks · shield 0–1: how much of the refuge is up. Both ease in. */
  setStorm(level, shield) { this.stormTo = { level: Math.max(0, Math.min(1, level)), shield: Math.max(0, Math.min(1, shield)) }; }

  /** Draws the emergency guide effects for the current act (see setAct). */
  drawAct(t, dt) {
    const act = this.act, k = (v) => Math.max(0, Math.min(1, v));
    const fade = (obj, to) => { obj.userData.a = (obj.userData.a || 0) + (to - (obj.userData.a || 0)) * Math.min(1, dt * 2.2); return obj.userData.a; };
    const bubbleTo = act && act.type === "temp" && act.progress >= 0.2 ? 1 : 0, oxyTo = act && act.type === "oxygen" && act.progress >= 0.75 ? 1 : 0;
    const b = fade(this.bubble, bubbleTo); this.bubble.visible = b > 0.01; this.bubble.material.uniforms.uShield.value = b * 1.1; this.bubble.material.uniforms.uTime.value = t * 0.35;
    const o = fade(this.oxygen, oxyTo); this.oxygen.visible = o > 0.01; this.oxygen.material.uniforms.uLevel.value = o; this.oxygen.material.uniforms.uTime.value = t;
    if (!act) { this.rings.forEach((r) => { r.material.opacity = 0; }); return; }
    const p = k(act.progress), a = ANCHORS[act.zone];
    // color: real emergencies stay red; a drill recovers red → amber → green with the steps
    if (act.drill) { if (p < 0.5) this.actColor.setRGB(1, 0.23 + 0.5 * (p / 0.5), 0.3 - 0.06 * (p / 0.5)); else this.actColor.setRGB(1 - 0.76 * ((p - 0.5) / 0.5), 0.73 + 0.13 * ((p - 0.5) / 0.5), 0.24 + 0.35 * ((p - 0.5) / 0.5)); }
    else this.actColor.setHex(LEVEL_COLOR[2]);
    const light = this.glows[act.zone];
    let pulse, ringScale;                        // pulse 0–1 drives the glow; rings expand from the zone
    if (act.breath || act.type === "oxygen") {   // slow breathing: in 4 s, out 6 s
      const c = ((t - this.actAt) % BREATH_CYCLE + BREATH_CYCLE) % BREATH_CYCLE;
      pulse = c < INHALE ? c / INHALE : 1 - (c - INHALE) / (BREATH_CYCLE - INHALE);
      pulse = pulse * pulse * (3 - 2 * pulse);
      this.rings.forEach((r, i) => { r.position.set(act.type === "oxygen" ? 0 : a[0], a[1], a[2] + 0.12); r.scale.setScalar(0.34 + 0.42 * pulse + i * 0.07); r.material.opacity = (0.5 - i * 0.16) * (0.4 + 0.6 * pulse); r.material.color.copy(this.actColor); });
    } else if (act.type === "heart") {           // heartbeat: fast at first, calmer as the drill advances
      const bpm = act.drill ? 122 - 56 * p : 118, ph = ((t - this.actAt) * bpm / 60) % 1;
      pulse = Math.max(Math.exp(-ph * 9), 0.75 * Math.exp(-Math.abs(ph - 0.28) * 14));
      this.rings.forEach((r, i) => { const q = (ph + i * 0.33) % 1; r.position.set(a[0], a[1], a[2] + 0.12); r.scale.setScalar(0.16 + q * 0.75); r.material.opacity = (1 - q) * 0.85; r.material.color.copy(this.actColor); });
    } else {                                     // fever and other zones: warm waves rising slowly
      const ph = ((t - this.actAt) * 0.45) % 1; pulse = 0.55 + 0.45 * Math.sin(t * 2.4);
      this.rings.forEach((r, i) => { const q = (ph + i * 0.33) % 1; r.position.set(a[0], a[1], a[2] + 0.12); r.scale.setScalar(0.2 + q * 0.6); r.material.opacity = act.type === "temp" ? 0 : (1 - q) * 0.7; r.material.color.copy(this.actColor); });
    }
    if (light) { light.color.copy(this.actColor); light.intensity = 1.2 + 2.2 * pulse; }
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    if (document.hidden || !this.stage.offsetParent) { this.last = 0; return; }   // Today is not on screen: do not draw
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0; this.last = now;
    this.t += dt;
    const t = this.t, k = this.reduced ? 0.15 : 1;
    // weightless drift: the body turns a little on every axis and bobs; calmer while a zone is in focus
    this.sway += ((this.focus || this.act ? 0.25 : 1) - this.sway) * Math.min(1, dt * 3);
    const s = this.sway * k;
    this.float.rotation.set(Math.sin(t * 0.23) * 0.07 * s, Math.sin(t * 0.31) * 0.5 * s, Math.sin(t * 0.19) * 0.07 * s);
    this.float.position.set(Math.sin(t * 0.17) * 0.05 * s, Math.sin(t * 0.43) * 0.09 * s, 0);
    // glow on affected zones: yellow breathes, red beats
    for (const [id, light] of Object.entries(this.glows)) {
      const lvl = this.levels[id];
      if (lvl === 1 || lvl === 2) {
        light.color.setHex(LEVEL_COLOR[lvl]);
        const beat = lvl === 2 ? 0.55 + 0.45 * Math.pow(Math.sin(t * 5.6) * 0.5 + 0.5, 2) : 0.6 + 0.4 * (Math.sin(t * 2.3) * 0.5 + 0.5);
        light.intensity = (lvl === 2 ? 2.6 : 1.3) * beat * (id === "rad" ? 0 : 1);
      } else light.intensity = 0;
    }
    // (an active emergency guide takes over the glow of its zone: see drawAct)
    // radiation storm: the suit itself glows orange-red while it is exposed; the shield takes the hits when it is up
    const st = this.storm, to = this.stormTo, e2 = Math.min(1, dt * 1.6);
    st.level += (to.level - st.level) * e2; st.shield += (to.shield - st.shield) * e2;
    const exposed = st.level * (1 - 0.92 * st.shield), flick = 0.5 + 0.5 * Math.sin(t * 17.0) * Math.sin(t * 7.3);
    // fever drill or emergency: the whole suit runs warm, and cools as the steps are done
    const fever = this.act && this.act.type === "temp" ? (this.act.drill ? 1 - this.act.progress : 1) * (0.2 + 0.07 * Math.sin(t * 2.4)) : 0;
    for (const m of this.suitMats) { m.emissive.setRGB(1.0, 0.27, 0.05); m.emissiveIntensity = Math.max(exposed * (0.2 + 0.2 * flick), fever); }
    this.stormLight.intensity = exposed * (1.6 + 0.8 * flick);
    for (const o of [this.streaks, this.shield]) { o.material.uniforms.uTime.value = t; o.material.uniforms.uShield.value = st.shield; }
    this.streaks.material.uniforms.uLevel.value = st.level; this.streaks.visible = st.level > 0.01; this.shield.visible = st.shield > 0.01;
    this.drawAct(t, dt);
    // scan ring: head to feet in 1.9 s
    const sp = this.scanAt < 0 ? 2 : (t - this.scanAt) / 1.9;
    if (sp >= 0 && sp <= 1) {
      const e = sp < 0.5 ? 2 * sp * sp : 1 - Math.pow(-2 * sp + 2, 2) / 2, y = 1.75 - e * 3.5;
      this.ring.position.y = y; this.ring.scale.setScalar(0.72 + 0.28 * Math.sin(Math.PI * sp));
      this.ring.material.opacity = Math.sin(Math.PI * sp); this.ringLight.position.set(0, y, 1.2); this.ringLight.intensity = 9 * Math.sin(Math.PI * sp);
    } else { this.ring.material.opacity = 0; this.ringLight.intensity = 0; }
    // camera: whole body, or close on the chosen zone
    this.float.updateMatrixWorld(true);
    const camZone = this.act ? this.act.zone : this.focus ? this.selected : null;
    if (camZone) {
      const a = ANCHORS[camZone];
      this.lookTo.set(a[0], a[1], a[2]).applyMatrix4(this.float.matrixWorld); this.lookTo.z = 0;
      const whole = camZone === "rad" || (this.act && this.act.type === "temp"); // fever shows the whole body inside its isolation bubble
      const dist = whole ? DIST : this.act ? 5.6 : camZone === "bones" ? 5.4 : 4.3;
      this.camTo.set(this.lookTo.x * 0.9, this.lookTo.y * 0.95, dist);
      if (whole) { this.lookTo.set(0, 0, 0); this.camTo.set(0, 0, DIST); }
    } else { this.lookTo.set(0, 0, 0); this.camTo.set(0, 0, DIST); }
    const ease = Math.min(1, dt * 3.2);
    this.camera.position.lerp(this.camTo, ease); this.target.lerp(this.lookTo, ease);
    this.camera.lookAt(this.target);
    if (this.act) for (const r of this.rings) r.quaternion.copy(this.camera.quaternion).premultiply(this.pins.getWorldQuaternion(new THREE.Quaternion()).invert());
    this.renderer.render(this.scene, this.camera);
    // where each zone is on screen right now
    const v = new THREE.Vector3();
    for (const [id, p] of Object.entries(ANCHORS)) {
      v.set(p[0], p[1], p[2]).applyMatrix4(this.float.matrixWorld).project(this.camera);
      this.points[id] = { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
    }
    if (this.onFrame) this.onFrame(this.points);
  }
}
