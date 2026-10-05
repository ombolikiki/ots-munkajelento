// Közös környezet a felületi modulok számára: az app.js tölti fel (store, felületi állapot, újrarajzolás).
import { todayYMD } from "../dates.js";

export const ui = {
  mode: "timer", day: todayYMD(), settings: false, modal: null,
  msg: null, msgErr: false, update: false,
  manual: { mode: "range", from: "", to: "", hours: 1, minutes: 0, message: null },
  pomoSettings: false, confirmDelete: null, confirmReset: 0,
  calWeek: null, pending: null,
  att: { key: "", rows: {}, message: null },
  ots: { y: 0, m: 0, copied: null },
  skill: null, colorOpen: null, newPlace: "", newCongregation: "", newCategory: "", newCategoryUnit: "hours", catEdit: null,
  catOpen: false, resetOpen: false, hex: "",
  cal: { calendars: [], busy: false, error: null, needsLogin: {}, lastAuto: 0, resolve: null, helpOpen: false },
};

export const ctx = { store: null, S: null, render: () => {}, say: () => {}, now: () => Date.now() };
