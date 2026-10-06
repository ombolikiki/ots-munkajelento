// Közös felületi segédek: szöveg-kiegyenesítés, bejegyzések megjelenítése.
import { UNIT } from "../types.js";
import { formatHM } from "../dates.js";
import { workplaceList } from "../entries.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);

export function entryAmount(e) {
  if (e.unit === UNIT.OCCASIONS) return `${e.quantity ?? 1} alkalom`;
  if (e.unit === UNIT.PEOPLE) return `${e.quantity ?? 1} fő`;
  if (e.unit === UNIT.WHOLE_DAY) return "";
  return formatHM(e.durationSeconds);
}

export function entryWhen(e) {
  if (e.unit === UNIT.WHOLE_DAY) return "egész nap";
  if (e.start && e.end) return `${e.start.slice(0, 5)}–${e.end.slice(0, 5)}`;
  return e.unit === UNIT.HOURS ? "óraszám" : "";
}

/** Második sor: utazásnál az útvonal (Indulás → Munkahely(ek) → Érkezés), egyébként munkahely · tevékenység. */
export function entryDetail(e) {
  if (e.departure || e.arrival) {
    const route = [e.departure, ...workplaceList(e.workplace), e.arrival].filter(Boolean)
      .filter((p, i, a) => !i || p.toLowerCase() !== a[i - 1].toLowerCase()).join(" → ");
    return [route, e.activity].filter(Boolean).join(" · ");
  }
  return [e.workplace, e.activity].filter(Boolean).join(" · ");
}

export const hm = (secs) => formatHM(secs);
export const pad2 = (n) => String(Math.trunc(n)).padStart(2, "0");
/** `<input type=time>` érték (óó:pp) az aktuális időből. */
export const timeValue = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
