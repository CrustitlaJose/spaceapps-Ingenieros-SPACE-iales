// AstroVital · DelayModel (Model layer): how long a message takes to reach Earth, per mission.
// ISS: relayed by satellites, well under a second. Moon: 384,400 km / speed of light = 1.28 s.
// Mars: real light time for today's Earth–Mars distance (JPL orbital elements, see Ephemeris.js).
// In the demo, Mars minutes are played as seconds (1 real minute = 1 demo second) so a round trip can be shown.
import { marsDistanceAU, marsLightSeconds, AU_KM } from "./Ephemeris.js";

const round1 = (v) => Math.round(v * 10) / 10;

/** Returns { seconds (real, one way), demoMs, text, demoText, detail } for the mission and date. */
export function linkDelay(mission, date = new Date()) {
  if (mission === "iss") return { seconds: 0.5, demoMs: 500, text: "< 1 s", demoText: "< 1 s", detail: null };
  if (mission === "moon") return { seconds: 1.28, demoMs: 1300, text: "1.3 s", demoText: "1.3 s", detail: null };
  const au = marsDistanceAU(date), seconds = marsLightSeconds(date), min = seconds / 60;
  return {
    seconds, demoMs: Math.round(min * 1000),
    text: `${round1(min)} min`, demoText: `${round1(min)} s`,
    detail: { au: Math.round(au * 1000) / 1000, millionKm: Math.round((au * AU_KM) / 1e6), minutes: round1(min) },
  };
}
