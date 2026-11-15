// AstroVital · SpaceBackdrop: the living background of both apps.
// A real planet turns slowly behind the interface: the Earth (seen from the Station, night side with city lights),
// the Moon or Mars, depending on the mission. Drawn with WebGL (three.js) from NASA imagery; see assets/space/CREDITS.md.
// If WebGL is not available the page keeps its plain star background.
import * as THREE from "three";
import { makeStreaks } from "./StormFx.js";

const TEX = "assets/space/";
const TURN_SECONDS = 300; // one full turn of the planet on screen
const FPS = 30;

/** Where the planet sits and how it is lit, per mission. Units: the screen is about 3.1 units tall at the planet's depth. */
const VIEWS = {
  iss:  { body: "earth", radius: 3.25, pos: [-1.5, -3.72, 0], sun: [-0.62, 0.6, -0.5], tilt: 0.41, turn: 1 },
  moon: { body: "moon",  radius: 1.45, pos: [-1.85, -0.85, 0], sun: [-0.55, 0.45, 0.7],  tilt: 0.03, turn: 0.45 },
  mars: { body: "mars",  radius: 1.5,  pos: [-1.85, -0.9, 0],  sun: [-0.6, 0.5, 0.62],   tilt: 0.44, turn: 0.8 },
};

const EARTH_VERT = `
  varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
  void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const EARTH_FRAG = `
  uniform sampler2D dayMap; uniform sampler2D lightsMap; uniform sampler2D cloudMap; uniform vec3 sunDir; uniform float cloudShift;
  varying vec2 vUv; varying vec3 vN; varying vec3 vPos;
  void main(){
    vec3 N = normalize(vN); float ndl = dot(N, normalize(sunDir));
    float day = smoothstep(-0.10, 0.30, ndl);
    float cl = texture2D(cloudMap, vec2(vUv.x + cloudShift, vUv.y)).r;
    vec3 dayC = mix(texture2D(dayMap, vUv).rgb, vec3(1.0), cl * 0.8);
    vec2 e = vec2(0.00035, 0.0007);   // soften the city lights: the map is coarser than the screen
    vec3 lights = (texture2D(lightsMap, vUv).rgb * 2.0 + texture2D(lightsMap, vUv + vec2(e.x, 0.0)).rgb + texture2D(lightsMap, vUv - vec2(e.x, 0.0)).rgb
      + texture2D(lightsMap, vUv + vec2(0.0, e.y)).rgb + texture2D(lightsMap, vUv - vec2(0.0, e.y)).rgb) / 6.0;
    vec3 nightC = lights * vec3(2.0, 1.3, 0.55) * 2.6 * (1.0 - cl * 0.5) + dayC * 0.012 + vec3(0.002, 0.005, 0.014);
    vec3 col = mix(nightC, dayC * (0.2 + 1.1 * max(ndl, 0.0)), day);
    vec3 V = normalize(cameraPosition - vPos); float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += vec3(0.22, 0.52, 1.0) * fr * (0.22 + 1.1 * smoothstep(-0.4, 0.5, ndl));               // blue air at the limb
    float tw = smoothstep(-0.14, 0.04, ndl) * (1.0 - smoothstep(0.04, 0.28, ndl));
    col += vec3(1.0, 0.38, 0.12) * tw * 0.16 * (1.0 - fr);                                         // warm band at dusk
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const HALO_VERT = `
  varying vec3 vN; varying vec3 vW;
  void main(){ vN = normalize(normalMatrix * normal); vW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAG = `
  uniform vec3 color; uniform vec3 sunDir; uniform float power; uniform float strength; uniform float edge; uniform float floorLit;
  varying vec3 vN; varying vec3 vW;
  void main(){
    // 1 at the planet's limb, fading to 0 at the outer edge of the air
    float rim = pow(clamp(-dot(vN, vec3(0.0, 0.0, 1.0)) / edge, 0.0, 1.0), power);
    float lit = floorLit + (1.0 - floorLit) * smoothstep(-0.5, 0.5, dot(vW, normalize(sunDir)));
    gl_FragColor = vec4(color * rim * lit * strength, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class SpaceBackdrop {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(19.6, 1, 0.1, 2000); // long lens: the planet stays round near the screen edge
    this.camera.position.set(0, 0, 9);
    this.loader = new THREE.TextureLoader();
    this.sun = new THREE.DirectionalLight(0xffffff, 3.4);
    this.scene.add(this.sun, new THREE.AmbientLight(0x0b1020, 0.35));
    this.bodies = {};
    this.mission = null;
    this.t = 0; this.last = 0; this.running = false;
    this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.addStars();
    // radiation storm across the whole background (only while the app says there is one)
    this.streaks = makeStreaks({ count: 900, box: [6.5, 3.6, 2.5], length: 0.8, speed: 7, span: 14, color: [1.0, 0.5, 0.18] });
    this.streaks.position.z = 4; this.streaks.material.uniforms.uRadius.value = 0; this.streaks.visible = false;
    this.scene.add(this.streaks);
    this.storm = 0; this.stormTo = 0;
    this.resize = this.resize.bind(this); this.frame = this.frame.bind(this);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this.last = 0; });
    this.resize();
  }

  tex(name, srgb = true) {
    const t = this.loader.load(TEX + name, () => this.renderOnce());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }

  /** Stars: a few thousand sharp points of different size, brightness and tint, on a far sphere that turns very slowly. */
  addStars() {
    const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    let seed = 20261115; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < n; i++) {
      const u = (rnd() * 2 - 1) * 0.42, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([r * Math.cos(a) * 800, u * 800, r * Math.sin(a) * 800], i * 3);
      const mag = Math.pow(rnd(), 4.0), b = 0.45 + 0.55 * mag, tint = rnd();
      col.set(tint < 0.2 ? [b, b * 0.86, b * 0.72] : tint > 0.75 ? [b * 0.8, b * 0.88, b] : [b, b, b], i * 3);
      size[i] = 1.5 + mag * 3.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { px: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float px;
        void main(){ vC = color; gl_PointSize = size * px; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d); gl_FragColor = vec4(vC * a, a); }` });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  build(body) {
    const g = new THREE.Group(), geo = new THREE.SphereGeometry(1, 128, 96);
    const spin = new THREE.Group(); g.add(spin);
    if (body === "earth") {
      const mat = new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
        uniforms: { dayMap: { value: this.tex("earth-day.jpg") }, lightsMap: { value: this.tex("earth-lights.jpg") }, cloudMap: { value: this.tex("earth-clouds.jpg", false) }, sunDir: { value: new THREE.Vector3() }, cloudShift: { value: 0 } } });
      spin.add(new THREE.Mesh(geo, mat)); g.userData.surface = mat;
      g.userData.halo = this.halo(g, 0x3f8dff, 1.075, 3.2, 0.85, 0.1);
    } else {
      const mat = new THREE.MeshStandardMaterial({ map: this.tex(body + ".jpg"), roughness: 1, metalness: 0 });
      if (body === "mars") { mat.color = new THREE.Color(1.12, 1.0, 0.92); g.userData.halo = this.halo(g, 0xff8a52, 1.045, 3.0, 0.28, 0); }
      spin.add(new THREE.Mesh(geo, mat));
    }
    g.userData.spin = spin; g.visible = false;
    this.scene.add(g);
    return g;
  }

  halo(group, color, scale, power, strength, floorLit = 0) {
    const mat = new THREE.ShaderMaterial({ vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      uniforms: { color: { value: new THREE.Color(color) }, sunDir: { value: new THREE.Vector3() }, power: { value: power }, strength: { value: strength }, edge: { value: Math.sqrt(1 - 1 / (scale * scale)) }, floorLit: { value: floorLit } } });
    const m = new THREE.Mesh(new THREE.SphereGeometry(scale, 96, 64), mat);
    group.add(m);
    return mat;
  }

  setMission(mission) {
    const v = VIEWS[mission] || VIEWS.mars;
    if (this.mission === mission) return;
    this.mission = mission; this.view = v;
    if (!this.bodies[v.body]) this.bodies[v.body] = this.build(v.body);
    Object.entries(this.bodies).forEach(([k, g]) => { g.visible = k === v.body; });
    const g = this.bodies[v.body];
    g.scale.setScalar(v.radius); g.rotation.z = v.tilt;
    const sun = new THREE.Vector3(...v.sun).normalize();
    this.sun.position.copy(sun).multiplyScalar(10);
    if (g.userData.surface) g.userData.surface.uniforms.sunDir.value.copy(sun);
    if (g.userData.halo) g.userData.halo.uniforms.sunDir.value.copy(sun);
    this.place();
    // short fade so the planet does not pop
    this.canvas.style.opacity = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => { this.canvas.style.opacity = "1"; }));
    this.renderOnce();
  }

  /** Keeps the planet in the lower-left of the screen on any window shape. */
  place() {
    if (!this.view) return;
    const g = this.bodies[this.view.body], aspect = this.camera.aspect, k = Math.min(1.25, Math.max(0.62, aspect / 1.78));
    g.position.set(this.view.pos[0] * k, this.view.pos[1], this.view.pos[2]);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.place(); this.renderOnce();
  }

  renderOnce() { if (this.view) this.renderer.render(this.scene, this.camera); }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (document.hidden) return;
    if (now - this.last < 1000 / FPS) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0; this.last = now;
    this.t += dt * (this.reduced ? 0.15 : 1);
    const g = this.view && this.bodies[this.view.body];
    if (g) {
      g.userData.spin.rotation.y = (this.t / TURN_SECONDS) * Math.PI * 2 * this.view.turn + 3.6;
      if (g.userData.surface) g.userData.surface.uniforms.cloudShift.value = this.t / 2400;
    }
    this.stars.rotation.y = this.t / 1500;
    this.storm += (this.stormTo - this.storm) * Math.min(1, dt * 1.6);
    this.streaks.visible = this.storm > 0.01;
    this.streaks.material.uniforms.uTime.value = this.t; this.streaks.material.uniforms.uLevel.value = this.storm * 0.75;
    this.camera.position.x = Math.sin(this.t / 19) * 0.045; this.camera.position.y = Math.cos(this.t / 23) * 0.03;
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  start() { if (!this.running) { this.running = true; requestAnimationFrame(this.frame); } }
}

/** Creates the fixed background canvas and keeps it in step with the mission. Returns null without WebGL. */
export function startBackdrop(getMission) {
  try {
    const canvas = document.createElement("canvas");
    canvas.id = "space"; canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const bd = new SpaceBackdrop(canvas);
    bd.setMission(getMission());
    bd.start();
    document.documentElement.classList.add("has-space");
    window.addEventListener("astrovital:mission", () => bd.setMission(getMission()));
    window.addEventListener("astrovital:storm", (e) => { bd.stormTo = e.detail ? e.detail.level : 0; });
    window.addEventListener("storage", () => bd.setMission(getMission()));
    return bd;
  } catch (e) {
    const c = document.getElementById("space"); if (c) c.remove();
    return null;
  }
}
