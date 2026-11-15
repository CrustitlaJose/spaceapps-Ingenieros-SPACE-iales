// AstroVital · LinkModel (Model layer).
// Simulated DTN link (Delay/Disruption Tolerant Networking): store-and-forward between the spacecraft and Earth.
// Both apps share the on-board database (same origin); BroadcastChannel notifies the other tab instantly.
// A message is "inTransit" until now >= deliverAt and the link is up; with no signal it waits "queued".

import { linkDelay } from "./DelayModel.js";

const CHANNEL = "astrovital-link";
const UP_KEY = "astrovital-link-up";
const MISSION_KEY = "astrovital-mission";

export function getMission() {
  try { return localStorage.getItem(MISSION_KEY) || "mars"; } catch (e) { return "mars"; }
}
export function setMission(m) {
  try { localStorage.setItem(MISSION_KEY, m); } catch (e) {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event("astrovital:mission")); // the space background follows the mission
}

export class LinkModel {
  /** side: "ship" | "earth" */
  constructor(db, side) {
    this.db = db;
    this.side = side;
    this.listeners = [];
    this.channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    if (this.channel) this.channel.onmessage = () => this._emit();
    window.addEventListener("storage", (e) => { if (e.key === UP_KEY || e.key === MISSION_KEY) this._emit(); });
  }

  get outgoing() { return this.side === "ship" ? "toEarth" : "toShip"; }
  get incoming() { return this.side === "ship" ? "toShip" : "toEarth"; }

  isUp() {
    try { return localStorage.getItem(UP_KEY) !== "false"; } catch (e) { return true; }
  }

  /** Demo delay for the current mission. Mars uses today's real Earth–Mars light time (1 min = 1 s in the demo). */
  delayMs() { return linkDelay(getMission()).demoMs; }

  onChange(fn) { this.listeners.push(fn); }
  _emit() { this.listeners.forEach((fn) => fn()); }
  _notify() { if (this.channel) this.channel.postMessage({ at: Date.now() }); this._emit(); }

  async send({ type, crewId, body, payload }) {
    const now = Date.now(), up = this.isUp(), delay = this.delayMs();
    const msg = {
      _id: `${this.side}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      direction: this.outgoing,
      type, crewId, body, payload: payload || null,
      mission: getMission(),
      sentAt: new Date(now).toISOString(),
      delayMs: delay, realDelayS: linkDelay(getMission()).seconds,
      deliverAt: up ? now + delay : null,
      status: up ? "inTransit" : "queued",
    };
    await this.db.put("messages", msg);
    this._notify();
    return msg;
  }

  async setUp(up) {
    try { localStorage.setItem(UP_KEY, String(up)); } catch (e) {}
    if (up) {
      const now = Date.now();
      const queued = (await this.db.all("messages")).filter((m) => m.status === "queued");
      for (const m of queued) { m.status = "inTransit"; m.deliverAt = now + m.delayMs; await this.db.put("messages", m); }
    }
    this._notify();
  }

  /** Delivers every message whose delay has passed. Called on a timer by the controllers. Returns true if anything changed. */
  async tick() {
    if (!this.isUp()) return false;
    const now = Date.now();
    const due = (await this.db.all("messages")).filter((m) => m.status === "inTransit" && m.deliverAt <= now);
    for (const m of due) { m.status = "delivered"; m.deliveredAt = new Date(now).toISOString(); await this.db.put("messages", m); }
    if (due.length) this._notify();
    return due.length > 0;
  }

  async list(direction) {
    const all = await this.db.all("messages");
    return all.filter((m) => m.direction === direction).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }
  sent() { return this.list(this.outgoing); }
  async received() { return (await this.list(this.incoming)).filter((m) => m.status === "delivered" || m.status === "read"); }
  async inbound() { return this.list(this.incoming); }

  async markRead(id) {
    const m = await this.db.get("messages", id);
    if (m && m.status === "delivered") { m.status = "read"; await this.db.put("messages", m); this._notify(); }
  }

  async clearAll() { await this.db.clear("messages"); this._notify(); }
}
