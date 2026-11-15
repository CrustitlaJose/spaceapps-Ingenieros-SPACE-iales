// AstroVital · CrewView (View layer): crew list and astronaut form.
import { t, tr, L } from "../../config/i18n.js";
import { ROLES, PROFILE_LIMITS } from "../../config/crew.js";
import { CrewModel } from "../../models/CrewModel.js";
import { esc } from "../../utils/format.js";

const $ = (id) => document.getElementById(id);

/** counts: { crewId: number of check-ins } · confirmId: astronaut waiting for delete confirmation */
export function renderCrewList(list, activeId, counts, confirmId) {
  $("crewList").innerHTML = list.map((c) => {
    const bmi = CrewModel.bmi(c);
    const facts = [c.age ? `${c.age} ${t("years")}` : null, c.weight ? `${c.weight} kg` : null, c.height ? `${c.height} cm` : null, bmi ? `${t("bmi")} ${bmi.toFixed(1)}` : null].filter(Boolean).join(" · ");
    const isActive = c._id === activeId;
    const actions = confirmId === c._id
      ? `<button type="button" class="btn small" data-crew-confirm="${c._id}" style="border-color:var(--bad);color:var(--bad)">${esc(t("confirmRemove"))}</button>
         <button type="button" class="btn small" data-crew-cancel="1">${esc(t("cancel"))}</button>`
      : `${isActive ? `<span class="pill" data-l="0">${esc(t("active"))}</span>` : `<button type="button" class="btn small primary" data-crew-select="${c._id}">${esc(t("makeActive"))}</button>`}
         <button type="button" class="btn small" data-crew-edit="${c._id}">${esc(t("edit"))}</button>
         <button type="button" class="btn small" data-crew-remove="${c._id}">${esc(t("remove"))}</button>`;
    return `<li class="msg" data-new="${isActive}">
      <div class="mh"><strong>${esc(c._id)} · ${esc(c.name)}</strong><span class="note">${esc(tr(ROLES[c.role || "ms"].n))}</span></div>
      <div class="note">${esc(facts || "–")} · ${counts[c._id] || 0} ${esc(t("checkinsLbl"))}</div>
      ${c.notes ? `<div class="mb">${esc(c.notes)}</div>` : ""}
      <div class="row">${actions}</div></li>`;
  }).join("");
}

/** Fills the form for a new astronaut (profile = null) or to edit one. */
export function openCrewForm(profile) {
  $("crewForm").hidden = false;
  $("crewFormTitle").textContent = profile ? `${t("editCrew")} · ${profile._id}` : t("newCrew");
  $("crew-id").value = profile ? profile._id : "";
  $("crew-name").value = profile ? profile.name : "";
  $("crew-role").innerHTML = Object.entries(ROLES).map(([k, r]) => `<option value="${k}"${(profile ? profile.role : "ms") === k ? " selected" : ""}>${esc(tr(r.n))}</option>`).join("");
  $("crew-age").value = profile && profile.age ? profile.age : "";
  $("crew-weight").value = profile && profile.weight ? profile.weight : "";
  $("crew-height").value = profile && profile.height ? profile.height : "";
  $("crew-notes").value = profile && profile.notes ? profile.notes : "";
  $("crewErr").textContent = "";
  ["age", "weight", "height"].forEach((k) => { const el = $("crew-" + k); el.min = PROFILE_LIMITS[k][0]; el.max = PROFILE_LIMITS[k][1]; });
  $("crew-name").focus();
}

export function closeCrewForm() { $("crewForm").hidden = true; }

export function readCrewForm() {
  const num = (id) => { const v = $(id).value; return v === "" ? null : parseFloat(v); };
  return {
    _id: $("crew-id").value || undefined,
    name: $("crew-name").value,
    role: $("crew-role").value,
    age: num("crew-age"), weight: num("crew-weight"), height: num("crew-height"),
    notes: $("crew-notes").value.trim(),
  };
}

export function setCrewError(msg) { $("crewErr").textContent = msg; }

export function renderCrewSelect(list, activeId) {
  $("crewSel").innerHTML = (list.length ? "" : `<option value="">${esc(L("Sin astronautas", "No astronauts"))}</option>`) + list.map((c) => `<option value="${esc(c._id)}"${c._id === activeId ? " selected" : ""}>${esc(c._id)} · ${esc(c.name)}</option>`).join("");
  $("crewSel").setAttribute("aria-label", L("Astronauta activo", "Active astronaut"));
}
