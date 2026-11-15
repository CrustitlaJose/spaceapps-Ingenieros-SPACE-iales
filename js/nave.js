// AstroVital · Ship app entry point.
// Living space background (a real planet turning). Loaded apart so the app still works if WebGL is missing.
import("./space/SpaceBackdrop.js").then(async (m) => { const { getMission } = await import("./models/LinkModel.js"); m.startBackdrop(getMission); }).catch(() => {});

import { Database } from "./models/Database.js";
import { ShipController } from "./controllers/ShipController.js";

const db = await new Database().open();
await new ShipController(db).start();
