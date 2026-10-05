// Nézet: telefonos (alsó fülsor, egy oszlop) vagy asztali (felső fülsor, két oszlop, Windowsra/nagy képernyőre).
export const LAYOUTS = ["auto", "mobile", "desktop"];
export const DESKTOP_MIN_WIDTH = 1000;

/** A beállítás és az ablak szélessége alapján a ténylegesen használt nézet. */
export function resolveLayout(setting, viewportWidth) {
  if (setting === "desktop" || setting === "mobile") return setting;
  return Number(viewportWidth) >= DESKTOP_MIN_WIDTH ? "desktop" : "mobile";
}

/** A fejléc gombja: a jelenlegi nézetről a másikra vált (kifejezett választás, nem „automatikus”). */
export const toggledLayout = (current) => (current === "desktop" ? "mobile" : "desktop");
export const normalizeLayout = (v) => (LAYOUTS.includes(v) ? v : "auto");
