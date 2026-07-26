# NUME Vendor Catalog v1

## Purpose and ownership

A vendor catalog is one merchant's draft, one-way source for NUME presentation and desired Stripe catalog data. NUME owns stable product/variant identity, title, description, desired minor-unit price, variants, media choice, availability, fulfillment mapping, and ordering inside server-authorized rows. Stripe owns its object IDs, payments, immutable historical Prices, refunds, and disputes. This milestone does **not** pull Stripe edits into NUME, create Checkout Sessions, submit fulfillment orders, or delete Stripe objects.

The normative contract is `schemas/nume-vendor-catalog.schema.v1.json`; TypeScript contracts are in `lib/vendor-catalog/types.ts`. Examples are `data/vendor-catalogs/merchant_emadoku.json`, `merchant_nume.json`, and `merchant_qa.json`. Each has `schema_version`, permanent catalog/merchant/storefront IDs, authorized rows, lowercase currency, increasing integer revision, timestamp, products, and namespaced extensions. Products contain stable NUME IDs, rows, copy, ordered media, tags, variants, references, lifecycle timestamps/state, and extensions. Variants contain stable IDs, unique merchant SKUs, options, integer-minor-unit retail price, currency, NUME availability, provider-neutral mapping, references, timestamps, and extensions.

Never put API keys, OAuth/access tokens, passwords, webhook secrets, provider credentials, or secret values in a catalog. `secret_ref` exists only in the server-controlled connection registry and is never returned to browser code.

## Validation and media

Validation reports the file, product, variant, field, and error. It rejects unsupported versions, duplicate IDs/SKUs, missing copy/variants, float or negative money, currency mismatch, invalid availability, malformed/cross-account references, conflicting active Price references, embedded credential-shaped fields, unknown providers, and rows not owned by the merchant. Row ownership comes from server-controlled `data/catalog-sync/row-ownership.json`; catalog text cannot grant ownership.

Media kinds are:

* `local`: website-only `/public` asset; it must exist and is never sent to Stripe.
* `public_https`: safe public HTTPS media, usable by the website and Stripe.
* `provider`: future provider-hosted public HTTPS media.
* `managed`: NUME object storage upload awaiting publication; the plan warns until it is publishable.

## Availability and checkout policy

States are `available`, `low_stock`, `sold_out`, `temporarily_unavailable`, `preorder`, `discontinued`, `unknown`, `mapping_error`, and `suspended`. NUME, not Stripe, owns availability and future checkout eligibility. `sold_out`, `suspended`, `discontinued`, `mapping_error`, and `unknown` are blocked by `checkoutEligible`. `temporarily_unavailable` is retained as a Price and is not automatically deactivated. Reliable integer quantity is copied to metadata; absent/unreliable quantity is omitted.

## Synchronization model

Both CLI and dashboard call `synchronizeCatalog`:

```text
Load → Validate → Normalize → Plan → Confirm → Apply Stripe
     → write immutable snapshot → atomic active pointer → Audit
```

Planning compares against the last successful desired catalog and reports products created/updated/unchanged/removed, Prices created, old Prices deactivated, availability/media/row changes, warnings, and blocking errors. Removed products disappear from the confirmed next website snapshot but remain in Stripe. Only `--archive-removed` opts into safe deactivation; deletion is never automatic.

Every Stripe Product gets `nume_product_id`, `nume_merchant_id`, and availability metadata. Every Stripe Price gets `nume_variant_id`, product/merchant IDs, availability, and reliable quantity. Product name, description, public images, metadata, and permitted active state are mutable. Price amount is immutable: a change creates a Price, records it as active, safely deactivates the preceding Price, and retains its ID in `historical_price_ids`; orders are never rewritten.

Idempotency keys hash merchant ID, catalog revision, product ID, variant ID, operation, and desired data. Repeating unchanged input does not create objects. Stripe applies before publication. A Stripe error leaves the active snapshot unchanged. A publication error records `partial_stripe_applied` with references and exits 4; retry uses those references/idempotency keys rather than duplicating objects. Snapshots are immutable revision/hash files and `active.json` is switched by same-filesystem rename. The generated published marketplace/layout feed the existing row renderer without changing its presentation behavior.

## Merchant isolation and authorization

`data/catalog-sync/merchant-connections.json` is server-controlled and binds a merchant to exactly one Stripe Connect account, opaque secret-manager reference, and connection status. The Stripe account is derived from this record, never a browser field. The protected route derives merchant identity through `merchantSession`; production requires `NUME_MERCHANT_DASHBOARD_TOKEN` until the application's production identity provider replaces this explicit boundary. `x-nume-merchant-id` alone is accepted only outside production when `NUME_ENABLE_DEV_CATALOG_CONTROL=1`. Per-merchant exclusive lock files prevent concurrent updates.

## CLI

Install/link the package or run `node bin/nume-vcatalog.mjs`:

* `nume-vcatalog validate --merchant merchant_emadoku` validates without mutation. `validate --all --json` validates all examples.
* `nume-vcatalog plan --merchant merchant_emadoku` prints deterministic changes without applying.
* `nume-vcatalog update --merchant merchant_emadoku` prints the plan and prompts.
* `nume-vcatalog update --merchant merchant_emadoku --yes --json` is noninteractive automation.
* `nume-vcatalog status --merchant merchant_emadoku` reports published revision, time, and last result.

All commands accept `--catalog`, `--merchant`, `--json`, and `--revision`; update/plan accept `--dry-run`; update accepts `--yes` and `--archive-removed`. Exit codes: 0 success, 1 validation/sync failure, 2 usage, 3 authentication/authorization, and 4 recoverable Stripe-applied publication failure.

## Dashboard

`/merchant/catalog` is a deliberately plain, isolated development control with Update Catalog, Validate Catalog, Preview Changes, current revision, last synchronization/result, warnings/errors, and progress. It calls only `/api/merchant/catalog`; the browser never calls Stripe. It is not a fake production login and remains disabled in production without the protected session boundary. The endpoint and CLI share the synchronization service.

## Provider adapters and row order

`FulfillmentProviderAdapter` validates mappings, normalizes provider products, and retrieves availability. Its order method deliberately throws because live submission is out of scope. Provider details stay in fulfillment mappings, references, or namespaced extensions; generic rendering has no Printify/Printful/Gelato/Gooten dependency. Product array order is row display order; only owned row IDs are publishable.

## Operations and limitations

Server environment variable names (never catalog values): `NUME_STRIPE_SECRET_KEY`, `NUME_MERCHANT_ID`, `NUME_MERCHANT_DASHBOARD_TOKEN`, `NUME_ENABLE_DEV_CATALOG_CONTROL`, and development/test-only `NUME_VCATALOG_ALLOW_MOCK_STRIPE`. Production must provision connection records in a database/secret manager, replace the token boundary with the real authenticated session, move locks/state/snapshots/audit to durable transactional storage, and provide managed-upload publication. File persistence is suitable for the first single-instance service boundary, not multi-region workers.

For manual Stripe test mode: create three Connect test accounts; update only server connection account IDs and secret references; inject the platform test secret as `NUME_STRIPE_SECRET_KEY`; validate and plan; run update with `--yes`; verify connected-account Product/Price metadata; change one amount and confirm a new Price plus inactive prior Price; mark sold out and confirm metadata changes without Price deactivation; rerun unchanged and confirm no duplicates; then inspect status, immutable snapshot, active pointer, and audit event.
