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
  assert.match(page, /className="mobile-rotunda-title"/);
  assert.match(page, /className="mobile-rotunda-details"/);
  assert.match(page, /className="mobile-rotunda-nav"/);
  assert.match(css, /\.mobile-rotunda-meta \{[\s\S]*?display: grid/);
  assert.match(css, /\.mobile-rotunda-nav \{[\s\S]*?display: grid/);
});

test("mobile text keeps ordinary words intact and separates price from the title", () => {
  assert.doesNotMatch(css.slice(css.indexOf("/* Mobile presentation")), /overflow-wrap: anywhere/);
  assert.match(css, /\.mobile-rotunda-meta h1 \{[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: normal;[\s\S]*?hyphens: none/);
  assert.match(css, /\.tile-meta \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.mobile-rotunda-details \{[\s\S]*?flex-wrap: wrap/);
});

test("mobile row headings use catalog alignment and a reserved card-free band", () => {
  assert.match(page, /data-mobile-align=\{logicalRow\.tokens\.header_alignment\}/);
  assert.match(css, /\.gallery-row\[data-mobile-align="center"\] \.row-heading/);
  assert.match(css, /\.gallery-row\[data-mobile-align="right"\] \.row-heading/);
  assert.match(css, /\.gallery-row\[class\*="heading-"\] \.row-heading[\s\S]*?writing-mode: horizontal-tb/);
  assert.match(css, /\.gallery-row\[style\*="--row-decoration"\] \{[\s\S]*?padding: 82px 0 10px/);
});

test("mobile landscape assigns metadata, hero, and navigation distinct columns", () => {
  const landscape = css.slice(css.indexOf("@media (max-width: 900px) and (orientation: landscape)"));
  assert.match(landscape, /grid-template-columns: minmax\(176px, 34vw\) minmax\(0, 1fr\) 108px/);
  assert.match(landscape, /\.mobile-rotunda-meta \{ grid-column: 1/);
  assert.match(landscape, /\.mobile-rotunda-stage \{ grid-column: 2/);
  assert.match(landscape, /\.mobile-rotunda-nav \{ grid-column: 3/);
  assert.match(landscape, /grid-template-columns: minmax\(96px, \.8fr\) minmax\(0, 1\.2fr\)/);
});

test("rotunda preserves previous, next, ascend, and descend boundaries", () => {
  assert.match(page, /label: "Previous"/);
  assert.match(page, /label: "Next"/);
  assert.match(page, /label: "Ascend"/);
  assert.match(page, /label: "Descend"/);
});
