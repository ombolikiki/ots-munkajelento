// Tevékenység-típusok: az OTS Havi munkajelentő mezőazonosítói (ne változtasd).

export const UNIT = { HOURS: "ora", OCCASIONS: "alkalom", PEOPLE: "fo", WHOLE_DAY: "egesz_nap" };
export const CUSTOM_PREFIX = "EGYEDI_";

const t = (code, group, shortLabel, label, unit) => ({ code, group, shortLabel, label: label || shortLabel, unit });

export const BUILTIN_TYPES = [
  t("PREACHING", "Gyülekezet", "Istentisztelet", null, UNIT.OCCASIONS),
  t("VISITING", "Gyülekezet", "Látogatás", "Látogatás (gyülekezet)", UNIT.PEOPLE),
  t("OFFICE_WORK", "Gyülekezet", "Ügyintézés", null, UNIT.HOURS),
  t("MEETING", "Gyülekezet", "Értekezlet", null, UNIT.HOURS),
  t("EVANGELISATION", "Misszió", "Evangelizáció", null, UNIT.OCCASIONS),
  t("BIBLE_HOUR", "Misszió", "Bibliaóra", null, UNIT.OCCASIONS),
  t("MISSION_VISITING", "Misszió", "Látogatás", "Látogatás (misszió)", UNIT.PEOPLE),
  t("TRAINING", "Továbbképzés", "Résztvevő", "Továbbképzés – résztvevő", UNIT.HOURS),
  t("HELD_TRAINING", "Továbbképzés", "Tartott", "Továbbképzés – tartott", UNIT.HOURS),
  t("ADMINISTRATION", "Hivatal", "Adminisztráció", null, UNIT.HOURS),
  t("PREPARING", "Hivatal", "Felkészülés", null, UNIT.HOURS),
  t("TRAVEL", "Egyéb", "Utazás", null, UNIT.HOURS),
  t("HOLIDAY", "Nem munkaidő", "Szabadság", null, UNIT.WHOLE_DAY),
  t("DAY_OFF", "Nem munkaidő", "Szabadnap", null, UNIT.WHOLE_DAY),
  t("PUBLIC_HOLIDAY", "Nem munkaidő", "Munkaszüneti nap", null, UNIT.WHOLE_DAY),
];

export const isCustomCode = (code) => String(code ?? "").toUpperCase().startsWith(CUSTOM_PREFIX);
export const isTravel = (type) => !!type && type.code === "TRAVEL";
export const isWholeDay = (type) => !!type && type.unit === UNIT.WHOLE_DAY;
export const hasQuantity = (type) => !!type && (type.unit === UNIT.OCCASIONS || type.unit === UNIT.PEOPLE);
export const quantityUnit = (type) => (type && type.unit === UNIT.PEOPLE ? "fő" : "alkalom");

// ---------- A felhasználó saját kategóriái, elrejtett típusok, színek (a natív app ActivityType/CategoryColors megfelelője) ----------

const registry = { custom: [], hidden: new Set(), colors: {} };
const CUSTOM_UNITS = { hours: UNIT.HOURS, occasions: UNIT.OCCASIONS, people: UNIT.PEOPLE };

/** Beállítja a saját kategóriákat ([{code, label, unit: "hours"|"occasions"|"people"}]), az elrejtett kódokat és a színfelülírásokat. */
export function configureTypes({ custom = [], hidden = [], colors = {} } = {}) {
  registry.custom = (Array.isArray(custom) ? custom : [])
    .filter((c) => c && typeof c.code === "string" && typeof c.label === "string" && c.code && c.label)
    .map((c) => ({
      code: c.code.toUpperCase(), group: "Egyéni", shortLabel: c.label, label: c.label,
      unit: CUSTOM_UNITS[c.unit] || UNIT.HOURS, custom: true,
    }));
  registry.hidden = new Set(Array.isArray(hidden) ? hidden : []);
  registry.colors = colors && typeof colors === "object" && !Array.isArray(colors) ? { ...colors } : {};
}

