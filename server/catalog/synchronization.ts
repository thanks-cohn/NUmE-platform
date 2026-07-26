import catalog from "../../data/catalog-sync/published-marketplace.v1.json";
import layout from "../../data/catalog-sync/published-layout.v1.json";

export type CatalogAction = "validate" | "plan" | "update";
export interface CatalogStorage { recordAudit(entry: { merchantId: string; action: CatalogAction; at: string }): Promise<void>; }
export async function executeCatalogAction(action: CatalogAction, merchantId: string, storage?: CatalogStorage) {
  const ownedRows=layout.rows.filter(row=>row.storefront_id===merchantId.replace(/^merchant_/,"storefront_"));
  const plan={merchant_id:merchantId,action,products:catalog.products.filter(product=>ownedRows.some(row=>row.product_ids.includes(product.product_id))).length,blocking_errors:[] as string[]};
  if(action==="update"&&!storage) throw new Error("Catalog updates require a configured Cloudflare storage binding");
  if(action==="update") await storage!.recordAudit({merchantId,action,at:new Date().toISOString()});
  return {ok:true,plan,mock_stripe:true,published_snapshot:catalog.source_revision};
}
