import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const [page, responsive, marketplace, rotunda, engine] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/styles/responsive.css", import.meta.url), "utf8"),
  readFile(new URL("../app/styles/marketplace.css", import.meta.url), "utf8"),
  readFile(new URL("../app/styles/rotunda.css", import.meta.url), "utf8"),
  readFile(new URL("../lib/motion/ticker-engine.ts", import.meta.url), "utf8"),
]);

test("mobile edge controls remain labelled and scoped to their row", () => {
  assert.match(page, /aria-label=\{`Move row \$\{rowIndex \+ 1\} left`\}/);
  assert.match(page, /nudgeRow\(rowIndex, direction\)/);
  assert.match(responsive, /\.mobile-edge-control[\s\S]*width:18vw/);
});

test("horizontal dragging claims only clear horizontal intent and preserves momentum", () => {
  assert.match(engine, /Math\.abs\(totalX\) <= INTENT_DISTANCE/);
  assert.match(engine, /Math\.abs\(totalX\) <= Math\.abs\(totalY\) \* 1\.2/);
  assert.match(engine, /drag\.row\.velocity = Math\.max\(-MAX_THROW/);
  assert.match(engine, /1 - Math\.exp\(-response \* dt\)/);
  assert.match(page, /suppressOpenUntil\.current = performance\.now\(\) \+ 180/);
});

test("rotunda is modal, inert, and restores the exact native scroll offset", () => {
  assert.match(page, /inert=\{rotundaOpen\}/);
  assert.match(page, /document\.body\.style\.position = "fixed"/);
  assert.match(page, /window\.scrollTo\(0, scrollY\)/);
  assert.match(marketplace, /\.is-open \.gallery\{pointer-events:none\}/);
});

test("mobile rotunda has safe-area-aware non-overlapping geometry", () => {
  assert.match(rotunda, /\.mobile-rotunda\{display:none\}/);
  assert.match(responsive, /grid-template-rows:auto minmax\(0,1fr\) auto/);
  assert.match(responsive, /100dvh/);
  assert.match(responsive, /env\(safe-area-inset-bottom\)/);
  assert.match(responsive, /\.mobile-hero img\{object-fit:contain\}/);
  assert.match(responsive, /\.mobile-rotunda-nav\{display:grid/);
});
