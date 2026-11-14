// AstroVital · SVG chart helpers (no external libraries, works offline).
import { INDICATORS } from "../config/ranges.js";
import { COLORS } from "./format.js";

export function sparkSvg(key, values) {
  const I = INDICATORS[key], W = 160, H = 38;
  const y = (v) => H - ((Math.min(I.hi, Math.max(I.lo, v)) - I.lo) / (I.hi - I.lo)) * H;
  const path = values.map((v, i) => (i ? "L" : "M") + ((i / (values.length - 1)) * W).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
  const top = Math.min(y(I.band[1]), H), h = Math.max(0, y(I.band[0]) - y(I.band[1]));
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <rect x="0" y="${top.toFixed(1)}" width="${W}" height="${h.toFixed(1)}" fill="rgba(62,207,142,.12)"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

/** Full chart of one indicator over all days: normal band, grid, area, points colored by level, last point emphasized. */
export function lineChartSvg(key, days, dayLabel = "D") {
  const I = INDICATORS[key], W = 760, H = 300, pl = 52, pr = 16, pt = 14, pb = 36;
  const n = days.length;
  const x = (i) => pl + (n > 1 ? i / (n - 1) : 0) * (W - pl - pr);
  const y = (v) => pt + (1 - (Math.min(I.hi, Math.max(I.lo, v)) - I.lo) / (I.hi - I.lo)) * (H - pt - pb);
  let g = "";
  for (let i = 0; i <= 5; i++) {
    const v = I.lo + ((I.hi - I.lo) * i) / 5, yy = y(v);
    g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-width="1"/>`;
    g += `<text x="${pl - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${I.dec ? v.toFixed(1) : Math.round(v)}</text>`;
  }
  days.forEach((d, i) => {
    if (i % 5 === 0 || i === n - 1) g += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${dayLabel}${d.day}</text>`;
  });
  const band = `<rect x="${pl}" y="${y(I.band[1])}" width="${W - pl - pr}" height="${y(I.band[0]) - y(I.band[1])}" fill="rgba(62,207,142,.10)"/>`;
  const line = days.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d[key]).toFixed(1)).join(" ");
  const area = line + ` L${x(n - 1).toFixed(1)} ${H - pb} L${pl} ${H - pb} Z`;
  const pts = days.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(d[key]).toFixed(1)}" r="${i === n - 1 ? 6 : 3.2}" fill="${COLORS[I.ev(d[key])]}" stroke="var(--panel)" stroke-width="${i === n - 1 ? 2.5 : 1}"/>`).join("");
  return `${band}${g}<path d="${area}" fill="rgba(79,193,192,.10)"/><path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>${pts}`;
}
