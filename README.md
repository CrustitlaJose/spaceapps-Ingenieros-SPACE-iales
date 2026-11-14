# AstroVital: Astronaut Health Monitoring

**Team:** Ingenieros SPACE-iales · TecNM Zacatepec, Morelos, Mexico
**Challenge:** NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts on Space Missions*

## The problem
On long missions, astronauts face NASA's five hazards of human spaceflight: space radiation, isolation and confinement, distance from Earth, altered gravity and hostile/closed environments. Far from Earth (a message to Mars takes 4–24 minutes each way), crews must detect health changes themselves.

## Our solution
AstroVital is an offline-first web app for a crew tablet or laptop. Every day the astronaut completes a one-minute check-in, and the app:

1. **Collects health indicators**: blood pressure, heart rate, blood glucose, body temperature, blood oxygen, sleep, mood, exercise, symptoms and radiation dose.
2. **Shows them on an interactive body map** with 8 zones (mind & sleep, brain & eyes, heart, lungs, blood & metabolism, bones & muscles, immune system, radiation) colored green / yellow / red.
3. **Detects slow trends** (7–14 day slopes and averages), warning the crew *before* a value leaves its normal range.
4. **Tells the astronaut what to do** with a 3-level protocol: self-manage → notify the Crew Medical Officer → contact flight surgeons, plus autonomy steps that depend on the communication delay (ISS, Moon or Mars).
5. **Generates a flight-surgeon report** ready to send to Earth.
6. **Motivates healthy habits** with daily health missions, points, streaks and badges.
7. **Explains the science** behind each zone, linked to the NASA HRP hazards and risks.

Available in English and Spanish.

## How to use
Open `index.html` in any browser (no installation or internet needed after loading).
- Change the **mission** (Space Station / Lunar base / Mars mission).
- Change the **demo scenario**: *Stable mission*, *Hidden trend* or *Emergency + solar storm*.
- Use **Daily check-in → Sync wearable (simulated)** to add a new day.

## Data and assumptions
- Sensor data is **simulated**, the way an ARCHeR-style wearable (Artemis II) would provide it.
- Green / yellow / red ranges come from general adult clinical guidelines (American Heart Association, American Diabetes Association).
- Radiation rates: ~0.5 mSv/day (ISS, approx.), 1.37 mSv/day (lunar surface, Chang'e 4), 1.84 mSv/day (Mars cruise, Curiosity RAD); NASA career limit 600 mSv.
- Bone loss uses an illustrative model based on "up to 1.5% of bone mass per month" (Canadian Space Agency).
- This is a hackathon prototype, **not a medical device**.

## Future work
Real wearable sensors, camera input (reading devices and photographing rashes), crew-wide dashboard for the medical officer, and machine-learning trend detection trained on NASA open data.

## References
- NASA HRP, 5 Hazards of Human Spaceflight: https://www.nasa.gov/hrp/hazards/
- NASA HRP, Human Spaceflight Risks: https://www.nasa.gov/hrp/risks/
- NASA HRP, Ongoing HRP Research (ARCHeR, Standard Measures, Tempus Pro, Veggie): https://www.nasa.gov/hrp/ongoing-hrp-research/
- Canadian Space Agency, Monitoring radiation for astronaut health: https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Canadian Space Agency, How does space affect the human body?
- American Heart Association, Blood pressure categories
- American Diabetes Association, Diagnosis

## Built with
HTML, CSS and JavaScript (no frameworks). AI tools were used to assist in development.
