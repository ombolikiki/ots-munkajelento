// Javaslatok gépelés közben (a natív app SuggestTextField megfelelője): tiszta függvények, tesztelhetők.
import { fold, isStreetLike, parsePlaces } from "./calendarParser.js";

export const MAX_SUGGESTIONS = 5;
export const MAX_ACTIVITIES = 300;

/**
 * A szövegre illeszkedő jelöltek, legfeljebb `limit` darab. Kisbetű- és ékezetfüggetlen. Sorrend: 1. a jelölt ezzel kezdődik, 2. valamelyik nem
 * első szava ezzel kezdődik, 3. bárhol benne van. A pontosan egyező és az ismétlődő jelöltet kihagyja; üres szövegre nincs javaslat.
 */
export function matches(query, candidates, limit = MAX_SUGGESTIONS) {
  const q = fold(query);
  if (!q) return [];
  const seen = new Set(), ranked = [[], [], []];
  for (const c of candidates) {
    const f = fold(c);
    if (!f || f === q || seen.has(f)) continue;
    seen.add(f);
    if (f.startsWith(q)) ranked[0].push(c);
    else if (f.split(" ").slice(1).some((w) => w.startsWith(q))) ranked[1].push(c);
    else if (f.includes(q)) ranked[2].push(c);
  }
  return ranked.flat().slice(0, limit);
}

/** Listás mező (Cél): az utolsó elválasztó („,”, „;” vagy „ - ”) utáni, éppen írt rész; prefix: ami előtte áll (az elválasztóval és a szóközzel). */
export function listToken(text) {
  const s = String(text ?? "");
  let cut = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "," || s[i] === ";") cut = i + 1;
    else if (s.startsWith(" - ", i)) cut = i + 3;
  }
  const rest = s.slice(cut);
  const lead = rest.length - rest.trimStart().length;
  return { prefix: s.slice(0, cut + lead), token: rest.trimStart() };
}

/** Javaslatok egy listás mezőhöz (Cél): nincs javaslat, ha az éppen írt rész címnek látszik; a már beírt helyeket nem javasolja újra. */
export function listSuggestions(text, places, limit = MAX_SUGGESTIONS) {
  const { prefix, token } = listToken(text);
  if (!token.trim() || isStreetLike(token)) return { prefix, items: [] };
  const used = new Set((parsePlaces(prefix.replace(/[\s,;-]+$/, "")) || []).map((p) => fold(p.settlement)));
  return { prefix, items: matches(token, places.filter((p) => !used.has(fold(p))), limit) };
}

/** Elfogadáskor az éppen írt rész cserélődik le („Tata, Mó” + „Mór” = „Tata, Mór”). */
export const applySuggestion = (prefix, item) => prefix + item;

/**
 * A Tevékenység (szöveg) jelöltjei: a korábban rögzített, különböző tevékenységek, a legutóbbiak elöl, az éppen kiválasztott típusúak előbb;
 * legfeljebb MAX_ACTIVITIES különböző érték. `entries` időrendben (a legrégebbi elöl).
 */
export function activityCandidates(entries, typeCode) {
  const first = [], rest = [], seen = new Set();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i], a = String(e.activity ?? "").trim();
    if (!a) continue;
    const k = fold(a);
    if (seen.has(k)) continue;
    seen.add(k);
    (typeCode && e.type === typeCode ? first : rest).push(a);
    if (seen.size >= MAX_ACTIVITIES) break;
  }
  return [...first, ...rest];
}
