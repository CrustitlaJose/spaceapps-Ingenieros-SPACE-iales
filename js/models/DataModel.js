// AstroVital · DataModel (Model layer): backups and starting from zero.
// The on-board database lives in this browser only, so a backup file is how data moves to another computer.

const STORES = ["crew", "checkins", "messages", "events"];

/** Everything in the database as one JSON object. */
export async function exportAll(db) {
  const stores = {};
  for (const s of STORES) stores[s] = await db.all(s);
  return { app: "AstroVital", format: 2, exportedAt: new Date().toISOString(), stores };
}

/** Checks a backup before loading it. Returns an error text key or null. */
export function validateBackup(obj) {
  if (!obj || obj.app !== "AstroVital" || !obj.stores) return "backupInvalid";
  for (const s of STORES) {
    if (s === "events" && obj.stores[s] === undefined) continue; // older backups have no emergency log
    if (!Array.isArray(obj.stores[s])) return "backupInvalid";
    if (obj.stores[s].some((d) => !d || typeof d._id !== "string")) return "backupInvalid";
  }
  if (!obj.stores.crew.length) return "backupInvalid";
  return null;
}

/** Replaces the whole database with the backup. */
export async function importAll(db, obj) {
  for (const s of STORES) { await db.clear(s); await db.putMany(s, obj.stores[s] || []); }
}

/** Deletes everything: astronauts, check-ups, messages and the emergency log. */
export async function resetAll(db) {
  for (const s of STORES) await db.clear(s);
}

/** Counts used to describe what "start from zero" will delete. */
export async function counts(db) {
  return { crew: (await db.all("crew")).length, checkins: (await db.all("checkins")).length, messages: (await db.all("messages")).length };
}
