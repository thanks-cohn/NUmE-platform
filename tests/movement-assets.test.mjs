import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { movementConfiguration, wrapTickerPosition } from "../lib/movement.mjs";
import { GITHUB_PAGES_REPOSITORY, productImageFallback, resolveAssetPath } from "../lib/asset-path.mjs";

const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url)));
const catalog = await read("data/catalogs/nume-marketplace.v1.json");
const layout = await read("data/layout/marketplace-layout.v1.json");

test("every layout row receives finite nonzero alternating movement", () => {
  const movement = movementConfiguration(layout.rows.length);
  assert.equal(movement.length, 5);
  movement.forEach(({ speed, direction }, index) => {
    assert.ok(Number.isFinite(speed) && speed > 0, `row ${index + 1} moves`);
    assert.equal(direction, index % 2 === 0 ? -1 : 1);
  });
  assert.notEqual(movement[4].speed, 0, "fifth row moves");
  assert.equal(movementConfiguration(7).length, 7, "configuration grows with catalog rows");
});

test("reduced motion intentionally stops ambient movement", () => {
  assert.ok(movementConfiguration(5, true).every(({ speed }) => speed === 0));
});

test("ticker wraps into the buffered center without discontinuity", () => {
  assert.deepEqual(wrapTickerPosition(-301, -298, 100), { position: -201, target: -198 });
  assert.deepEqual(wrapTickerPosition(-99, -96, 100), { position: -199, target: -196 });
});

test("asset resolver supports roots, GitHub Pages, remote URLs, and fallbacks", () => {
  assert.equal(resolveAssetPath("products/example.webp"), "/products/example.webp");
  assert.equal(resolveAssetPath("/products/example.webp", `/${GITHUB_PAGES_REPOSITORY}`), "/NUmE-platform/products/example.webp");
  assert.equal(resolveAssetPath("/NUmE-platform/products/example.webp", "/NUmE-platform"), "/NUmE-platform/products/example.webp");
  assert.equal(resolveAssetPath("https://media.example.com/item.webp", "/NUmE-platform"), "https://media.example.com/item.webp");
  assert.equal(productImageFallback("/NUmE-platform"), "/NUmE-platform/products/fallback.svg");
});

test("all 50 products resolve local raster imagery with descriptive alt text", async () => {
  assert.equal(catalog.products.length, 50);
  for (const product of catalog.products) {
    const media = product.media[0];
    assert.match(media.object_key, /^products\/(?:emadoku|numenume|qa)\/.+\.webp$/);
    assert.doesNotMatch(media.url, /\.svg(?:$|\?)/);
    assert.ok(media.alt.length > 35 && /rendering/i.test(media.alt));
    await access(new URL(`../public/${media.object_key}`, import.meta.url));
  }
});

test("every local image has a complete attribution record", async () => {
  const sources = await readFile(new URL("../docs/catalog/product-image-sources.md", import.meta.url), "utf8");
  for (const product of catalog.products) {
    assert.match(sources, new RegExp(product.product_id));
    assert.match(sources, new RegExp(product.media[0].object_key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
