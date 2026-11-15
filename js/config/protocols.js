// AstroVital · emergency protocols: short steps the crew follows on their own while Earth answers.
// Educational protocols written by the team from: NASA Human Research Program (hazards and risks),
// NOAA's Solar Radiation Storm scale (S3+: hazard avoidance for astronauts) and NASA's Artemis storm-shelter procedure
// (the crew shelters in the most shielded area, surrounded by stowed supplies). They are not medical advice.
// Zones without their own protocol use that zone's red-level actions (config/zones.js).

export const PROTOCOLS = {
  storm: {
    zone: "rad", icon: "☢",
    name: { es: "Tormenta solar", en: "Solar storm" },
    goal: { es: "Proteger a la tripulación de la radiación.", en: "Protect the crew from radiation." },
    steps: [
      { es: "Suspende cualquier caminata espacial y entra a la nave.", en: "Cancel any spacewalk and get inside the spacecraft." },
      { es: "Ve al refugio de radiación: la zona con más blindaje, rodeada de agua, comida y equipo.", en: "Go to the radiation shelter: the most shielded area, surrounded by water, food and equipment." },
      { es: "Avisa a toda la tripulación y confirmen que todos están en el refugio.", en: "Alert the whole crew and confirm everyone is in the shelter." },
      { es: "Quédate en el refugio y revisa el monitor de radiación cada 30 minutos.", en: "Stay in the shelter and check the radiation monitor every 30 minutes." },
      { es: "Sal solo cuando el nivel baje de S1, menos de 10 protones, o cuando la Tierra lo confirme.", en: "Leave only when the level drops below S1, under 10 protons, or when Earth confirms it." },
    ],
  },
  heart: {
    zone: "heart", icon: "♥",
    name: { es: "Corazón o presión", en: "Heart or blood pressure" },
    goal: { es: "Bajar el esfuerzo del corazón y confirmar la medición.", en: "Lower the load on the heart and confirm the reading." },
    steps: [
      { es: "Detén toda actividad y siéntate.", en: "Stop all activity and sit down." },
      { es: "Avisa al oficial médico de la tripulación. No te quedes solo.", en: "Tell the crew medical officer. Do not stay alone." },
      { es: "Respira lento y profundo durante 5 minutos.", en: "Breathe slowly and deeply for 5 minutes.", breath: true },
      { es: "Repite la medición de presión y de pulso, sentado y en calma.", en: "Repeat the blood pressure and pulse readings, seated and calm." },
      { es: "Si hay dolor de pecho o falta de aire, el oficial médico inicia la atención de emergencia.", en: "If there is chest pain or shortness of breath, the medical officer starts emergency care." },
      { es: "Envía el reporte a los médicos en la Tierra.", en: "Send the report to the doctors on Earth." },
    ],
  },
  oxygen: {
    zone: "lungs", icon: "O₂",
    name: { es: "Oxígeno bajo", en: "Low oxygen" },
    goal: { es: "Recuperar la oxigenación y revisar el aire de la cabina.", en: "Recover oxygenation and check the cabin air." },
    steps: [
      { es: "Deja lo que estás haciendo y quédate quieto.", en: "Stop what you are doing and stay still." },
      { es: "Respira lento y profundo durante 2 minutos.", en: "Breathe slowly and deeply for 2 minutes.", breath: true },
      { es: "Vuelve a medir tu oxígeno.", en: "Measure your oxygen again." },
      { es: "Pide a un compañero revisar el oxígeno y el dióxido de carbono de la cabina.", en: "Ask a crewmate to check the cabin oxygen and carbon dioxide." },
      { es: "Si sigue abajo de 92 por ciento, usa oxígeno suplementario y avisa al oficial médico.", en: "If it stays below 92 percent, use supplemental oxygen and tell the medical officer." },
      { es: "Envía el reporte a los médicos en la Tierra.", en: "Send the report to the doctors on Earth." },
    ],
  },
  temp: {
    zone: "immune", icon: "°C",
    name: { es: "Fiebre o temperatura", en: "Fever or temperature" },
    goal: { es: "Cuidarte y no contagiar al resto de la tripulación.", en: "Take care of yourself and avoid infecting the crew." },
    steps: [
      { es: "Deja tus tareas, descansa y toma agua.", en: "Stop your tasks, rest and drink water." },
      { es: "Aíslate en tu módulo personal y usa cubrebocas.", en: "Isolate in your crew quarters and wear a mask." },
      { es: "Avisa al oficial médico.", en: "Tell the medical officer." },
      { es: "Vuelve a medir tu temperatura en una hora.", en: "Measure your temperature again in one hour." },
      { es: "Envía el reporte a los médicos en la Tierra.", en: "Send the report to the doctors on Earth." },
    ],
  },
};

/** Which protocol answers a red zone. */
export const PROTOCOL_BY_ZONE = { rad: "storm", heart: "heart", lungs: "oxygen", immune: "temp" };
