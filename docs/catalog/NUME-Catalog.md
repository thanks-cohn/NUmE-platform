# NUME Catalog

## Purpose

NUME Catalog is the stable commercial bridge between NUME, Stripe, merchants, and present or future fulfillment providers.

Every provider describes products differently. Printify, Printful, a warehouse, a local manufacturer, and a merchant-managed product may use different identifiers, variant models, availability rules, and order payloads. NUME Catalog translates those systems into one small, durable contract.

```text
Provider-specific data
        ↓ adapter
NUME Catalog v1
        ↓
Stripe Products and Prices
        ↓
NUME storefront presentation
        ↓
Verified payment
        ↓
Provider-specific fulfillment adapter
```

Adding a provider should require a new adapter, not a rewrite of the gallery, checkout, rows, search, or order history.

## Contract files

- `schemas/nume-catalog.schema.v1.json` is the normative JSON Schema.
- `examples/nume-catalog.example.v1.json` is a valid explanatory example.
- Production data should use a generated path such as `data/catalog/nume-catalog.v1.json`.
- Storefront row placement belongs in a separate file such as `data/layout/storefront-layout.v1.json`.

## Governing principles

### NUME owns stable identity

NUME assigns permanent internal IDs to merchants, storefronts, products, variants, media, rows, and orders. Stripe and provider IDs are external references. They may change without changing NUME identity.

Never use a product title, SKU, array position, URL, or provider name as the only permanent identity.

### Catalog and layout remain separate

The catalog answers:

- What is the product?
- What variants exist?
- What is its retail price?
- Is it available?
- Which external systems know it?
- Who can fulfill it?

The layout answers:

- Which storefront owns the presentation?
- Which row contains the product?
- What is its canonical position?
- Which theme and presentation overrides apply?

Provider or Stripe synchronization may update catalog facts. It must never reorder the gallery. Newly imported products enter an unpositioned collection until an operator places them intentionally.

### Money uses integer minor units

Money is never stored as floating point.

```json
{
  "amount_minor": 6800,
  "currency": "usd"
}
```

For USD, `6800` means `$68.00`.

Stripe remains authoritative for the Price charged at checkout. The NUME Catalog amount supports previews, builds, comparisons, and synchronization. Checkout must resolve and verify the current server-side Stripe Price.

### Variants are first-class objects

Size, color, material, format, and other purchasable choices belong to variants.

```text
Midnight Jacket
├── Black / Small
├── Black / Medium
└── Black / Large
```

Every variant has its own stable NUME ID, SKU, option values, retail price, availability, Stripe Price reference, and fulfillment mapping.

### Availability is explicit

Normalized states are:

- `available`
- `low_stock`
- `sold_out`
- `temporarily_unavailable`
- `discontinued`
- `preorder`
- `unknown`
- `mapping_error`
- `suspended`

Quantity may be `null`. Many dropshippers do not expose a reliable finite stock number. `null` means unknown or not applicable; it does not mean unlimited.

Availability identifies its source as `provider`, `merchant`, `nume`, or `combined`.

The strictest credible restriction wins:

```text
Provider available + merchant sold_out = sold_out
Provider sold_out + merchant available = sold_out
NUME suspended                          = suspended
Unknown stale state                     = checkout paused
```

Merchants must be able and contractually required to mark a product or variant sold out when provider automation cannot do so.

### Availability can move faster than the static catalog

Product titles, descriptions, media, and placement follow the deliberate workflow:

```text
import → arrange → validate → build → release
```

Availability can change after release. The static build may show the last known state, but the server must verify availability before creating Checkout. A stale static page must never authorize an impossible order.

### Fulfillment is an adapter mapping

The generic fulfillment record contains the NUME provider ID, provider product ID, provider variant ID, optional provider SKU, shipping requirement, optional production cost, and namespaced extensions.

Only the provider adapter understands the complete provider payload. The rest of NUME calls a stable internal contract:

```text
testConnection()
importCatalog()
refreshAvailability()
validateVariant()
createOrder()
retrieveOrder()
cancelOrder()
normalizeTracking()
verifyWebhook()
```

### Preserve mappings captured at purchase

An immutable order snapshot stores the exact provider mapping, Stripe Price, amount, currency, and product description used at checkout. If the merchant changes providers later, old orders remain understandable and point to the original fulfillment route.

### Credentials never enter catalog JSON

`connection_ref` points to a server-side secret record. It must never contain Stripe keys, provider API tokens, webhook secrets, passwords, or customer payment data.

Secrets belong in Cloudflare secrets or another approved secret store.

### Extensions are namespaced

The core contract stays small. Provider-specific and future fields go into `extensions`.

