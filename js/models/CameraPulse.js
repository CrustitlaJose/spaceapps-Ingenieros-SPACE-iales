// AstroVital · CameraPulse (Model layer, sensor): reads the webcam and measures the pulse with POS.
// Uses the average color of a skin region (forehead and cheeks, inside the on-screen oval).
// The video never leaves the computer: only three numbers per frame (R, G, B averages) are kept.

import { estimateHeartRate, lightLevel } from "./RppgPOS.js";

export class CameraPulse {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 48; this.canvas.height = 48;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.running = false;
  }

  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

  async open() {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  /** Mean RGB of the skin region: central box covering forehead and cheeks. */
  sample() {
    const v = this.video, w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return null;
    const sx = w * 0.36, sy = h * 0.22, sw = w * 0.28, sh = h * 0.36;
    this.ctx.drawImage(v, sx, sy, sw, sh, 0, 0, 48, 48);
    const d = this.ctx.getImageData(0, 0, 48, 48).data;
    let r = 0, g = 0, b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return { t: performance.now() / 1000, r: r / n, g: g / n, b: b / n };
  }

  /** Measures for `seconds`, calling onProgress({ elapsed, light, live }) about once per second. */
  measure(seconds, onProgress) {
    this.running = true;
    const samples = [];
    let lastReport = 0;
    return new Promise((resolve) => {
      let token = 0;
      const schedule = () => {
        // Next video frame; a timer backs it up in case the browser pauses frame callbacks.
        const my = ++token;
        const go = () => { if (my === token) step(); };
        if (this.video.requestVideoFrameCallback) this.video.requestVideoFrameCallback(go);
        else requestAnimationFrame(go);
        setTimeout(go, 100);
      };
      const step = () => {
        token++;
        if (!this.running) { resolve(null); return; }
        const s = this.sample();
        if (s) samples.push(s);
        const elapsed = samples.length ? samples[samples.length - 1].t - samples[0].t : 0;
        if (elapsed - lastReport >= 1) {
          lastReport = elapsed;
          const last = samples[samples.length - 1];
          const live = elapsed >= 10 ? estimateHeartRate(samples.slice(-Math.round(12 * 30))) : null;
          onProgress({ elapsed, light: lightLevel(last.r, last.g, last.b), live });
        }
        if (elapsed >= seconds) { this.running = false; resolve(estimateHeartRate(samples)); return; }
        schedule();
      };
      step();
    });
  }

  cancel() { this.running = false; }

  close() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((tr) => tr.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
