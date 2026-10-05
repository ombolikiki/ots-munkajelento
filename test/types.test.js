import test from "node:test";
import assert from "node:assert/strict";
import * as T from "../src/types.js";

test.afterEach(() => T.configureTypes({}));

test("saját kategóriák, elrejtés és keresés", () => {
  T.configureTypes({ custom: [{ code: "EGYEDI_ONKEPZES", label: "Önképzés", unit: "occasions" }, { code: "", label: "rossz" }, null], hidden: ["DAY_OFF"] });
  assert.equal(T.allTypes().length, 14 + 1);
  assert.equal(T.lookupByCode("egyedi_onkepzes").unit, T.UNIT.OCCASIONS);
  assert.equal(T.lookupByLabel("önképzés").code, "EGYEDI_ONKEPZES");
  assert.ok(T.isHidden("DAY_OFF")); assert.ok(T.lookupByCode("DAY_OFF"));   // elrejtve, de a régi bejegyzés típusa ismert marad
  assert.ok(!T.groupedTypes().flatMap((g) => g.types).some((t) => t.code === "DAY_OFF"));
  assert.equal(T.groupedTypes().at(-1).name, "Egyéni");
  T.configureTypes({});
  assert.equal(T.lookupByCode("EGYEDI_ONKEPZES"), null);
});

test("saját kategória kódja: ékezetek nélkül, ütközésnél számozva", () => {
  assert.equal(T.makeCustomCode("Önképzés"), "EGYEDI_ONKEPZES");
  assert.equal(T.makeCustomCode("Önképzés", ["EGYEDI_ONKEPZES"]), "EGYEDI_ONKEPZES_2");
  assert.equal(T.makeCustomCode("Önképzés", ["EGYEDI_ONKEPZES", "EGYEDI_ONKEPZES_2"]), "EGYEDI_ONKEPZES_3");
  assert.equal(T.makeCustomCode("Heti / hírlevél!"), "EGYEDI_HETI___HIRLEVEL_");
  assert.ok(T.makeCustomCode("x").startsWith(T.CUSTOM_PREFIX));
});

test("kategóriaszínek: alapérték csoportonként, felülírás, hibás érték", () => {
  assert.equal(T.colorFor("MEETING"), "#3373CC"); assert.equal(T.colorFor("TRAVEL"), "#73808F"); assert.equal(T.colorFor("DAY_OFF"), "#CC5980");
  assert.equal(T.colorFor("ISMERETLEN"), "#73808F");
  T.configureTypes({ custom: [{ code: "EGYEDI_X", label: "X", unit: "hours" }], colors: { MEETING: "ff0000", TRAVEL: "nem szín", EGYEDI_X: "#00ff00" } });
  assert.equal(T.colorFor("MEETING"), "#FF0000"); assert.equal(T.colorFor("TRAVEL"), "#73808F"); assert.equal(T.colorFor("EGYEDI_X"), "#00FF00");
  assert.ok(T.isCustomized("MEETING")); assert.ok(!T.isCustomized("TRAVEL"));
  assert.equal(T.defaultColor("EGYEDI_X"), "#26949E");
  assert.equal(T.normalizeHex("#abc"), null); assert.equal(T.normalizeHex(" #AaBbCc "), "#AABBCC"); assert.equal(T.SWATCHES.length, 16);
});
