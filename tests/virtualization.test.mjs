import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { activeTickerIndexes, headingComposition, makeStressRows, MAX_ACTIVE_TICKERS, MAX_MOUNTED_ROWS, virtualWindow } from "../lib/virtualization.mjs";

test("50 and 500 row catalogs remain inside the mounted and animation ceilings", () => {
  for (const count of [50, 500]) {
    for (const offset of [0, 280, 14_000, 80_000, count * 280]) {
      const window = virtualWindow(count, offset, 900, 280);
      assert.ok(window.end - window.start <= MAX_MOUNTED_ROWS);
      assert.ok(activeTickerIndexes(window, offset, 900, 280).length <= MAX_ACTIVE_TICKERS);
      assert.equal(window.top + (window.end - window.start) * 280 + window.bottom, count * 280);
    }
  }
});

test("stress rows have deterministic stable keys without changing source data", () => {
  const source = [{ row_id: "row-a" }, { row_id: "row-b" }];
  const rows = makeStressRows(source, 500);
  assert.equal(rows.length, 500);
  assert.equal(new Set(rows.map(row => row.logicalKey)).size, 500);
  assert.deepEqual(source, [{ row_id: "row-a" }, { row_id: "row-b" }]);
});

test("heading compositions are deterministic, varied, and human-facing", () => {
  const first = Array.from({ length: 12 }, (_, index) => headingComposition(index));
  assert.deepEqual(first, Array.from({ length: 12 }, (_, index) => headingComposition(index)));
  assert.ok(new Set(first.slice(0, 6)).size >= 5);
  assert.ok(first.every(value => !value.includes("_")));
});

test("implementation uses passive native scrolling and coordinated animation", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
  assert.match(page, /document\.visibilityState === "hidden"/);
  assert.doesNotMatch(page, /scroll-behavior:\s*smooth|preventDefault\(\).*wheel/s);
});

test("all frame treatments are scoped by storefront style", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  for (const style of ["style_emadoku", "style_nume_apparel", "style_nume_objects", "style_nume_editions", "style_qa"]) {
    assert.match(css, new RegExp(`data-nume-style=["']${style}["']`));
  }
});
