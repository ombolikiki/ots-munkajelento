import test from "node:test";
import assert from "node:assert/strict";
import * as S from "../src/suggest.js";

test("illesztés: kisbetű- és ékezetfüggetlen, sorrend: eleje, nem első szó, bárhol", () => {
  assert.deepEqual(S.matches("ugy", ["Ügyintézés", "Értekezlet"]), ["Ügyintézés"]);
  assert.deepEqual(S.matches("ügy", ["Ügyintézés"]), ["Ügyintézés"]);
  const c = ["Heti beszámoló", "Beszámoló", "Elbeszélés", "Hittan"];
  assert.deepEqual(S.matches("besz", c), ["Beszámoló", "Heti beszámoló", "Elbeszélés"]);
  assert.deepEqual(S.matches("", c), []); assert.deepEqual(S.matches("   ", c), []);
  assert.deepEqual(S.matches("hittan", c), []);                      // a pontosan egyező kimarad
  assert.deepEqual(S.matches("ta", ["Tata", "tata", "Tatabánya", "Mór"]), ["Tata", "Tatabánya"]);   // ismétlődő kimarad
  assert.equal(S.matches("a", Array.from({ length: 20 }, (_, i) => "a" + i)).length, 5);   // legfeljebb 5
});

test("listás mező: az utolsó elválasztó utáni rész, címre nincs javaslat, a beírtat nem javasolja újra", () => {
  const places = ["Tata", "Tatabánya", "Mór", "Győr"];
  assert.deepEqual(S.listToken("Tata, Mó"), { prefix: "Tata, ", token: "Mó" });
  assert.deepEqual(S.listToken("Tata; Mó"), { prefix: "Tata; ", token: "Mó" });
  assert.deepEqual(S.listToken("Tata - Mó"), { prefix: "Tata - ", token: "Mó" });
  assert.deepEqual(S.listToken("Mó"), { prefix: "", token: "Mó" });
  assert.deepEqual(S.listSuggestions("Tata, Mó", places).items, ["Mór"]);
  assert.equal(S.applySuggestion(S.listSuggestions("Tata, Mó", places).prefix, "Mór"), "Tata, Mór");
  assert.deepEqual(S.listSuggestions("Ta", places).items, ["Tata", "Tatabánya"]);
  assert.deepEqual(S.listSuggestions("Tata, Ta", places).items, ["Tatabánya"]);   // a már beírt Tata nem
  assert.deepEqual(S.listSuggestions("Tata, Fő út 1", places).items, []);         // cím
  assert.deepEqual(S.listSuggestions("Tata, Kossuth u.", places).items, []);
  assert.deepEqual(S.listSuggestions("Tata, ", places).items, []);                // üres rész
  assert.deepEqual(S.listSuggestions("Tata, Fő út 1., Mó", places).items, ["Mór"]);
});

test("tevékenységek: legutóbbiak elöl, a kiválasztott típusúak előbb, különböző értékek, legfeljebb 300", () => {
  const e = (a, type) => ({ activity: a, type });
  const list = [e("Régi", "MEETING"), e("Hittan", "TRAVEL"), e("régi", "MEETING"), e("Kiszállás", "TRAVEL"), e("", "MEETING"), e("Heti", "MEETING")];
  assert.deepEqual(S.activityCandidates(list, ""), ["Heti", "Kiszállás", "régi", "Hittan"]);
  assert.deepEqual(S.activityCandidates(list, "TRAVEL"), ["Kiszállás", "Hittan", "Heti", "régi"]);
  const many = Array.from({ length: 500 }, (_, i) => e("t" + i, "MEETING"));
  assert.equal(S.activityCandidates(many, "").length, 300);
});
