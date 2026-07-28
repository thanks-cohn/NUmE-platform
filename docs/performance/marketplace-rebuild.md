# Marketplace motion and rendering rebuild

## Baseline

The baseline was captured from the original source and development render on 2026-07-28 before implementation. Production had five marketplace rows, five full track segments per row, and ten products per row. This produced 250 ticker tiles and up to 250 ticker image elements for the ordinary 50-product marketplace. The scroll listener read `window.scrollY`, all mounted segment rectangles, and computed root styles, then updated React's virtual window during vertical movement. Five actual rows were mounted at the initial viewport.

Both the source tests and development server were run. The first test run had 44 source tests pass and the rendered-worker check could not run before a Cloudflare artifact existed. Automated browser screenshots and a browser performance trace could not be captured in this container: no browser binary or browser driver is installed, and the package registry rejected the Playwright fetch with HTTP 403. This is an environment limitation rather than a performance claim; no synthetic frame-rate number is reported.

## Result

| Measure | Before | After |
| --- | ---: | ---: |
| Production rows mounted | 5 initially (virtual window) | 5, mounted once |
| Full track segments | 25 | 10 |
| Ordinary ticker tiles/images | 250 | 100 |
| Track copies per row | 5 | 2 |
| Vertical-scroll React updates | virtual-window state updates | none |
| Vertical-scroll geometry reads | all mounted segments plus computed root style | none |
| Animation schedulers | 1 | 1, suspended for hidden documents and without far rows |

The reduction is deterministic from the render structure and catalog cardinality, not an inferred runtime percentage. The two-segment track reduces ordinary ticker DOM duplication by 60%. Each row's segment is measured by its own `ResizeObserver`; `IntersectionObserver` classifies near and far rows without a scroll handler. Continuous work writes only a track transform and uses elapsed seconds, an exponential frame-independent response, restrained pixel-per-second ambient motion, release velocity, and bounded throw speed.

Images now reserve a 660×500 box, use responsive Unsplash candidates at 360/660/960 pixels, declare `sizes`, decode asynchronously, prioritize only the first three accessible images, and lazy-load other logical and duplicate images. Retry timers remain bounded and are released when the final listener unmounts.

The rotunda retains fixed-body scroll locking and exact offset restoration. Its transitions use transform and opacity rather than full-page filters. Reduced-motion stops ambient motion and inertia while leaving controls and direct drag available.

## Verification and observations

Cloudflare/Vinext and GitHub Pages/Next builds both completed. The 45-test suite verifies two-segment semantics, no production virtualization or scroll listener, vendor selector isolation, resize/visibility lifecycle, elapsed-time motion, horizontal intent, momentum, scroll restoration, responsive rotunda geometry, fallback behavior, availability, catalog separation, and rendered worker HTML.

Static inspection confirms observer, animation-frame, media listener, visibility listener, edge timeout/interval, and pointer-capture cleanup paths. Repeated browser heap snapshots and device frame traces remain a limitation of this environment and should be collected in CI on representative low-power devices; this report deliberately makes no zero-jank or stable-heap claim without those measurements.

## Deliberate simplifications

- Removed variable heading-card and vertical-title treatments in favor of one stable horizontal heading area.
- Removed moving card filters, per-card blur, deep glow stacks, and broad layer promotion.
- Removed production row slicing, virtual spacers, scroll-driven sizing, and five-copy centering.
- Kept one restrained stationary header blur; moving rows and tiles do not use backdrop blur.
- Preserved the existing desktop/mobile rotunda markup while sharing selection and navigation state, avoiding an experimental transition dependency.
