# NUME Gallery

NUME is a living visual index built around continuously moving image rows. Selecting a work opens the gallery from within: first as an enlarged hero rotunda, then as a source preview, while the moving gallery remains alive behind it.

## Experience

- Infinite image rows move continuously in alternating directions.
- Rows support pointer dragging, edge controls, hover controls, and keyboard navigation.
- Selecting an image opens its enlarged family rotunda.
- Previous and Next move through the current row.
- Ascend and Descend cross row boundaries from the nearest logical end.
- Selecting the enlarged hero opens its source preview.
- Back reverses one stage at a time; Escape remains available on hardware keyboards.
- The background gallery keeps moving but cannot receive accidental input while the rotunda is open.
- Reduced-motion preferences are respected.

### Mobile

Mobile uses a dedicated responsive rotunda component while sharing the same gallery data and interaction state as desktop. It is not a separate `mobile.html` page and does not redirect visitors.

- The selected image is the primary viewport region and can expand to approximately `94vw`.
- Enlarged images use `object-fit: contain` to preserve the complete artwork.
- Metadata, imagery, source preview, and navigation occupy separate layout regions to prevent overlapping text.
- Dynamic viewport units and safe-area insets support mobile browser bars and notched devices.
- Large row-edge controls replace the small desktop row-control pill.
- Portrait and landscape layouts are handled independently.
- Opening the rotunda locks background scrolling and restores the previous position when closed.

## Requirements

- Linux, macOS, or another Node-compatible development environment
- Node.js 22
- npm
- `bash`, `curl`, `flock`, `sha256sum`, and GNU `timeout` for the verified installation scripts

The hosted and CI environments use Node 22. Node 26 is not recommended for this project because native dependencies such as Sharp may not provide a compatible installation path.

## Node 22 with Fish

NUME was tested locally with Fish and `fnm`.

Install `fnm` if it is not already available:

```fish
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.config/fish/conf.d/fnm.fish
fnm install 22
fnm use 22
node --version
```

`node --version` should report `v22.x.x`.

In a new terminal, activate Node 22 before working on NUME:

```fish
fnm use 22
```

## First local setup

```fish
cd ~/dev/NUmE-Gallery
chmod +x scripts/*.sh

set -lx SHARP_IGNORE_GLOBAL_LIBVIPS 1
set -lx npm_config_include optional

npm run install:ci; and npm run build
```

Why these environment values are used:

- `SHARP_IGNORE_GLOBAL_LIBVIPS=1` prevents Sharp from detecting a system-wide `libvips` installation and attempting an unnecessary source compilation.
- `npm_config_include=optional` ensures Sharp's platform-specific prebuilt packages are installed.

The verified installer performs one bounded `npm ci`, checks the locked Vinext tarball and integrity value, uses a project-local writable cache, and confirms that Vinext is available afterward.

## Sites manifest

The repository tracks `.openai/hosting.json`, which identifies the existing NUME Sites project:

```json
{"project_id":"appgprj_6a631ba8f9cc81919d9b8d654d903388"}
```

This project ID is an identifier, not a password or deployment credential. Do not replace it when working on the existing NUME site.

If an older clone reports that `./.openai/hosting.json` cannot be resolved, update `main` first:

```fish
git switch main
git pull --ff-only
```

## Development

```fish
cd ~/dev/NUmE-Gallery
fnm use 22
npm run dev
```

Vite normally serves the project at:

```text
http://localhost:5173/
```

Stop the development server with `Ctrl+C`.

## Production build

```fish
cd ~/dev/NUmE-Gallery
fnm use 22
npm run build
```

A successful build ends with both messages:

```text
Build complete.
Validated Sites artifact: ESM Worker default.fetch and hosting manifest are present.
```

Vinext may report that route `/` is `Unknown`. This is an informational static-analysis limitation, not a failed build, provided the build and artifact validation finish successfully.

## Quality checks

```fish
npm run lint
npx tsc --noEmit
npm test
```

`npm test` performs the production build and then runs the automated tests. Current focused coverage includes mobile edge controls, drag-click suppression, background interaction blocking, the dedicated mobile rotunda layout, contained mobile imagery, and Previous/Next/Ascend/Descend behavior.

Next.js may emit advisory warnings about ordinary `<img>` elements during linting. Warnings are not build failures; errors must still be corrected.

## Available scripts

- `npm run install:ci` — verified, bounded clean dependency installation
- `npm run dev` — local Vite development server
- `npm run build` — Vinext production build plus Sites artifact validation
- `npm run start` — starts the completed Vinext production build
- `npm run lint` — ESLint through the project-local Sites environment
- `npm test` — production build followed by Node tests
- `npm run validate:artifact` — validates the generated Worker and Sites manifest

## Troubleshooting

### `Permission denied` for a script

