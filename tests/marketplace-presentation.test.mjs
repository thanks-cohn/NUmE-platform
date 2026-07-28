import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveFeaturedPlacement, validateHeadingPlacements } from "../lib/featured-placement.mjs";
const layout = JSON.parse(await readFile(new URL("../data/catalog-sync/published-layout.v1.json", import.meta.url)));
const config = JSON.parse(await readFile(new URL("../data/presentation/featured-placements.v1.json", import.meta.url)));
const readStyle = name => readFile(new URL(`../app/styles/${name}`, import.meta.url), "utf8");
const [tokens, marketplace, ticker, tile, responsive, qa] = await Promise.all(["tokens.css","marketplace.css","ticker.css","product-tile.css","responsive.css","vendors/qa.css"].map(readStyle));

test("five real rows render once with browser containment and a compositor track", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(layout.rows.length, 5);
  assert.match(page, /marketplaceRows\.map/);
  assert.doesNotMatch(page, /windowRange|virtual-spacer|addEventListener\("scroll"/);
  assert.match(marketplace, /content-visibility:auto/);
  assert.match(marketplace, /contain-intrinsic-size:auto var\(--gallery-row-height\)/);
  assert.match(ticker, /translate3d\(0,0,0\)/);
});

test("responsive geometry is stable and headings do not break arbitrarily", () => {
  for (const token of ["row-breathing-room","row-interior-bottom","row-neighbor-gap","product-gap"]) assert.match(tokens, new RegExp(`--${token}:clamp`));
  assert.match(marketplace, /word-break:keep-all/);
  assert.match(marketplace, /max-inline-size:min\(72vw,19rem\)/);
  assert.match(responsive, /--gallery-row-height:clamp\(286px,82vw,330px\)/);
});

test("vendor composition remains exact and Q&A remains horizontal", () => {
  assert.deepEqual(layout.rows.slice(1,4).map(row => row.storefront_id), Array(3).fill("storefront_numenume"));
  assert.deepEqual(layout.rows.slice(1,4).map(row => row.title), ["Clothing", "VENASI", "Swimwear"]);
  assert.equal(layout.rows.at(-1).title, "Q&A");
  assert.deepEqual(validateHeadingPlacements(layout.rows), []);
  assert.match(qa, /\[data-nume-vendor="merchant_qa"\]/);
  assert.doesNotMatch(qa, /writing-mode|text-orientation/);
});

test("Q&A slogan and metadata remain accessible without hover", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(page.match(/Married to Beauty/g)?.length, 1);
  assert.match(page, /className="qa-slogan">Married to Beauty/);
  assert.match(tile, /\.tile:focus-visible \.tile-meta\{opacity:1\}/);
  assert.match(responsive, /@media\(hover:none\)\{\.tile-meta\{opacity:1\}/);
});

test("featured placement still resolves the composed NUME anchor", () => {
  assert.equal(resolveFeaturedPlacement(config, layout, {now:new Date("2026-07-27")}).anchor_row_id, "row_nume_objects");
});