/** A legördülő menüben megjelenő kategóriák: a nem elrejtett beépítettek és a saját kategóriák. */
export const allTypes = () => [...BUILTIN_TYPES.filter((t) => !registry.hidden.has(t.code)), ...registry.custom];
export const isHidden = (code) => registry.hidden.has(code);

export function lookupByCode(code) {
  const c = String(code ?? "").trim().toUpperCase();
  return BUILTIN_TYPES.find((x) => x.code === c) || registry.custom.find((x) => x.code === c) || null;
}

export function lookupByLabel(label) {
  const l = String(label ?? "").trim().toLowerCase();
  if (!l) return null;
  return [...BUILTIN_TYPES, ...registry.custom].find((x) => x.label.toLowerCase() === l || x.shortLabel.toLowerCase() === l) || null;
}

/** Ismeretlen (pl. már törölt saját) kategória: az adat nem veszhet el, ezért egyéni típusként kezeljük. */
export function customType(name, code, unit) {
  const label = String(name || code || "").trim();
  return {
    code: String(code || CUSTOM_PREFIX + label.toUpperCase()).toUpperCase(),
    group: "Egyéni", shortLabel: label, label,
    unit: Object.values(UNIT).includes(unit) && unit !== UNIT.WHOLE_DAY ? unit : UNIT.HOURS,
    custom: true,
  };
}

/** Új saját kategória kódja: `EGYEDI_` + ékezet nélküli nagybetűs név; ütközésnél `_2`, `_3`… */
export function makeCustomCode(name, existingCodes = []) {
  const slug = String(name ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "_");
  const taken = new Set([...existingCodes, ...BUILTIN_TYPES.map((t) => t.code)].map((c) => String(c).toUpperCase()));
  let code = CUSTOM_PREFIX + slug, n = 2;
  while (taken.has(code)) code = `${CUSTOM_PREFIX}${slug}_${n++}`;
  return code;
}

// ---------- Színek ----------

export const GROUP_COLORS = {
  "Gyülekezet": "#3373CC",
  "Misszió": "#2E9E6B",
  "Továbbképzés": "#8C61C7",
  "Hivatal": "#E08533",
  "Nem munkaidő": "#CC5980",
  "Egyéni": "#26949E",
  "Egyéb": "#73808F",
};

/** A kategória alapszíne a csoportja szerint (ismeretlen kódra a szürke „Egyéb”). */
export function defaultColor(code) {
  const t = lookupByCode(code);
  return GROUP_COLORS[t?.group] || GROUP_COLORS["Egyéb"];
}

export const HEX_RE = /^#?[0-9a-fA-F]{6}$/;
export const normalizeHex = (s) => (HEX_RE.test(String(s ?? "").trim()) ? "#" + String(s).trim().replace("#", "").toUpperCase() : null);

/** A kategória színe kód alapján: felülírás, különben az alapszín. */
export function colorFor(code) {
  const o = normalizeHex(registry.colors[code]);
  return o || defaultColor(code);
}
export const isCustomized = (code) => !!normalizeHex(registry.colors[code]);

/** A 16 színminta a színválasztóhoz. */
export const SWATCHES = [
  "#3373CC", "#2E9E6B", "#8C61C7", "#E08533", "#CC5980", "#26949E", "#73808F", "#D94545",
  "#E0B422", "#6BA43A", "#1F8FBF", "#5B5FC7", "#B5547A", "#8A6D3B", "#3D4A5C", "#9AA3B2",
];

export const typeColor = (type) => (type ? colorFor(type.code) : colorFor(""));

/** Egy bejegyzés típusa a mentett kód alapján (ismeretlenre egyéni típus). */
export function typeOfEntry(e) {
  return lookupByCode(e.type) || customType(e.typeLabel, e.type, e.unit);
}

export function groupedTypes() {
  const out = [];
  for (const ty of allTypes()) {
    let g = out.find((x) => x.name === ty.group);
    if (!g) out.push((g = { name: ty.group, types: [] }));
    g.types.push(ty);
  }
  return out;
}
