# AstroVital: Astronaut Health Monitoring

**Team:** Ingenieros SPACE-iales · TecNM Zacatepec, Morelos, Mexico
**Challenge:** NASA Space Apps Challenge 2026: *Create Health Monitoring Software for Astronauts on Space Missions*

## The problem
On long missions, astronauts face NASA's five hazards of human spaceflight: space radiation, isolation and confinement, distance from Earth, altered gravity and hostile/closed environments. Far from Earth (a message to Mars takes 4–24 minutes each way), crews must detect and act on health changes by themselves.

## Our solution
AstroVital is a two-app, offline-first system:

- **Ship app (`index.html`)** for the astronaut's tablet: a one-minute daily check-in, an interactive body map with 8 zones in green / yellow / red, early warnings from 7–14 day trends, a 3-level action protocol (self-manage → notify the Crew Medical Officer → contact flight surgeons), radiation tracking, health missions with points and badges, and a flight-surgeon report.
- **Earth Control app (`tierra.html`)** for flight surgeons: receives reports with the real delay of each destination and sends instructions back.
- **Simulated DTN link:** messages are stored on board and forwarded when there is signal (store-and-forward, like NASA's Delay/Disruption Tolerant Networking). Delay per leg: ISS < 1 s, Moon ≈ 1.3 s, Mars 12 min (shown as 12 s in the demo). Signal loss can be simulated: messages wait in a queue and are delivered when the signal returns.
- **On-board database:** IndexedDB, with documents in the same JSON shape a MongoDB server would use.

Available in English and Spanish.

## Architecture (MVC)
```
AstroVital/
├── index.html            Ship app
├── tierra.html           Earth Control app
├── css/                  base.css · components.css · screens.css
└── js/
    ├── config/           science data, editable without touching code
    │   ├── ranges.js       green / yellow / red ranges and trend thresholds
    │   ├── zones.js        8 body zones, NASA hazards and risks, actions
    │   ├── missions.js     ISS, Moon, Mars: radiation, gravity, delay
    │   └── i18n.js         Spanish / English texts
    ├── models/           data and rules (never touch the screen)
    │   ├── Database.js         IndexedDB with MongoDB-style documents
    │   ├── CheckinModel.js     daily check-ins
    │   ├── HealthEvaluator.js  traffic light and trend detection
    │   ├── RadiationModel.js   daily, cumulative and projected dose
    │   ├── GamificationModel.js missions, points, badges
    │   ├── SensorSimulator.js  simulated wearable (ARCHeR-style)
    │   ├── LinkModel.js        simulated DTN link: queue, delay, signal loss
    │   └── ReportBuilder.js    flight-surgeon report
    ├── views/            what is drawn (never touch the database)
    │   ├── nave/   ShellView, BodyMapView, CheckinView, TrendsView, MissionsView, ReportView, ScienceView
    │   └── tierra/ InboxView, ReplyView
    ├── controllers/      connect user actions with models and views
    │   ├── ShipController.js
    │   └── EarthController.js
    ├── utils/            charts.js (SVG), format.js
    ├── nave.js           Ship app entry point
    └── tierra.js         Earth app entry point
```
Rules: views never access the database, models never access the screen, controllers connect both.

## How to run
- **Online:** open the GitHub Pages link of this repository.
- **On your computer:** the apps use JavaScript modules, so they need a local server (double-clicking `index.html` will not work). With VS Code, install *Live Server* and choose "Open with Live Server", or run `python -m http.server` in this folder and open `http://localhost:8000`.

## Demo (2 tabs)
1. Open `index.html` (Ship) and `tierra.html` (Earth Control) in two tabs of the same browser.
2. In Ship, choose **Mars mission** and the scenario **Emergency + solar storm**: the status turns red and shows what to do first.
3. Press **Send to Earth**: the report travels with a 12 s countdown and arrives at Earth Control.
4. In Earth Control, pick a quick reply and press **Send to spacecraft**: it arrives at the ship after the same delay.
5. Press **Simulate signal loss**, send again: the report waits in the queue until the signal is restored.

Scenarios: *Stable mission* (all green), *Hidden trend* (values look normal but the app detects slow changes), *Emergency + solar storm* (red).

## Data and assumptions
- Sensor data is **simulated**, the way an ARCHeR-style wearable (Artemis II) would provide it.
- Ranges come from general adult clinical guidelines (American Heart Association, American Diabetes Association).
- Radiation: ~0.5 mSv/day ISS (approx.), 1.37 mSv/day lunar surface (Chang'e 4), 1.84 mSv/day Mars cruise (Curiosity RAD); NASA career limit 600 mSv.
- Bone loss uses an illustrative model based on "up to 1.5% of bone mass per month" (Canadian Space Agency).
- This is a hackathon prototype, **not a medical device**.

## Future work (v3)
A spacecraft server with Node.js + MongoDB so the Crew Medical Officer sees the whole crew, real wearable sensors, camera input, and machine-learning trend detection trained on NASA open data.

## References
- NASA HRP, 5 Hazards of Human Spaceflight: https://www.nasa.gov/hrp/hazards/
- NASA HRP, Human Spaceflight Risks: https://www.nasa.gov/hrp/risks/
- NASA HRP, Ongoing HRP Research (ARCHeR, Standard Measures, Tempus Pro, Veggie): https://www.nasa.gov/hrp/ongoing-hrp-research/
- Canadian Space Agency, Monitoring radiation for astronaut health: https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- Canadian Space Agency, How does space affect the human body?
- American Heart Association, Blood pressure categories
- American Diabetes Association, Diagnosis

## Built with
HTML, CSS and JavaScript modules (no frameworks, no server). AI tools were used to assist in development.
