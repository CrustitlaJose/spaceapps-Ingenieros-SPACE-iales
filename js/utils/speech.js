// AstroVital · voice: reads text aloud with the browser's built-in speech (works offline on most systems).
import { getLang } from "../config/i18n.js";

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Reads a list of texts one after another. Calls onEnd when finished or stopped. */
export function speak(texts, onEnd) {
  if (!canSpeak()) { if (onEnd) onEnd(); return; }
  stopSpeaking();
  const lang = getLang() === "en" ? "en-US" : "es-MX";
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang && v.lang.startsWith(lang.slice(0, 2)));
  const list = Array.isArray(texts) ? texts : [texts];
  list.forEach((txt, i) => {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = lang; if (voice) u.voice = voice; u.rate = 0.95;
    if (i === list.length - 1 && onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() { if (canSpeak()) window.speechSynthesis.cancel(); }
