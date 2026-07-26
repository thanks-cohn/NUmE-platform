import { timingSafeEqual } from "node:crypto";
export type MerchantSession = { merchantId: string; developmentOnly: boolean };
/** Production must replace/bridge this boundary with its authenticated session provider. */
export function merchantSession(request: Request): MerchantSession | null {
  const configured = process.env.NUME_MERCHANT_DASHBOARD_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const merchantId = request.headers.get("x-nume-merchant-id") ?? "";
  if (configured && merchantId && supplied.length === configured.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(configured))) return { merchantId, developmentOnly: false };
  if (process.env.NODE_ENV !== "production" && process.env.NUME_ENABLE_DEV_CATALOG_CONTROL === "1" && merchantId) return { merchantId, developmentOnly: true };
  return null;
}
