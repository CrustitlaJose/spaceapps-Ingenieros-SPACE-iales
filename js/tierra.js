// AstroVital · Earth Control app entry point.
import { Database } from "./models/Database.js";
import { EarthController } from "./controllers/EarthController.js";

const db = await new Database().open();
await new EarthController(db).start();
