export type MerchantSession = { merchantId: string; developmentOnly: boolean };
export interface MerchantIdentityResolver { resolve(request: Request): Promise<{ merchantId: string } | null>; }

/**
 * Server-only authorization boundary. Production callers must inject a resolver
 * backed by a verified session. Browser headers and catalog fields are never identity.
 */
export async function merchantSession(request: Request, resolver?: MerchantIdentityResolver): Promise<MerchantSession | null> {
  if (resolver) {
    const identity = await resolver.resolve(request);
    return identity ? { merchantId: identity.merchantId, developmentOnly: false } : null;
  }
  if (process.env.NODE_ENV !== "production" && process.env.NUME_ENABLE_DEV_CATALOG_CONTROL === "1") {
    const merchantId = process.env.NUME_DEV_MERCHANT_ID;
    return merchantId ? { merchantId, developmentOnly: true } : null;
  }
  return null;
}