```fish
chmod +x scripts/*.sh
git add scripts
git commit -m "Fix shell script permissions"
git push origin main
```

### `vinext is unavailable`

Dependencies have not completed installation:

```fish
fnm use 22
set -lx SHARP_IGNORE_GLOBAL_LIBVIPS 1
set -lx npm_config_include optional
npm run install:ci
```

Do not run the build until installation succeeds.

### Sharp attempts to build from source

Confirm Node and platform information:

```fish
node --version
uname -m
ldd --version | head -n 1
```

On x86-64 GNU/Linux, use:

```fish
set -lx SHARP_IGNORE_GLOBAL_LIBVIPS 1
set -lx npm_config_include optional
npm run install:ci
```

### Missing `.openai/hosting.json`

Pull the latest `main`. If repairing an old or incomplete local checkout manually:

```fish
mkdir -p .openai
printf '%s\n' \
'{"project_id":"appgprj_6a631ba8f9cc81919d9b8d654d903388"}' \
> .openai/hosting.json
```

### Fish says `Expected a string, but found a redirection`

Do not paste terminal output beginning with `>` back into the shell. Paste only the commands inside documented code blocks.

## Source control workflow

Before beginning work:

```fish
git switch main
git pull --ff-only
```

After a verified change:

```fish
git status
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

The completed v1 gallery milestone remains available under the `v1` Git tag. Later commits contain the mobile usability work and build-environment fixes.

## Deployment

The project retains its Cloudflare-compatible Vinext Worker build and Sites metadata. Sites deployments use the same application source as the GitHub repository; mobile and desktop are responsive presentations of one application rather than separately deployed websites.

Current Sites deployment:

https://nume-gallery.officialmahasbiz.chatgpt.site

Before deploying or publishing a change, run the production build and quality checks described above. Never commit credentials, `.env` secrets, API keys, or payment-provider secrets.
## Five-row marketplace demonstration

The gallery is now a catalog-driven marketplace demonstration with exactly five visible rows: **Emadoku** (10 products), three consecutive **NUME / NUMENUMe** rows (Apparel, Objects, and Editions; 30 products), and **Q&A** (10 products). It retains the infinite alternating tickers, drag and touch controls, keyboard operation, living background, responsive rotunda, cross-row Ascend/Descend navigation, safe-area layout, scroll locking, and reduced-motion protections.

This milestone contains demonstration records only. It makes **no live payment or fulfillment request**, contains no secrets, and does not create Checkout Sessions.

### Data ownership

- `data/catalogs/nume-marketplace.v1.json` is the canonical product-facts layer: stable IDs, descriptions, media, integer-minor-unit prices, availability, variants, external references, and fulfillment mappings.
- `data/layout/marketplace-layout.v1.json` independently assigns stable product IDs to storefront rows.
- `data/styles/entrepreneur-groups.v1.json` defines the shared NUME identity inherited by all three middle rows.
- `data/styles/row-styles.v1.json` defines bounded Emadoku and Q&A identities and safe row-specific NUME accents. Resolution is platform defaults → group → row → platform accessibility/responsive safeguards; raw merchant CSS is never injected.
- `lib/catalog.ts` is the typed loader and exposes resolved rows, safe style tokens, availability checks, image paths, and minor-unit price formatting.

### Editing the marketplace

1. Add a schema-conforming product and stable variant to the catalog. Include nonempty media alt text, tags, timestamps, availability, retail money, Stripe placeholder references, and a provider-neutral fulfillment mapping.
2. Add its `product_id` to exactly one layout row's `product_ids` list. Product facts must never be copied into layout or React.
3. To add an entrepreneur grouping, add its declarative group profile and reference its stable ID from the relevant rows. A row may reference a row profile containing only allowlisted overrides.
4. Mark a product sold out by setting its variant `availability.status` to `sold_out`, quantity to `0` when known, and `active` to `false`. The product keeps its position and renders a non-purchasable state.
5. Run `npm run validate:catalog`. Structural errors fail the production build with product or row context.

Stripe Product and Price placeholders live only in `external_references`; connected-account placeholders use `account_id`. The NUME product and variant IDs remain stable when Stripe IDs change. Displayed HTML prices come from integer catalog amounts, but a future server checkout endpoint **must retrieve and validate the current Stripe Price and availability before creating Checkout**.

Printify, Printful, and manual provider identities are registered in `providers`. Variant `fulfillment` records map provider, product, variant, SKU, shipping, and optional production cost; namespaced extensions hold provider-specific details. Generic UI components do not inspect provider-specific fields.

Original, locally stored demonstration imagery and a per-product provenance record are documented in `docs/catalog/product-image-sources.md`.

### Run and verify

```bash
npm run install:ci
npm run validate:catalog
npm run lint
npx tsc --noEmit
npm test
npm run build
```
