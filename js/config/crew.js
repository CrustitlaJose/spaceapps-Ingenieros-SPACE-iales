// AstroVital · crew roles. The app starts with no astronauts: the crew registers itself.
export const ROLES = {
  cdr: { code: "CDR", n: { es: "Comandante", en: "Commander" } },
  cmo: { code: "CMO", n: { es: "Oficial médico", en: "Crew Medical Officer" } },
  ms: { code: "MS", n: { es: "Especialista de misión", en: "Mission specialist" } },
  fe: { code: "FE", n: { es: "Ingeniero de vuelo", en: "Flight engineer" } },
};

/** Valid ranges for the profile form. */
export const PROFILE_LIMITS = { age: [18, 80], weight: [35, 150], height: [140, 210] };
