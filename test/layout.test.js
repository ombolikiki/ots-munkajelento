import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../src/layout.js";

test("automatikus nézet a szélesség alapján", () => {
  assert.equal(L.resolveLayout("auto", 375), "mobile");
  assert.equal(L.resolveLayout("auto", 999), "mobile");
  assert.equal(L.resolveLayout("auto", 1000), "desktop");
  assert.equal(L.resolveLayout("auto", 1920), "desktop");
  assert.equal(L.resolveLayout(undefined, 1400), "desktop");
  assert.equal(L.resolveLayout("auto", NaN), "mobile");
});

test("a kifejezett választás felülírja a szélességet", () => {
  assert.equal(L.resolveLayout("desktop", 375), "desktop");
  assert.equal(L.resolveLayout("mobile", 1920), "mobile");
});

test("a gomb a másik nézetre vált", () => {
  assert.equal(L.toggledLayout("desktop"), "mobile");
  assert.equal(L.toggledLayout("mobile"), "desktop");
  assert.equal(L.toggledLayout("auto"), "desktop");
  assert.equal(L.normalizeLayout("x"), "auto");
  assert.equal(L.normalizeLayout("mobile"), "mobile");
});
