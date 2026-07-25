# Entrepreneur Groupings vs. Row Stylings

## Purpose

NUME must let an individual row have its own visual identity and must also let one merchant apply a consistent identity to several related rows. This document defines the difference between those two concepts and describes how to implement them without allowing one storefront's CSS to damage NUME, another merchant's rows, the rotunda, navigation, accessibility, or mobile behavior.

This presentation system is separate from the NUME Catalog. The catalog owns product facts such as title, description, price reference, availability, variants, and fulfillment mappings. Presentation records decide where products appear and how their row or entrepreneur grouping looks.

## The two concepts

### Row styling

A row styling belongs to exactly one gallery row.

It may define that row's:

- header text and alignment
- header font family, weight, letter spacing, and capitalization
- foreground, background, accent, border, and muted colors
- product-card radius, spacing, aspect-ratio preference, and shadow treatment
- row background or restrained background image
- ticker speed and initial movement direction within platform limits
- rotunda surface colors and typography when a product from that row is enlarged
- arrow and focus-state treatment
- optional decorative details that remain inside the row's styling boundary

A row styling cannot change another row. It also cannot change NUME's global header, page layout, positioning engine, accessibility controls, scroll locking, infinite-carousel mechanics, safe-area behavior, checkout, prices, availability, or other application logic.

### Entrepreneur grouping

An entrepreneur grouping represents one merchant or brand controlling two or more rows as a coordinated storefront.

Every merchant receives at least one row. An entrepreneur account may obtain multiple rows. Those rows can be contiguous or assigned according to the marketplace layout rules. The grouping supplies a shared base presentation so all of the merchant's rows feel like parts of the same store.

A grouping may define:

- a shared brand name and wordmark treatment
- a shared typography family
- a common color palette
- shared rotunda presentation
- shared card and navigation treatments
- a default header position
- reusable media or decorative variables
- a versioned style profile applied to all rows in the grouping

Each row may still have a small row-specific override—for example, one apparel row may use a different accent color from the same merchant's accessories row. The override must remain inside the approved styling vocabulary.

## Style resolution order

NUME should compute a row's final presentation in this order:

1. NUME platform defaults
2. entrepreneur-group style profile, when the row belongs to a grouping
3. row-level style profile
4. temporary accessibility and device adjustments controlled by NUME

Later layers may override approved design tokens from earlier layers. They may not override protected platform behavior.

In compact form:

```text
NUME defaults
  → entrepreneur grouping
    → individual row overrides
      → NUME accessibility/responsive safeguards
```

This lets one entrepreneur apply the same appearance to three or more rows while preserving the option to distinguish an individual row.

## Do not store unrestricted global CSS

The merchant-facing interface may describe the feature as a custom CSS sheet, but NUME should not inject unreviewed global CSS into the application document. Raw global CSS could hide controls, imitate checkout, overlap another store, read unintended page structure, break mobile layouts, or make the marketplace inaccessible.

The durable default should be a versioned, declarative style profile. NUME translates approved fields into scoped CSS custom properties and approved component variants.

Example:

```json
{
  "style_profile_version": "1.0.0",
  "style_profile_id": "style_numenume_editorial_dark",
  "scope": "entrepreneur_group",
  "tokens": {
    "font_heading": "Cormorant Garamond",
    "font_body": "Inter",
    "color_background": "#090909",
    "color_surface": "#151515",
    "color_foreground": "#f5f2eb",
    "color_accent": "#b6a06a",
    "header_alignment": "left",
    "card_radius_px": 4,
    "rotunda_surface": "rgba(9, 9, 9, 0.88)"
  },
  "extensions": {}
}
```

A single row could then provide only its permitted differences:

```json
{
  "style_profile_version": "1.0.0",
  "style_profile_id": "style_numenume_outerwear",
  "scope": "row",
  "tokens": {
    "color_accent": "#8e3030",
    "header_alignment": "right"
  },
  "extensions": {}
}
```

## Technical scoping model

Every rendered row should receive immutable identifiers such as:

```html
<section
  data-nume-row="row_numenume_outerwear"
  data-nume-entrepreneur="entrepreneur_numenume"
  data-nume-style="style_numenume_outerwear"
>
```

Approved tokens should be compiled into variables on that exact row container:

```css
[data-nume-row="row_numenume_outerwear"] {
  --nume-row-bg: #090909;
  --nume-row-fg: #f5f2eb;
  --nume-row-accent: #8e3030;
  --nume-row-heading-font: "Cormorant Garamond", serif;
}
```

Row components consume only those variables. Selectors must be rooted beneath the row identifier. NUME must reject selectors targeting `html`, `body`, `:root`, the application shell, unrelated row IDs, checkout surfaces, dialogs, or generic elements outside the row.

Where supported, CSS cascade layers should keep platform safeguards above merchant presentation rules:

```css
@layer nume.reset, nume.platform, nume.merchant, nume.accessibility;
```

Additional isolation may use CSS Modules, generated class names, Shadow DOM for tightly bounded decorative components, or sanitized constructable stylesheets. The initial implementation should prefer design tokens and generated scoped CSS because it is simpler to validate, cache, version, and preserve across application upgrades.

## Rotunda ownership

When a visitor opens a product, the rotunda may inherit presentation from the product's row and entrepreneur grouping. Only presentation follows the selected product; behavior remains owned by NUME.

