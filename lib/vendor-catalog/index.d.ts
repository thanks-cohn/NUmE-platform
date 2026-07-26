export * from "./types";
export function validateVendorCatalog(catalog: unknown, context: {file:string; connection?: import("./types").MerchantConnection}): Promise<{valid:boolean;errors:string[];warnings:string[]}>;
export function synchronizeCatalog(options: Record<string, unknown>): Promise<Record<string, unknown>>;
export function checkoutEligible(status: import("./types").AvailabilityState): boolean;
