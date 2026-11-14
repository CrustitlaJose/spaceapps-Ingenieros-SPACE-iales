// AstroVital · formatting helpers.
import { INDICATORS } from "../config/ranges.js";
import { tr } from "../config/i18n.js";

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fmt = (k, v) => (v == null ? "–" : Number(v).toFixed(INDICATORS[k].dec));
export const unit = (k) => tr(INDICATORS[k].u);
export const sgn = (v) => (v > 0 ? "+" : "") + v.toFixed(1);
export const COLORS = ["var(--ok)", "var(--warn)", "var(--bad)"];
export const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
export const secs = (ms) => `${Math.max(0, ms / 1000).toFixed(1)} s`;
