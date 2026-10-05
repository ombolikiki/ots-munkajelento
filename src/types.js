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

export const GROUP_COLORS = {
  "Gyülekezet": "#3373CC",
  "Misszió": "#2E9E6B",
  "Továbbképzés": "#8C61C7",
  "Hivatal": "#E08533",
  "Nem munkaidő": "#CC5980",
  "Egyéni": "#26949E",
  "Egyéb": "#73808F",
};

export const isCustomCode = (code) => String(code ?? "").toUpperCase().startsWith(CUSTOM_PREFIX);
export const isTravel = (type) => !!type && type.code === "TRAVEL";
export const isWholeDay = (type) => !!type && type.unit === UNIT.WHOLE_DAY;
export const hasQuantity = (type) => !!type && (type.unit === UNIT.OCCASIONS || type.unit === UNIT.PEOPLE);
export const quantityUnit = (type) => (type && type.unit === UNIT.PEOPLE ? "fő" : "alkalom");

export function lookupByCode(code) {
  const c = String(code ?? "").trim().toUpperCase();
  return BUILTIN_TYPES.find((x) => x.code === c) || null;
}

export function lookupByLabel(label) {
  const l = String(label ?? "").trim().toLowerCase();
  if (!l) return null;
  return BUILTIN_TYPES.find((x) => x.label.toLowerCase() === l || x.shortLabel.toLowerCase() === l) || null;
}

/** Ismeretlen (pl. a Mac-alkalmazás saját) kategória: az adat nem veszhet el, ezért egyéni típusként kezeljük. */
export function customType(name, code, unit) {
  const label = String(name || code || "").trim();
  return {
    code: String(code || CUSTOM_PREFIX + label.toUpperCase()).toUpperCase(),
    group: "Egyéni", shortLabel: label, label,
    unit: Object.values(UNIT).includes(unit) && unit !== UNIT.WHOLE_DAY ? unit : UNIT.HOURS,
    custom: true,
  };
}

export const typeColor = (type) => (type ? GROUP_COLORS[type.group] || GROUP_COLORS["Egyéb"] : GROUP_COLORS["Egyéb"]);

/** Egy bejegyzés típusa a mentett kód alapján (ismeretlenre egyéni típus). */
export function typeOfEntry(e) {
  return lookupByCode(e.type) || customType(e.typeLabel, e.type, e.unit);
}

export function groupedTypes() {
  const out = [];
  for (const ty of BUILTIN_TYPES) {
    let g = out.find((x) => x.name === ty.group);
    if (!g) out.push((g = { name: ty.group, types: [] }));
    g.types.push(ty);
  }
  return out;
}
