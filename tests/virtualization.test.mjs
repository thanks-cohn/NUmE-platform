import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { makeStressRows, virtualWindow } from "../lib/virtualization.mjs";

test("virtualization utilities remain isolated for dedicated stress scenarios", () => {
  assert.equal(makeStressRows([{row_id:"a"}], 100).length, 100);
  assert.ok(virtualWindow(500, 14000, 900, 280).end < 500);
});

test("production page uses exactly two segments and no scroll-driven rendering", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const ROW_COPIES = 2/);
  assert.doesNotMatch(page, /ROW_COPIES = 5|windowRange|virtualWindow|window\.scrollY.*setState/s);
  assert.match(page, /aria-hidden=\{copyIndex === 0 \? undefined : true\}/);
  assert.match(page, /tabIndex=\{copyIndex === 0 \? 0 : -1\}/);
});

test("motion engine is elapsed-time, visibility, resize, and lifecycle controlled", async () => {
  const engine = await readFile(new URL("../lib/motion/ticker-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /Math\.min\(\(time - this\.previous\) \/ 1000, \.05\)/);
  assert.match(engine, /new ResizeObserver/);
  assert.match(engine, /new IntersectionObserver/);
  assert.match(engine, /visibilitychange/);
  assert.match(engine, /translate3d/);
  assert.doesNotMatch(engine, /getBoundingClientRect|getComputedStyle|addEventListener\("scroll"/);
});

test("vendor stylesheets cannot target another vendor container", async () => {
  for (const [file, vendor] of [["emadoku.css","merchant_emadoku"],["nume.css","merchant_numenume"],["qa.css","merchant_qa"]]) {
    const css = await readFile(new URL(`../app/styles/vendors/${file}`, import.meta.url), "utf8");
    assert.match(css, new RegExp(`data-nume-vendor=\\"${vendor}\\"`));
    for (const other of ["merchant_emadoku","merchant_numenume","merchant_qa"].filter(v => v !== vendor)) assert.doesNotMatch(css, new RegExp(other));
  }
});
