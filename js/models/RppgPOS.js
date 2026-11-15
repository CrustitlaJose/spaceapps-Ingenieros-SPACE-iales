// AstroVital · RppgPOS (Model layer): heart rate from the camera (remote photoplethysmography).
// Method: POS, "Plane Orthogonal to Skin" — Wang, den Brinker, Stuijk & de Haan,
// "Algorithmic Principles of Remote PPG", IEEE Trans. Biomed. Eng. 64(7):1479–1491, 2017.
// Input: average R, G, B of the skin region in each video frame, with its timestamp.
// Output: an ESTIMATE of beats per minute plus a signal-quality score (SNR). Not a medical reading.

export const FS = 30;            // resampling rate (Hz)
export const MIN_BPM = 42;       // 0.7 Hz
export const MAX_BPM = 180;      // 3.0 Hz

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length) || 1e-9; };

/** Linear resampling of irregular samples [{t (s), r, g, b}] to a uniform rate. */
export function resample(samples, fs = FS) {
  if (samples.length < 2) return { r: [], g: [], b: [] };
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  const n = Math.floor((t1 - t0) * fs);
  const out = { r: new Array(n), g: new Array(n), b: new Array(n) };
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = t0 + i / fs;
    while (j < samples.length - 2 && samples[j + 1].t < t) j++;
    const a = samples[j], c = samples[j + 1], w = c.t === a.t ? 0 : (t - a.t) / (c.t - a.t);
    out.r[i] = a.r + (c.r - a.r) * w;
    out.g[i] = a.g + (c.g - a.g) * w;
    out.b[i] = a.b + (c.b - a.b) * w;
  }
  return out;
}

/** POS pulse signal (overlap-add of 1.6 s windows). */
export function pos({ r, g, b }, fs = FS) {
  const N = r.length, L = Math.round(1.6 * fs);
  const H = new Array(N).fill(0);
  for (let n = L; n <= N; n++) {
    const s = n - L;
    const R = r.slice(s, n), G = g.slice(s, n), B = b.slice(s, n);
    const mr = mean(R), mg = mean(G), mb = mean(B);
    const s1 = [], s2 = [];
    for (let k = 0; k < L; k++) {
      const cr = R[k] / mr, cg = G[k] / mg, cb = B[k] / mb;
      s1.push(cg - cb);            // projection 1: G - B
      s2.push(cg + cb - 2 * cr);   // projection 2: G + B - 2R
    }
    const alpha = std(s1) / std(s2);
    const h = s1.map((v, k) => v + alpha * s2[k]);
    const mh = mean(h);
    for (let k = 0; k < L; k++) H[s + k] += h[k] - mh;
  }
  return H;
}

/** Removes slow drift (moving-average detrend, ~1 s). */
function detrend(x, fs) {
  const w = Math.max(3, Math.round(fs));
  return x.map((v, i) => {
    const a = Math.max(0, i - w), c = Math.min(x.length, i + w + 1);
    let s = 0; for (let k = a; k < c; k++) s += x[k];
    return v - s / (c - a);
  });
}

/** Power spectrum between 0.7 and 3.0 Hz (direct DFT, 0.01 Hz steps) with a Hann window. */
export function spectrum(x, fs = FS) {
  const N = x.length, win = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))));
  const freqs = [], power = [];
  for (let f = MIN_BPM / 60; f <= MAX_BPM / 60 + 1e-9; f += 0.01) {
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) { const ph = (2 * Math.PI * f * i) / fs; re += win[i] * Math.cos(ph); im -= win[i] * Math.sin(ph); }
    freqs.push(f); power.push(re * re + im * im);
  }
  return { freqs, power };
}

/**
 * Heart-rate estimate from raw samples [{t, r, g, b}].
 * Returns { bpm, snr (dB), quality: "good" | "fair" | "poor", seconds } or null if there is too little data.
 * SNR: power within ±0.1 Hz of the peak and its first harmonic vs. the rest of the band (de Haan & Jeanne, 2013).
 */
export function estimateHeartRate(samples, fs = FS) {
  const seconds = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  if (seconds < 8) return null;
  const rgb = resample(samples, fs);
  const h = detrend(pos(rgb, fs), fs);
  const { freqs, power } = spectrum(h, fs);
  let iMax = 0; power.forEach((p, i) => { if (p > power[iMax]) iMax = i; });
  const f0 = freqs[iMax];
  let sig = 0, noise = 0;
  freqs.forEach((f, i) => {
    if (Math.abs(f - f0) <= 0.1 || Math.abs(f - 2 * f0) <= 0.1) sig += power[i]; else noise += power[i];
  });
  const snr = 10 * Math.log10(sig / (noise || 1e-12));
  const quality = snr >= 2 ? "good" : snr >= -2 ? "fair" : "poor";
  return { bpm: Math.round(f0 * 60), snr: +snr.toFixed(1), quality, seconds: +seconds.toFixed(1) };
}

/** Brightness check of a frame's skin region (0–255): too dark makes the reading unreliable. */
export const lightLevel = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
