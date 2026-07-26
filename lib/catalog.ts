import catalogData from "../data/catalog-sync/published-marketplace.v1.json";
import layoutData from "../data/catalog-sync/published-layout.v1.json";
import groupData from "../data/styles/entrepreneur-groups.v1.json";
import rowStyleData from "../data/styles/row-styles.v1.json";
import manifestData from "../data/platform/marketplace-manifest.v1.json";
import { resolveAssetPath } from "./asset-path.mjs";

export type Availability = "available" | "low_stock" | "sold_out" | "temporarily_unavailable" | "discontinued" | "preorder" | "unknown" | "mapping_error" | "suspended";
export type Product = (typeof catalogData.products)[number];
export type StyleTokens = Partial<{ color_background: string; color_surface: string; color_foreground: string; color_accent: string; font_heading: string; font_body: string; heading_size: string; heading_weight: number; heading_tracking: string; border_style: string; decoration: string; header_alignment: string; card_radius_px: number; rotunda_surface: string; vendor_image_fallback_background: string; vendor_image_fallback_foreground: string }>;
export type MarketplaceRow = (typeof layoutData.rows)[number] & { merchant_id: string; products: Product[]; tokens: StyleTokens };

const productById = new Map(catalogData.products.map((product) => [product.product_id, product]));
const groupById = new Map(groupData.groups.map((group) => [group.entrepreneur_group_id, group]));
const manifestByRow = new Map(manifestData.rows.map((row) => [row.row_id, row]));
const styleById = new Map(rowStyleData.profiles.map((profile) => [profile.style_profile_id, profile]));

export const marketplaceRows: MarketplaceRow[] = layoutData.rows
  .slice()
  .sort((a, b) => a.position - b.position)
  .map((row) => ({
    ...row,
    merchant_id: manifestByRow.get(row.row_id)?.merchant_id ?? "",
    products: row.product_ids.map((id) => productById.get(id) as Product),
    tokens: {
      ...(row.entrepreneur_group_id ? groupById.get(row.entrepreneur_group_id)?.tokens : {}),
      ...styleById.get(row.style_profile_id)?.tokens,
    },
  }));

export function imagePath(product: Product) {
  const media = product.media[0];
  if (!media) return resolveAssetPath(null);
  return media.url || localImagePath(product);
}

export function localImagePath(product: Product) {
  return resolveAssetPath(product.media[0]?.object_key ?? null);
}

/** Defensive presentation fallback; curated display names should always take precedence. */
export function displayLabel(value: string) {
  return value.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export { productImageFallback, resolveAssetPath } from "./asset-path.mjs";

export function formatPrice(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amountMinor / 100);
}

export function isPurchasable(product: Product) {
  const status = product.variants[0].availability.status as Availability;
  return product.active && product.variants[0].active && !["sold_out", "temporarily_unavailable", "discontinued", "mapping_error", "suspended", "unknown"].includes(status);
}

export { catalogData, layoutData, groupData, rowStyleData };
