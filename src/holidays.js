// A magyar munkaszüneti napok (kiszámolhatók: a rögzített napok és a húsvétból számolt mozgó ünnepek). A rendelettel változó pihenőnapok és
// áthelyezett munkanapok nincsenek benne (a dec. 24. sem): azokat a felhasználó a Pihenőnap (vagy Ünnepnap) típussal jelöli.
import { ymd, addDays, parseYMD } from "./dates.js";

/** A húsvétvasárnap hónapja és napja a Gergely-naptár szerint (névtelen / Meeus–Jones–Butcher algoritmus). */
export function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Az év munkaszüneti napjai időrendben, hivatalos nevekkel: [{date: "ÉÉÉÉ-HH-NN", name}]. Érvénytelen évre üres lista. */
export function holidays(year) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return [];
  const list = [];
  const add = (m, d, name) => list.push({ date: ymd(year, m, d), name });
  add(1, 1, "Újév");
  add(3, 15, "Március 15. (nemzeti ünnep)");
  const e = easterSunday(year), easter = ymd(year, e.month, e.day);
  list.push({ date: addDays(easter, -2), name: "Nagypéntek" });
  list.push({ date: easter, name: "Húsvétvasárnap" });
  list.push({ date: addDays(easter, 1), name: "Húsvéthétfő" });
  list.push({ date: addDays(easter, 49), name: "Pünkösdvasárnap" });
  list.push({ date: addDays(easter, 50), name: "Pünkösdhétfő" });
  add(5, 1, "Május 1. (a munka ünnepe)");
  add(8, 20, "Augusztus 20. (az államalapítás ünnepe)");
  add(10, 23, "Október 23. (nemzeti ünnep)");
  add(11, 1, "Mindenszentek");
  add(12, 25, "Karácsony");
  add(12, 26, "Karácsony másnapja");
  return list.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/** Az adott nap ünnepének neve (null, ha nem munkaszüneti nap). */
export function holidayName(day) {
  const p = parseYMD(day);
  if (!p) return null;
  return holidays(p.y).find((h) => h.date === day)?.name ?? null;
}
