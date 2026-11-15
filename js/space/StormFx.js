// AstroVital · StormFx: what a solar radiation storm looks like on screen.
// Streaks of fast particles (solar protons) crossing the scene, and a refuge "shield" that stops them.
// It is an illustration to make the storm protocol clear; the storm level itself always comes from NOAA data or a labeled drill.
import * as THREE from "three";

export const STORM_DIR = new THREE.Vector3(0.85, -0.42, 0.3).normalize(); // particles come from the sun (upper left) toward the viewer's right

/** Streaks crossing a box. Returns a LineSegments whose material has uniforms: uTime, uLevel (0–1), uShield (0–1), uCenter, uRadius. */
export function makeStreaks({ count = 400, box = [3, 3, 2], length = 0.5, speed = 5, span = 9, color = [1.0, 0.56, 0.2] } = {}) {
  const start = new Float32Array(count * 6), seed = new Float32Array(count * 2), end = new Float32Array(count * 2);
  let s = 77; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) {
    const p = [(rnd() * 2 - 1) * box[0], (rnd() * 2 - 1) * box[1], (rnd() * 2 - 1) * box[2]], sd = rnd();
    start.set(p, i * 6); start.set(p, i * 6 + 3);
    seed[i * 2] = sd; seed[i * 2 + 1] = sd; end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(start, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uShield: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uRadius: { value: 2.05 },
      uDir: { value: STORM_DIR.clone() }, uLen: { value: length }, uSpeed: { value: speed }, uSpan: { value: span }, uColor: { value: new THREE.Color(...color) } },
    vertexShader: `
      attribute float aSeed; attribute float aEnd;
      uniform float uTime, uLen, uSpeed, uSpan, uShield, uRadius; uniform vec3 uDir, uCenter;
      varying float vA;
      void main(){
        float travel = mod(uTime * uSpeed * (0.55 + aSeed * 0.9) + aSeed * uSpan * 7.0, uSpan) - uSpan * 0.5;
        vec3 p = position + uDir * travel - uDir * aEnd * uLen * (0.5 + aSeed);
        float edge = 1.0 - smoothstep(uSpan * 0.32, uSpan * 0.5, abs(travel));       // fade in and out at the ends of the path
        float inside = 1.0 - smoothstep(uRadius * 0.92, uRadius * 1.08, distance(p, uCenter));
        vA = (1.0 - aEnd) * edge * (1.0 - inside * uShield) * (0.35 + 0.65 * aSeed);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uLevel; varying float vA; void main(){ float a = vA * uLevel; gl_FragColor = vec4(uColor * a, a); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false; lines.renderOrder = 5;
  return lines;
}

/** The refuge: a faint dome that lights up where particles hit it. Uniforms: uTime, uShield. */
export function makeShield(radius = 2.05) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
    uniforms: { uTime: { value: 0 }, uShield: { value: 0 }, uDir: { value: STORM_DIR.clone() }, uTint: { value: new THREE.Vector3(0.25, 0.7, 1.0) } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uShield; uniform vec3 uDir; uniform vec3 uTint; varying vec3 vN; varying vec3 vP;
      void main(){
        float fres = pow(1.0 - abs(vN.z), 2.4);
        float hit = pow(max(0.0, dot(normalize(vP), -uDir)), 2.5);                       // the side facing the storm
        float ripple = 0.5 + 0.5 * sin(dot(vP, uDir) * 13.0 - uTime * 10.0);
        float a = uShield * (0.05 + fres * 1.25 + hit * (0.22 + 0.45 * ripple));
        vec3 col = mix(uTint, vec3(1.0, 0.95, 0.85), hit * ripple * 0.55);
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 72, 48), mat);
  m.renderOrder = 6;
  return m;
}
