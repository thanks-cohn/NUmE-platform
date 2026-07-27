import assert from "node:assert/strict";
import test from "node:test";
import { resolveRotundaMove } from "../lib/rotunda-navigation.mjs";

const rows = [[{product_id:"a"},{product_id:"b"}], [{product_id:"c"},{product_id:"d"}]];

test("rotunda navigation reports same-row and cross-row destinations", () => {
  assert.deepEqual(resolveRotundaMove(rows, "a", 1), {target:rows[0][1], rowIndex:0, label:"Next"});
  assert.deepEqual(resolveRotundaMove(rows, "b", 1), {target:rows[1][0], rowIndex:1, label:"Descend"});
  assert.deepEqual(resolveRotundaMove(rows, "c", -1), {target:rows[0][1], rowIndex:0, label:"Ascend"});
  assert.deepEqual(resolveRotundaMove(rows, "d", -1), {target:rows[1][0], rowIndex:1, label:"Previous"});
});

test("rotunda navigation preserves terminal boundaries", () => {
  assert.deepEqual(resolveRotundaMove(rows, "a", -1), {target:null, rowIndex:0, label:"Ascend"});
  assert.deepEqual(resolveRotundaMove(rows, "d", 1), {target:null, rowIndex:1, label:"Descend"});
});
