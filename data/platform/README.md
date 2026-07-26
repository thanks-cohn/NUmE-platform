# Marketplace ownership boundary

`marketplace-manifest.v1.json` is platform-owned policy: it alone assigns merchants,
storefronts, rows, ordering, and enablement. Vendor catalogs and declarative style
tokens cannot override those fields. GitHub Pages consumes these files read-only.

Production publication must provide a `MerchantIdentityResolver` backed by a verified
server session and durable atomic storage. The default resolver fails closed in
production; request headers are deliberately not accepted as merchant identity.
