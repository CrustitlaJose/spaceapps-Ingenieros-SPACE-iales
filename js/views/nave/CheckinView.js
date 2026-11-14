// AstroVital · CheckinView (View layer): daily check-in form.
import { t, tr } from "../../config/i18n.js";
import { FIELDS, SYMPTOMS, INDICATORS } from "../../config/ranges.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);
const FACES = ["😫", "😟", "😐", "🙂", "😄"];

export function renderCheckinChoices(mood) {
  $("moods").innerHTML = FACES.map((f, i) => `<button type="button" data-mood="${i + 1}" aria-pressed="${mood === i + 1}" aria-label="${i + 1}/5">${f}</button>`).join("");
  const prev = {};
  document.querySelectorAll("#syms input").forEach((i) => { prev[i.value] = i.checked; });
  $("syms").innerHTML = Object.entries(SYMPTOMS).map(([k, v]) =>
    `<label><input type="checkbox" id="sym-${k}" value="${k}"${prev[k] ? " checked" : ""}> ${esc(tr(v))}</label>`).join("");
}

export function setMood(mood) {
  document.querySelectorAll("#moods button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.mood === mood)));
}

export function fillReading(values) {
  FIELDS.forEach((k) => { if (values[k] != null) $("f-" + k).value = values[k]; });
}

/** Reads and validates the form. Returns { ok, rec } or { ok:false, error, field }. */
export function readForm(mood) {
  const rec = { sym: {}, solar: false, src: "user" };
  for (const k of FIELDS) {
    const el = $("f-" + k), v = parseFloat(el.value);
    if (el.value === "" || Number.isNaN(v)) return { ok: false, error: t("missing"), field: el };
    if (v < parseFloat(el.min) || v > parseFloat(el.max)) return { ok: false, error: t("outOfRange") + tr(INDICATORS[k].n), field: el };
    rec[k] = v;
  }
  if (!mood) return { ok: false, error: t("missing") };
  rec.mood = mood;
  document.querySelectorAll("#syms input").forEach((i) => { if (i.checked) rec.sym[i.value] = true; });
  return { ok: true, rec };
}

export function resetForm() {
  FIELDS.forEach((k) => { $("f-" + k).value = ""; });
  document.querySelectorAll("#syms input").forEach((i) => { i.checked = false; });
  setError("");
}

export function setError(msg, field) {
  $("ciErr").textContent = msg;
  if (field) field.focus();
}
