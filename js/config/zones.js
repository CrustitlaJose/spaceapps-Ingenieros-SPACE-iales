// AstroVital · body zones: NASA hazards, NASA risks, explanation and actions per level (0 green, 1 yellow, 2 red).
// Source: NASA Human Research Program (hazards and risks pages), CSA infographic, NASA HRP ongoing research.

export const HAZARDS = {
  rad:{es:"Radiación espacial",en:"Space radiation"},
  iso:{es:"Aislamiento y confinamiento",en:"Isolation and confinement"},
  dist:{es:"Distancia a la Tierra",en:"Distance from Earth"},
  grav:{es:"Campos gravitatorios",en:"Gravity fields"},
  env:{es:"Entornos hostiles/cerrados",en:"Hostile/closed environments"}
};

export const ZONES = [
  {id:"mind", n:{es:"Mente y sueño",en:"Mind & sleep"}, hz:["iso","dist"], inds:["sleep","mood"],
   risks:{es:["Cambios de conducta y trastornos psiquiátricos","Sueño insuficiente y horarios irregulares"],en:["Behavioral conditions and psychiatric disorders","Sleep loss and circadian misalignment"]},
   why:{es:"El encierro, el aislamiento y la distancia a la Tierra afectan el ánimo y el sueño. Dormir poco varios días seguidos baja la concentración en tareas críticas.",en:"Confinement, isolation and distance from Earth affect mood and sleep. Several short nights in a row reduce focus on critical tasks."},
   act:[{es:["Mantén tu horario de sueño fijo.","Haz tu check-in mañana a la misma hora."],en:["Keep a fixed sleep schedule.","Do tomorrow's check-in at the same time."]},
        {es:["Apaga pantallas 30 min antes de dormir y usa la iluminación de noche del módulo.","Pasa 10 min en el huerto a bordo: cuidar plantas reduce la sensación de encierro (estudio de jardinería espacial).","Agenda una llamada privada con tu familia."],en:["Turn off screens 30 min before sleep and use the module's night lighting.","Spend 10 min at the on-board garden: tending plants eases the feeling of confinement (space gardening study).","Schedule a private call with family."]},
        {es:["Habla hoy con el oficial médico de la tripulación.","Solicita una sesión privada con el equipo de apoyo psicológico en la Tierra.","Reduce tareas críticas hasta recuperar el sueño."],en:["Talk to the Crew Medical Officer today.","Request a private session with the behavioral-health team on Earth.","Reduce critical tasks until sleep recovers."]}]},
  {id:"brain", n:{es:"Cerebro y ojos",en:"Brain & eyes"}, hz:["grav"], inds:[],
   risks:{es:["Síndrome neuro-ocular asociado al vuelo espacial (SANS)","Alteración de la función sensoriomotora"],en:["Spaceflight Associated Neuro-ocular Syndrome (SANS)","Altered sensorimotor function"]},
   why:{es:"Sin gravedad, los líquidos del cuerpo suben a la cabeza y pueden cambiar la forma del ojo. Además, el oído interno se confunde y aparecen mareos.",en:"Without gravity, body fluids shift toward the head and can change the shape of the eye. The inner ear also gets confused, causing dizziness."},
   act:[{es:["Sin síntomas. Continúa tus revisiones de visión programadas."],en:["No symptoms. Keep your scheduled vision checks."]},
        {es:["Haz la prueba de visión de cerca y lejos y anota el resultado.","Evita movimientos bruscos de cabeza durante una hora.","Si la visión borrosa sigue mañana, pide un ultrasonido ocular guiado."],en:["Run the near/far vision test and log the result.","Avoid sudden head movements for an hour.","If blurred vision continues tomorrow, request a guided eye ultrasound."]},
        {es:["Detén tareas que exijan visión fina o pilotaje.","Avisa al oficial médico y envía el reporte a los cirujanos de vuelo.","Repite la prueba de visión en 1 hora."],en:["Stop tasks that need fine vision or piloting.","Notify the Crew Medical Officer and send the report to flight surgeons.","Repeat the vision test in 1 hour."]}]},
  {id:"heart", n:{es:"Corazón",en:"Heart"}, hz:["grav"], inds:["sys","dia","hr"],
   risks:{es:["Adaptaciones cardiovasculares"],en:["Cardiovascular adaptations"]},
   why:{es:"La ingravidez cambia la circulación y el trabajo del corazón. Con el tiempo, los vasos sanguíneos se endurecen y envejecen más rápido.",en:"Weightlessness changes circulation and how the heart works. Over time, blood vessels stiffen and age faster."},
   act:[{es:["Sigue con tu ejercicio aeróbico diario."],en:["Keep up your daily aerobic exercise."]},
        {es:["Repite la medición sentado y en calma en 10 minutos.","Revisa tu hidratación y el sodio de tus comidas.","Mantén al menos 30 min de ejercicio aeróbico hoy."],en:["Repeat the reading seated and calm in 10 minutes.","Check hydration and the sodium in your meals.","Do at least 30 min of aerobic exercise today."]},
        {es:["Detén la actividad física y siéntate.","Repite la medición en 5 minutos.","Si hay dolor de pecho o falta de aire, activa el protocolo médico de emergencia con el oficial médico."],en:["Stop physical activity and sit down.","Repeat the reading in 5 minutes.","If there is chest pain or shortness of breath, start the emergency medical protocol with the Crew Medical Officer."]}]},
  {id:"lungs", n:{es:"Pulmones",en:"Lungs"}, hz:["env"], inds:["spo2"],
   risks:{es:["Hipoxia"],en:["Hypoxia"]},
   why:{es:"En futuras misiones la cabina podría tener menos presión para facilitar las caminatas espaciales, y eso aumenta el riesgo de hipoxia leve: poco oxígeno en los tejidos.",en:"Future cabins may use lower pressure to make spacewalks easier, which raises the risk of mild hypoxia: low oxygen in body tissues."},
   act:[{es:["Oxigenación normal."],en:["Normal oxygenation."]},
        {es:["Respira lento y profundo 2 minutos y vuelve a medir.","Revisa la lectura de oxígeno y CO₂ del módulo."],en:["Breathe slowly and deeply for 2 minutes and measure again.","Check the module's oxygen and CO₂ readings."]},
        {es:["Suspende cualquier caminata espacial.","Pide a la tripulación revisar el soporte vital del módulo.","Usa oxígeno suplementario según el protocolo y avisa a la Tierra."],en:["Cancel any spacewalk.","Ask the crew to check the module's life support.","Use supplemental oxygen per protocol and notify Earth."]}]},
  {id:"blood", n:{es:"Sangre y metabolismo",en:"Blood & metabolism"}, hz:["grav","env"], inds:["glu"],
   risks:{es:["Alimentación y nutrición insuficientes"],en:["Inadequate food and nutrition"]},
   why:{es:"En el espacio el cuerpo puede volverse resistente a la insulina, lo que puede llevar a diabetes tipo 2 (Agencia Espacial Canadiense). Por eso la NASA pide vigilar la glucosa.",en:"In space the body can become insulin resistant, which can lead to type 2 diabetes (Canadian Space Agency). That is why NASA asks to monitor glucose."},
   act:[{es:["Glucosa en rango. Termina tus raciones completas."],en:["Glucose in range. Finish your full rations."]},
        {es:["Mide en ayunas mañana para confirmar.","Prefiere raciones con fibra y menos azúcar.","Agrega 20 min de ejercicio de resistencia."],en:["Measure fasting tomorrow to confirm.","Choose rations with fiber and less sugar.","Add 20 min of resistance exercise."]},
        {es:["Si es baja (< 54): come 15 g de carbohidrato rápido y mide en 15 min.","Si es alta (≥ 126): bebe agua, evita azúcar y mide de nuevo en 2 h.","Envía el reporte a los cirujanos de vuelo."],en:["If low (< 54): eat 15 g of fast carbs and measure in 15 min.","If high (≥ 126): drink water, avoid sugar and measure again in 2 h.","Send the report to flight surgeons."]}]},
  {id:"bones", n:{es:"Huesos y músculos",en:"Bones & muscles"}, hz:["grav"], inds:["ex"],
   risks:{es:["Cambios óseos inducidos por el vuelo espacial","Reducción de la condición cardiorrespiratoria y musculoesquelética"],en:["Spaceflight-induced bone changes","Reduced aerobic capacity, muscle mass and strength"]},
   why:{es:"Sin peso, los huesos pueden perder hasta 1.5% de su masa al mes (en la Tierra, un adulto mayor pierde ~1% al año). El ejercicio diario es la principal defensa.",en:"Without weight, bones can lose up to 1.5% of their mass per month (on Earth, an older adult loses ~1% per year). Daily exercise is the main defense."},
   act:[{es:["Buen trabajo: mantén tu rutina de resistencia y cardio."],en:["Good work: keep your resistance and cardio routine."]},
        {es:["Completa hoy 90 minutos de ejercicio: 60 de resistencia y 30 de cardio.","Incluye sentadillas y peso muerto en el equipo de resistencia."],en:["Complete 90 minutes of exercise today: 60 resistance and 30 cardio.","Include squats and deadlifts on the resistance device."]},
        {es:["Llevas varios días casi sin ejercicio: tu riesgo de pérdida ósea está alto.","Reprograma tu día para incluir el ejercicio de resistencia.","Avisa al oficial médico para ajustar tu plan."],en:["Several days with almost no exercise: bone-loss risk is high.","Rearrange your day to include resistance exercise.","Tell the Crew Medical Officer so your plan can be adjusted."]}]},
  {id:"immune", n:{es:"Defensas",en:"Immune system"}, hz:["env"], inds:["temp"],
   risks:{es:["Alteraciones en las respuestas del sistema inmune","Interacciones huésped-microorganismo"],en:["Altered immune response","Host-microorganism interactions"]},
   why:{es:"El estrés del vuelo puede despertar virus dormidos y causar erupciones. Además, en una nave cerrada los microbios circulan más fácil.",en:"Flight stress can reactivate dormant viruses and cause rashes. In a closed spacecraft, microbes also spread more easily."},
   act:[{es:["Sin fiebre. Mantén la higiene de manos y superficies."],en:["No fever. Keep up hand and surface hygiene."]},
        {es:["Descansa e hidrátate.","Mide tu temperatura otra vez en 4 horas.","Si tienes erupción, toma una foto para el registro y no la rasques."],en:["Rest and hydrate.","Measure your temperature again in 4 hours.","If you have a rash, photograph it for the record and avoid scratching."]},
        {es:["Aíslate en tu módulo personal y usa cubrebocas.","Avisa al oficial médico.","Envía el reporte a la Tierra con la foto de la erupción, si la hay."],en:["Isolate in your crew quarters and wear a mask.","Notify the Crew Medical Officer.","Send the report to Earth with the rash photo, if any."]}]},
  {id:"rad", n:{es:"Radiación",en:"Radiation"}, hz:["rad"], inds:[],
   risks:{es:["Cáncer inducido por radiación"],en:["Radiation-induced cancer"]},
   why:{es:"La radiación es invisible y uno de los peligros más serios: daña el ADN, puede causar cataratas y aumenta el riesgo de cáncer. La NASA limita la dosis de toda la carrera a 600 mSv.",en:"Radiation is invisible and one of the most serious hazards: it damages DNA, can cause cataracts and raises cancer risk. NASA limits career dose to 600 mSv."},
   act:[{es:["Dosis dentro de lo esperado para esta misión."],en:["Dose within what is expected for this mission."]},
        {es:["Pasa más tiempo de descanso en la zona más blindada de la nave.","Revisa con la tripulación el plan de actividades fuera de la nave."],en:["Spend more rest time in the most shielded area of the spacecraft.","Review planned activities outside the spacecraft with the crew."]},
        {es:["Tormenta solar detectada: ve al refugio de radiación ahora.","Suspende cualquier caminata espacial.","Quédate en el refugio hasta que el monitor indique niveles normales."],en:["Solar storm detected: go to the radiation shelter now.","Cancel any spacewalk.","Stay in the shelter until the monitor shows normal levels."]}]}
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** When several zones share the worst level, the first in this list is handled first. */
export const PRIORITY = ["rad", "heart", "lungs", "brain", "immune", "blood", "bones", "mind"];
