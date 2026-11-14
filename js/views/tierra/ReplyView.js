// AstroVital · ReplyView (View layer, Earth Control): quick replies, composer and instructions sent.
import { t, tr, L } from "../../config/i18n.js";
import { esc, clock } from "../../utils/format.js";
import { statusChip } from "../nave/ReportView.js";

const $ = (id) => document.getElementById(id);

export const QUICK = [
  { es: "Recibido. Sigue el protocolo que indica la app y repite la medición en 1 hora.", en: "Received. Follow the protocol the app shows and repeat the reading in 1 hour." },
  { es: "Descansa sentado, hidrátate y repite la presión en 10 minutos. Si pasa de 160/100, avísanos.", en: "Rest seated, hydrate and repeat blood pressure in 10 minutes. If it goes above 160/100, tell us." },
  { es: "Ve al refugio de radiación y quédate ahí hasta nuevo aviso.", en: "Go to the radiation shelter and stay there until further notice." },
  { es: "Agendamos una consulta privada con el equipo de apoyo psicológico.", en: "We scheduled a private session with the behavioral-health team." },
];

export function renderQuick() {
  $("quick").innerHTML = QUICK.map((q, i) => `<button type="button" data-quick="${i}">${esc(tr(q).split(".")[0])}</button>`).join("");
  $("replyText").placeholder = t("replyPh");
}

export function setReply(text) { $("replyText").value = text; $("replyText").focus(); }
export function readReply() { return $("replyText").value.trim(); }
export function clearReply() { $("replyText").value = ""; }
export function setReplyError(msg) { $("replyErr").textContent = msg; }

export function renderSent(sent, now) {
  $("sentToShip").innerHTML = sent.length ? sent.map((m) => `<li class="msg">
      <div class="mh"><strong>${esc(L("Para", "To"))} ${esc(m.crewId)}</strong><span class="note">${clock(m.sentAt)}</span></div>
      <div class="mb">${esc(m.body)}</div><div>${statusChip(m, now)}</div></li>`).join("")
    : `<li class="empty">${esc(t("noMsgs"))}</li>`;
}
