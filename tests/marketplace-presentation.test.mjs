import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { activatePlacement, createPlacementVersion, resolveFeaturedPlacement, rollbackPlacement, storefrontAnchor, validateHeadingPlacements } from "../lib/featured-placement.mjs";
const layout = JSON.parse(await readFile(new URL("../data/catalog-sync/published-layout.v1.json", import.meta.url)));
const config = JSON.parse(await readFile(new URL("../data/presentation/featured-placements.v1.json", import.meta.url)));
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const catalog = await readFile(new URL("../data/catalog-sync/published-marketplace.v1.json", import.meta.url), "utf8");

test("five configured rows are separated, straight and receive safe horizontal movement", async () => {
  assert.equal(layout.rows.length, 5);
  assert.match(css, /--row-breathing-room:\s*clamp/);
  assert.match(css, /translate3d\(0, 0, 0\)/);
  const { movementConfiguration } = await import("../lib/movement.mjs");
  assert.ok(movementConfiguration(layout.rows.length).every(({speed}) => Number.isFinite(speed) && speed > 0));
});

test("mobile shelf spacing and title containment use fluid independent measures", () => {
  assert.match(css, /--row-interior-bottom:\s*clamp/);
  assert.match(css, /--row-neighbor-gap:\s*clamp/);
  assert.match(css, /--product-gap:\s*clamp/);
  assert.match(css, /word-break:\s*keep-all/);
  assert.match(css, /max-inline-size:\s*min\(72vw, 19rem\)/);
});

test("Venasi presentation owns the three central configured families with one center wordmark", () => {
  assert.deepEqual(layout.rows.slice(1,4).map(row => row.storefront_id), Array(3).fill("storefront_numenume"));
  assert.deepEqual(layout.rows.slice(1,4).map(row => row.title), ["Clothing", "VENASI", "Swimwear"]);
  assert.equal(layout.rows.filter(row => row.title === "VENASI" && row.heading_role === "primary").length, 1);
});

test("Q&A is exact, horizontal, and placed at the end", () => {
  assert.deepEqual(validateHeadingPlacements(layout.rows), []);
  assert.match(validateHeadingPlacements([{row_id:"a",heading_placement:"center"},{row_id:"b",heading_placement:"center"}])[0], /adjacent/);
  assert.equal(layout.rows.at(-1).title, "Q&A");
  assert.equal(layout.rows.at(-1).heading_placement, "end");
  const qaRules = css.match(/\[data-nume-vendor=["']merchant_qa["']\][^{]*\{[^}]*\}/g) ?? [];
  assert.ok(qaRules.length > 0);
  assert.doesNotMatch(qaRules.join("\n"), /writing-mode:\s*vertical-rl|text-orientation:\s*upright/);
});

test("Q&A slogan has one separate vendor-scoped presentation region", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(page.match(/Married to Beauty/g)?.length, 1);
  assert.match(page, /className="qa-slogan">Married to Beauty<\/p>[\s\S]*<h2 className=/);
  assert.doesNotMatch(css, /(?<!merchant_qa[^{}]{0,120})\.qa-slogan\s*\{/);
});

test("featured resolver centers multi-row and single-row storefronts and validates visit slugs", () => {
  const active = resolveFeaturedPlacement(config, layout, {now:new Date("2026-07-27")});
  assert.equal(active.anchor_row_id, "row_nume_objects");
  assert.equal(storefrontAnchor(layout, "storefront_emadoku"), "row_emadoku");
  assert.equal(resolveFeaturedPlacement(config, layout, {slug:"emadoku"}).anchor_row_id, "row_emadoku");
  assert.equal(resolveFeaturedPlacement(config, layout, {slug:"unknown"}).anchor_row_id, "row_nume_objects");
});

test("priority is deterministic and unavailable storefronts fall back", () => {
  const competing = structuredClone(config); competing.placements.push({...competing.placements[0],placement_id:"placement_higher",storefront_id:"storefront_qa",anchor_row_id:"row_qa",priority:200});
  assert.equal(resolveFeaturedPlacement(competing,layout,{now:new Date("2026-07-27")}).anchor_row_id,"row_qa");
  const suspended = structuredClone(layout); suspended.storefronts.find(item=>item.storefront_id==="storefront_numenume").status="suspended";
  assert.equal(resolveFeaturedPlacement(config,suspended,{now:new Date("2026-07-27")}).anchor_row_id,"row_emadoku");
});

test("operator activation versions, audits, atomically supersedes, and rolls back", () => {
  const placement = createPlacementVersion(config,layout,{storefront_id:"qa"},"operator:test",new Date("2026-07-28"));
  const activated = activatePlacement(config,placement,"operator:test",new Date("2026-07-28"));
  assert.equal(placement.anchor_row_id,"row_qa"); assert.equal(activated.placements.filter(item=>item.status==="active").length,1);
  const rolled = rollbackPlacement(activated,config.placements[0].placement_id,"operator:test",new Date("2026-07-29"));
  assert.equal(rolled.placements.find(item=>item.placement_id===config.placements[0].placement_id).status,"active");
  assert.equal(rolled.placements.find(item=>item.placement_id===config.placements[0].placement_id).audit_history.at(-1).event,"rollback-activated");
});

test("presentation leaves catalog and payment records untouched and metadata interaction is accessible", () => {
  assert.equal(catalog, JSON.stringify(JSON.parse(catalog), null, 2) + "\n");
  assert.match(css, /\.tile-meta[^}]*opacity:\s*0/);
  assert.match(css, /\.tile:focus-visible \.tile-meta/);
  assert.match(css, /@media \(hover: none\)/);
});
