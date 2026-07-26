import type { FulfillmentProviderAdapter } from "./types";
/** Order submission is intentionally a typed future boundary, not implemented in this milestone. */
export abstract class BaseFulfillmentProviderAdapter implements FulfillmentProviderAdapter {
  abstract validateMapping(mapping: Parameters<FulfillmentProviderAdapter["validateMapping"]>[0]): ReturnType<FulfillmentProviderAdapter["validateMapping"]>;
  abstract normalizeProducts(input: unknown): ReturnType<FulfillmentProviderAdapter["normalizeProducts"]>;
  abstract retrieveAvailability(mapping: Parameters<FulfillmentProviderAdapter["retrieveAvailability"]>[0]): ReturnType<FulfillmentProviderAdapter["retrieveAvailability"]>;
  async submitOrder(): Promise<never> { throw new Error("Live fulfillment order submission is not implemented"); }
}
