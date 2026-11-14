// AstroVital · Ship app entry point.
import { Database } from "./models/Database.js";
import { ShipController } from "./controllers/ShipController.js";

const db = await new Database().open();
await new ShipController(db).start();
