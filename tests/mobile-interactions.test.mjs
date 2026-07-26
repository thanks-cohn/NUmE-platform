import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("mobile replaces the row pill with accessible per-row edge controls", () => {
  assert.match(page, /aria-label=\{`Move row \$\{rowIndex \+ 1\} left`\}/);
  assert.match(page, /aria-label=\{`Move row \$\{rowIndex \+ 1\} right`\}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.row-controls \{ display: none !important; \}/);
  assert.match(css, /\.mobile-edge-control[\s\S]*?width: 18vw/);
});

test("edge controls own their pointer gesture and nudge only their row", () => {
  assert.match(page, /event\.stopPropagation\(\)/);
  assert.match(page, /nudgeRow\(rowIndex, direction\)/);
  assert.match(page, /onPointerCancel=\{stopEdgeHold\}/);
  assert.match(page, /onPointerLeave=\{stopEdgeHold\}/);
});

test("drag completion still suppresses accidental product opening", () => {
  assert.match(page, /suppressOpenUntil\.current = performance\.now\(\) \+ 180/);
  assert.match(page, /performance\.now\(\) < suppressOpenUntil\.current/);
});

test("open rotunda makes the background inert and locks restored scrolling", () => {
  assert.match(page, /inert=\{rotundaOpen\}/);
  assert.match(page, /aria-hidden=\{rotundaOpen\}/);
  assert.match(page, /document\.body\.style\.position = "fixed"/);
  assert.match(page, /window\.scrollTo\(0, scrollY\)/);
  assert.match(css, /\.is-open \.gallery \{\s*pointer-events: none/);
});

test("mobile uses a dedicated grid rotunda while preserving the desktop rotunda", () => {
  assert.match(page, /className="reveal-band desktop-rotunda"/);
  assert.match(page, /className=\{`mobile-rotunda/);
  assert.match(css, /\.mobile-rotunda \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.desktop-rotunda \{ display: none; \}/);
  assert.match(css, /grid-template-rows: auto minmax\(0, 1fr\) auto/);
});

test("mobile hero is enlarged, contained, safe-area aware, and uses dvh", () => {
  assert.match(css, /height: 100dvh/);
  assert.match(css, /width: min\(94vw, 680px\)/);
  assert.match(css, /\.mobile-hero img \{[\s\S]*?object-fit: contain/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("mobile copy and navigation have dedicated non-overlapping layout rows", () => {
  assert.match(page, /className="mobile-rotunda-meta"/);
  assert.match(page, /className="mobile-rotunda-nav"/);
  assert.match(css, /\.mobile-rotunda-meta \{[\s\S]*?display: flex/);
  assert.match(css, /\.mobile-rotunda-nav \{[\s\S]*?display: grid/);
});

test("rotunda preserves previous, next, ascend, and descend boundaries", () => {
  assert.match(page, /label: "Previous"/);
  assert.match(page, /label: "Next"/);
  assert.match(page, /label: "Ascend"/);
  assert.match(page, /label: "Descend"/);
});
