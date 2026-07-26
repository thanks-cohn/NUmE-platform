import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
const read = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url)));
const catalog = await read("data/catalogs/nume-marketplace.v1.json");
const layout = await read("data/layout/marketplace-layout.v1.json");
const groups = await read("data/styles/entrepreneur-groups.v1.json");
const styles = await read("data/styles/row-styles.v1.json");
const products = new Map(catalog.products.map((p) => [p.product_id, p]));
test("renders five rows of ten catalog references", () => { assert.equal(layout.rows.length, 5); assert.deepEqual(layout.rows.map((r) => r.product_ids.length), [10,10,10,10,10]); });
test("NUME grouping owns thirty products while storefronts remain separate", () => { const nume = layout.rows.filter((r) => r.entrepreneur_group_id === "group_numenume"); assert.equal(nume.flatMap((r) => r.product_ids).length, 30); assert.equal(layout.rows[0].storefront_id, "storefront_emadoku"); assert.equal(layout.rows[4].storefront_id, "storefront_qa"); });
test("all row references and storefront ownership resolve", () => { for (const row of layout.rows) for (const id of row.product_ids) assert.equal(products.get(id)?.storefront_id, row.storefront_id); });
test("group inheritance and row overrides are declaratively isolated", () => {
  const group = groups.groups.find((g) => g.entrepreneur_group_id === "group_numenume");
  const numeRows = layout.rows.filter((r) => r.entrepreneur_group_id === "group_numenume");
  assert.ok(group);
  assert.equal(numeRows.length, 3);
  const resolved = numeRows.map((row) => ({ ...group.tokens, ...styles.profiles.find((style) => style.style_profile_id === row.style_profile_id).tokens }));
  assert.ok(resolved.every((tokens) => tokens.color_background === group.tokens.color_background));
  assert.equal(new Set(resolved.map((tokens) => tokens.color_accent)).size, 3);
  assert.equal(layout.rows[0].entrepreneur_group_id, null);
  assert.equal(layout.rows[4].entrepreneur_group_id, null);
});
test("storefront identities resolve distinct typography and palettes while NUME remains unified", () => {
  const group = groups.groups.find((g) => g.entrepreneur_group_id === "group_numenume");
  const resolved = layout.rows.map((row) => ({ ...(row.entrepreneur_group_id ? group.tokens : {}), ...styles.profiles.find((style) => style.style_profile_id === row.style_profile_id).tokens }));
  assert.equal(new Set(resolved.slice(1, 4).map((tokens) => tokens.font_heading)).size, 1);
  assert.equal(new Set(resolved.slice(1, 4).map((tokens) => tokens.decoration)).size, 1);
  assert.notEqual(resolved[0].font_heading, resolved[1].font_heading);
  assert.notEqual(resolved[4].font_heading, resolved[1].font_heading);
  assert.equal(new Set([resolved[0].color_background, resolved[1].color_background, resolved[4].color_background]).size, 3);
});
test("all products prefer unique stable Unsplash photographs and retain local WebP fallbacks", async () => {
  assert.equal(catalog.products.length, 50);
  const urls = catalog.products.map((product) => product.media[0].url);
  assert.equal(new Set(urls).size, 50);
  for (const product of catalog.products) {
    const media = product.media[0];
    assert.match(media.url, /^https:\/\/images\.unsplash\.com\/photo-[^?]+\?/);
    assert.ok(media.alt.length > 35);
    assert.match(media.object_key, /\.webp$/);
    await access(new URL(`../public/${media.object_key}`, import.meta.url));
  }
});
test("visible catalog labels are professionally written", () => {
  const labels = [...layout.storefronts.map((item) => item.display_name), ...layout.rows.flatMap((row) => [row.title, row.subtitle]), ...catalog.products.flatMap((product) => [product.title, product.description, product.media[0].alt])];
  assert.ok(labels.every((label) => !label.includes("_")));
  const internalIds = [...layout.storefronts.map((item) => item.storefront_id), ...layout.rows.flatMap((row) => [row.row_id, row.style_profile_id]), ...catalog.products.map((product) => product.product_id)];
  assert.ok(labels.every((label) => internalIds.every((id) => !label.includes(id))));
});
test("Stripe and provider mappings survive in every product", () => { for (const product of catalog.products) { assert.ok(product.external_references.some((r) => r.system === "stripe_product")); for (const variant of product.variants) { assert.ok(variant.external_references.some((r) => r.system === "stripe_price")); assert.ok(variant.fulfillment.provider_product_id); } } });
test("catalog demonstrates sold out and minor-unit prices", () => { const variants=catalog.products.flatMap((p)=>p.variants); assert.ok(variants.some((v)=>v.availability.status === "sold_out")); assert.ok(variants.every((v)=>Number.isInteger(v.retail_price.amount_minor))); });
test("renderer retains selection, navigation, fallback chain, style isolation, and reduced motion", async () => { const [page,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/globals.css",import.meta.url),"utf8")]); assert.match(page,/openWork\(work, rowIndex\)/); assert.match(page,/label: "Previous"/); assert.match(page,/label: "Descend"/); assert.match(page,/data-nume-row/); const resilientImage=await readFile(new URL("../app/product-image.tsx",import.meta.url),"utf8"); assert.match(page,/ProductImage/); assert.match(resilientImage,/MAX_CONCURRENT = 3/); assert.match(resilientImage,/const DELAYS = \[750, 2000, 5000\]/); assert.match(css,/@media \(prefers-reduced-motion: reduce\)/); assert.match(css,/availability-sold_out/); });
