# Vertical scrolling performance diagnostic

## Scope and measurement status

This audit intentionally makes no scrolling changes. It covers the current React, DOM, CSS, and image paths on desktop/mobile and with normal/reduced motion. The repository environment has no browser executable, so trustworthy FPS, dropped-frame, PerformanceObserver, paint, image-decode, and mobile-device traces could not be captured here. Those values must not be invented; the browser protocol below is required before implementation.

## Confirmed causes from the implementation

1. **Every handled scroll frame synchronously measures every mounted ticker segment.** `Home`'s virtualization effect schedules `update` from the passive scroll listener, then loops over `rowSegments.current` and calls `getBoundingClientRect()` before reading the root computed style and updating React state. This puts layout reads and a possible render on the scroll-critical path. The cost is bounded by the mounted-row limit, not by the visible-row set, and applies in both directions and both motion preferences.
2. **Virtual-window boundary crossings synchronously render a different row slice.** `setWindowRange` changes the sliced `logicalRows` range. Rows leaving the buffer unmount their tracks and delete measured widths; rows entering it reconstruct five copies of every product, remount images, and queue a new `getBoundingClientRect()`. Upward scrolling therefore reconstructs earlier rows just as downward scrolling reconstructs later rows. Stable logical keys and exact top/bottom spacer arithmetic prevent a proven state-index or spacer-total error, while ticker positions remain in `tickerState`; nevertheless, remount/decode/paint bursts can produce visible frame-time spikes.
3. **Ticker work continues during scrolling.** The single animation loop updates transforms for the active window while the scroll callback performs measurements and React window updates. The active-row ceiling and GPU-friendly `translate3d` are positive controls, but both workloads contend for main-thread frame budget.
4. **Paint-heavy presentation increases raster/compositing cost.** Mounted cards use shadows and translucent metadata with backdrop blur; the gallery uses gradients; Q&A adds bounded glow. Mobile/slow-update CSS removes tile shadows and rotunda blur, so desktop is expected to pay more paint/composite cost. This is a source-level expectation pending paint traces, not a measured FPS conclusion.
5. **Image lifecycle can coincide with virtual mounts.** Each mounted logical row creates five segment copies, while only one copy is accessible. Later rows request lazy images and `ProductImage` can swap to a fallback after an error. Decoding and fallback swaps are plausible contributors at window boundaries; their exact duration and layout-shift impact require browser evidence.

No wheel interception, smooth scrolling, or scroll restoration loop exists. The fixed header itself has no JavaScript scroll work. Rotunda body fixing/restoration occurs only while opening or closing a product, not during ordinary gallery scrolling. The CSS row height is fixed per media query, and `virtualWindow` preserves the exact total spacer height for its current row-height input; no incorrect spacer math is confirmed. Mobile `vh` participates only in the clamped row height, so viewport-bar changes can trigger `ResizeObserver` and a recalculation, but require a real-device trace to quantify. Reduced motion previously stopped ambient displacement but did not stop the RAF scheduler; after the ticker regression fix it uses gentler nonzero displacement, with otherwise identical scrolling work.

## Responsible code

- `app/page.tsx`: `update`/`onScroll`, the root `ResizeObserver`, segment ref measurement, virtual slice rendering, image-copy rendering, and `animate`.
- `lib/virtualization.mjs`: `virtualWindow` and `activeTickerIndexes` limits and spacer calculations.
- `app/product-image.tsx`: image loading, decoding behavior delegated to the browser, and fallback transition.
- `app/globals.css`: containment, gradients, shadows, filters, backdrop filters, fixed header, row-height media queries, and mobile cost reductions.
- `lib/movement.mjs`: ambient displacement policy; it does not create an additional scheduler.

## Prioritized later remediation plan

1. Capture reproducible Chrome Performance traces before editing: cold/warm image cache, down/up, desktop/mobile emulation and real mobile, normal/reduced motion. Record FPS, dropped frames, p50/p95/p99 frame time, tasks over 50 ms, layout/style/paint/composite time, CLS, React commits, image decode time, and mounted/active row counts.
2. Remove geometry reads from the scroll path: cache segment widths through a segment-level `ResizeObserver` and invalidate only when content/font/viewport geometry changes. Batch all reads before writes and prove that no forced layout remains.
3. Decouple virtual-window transitions from high-frequency scroll frames and reduce remount bursts without changing native scrolling. Preserve stable spacer totals and ticker state, then test boundaries in both directions.
4. Profile image duplication/decode. Avoid redundant work for inaccessible copies while retaining seamless wrapping; reserve intrinsic dimensions and verify fallback CLS.
5. Use paint/compositing traces to simplify only effects proven expensive, with desktop/mobile budgets and visual snapshots. Do not broadly remove the settled design.

Expected results are fewer scroll-frame layouts and React commits, smaller boundary spikes, less repeated decode/paint work, and symmetric down/up responsiveness while all tickers remain alive. Quantitative improvement targets should be set from the baseline traces rather than guessed.

## Required regression and browser protocol

- Automated: exact spacer-height invariants, stable logical keys/ticker state across down/up window transitions, segment measurement invalidation tests, no scroll-time geometry-read assertion, hydration/build checks, image fallback dimension checks, and existing ticker direction/wrap/performance ceilings.
- Desktop: Chrome at 1440×900 with 4× CPU throttle and no throttle; 10-second down and up runs after cold and warm loads, normal and reduced motion.
- Mobile: a real mid-tier Android device plus 390×844 emulation, browser chrome expanding/collapsing, portrait/landscape, normal and reduced motion.
- Inspect DevTools Performance (Screenshots, Web Vitals, Layout Shifts), Rendering FPS meter, React Profiler, Layers/Paint Flashing, and a `PerformanceObserver` for `longtask` and layout shifts. Compare row-boundary timestamps with React commits, layouts, image decodes, and dropped frames.
- Acceptance for the later fix: no long task caused by a virtual boundary, no forced synchronous layout attributed to scrolling, zero unexpected CLS, unchanged spacer totals and ticker positions, and sustained frame pacing appropriate to each tested display/device.