The inherited rotunda style may affect:

- surface and backdrop colors within approved contrast limits
- approved heading and body fonts
- accent color
- caption placement variant
- border, radius, and shadow treatment

It may not affect:

- backdrop interaction blocking
- background scroll locking
- Previous, Next, Ascend, Descend, Back, or Escape behavior
- source-preview behavior
- safe-area positioning
- focus trapping and keyboard navigation
- product price or availability
- living-background movement rules

When the rotunda moves into a different row through Ascend or Descend, its presentation should transition to the newly selected row's resolved style without modifying the background rows.

## Font handling

Fonts must be registered through an approved font registry rather than arbitrary merchant `<link>`, `@import`, or script tags.

A style profile refers to a registered font ID or an approved system stack. NUME can later support merchant-uploaded font files after license confirmation, file inspection, size limits, caching, and content-security-policy review.

Every custom font must include fallbacks. Font loading failure must not damage layout or prevent shopping.

## Validation and safety rules

The style service should enforce:

- a versioned allowlist of tokens and component variants
- valid color formats and minimum readable contrast
- numeric minimums and maximums for spacing, type size, radii, animation speed, and opacity
- URL allowlists for merchant media
- no JavaScript, event handlers, HTML, `@import`, remote scripts, or executable URLs
- no selectors escaping the assigned row or entrepreneur grouping
- no fixed overlays capable of covering platform navigation or checkout
- no rules that make required controls invisible or untappable
- no mutation of product facts or payment data
- reduced-motion alternatives
- responsive bounds that work across supported mobile, tablet, and desktop viewports
- a maximum profile size and bounded number of custom assets

If a profile fails validation, NUME should retain the last known-good style and report actionable errors to the merchant. The public storefront must never render a partially validated stylesheet.

## Storage model

Recommended records:

### `entrepreneur_groups`

- `entrepreneur_group_id`
- `merchant_id`
- `slug`
- `display_name`
- `base_style_profile_id`
- `status`
- `created_at`
- `updated_at`

### `rows`

- `row_id`
- `entrepreneur_group_id` or `null`
- `merchant_id`
- `slug`
- `title`
- `row_style_profile_id` or `null`
- `position`
- `status`
- `created_at`
- `updated_at`

### `style_profiles`

- `style_profile_id`
- `merchant_id`
- `scope`: `entrepreneur_group` or `row`
- `schema_version`
- `tokens`
- `extensions`
- `validation_status`
- `published_revision`
- `created_at`
- `updated_at`

Published profiles should be immutable revisions. Editing creates a new draft revision; publishing atomically changes the active reference. This makes rollback straightforward and prevents a half-written style from reaching customers.

## Caching and durability

A resolved row style should be compiled into a small deterministic artifact whose cache key includes:

- platform style-engine version
- entrepreneur-group style revision
- row-style revision
- accessibility/responsive profile version

The resulting artifact can be cached at the edge. Catalog synchronization does not need to rebuild styling, and a style change does not need to rewrite product records.

Keep old profile readers available for a documented compatibility window. Migrations should transform stored tokens forward without requiring merchants to recreate their storefront every time NUME's packages or components change.

## Merchant workflow

1. A merchant creates or receives a row.
2. An entrepreneur with multiple rows creates a shared grouping profile.
3. NUME previews that profile against desktop, mobile, rotunda, sold-out, long-title, and missing-image states.
4. The merchant optionally adds approved overrides to individual rows.
5. NUME validates and produces an immutable revision.
6. The merchant publishes the revision.
7. NUME atomically activates it and retains the last known-good revision for rollback.

The preview should display the real NUME interaction model, including moving rows, dragging, edge controls, the living rotunda background, and source preview. A style cannot be approved solely from a static screenshot.

## Initial five-row pilot

For the first storefront test:

- the top row belongs to Emadoku and uses its own row profile
- the middle three rows belong to NUME/NUMENUMe and share one entrepreneur-group profile
- each of the three middle rows may add small row-level overrides
- the bottom row belongs to Q&A and uses its own row profile

This configuration proves both models at once: single-row merchants retain distinct identities, while the NUME entrepreneur grouping demonstrates a coordinated multi-row storefront.

## Implementation boundary for Codex

Codex should build this as a presentation subsystem, not as arbitrary CSS pasted into the page.

The first implementation should include:

1. versioned TypeScript and JSON Schema definitions for style profiles
2. entrepreneur-group and row ownership records
3. deterministic style resolution
4. token validation and readable error reporting
5. scoped CSS-variable generation
6. server-side or build-time sanitization
7. immutable published revisions and rollback
8. rotunda inheritance based on the currently selected row
9. responsive and reduced-motion enforcement
10. tests proving one row cannot affect another row or the NUME application shell

Tests must specifically verify:

- a grouping profile reaches all rows in that grouping
- a row override affects only its own row
- unrelated merchant rows remain unchanged
- prohibited selectors and values are rejected
- invalid profiles fall back to the last known-good revision
- rotunda styling follows the selected row while rotunda behavior remains intact
- mobile layouts, focus indicators, and reduced-motion behavior remain protected
- catalog price, availability, and fulfillment data cannot be altered through styling

## Core rule

Entrepreneur groupings create a shared identity across a merchant's rows. Row stylings provide controlled individuality inside that identity. NUME owns the boundaries, behavior, commerce facts, and accessibility of the platform at all times.