```json
{
  "printify.blueprint_id": "12",
  "printify.print_provider_id": "29",
  "nume.presentation_profile": "editorial-dark"
}
```

Extensions never override core fields. Core code may ignore unknown namespaced extensions without breaking.

## Source-of-truth matrix

| Information | Normal authority |
|---|---|
| NUME identity | NUME |
| Storefront and row placement | NUME layout |
| Retail Price used at checkout | Stripe |
| Product title and description | Configured catalog direction |
| Presentation media | R2 override, then Stripe/provider fallback |
| Provider availability | Provider |
| Manual sold-out override | Merchant |
| Safety suspension | NUME |
| Fulfillment product/variant | NUME mapping plus provider |
| Payment state | Stripe |
| Provider order and tracking state | Provider |

## Supported catalog directions

### Stripe-first

```text
Edit Stripe catalog
    ↓
catalog:pull
    ↓
NUME Catalog
```

Use when Stripe is the merchant's primary product editor.

### Provider-first

```text
Edit Printify or Printful
    ↓
Provider adapter imports product
    ↓
NUME Catalog normalizes it
    ↓
NUME creates or updates Stripe Product/Price
```

Use when the dropshipper is the best product-design interface.

### Merchant-first

```text
Edit product in NUME
    ↓
NUME Catalog
    ↓
Stripe and provider mappings
```

Use for merchant inventory or a provider without catalog authoring.

The configured authority for each field must be explicit. Two systems must not continually overwrite one another.

## Synchronization rules

Every synchronization should:

1. Read the provider or Stripe catalog and follow pagination.
2. Normalize into the NUME schema.
3. Match through permanent external-reference mappings, never titles alone.
4. Compare deterministic normalized records.
5. Update only changed catalog facts.
6. Preserve layout and the last valid catalog on failure.
7. Report new, changed, unavailable, malformed, and unpositioned products.
8. Write atomically.
9. Record source revision and synchronization time.
10. Be safe to run repeatedly.

## Price changes

When a retail amount changes:

1. Preserve the stable NUME variant ID.
2. Create or select the correct new Stripe Price.
3. Update the variant's active Stripe Price reference.
4. Retain historical Price references in order snapshots.
5. Never allow layout to depend on a Stripe Price ID.

## Sold-out procedure

When a merchant learns that a product or variant is unavailable:

1. Mark the variant `sold_out` or `temporarily_unavailable`.
2. Set quantity to `0` when known; otherwise use `null`.
3. Record source `merchant`, timestamp, and reason.
4. Prevent new Checkout Sessions for that variant.
5. Preserve the product's row position.
6. Display an unavailable state rather than deleting the product.

When availability returns, record a new timestamp and allow checkout only after provider and NUME safety checks pass.

## Backward compatibility

`schema_version` follows semantic versioning.

- Patch: compatible clarification or validation correction.
- Minor: optional additive fields supported by existing readers.
- Major: incompatible structural change.

Readers reject unsupported major versions, ignore unknown namespaced extensions, preserve unknown fields during migrations when possible, and support the previous major version during a declared transition.

Migrations follow:

```text
add → dual-read → backfill → verify → switch writes → retire old form
```

Never overwrite the only valid catalog during migration.

## Future optional layers

The v1 core intentionally does not standardize everything. Future modules may add shipping profiles, tax codes, customs codes, personalization, bundles, subscriptions, digital delivery, warehouses, regional availability, production times, environmental attributes, returns, and provider-specific print areas.

Keep these as optional versioned modules or namespaced extensions until multiple providers prove a field belongs in the universal core.

## Initial five-row pilot

```text
Row 1 — EMADOKU   — 10 products
Row 2 — NUMENUME  — 10 products
Row 3 — NUMENUME  — 10 products
Row 4 — NUMENUME  — 10 products
Row 5 — Q&A       — 10 products
```

The catalog stores product facts and storefront ownership. The separate layout stores row and canonical position. The importer must not create fake duplicates when fewer than 50 valid products exist.

## Codex implementation target

Codex should implement this schema as a domain contract independent of React, Next, or Vinext components.

At minimum:

- Validate catalog JSON against the schema.
- Generate deterministic normalized output.
- Maintain permanent external-reference mappings.
- Keep secrets outside JSON.
- Keep layout separate.
- Provide provider adapter interfaces.
- Provide a manual sold-out operation.
- Prevent checkout for unavailable or stale variants.
- Preserve immutable order snapshots.
- Add fixtures for Stripe, Printify, Printful, and manual products.
- Test that adding an adapter never requires editing gallery components.

The desired result is not merely one Stripe import script. It is a durable translation layer through which many commerce and fulfillment systems can participate in NUME without changing NUME's fundamental storefront format.
