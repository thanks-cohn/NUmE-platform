import catalogData from "../data/catalogs/nume-marketplace.v1.json";
import layoutData from "../data/layout/marketplace-layout.v1.json";
import groupData from "../data/styles/entrepreneur-groups.v1.json";
import rowStyleData from "../data/styles/row-styles.v1.json";
import { resolveAssetPath } from "./asset-path.mjs";

export type Availability = "available" | "low_stock" | "sold_out" | "temporarily_unavailable" | "discontinued" | "preorder" | "unknown" | "mapping_error" | "suspended";
export type Product = (typeof catalogData.products)[number];
export type StyleTokens = Partial<{ color_background: string; color_surface: string; color_foreground: string; color_accent: string; font_heading: string; header_alignment: string; card_radius_px: number; rotunda_surface: string }>;
export type MarketplaceRow = (typeof layoutData.rows)[number] & { products: Product[]; tokens: StyleTokens };

const productById = new Map(catalogData.products.map((product) => [product.product_id, product]));
const groupById = new Map(groupData.groups.map((group) => [group.entrepreneur_group_id, group]));
const styleById = new Map(rowStyleData.profiles.map((profile) => [profile.style_profile_id, profile]));

export const marketplaceRows: MarketplaceRow[] = layoutData.rows
  .slice()
  .sort((a, b) => a.position - b.position)
  .map((row) => ({
    ...row,
    products: row.product_ids.map((id) => productById.get(id) as Product),
    tokens: {
      ...(row.entrepreneur_group_id ? groupById.get(row.entrepreneur_group_id)?.tokens : {}),
      ...styleById.get(row.style_profile_id)?.tokens,
    },
  }));

export function imagePath(product: Product) {
  const media = product.media[0];
  if (!media) return resolveAssetPath(null);
  if (media.object_key) return resolveAssetPath(media.object_key);
  const url = new URL(media.url);
  return url.hostname === "numenume.com" ? resolveAssetPath(url.pathname) : media.url;
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
