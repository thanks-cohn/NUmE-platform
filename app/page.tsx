"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { displayLabel, featuredPlacementData, formatPrice, isPurchasable, layoutData, marketplaceRows, type Product, type StyleTokens } from "../lib/catalog";
import { resolveFeaturedPlacement } from "../lib/featured-placement.mjs";
import { ProductImage } from "./product-image";
import { movementConfiguration, wrapTickerPosition } from "../lib/movement.mjs";
import { activeTickerIndexes, makeStressRows, virtualWindow } from "../lib/virtualization.mjs";
import { resolveRotundaMove } from "../lib/rotunda-navigation.mjs";

const rows = marketplaceRows.map((row) => row.products);
const ROW_COPIES = 5;
const DEFAULT_ROW_HEIGHT = 300;
const INITIAL_WINDOW = { start: 0, end: Math.min(5, marketplaceRows.length), top: 0, bottom: 0 };

type TickerState = {
  position: number;
  target: number;
  initialized: boolean;
};

function styleVariables(tokens: StyleTokens) {
  return {
    "--row-bg": tokens.color_background, "--row-surface": tokens.color_surface,
    "--row-soft-surface": tokens.color_soft_surface ?? tokens.color_surface,
    "--row-fg": tokens.color_foreground, "--row-accent": tokens.color_accent,
    "--row-edge": tokens.color_edge ?? tokens.color_accent,
    "--row-font": tokens.font_heading, "--row-radius": `${tokens.card_radius_px ?? 0}px`,
    "--row-rotunda": tokens.rotunda_surface, "--row-align": tokens.header_alignment,
    "--row-body-font": tokens.font_body, "--row-heading-size": tokens.heading_size,
    "--row-heading-weight": tokens.heading_weight, "--row-heading-tracking": tokens.heading_tracking,
    "--row-border": tokens.border_style, "--row-decoration": tokens.decoration,
    "--row-image-treatment": tokens.image_treatment ?? "natural",
  } as React.CSSProperties;
}



export default function Home() {
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedRow, setSelectedRow] = useState(0);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [logicalRows, setLogicalRows] = useState(() => makeStressRows(marketplaceRows, marketplaceRows.length));
  const [windowRange, setWindowRange] = useState(INITIAL_WINDOW);
  const virtualMetrics = useRef({ offset: 0, viewport: 900, rowHeight: DEFAULT_ROW_HEIGHT });
  const windowRangeRef = useRef(INITIAL_WINDOW);
  const rowTracks = useRef(new Map<number, HTMLDivElement>());
  const rowSegments = useRef(new Map<number, HTMLDivElement>());
  const cycleWidths = useRef(new Map<number, number>());
  const tickerState = useRef(new Map<number, TickerState>());
  const dragState = useRef({
    rowIndex: -1,
    pointerId: -1,
    lastX: 0,
    distance: 0,
    dragging: false,
  });
  const suppressOpenUntil = useRef(0);
  const edgeHoldDelay = useRef<number | null>(null);
  const edgeHoldRepeat = useRef<number | null>(null);
  const rotundaOpen = stage > 0;
  const initialCenterComplete = useRef(false);

  const family = useMemo(
    () => selected ? rows[selectedRow].filter((product) => product.product_id !== selected.product_id).slice(0, 4) : [],
    [selected, selectedRow],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const requested = Number(new URLSearchParams(window.location.search).get("numeStress"));
    if (requested >= 50 && requested <= 1000) queueMicrotask(() => setLogicalRows(makeStressRows(marketplaceRows, requested)));
  }, []);

  useLayoutEffect(() => {
    if (initialCenterComplete.current || location.hash) return;
    initialCenterComplete.current = true;
    const match = location.pathname.match(/^\/storefront\/([^/]+)\/?$/);
    const resolved = resolveFeaturedPlacement(featuredPlacementData, layoutData, { slug: match ? decodeURIComponent(match[1]) : undefined } as never);
    if (!resolved) return;
    const rowIndex = marketplaceRows.findIndex((row) => row.row_id === resolved.anchor_row_id);
    if (rowIndex < 0) return;
    const rowHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gallery-row-height")) || DEFAULT_ROW_HEIGHT;
    window.scrollTo({ top: Math.max(0, 122 + rowIndex * rowHeight + rowHeight / 2 - innerHeight / 2), behavior: "instant" });
    document.documentElement.dataset.featuredResolution = resolved.reason;
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const galleryTop = 122;
      const offset = Math.max(0, window.scrollY - galleryTop);
      const viewport = window.innerHeight;
      virtualMetrics.current = { offset, viewport, rowHeight: virtualMetrics.current.rowHeight };
      for (const [index, segment] of rowSegments.current) cycleWidths.current.set(index, segment.getBoundingClientRect().width + 14);
      const rowHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gallery-row-height")) || DEFAULT_ROW_HEIGHT;
      virtualMetrics.current.rowHeight = rowHeight;
      const next = virtualWindow(logicalRows.length, offset, viewport, rowHeight);
      windowRangeRef.current = next;
      setWindowRange(current => current.start === next.start && current.end === next.end && current.bottom === next.bottom ? current : next);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const observer = new ResizeObserver(onScroll); observer.observe(document.documentElement);
    document.fonts?.ready.then(onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); observer.disconnect(); };
  }, [logicalRows.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stage > 0) goBack();
      if (stage > 0 && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (stage > 0) selectRelative(-1);
        else if (hoveredRow !== null) nudgeRow(hoveredRow, -1);
        else return;
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        if (stage > 0) selectRelative(1);
        else if (hoveredRow !== null) nudgeRow(hoveredRow, 1);
        else return;
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!rotundaOpen) return;
    const scrollY = window.scrollY;
    const bodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const rootOverflow = document.documentElement.style.overflow;
    const rootOverscroll = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = rootOverflow;
      document.documentElement.style.overscrollBehavior = rootOverscroll;
      document.body.style.overflow = bodyStyles.overflow;
      document.body.style.position = bodyStyles.position;
      document.body.style.top = bodyStyles.top;
      document.body.style.width = bodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [rotundaOpen]);

  useEffect(() => () => stopEdgeHold(), []);

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const constrained = (navigator.hardwareConcurrency || 8) <= 4;
    const activeCeiling = constrained ? 4 : 10;
    const movement = movementConfiguration(logicalRows.length, reducedMotion);

    const animate = (time: number) => {
      if (document.visibilityState === "hidden") { frame = 0; return; }
      const timeScale = Math.min((time - lastTime) / 16.667, 2.5);
      lastTime = time;
      const { offset, viewport, rowHeight } = virtualMetrics.current;
      const active = activeTickerIndexes(windowRangeRef.current, offset, viewport, rowHeight, activeCeiling);
      for (const logicalIndex of active) {
        const track = rowTracks.current.get(logicalIndex);
        const cycleWidth = cycleWidths.current.get(logicalIndex) ?? 0;
        if (!track || !cycleWidth) continue;
        let state = tickerState.current.get(logicalIndex);
        if (!state) { state = { position: -cycleWidth * 2, target: -cycleWidth * 2, initialized: true }; tickerState.current.set(logicalIndex, state); }
        const { direction, speed } = movement[logicalIndex];
        const ambientStep = direction * speed * timeScale;
        state.target += ambientStep;
        state.position += ambientStep + (state.target - state.position) * 0.075;
        Object.assign(state, wrapTickerPosition(state.position, state.target, cycleWidth));
        track.style.transform = `translate3d(${state.position}px, 0, 0)`;
      }
      if (process.env.NODE_ENV !== "production") {
        document.documentElement.dataset.numePerformance = JSON.stringify({ logicalRows: logicalRows.length, mountedRows: windowRangeRef.current.end - windowRangeRef.current.start, activeRows: active.length, schedulerCount: 1, window: [windowRangeRef.current.start, windowRangeRef.current.end] });
      }
      frame = requestAnimationFrame(animate);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { cancelAnimationFrame(frame); frame = 0; return; }
      lastTime = performance.now();
      if (!frame) frame = requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(animate);
    return () => { document.removeEventListener("visibilitychange", onVisibility); cancelAnimationFrame(frame); };
  }, [logicalRows.length]);

  function openWork(work: Product, rowIndex: number) {
    if (performance.now() < suppressOpenUntil.current) return;
    setSelected(work);
    setSelectedRow(rowIndex % rows.length);
    setStage(1);
  }

  function goBack() {
    if (stage === 2) setStage(1);
    else {
      setStage(0);
      setSelected(null);
    }
  }

  function advance() {
    if (!selected) return;
    if (stage === 1) setStage(2);
    else window.open("#", "_self");
  }

  function nudgeRow(rowIndex: number, direction: -1 | 1) {
    const state = tickerState.current.get(rowIndex);
    if (state) state.target += direction * 230;
  }

  function stopEdgeHold(event?: React.PointerEvent<HTMLButtonElement>) {
    event?.stopPropagation();
    if (edgeHoldDelay.current !== null) window.clearTimeout(edgeHoldDelay.current);
    if (edgeHoldRepeat.current !== null) window.clearInterval(edgeHoldRepeat.current);
    edgeHoldDelay.current = null;
    edgeHoldRepeat.current = null;
  }

  function startEdgeHold(
    event: React.PointerEvent<HTMLButtonElement>,
    rowIndex: number,
    direction: -1 | 1,
  ) {
    event.stopPropagation();
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopEdgeHold();
    edgeHoldDelay.current = window.setTimeout(() => {
      nudgeRow(rowIndex, direction);
      edgeHoldRepeat.current = window.setInterval(() => nudgeRow(rowIndex, direction), 135);
    }, 340);
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>, rowIndex: number) {
    if ((event.target as HTMLElement).closest(".row-controls")) return;
    dragState.current = {
      rowIndex,
      pointerId: event.pointerId,
      lastX: event.clientX,
      distance: 0,
      dragging: false,
    };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>, rowIndex: number) {
    const drag = dragState.current;
    if (drag.rowIndex !== rowIndex || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.distance += Math.abs(delta);
    if (!drag.dragging && drag.distance > 5) {
      drag.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.classList.add("is-dragging");
    }
    if (!drag.dragging) return;
    const state = tickerState.current.get(rowIndex);
    if (!state) return;
    state.position += delta;
    state.target = state.position;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>, rowIndex: number) {
    const drag = dragState.current;
    if (drag.rowIndex !== rowIndex || drag.pointerId !== event.pointerId) return;
    if (drag.dragging) suppressOpenUntil.current = performance.now() + 180;
    dragState.current = { rowIndex: -1, pointerId: -1, lastX: 0, distance: 0, dragging: false };
    event.currentTarget.classList.remove("is-dragging");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function focusLogicalRow(targetRow: number, itemIndex: number) {
    if (targetRow < 0 || targetRow >= logicalRows.length) return;
    window.scrollTo({ top: 122 + targetRow * virtualMetrics.current.rowHeight });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-logical-index="${targetRow}"]`);
      row?.querySelectorAll<HTMLButtonElement>('.track-segment[aria-hidden="false"] .tile, .track-segment:not([aria-hidden]) .tile')[itemIndex]?.focus();
    }));
  }

  function getRotundaMove(direction: -1 | 1) {
    return resolveRotundaMove(rows, selected?.product_id, direction);
  }

  function selectRelative(direction: -1 | 1) {
    const move = getRotundaMove(direction);
    if (move.target) {
      setSelected(move.target);
      setSelectedRow(move.rowIndex);
    }
  }

  const previousMove = getRotundaMove(-1);
  const nextMove = getRotundaMove(1);

  return (
    <main className={`nume ${stage ? "is-open" : ""} ${stage === 2 ? "is-previewing" : ""}`}>
      <header className="site-header">
        <button className="wordmark" onClick={() => { setStage(0); setSelected(null); }} aria-label="Return to NUME gallery">
          NU<span>M</span>E
        </button>
        <div className="header-note">Independent visual index <i>—</i> 2026</div>
        {stage > 0 && <button className="back" onClick={goBack} aria-label="Go back one step"><span>↖</span> Back</button>}
      </header>

      <section
        className="gallery"
        aria-label="NUME image gallery"
        aria-hidden={rotundaOpen}
        inert={rotundaOpen}
      >
        <div className="virtual-spacer" style={{ height: windowRange.top }} aria-hidden="true" />
        {logicalRows.slice(windowRange.start, windowRange.end).map((logicalRow, mountedIndex) => {
          const rowIndex = windowRange.start + mountedIndex;
          const sourceIndex = logicalRow.sourceIndex;
          const row = rows[sourceIndex];
          return (
          <div
            className={`gallery-row row-${sourceIndex + 1} heading-${logicalRow.heading_placement} ${sourceIndex < selectedRow ? "row-before" : sourceIndex > selectedRow ? "row-after" : "row-selected"}`}
            key={logicalRow.logicalKey}
            data-nume-row={logicalRow.row_id}
            data-nume-vendor={logicalRow.merchant_id}
            data-nume-entrepreneur={logicalRow.entrepreneur_group_id ?? undefined}
            data-nume-style={logicalRow.style_profile_id}
            data-logical-index={rowIndex}
            style={styleVariables(logicalRow.tokens)}
            onPointerEnter={() => setHoveredRow(rowIndex)}
            onPointerLeave={() => setHoveredRow((current) => current === rowIndex ? null : current)}
            onFocusCapture={() => setHoveredRow(rowIndex)}
            onPointerDown={(event) => startDrag(event, rowIndex)}
            onPointerMove={(event) => moveDrag(event, rowIndex)}
            onPointerUp={(event) => endDrag(event, rowIndex)}
            onPointerCancel={(event) => endDrag(event, rowIndex)}
          >
            <div className="row-heading-area">
              {logicalRow.merchant_id === "merchant_qa" && (
                <p className="qa-slogan">Married to Beauty</p>
              )}
              <h2 className={`row-heading ${logicalRow.heading_role === "primary" ? "is-primary" : ""}`} aria-label={`${logicalRow.merchant_name}, ${logicalRow.title}`}>
                <span className="merchant-title">{logicalRow.merchant_name}</span>
                <span className="family-title">{logicalRow.merchant_name === logicalRow.title ? logicalRow.subtitle : logicalRow.title}</span>
              </h2>
            </div>
            <div className="row-controls" aria-label={`Move row ${rowIndex + 1}`}>
              <button onClick={() => nudgeRow(rowIndex, -1)} aria-label={`Move row ${rowIndex + 1} left`}>←</button>
              <span>{String(rowIndex + 1).padStart(2, "0")}</span>
              <button onClick={() => nudgeRow(rowIndex, 1)} aria-label={`Move row ${rowIndex + 1} right`}>→</button>
            </div>
            <div
              className="track"
              ref={(element) => { if (element) rowTracks.current.set(rowIndex, element); else rowTracks.current.delete(rowIndex); }}
            >
              {Array.from({ length: ROW_COPIES }, (_, copyIndex) => (
                <div
                  className="track-segment"
                  key={copyIndex}
                  ref={copyIndex === 0 ? (element) => {
                    if (element) {
                      rowSegments.current.set(rowIndex, element);
                      queueMicrotask(() => cycleWidths.current.set(rowIndex, element.getBoundingClientRect().width + 14));
                    } else { rowSegments.current.delete(rowIndex); cycleWidths.current.delete(rowIndex); }
                  } : undefined}
                  aria-hidden={copyIndex === 2 ? undefined : true}
                >
                  {row.map((work, itemIndex) => (
                    <button
                      className={`tile tile-${itemIndex} availability-${work.variants[0].availability.status}`}
                      key={`${work.product_id}-${copyIndex}`}
                      onClick={() => openWork(work, rowIndex)}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                        event.preventDefault();
                        focusLogicalRow(rowIndex + (event.key === "ArrowUp" ? -1 : 1), itemIndex);
                      }}
                      aria-label={`Open ${work.title}${isPurchasable(work) ? "" : ` — ${work.variants[0].availability.status.replace("_", " ")}`}`}
                      tabIndex={copyIndex === 2 ? 0 : -1}
                      draggable={false}
                      data-product-id={work.product_id}
                    >
                      <ProductImage product={work} alt={copyIndex === 2 ? work.media[0].alt : ""} loading={rowIndex > 1 ? "lazy" : "eager"} vendor={logicalRow.merchant_id} tokens={logicalRow.tokens} />
                      <span className="tile-meta"><b>{work.title}</b><em>{formatPrice(work.variants[0].retail_price.amount_minor, work.variants[0].retail_price.currency)}</em></span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button
              className="mobile-edge-control mobile-edge-left"
              aria-label={`Move row ${rowIndex + 1} left`}
              disabled={rotundaOpen}
              onPointerDown={(event) => startEdgeHold(event, rowIndex, -1)}
              onPointerUp={stopEdgeHold}
              onPointerCancel={stopEdgeHold}
              onPointerLeave={stopEdgeHold}
              onClick={(event) => {
                event.stopPropagation();
                nudgeRow(rowIndex, -1);
              }}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              className="mobile-edge-control mobile-edge-right"
              aria-label={`Move row ${rowIndex + 1} right`}
              disabled={rotundaOpen}
              onPointerDown={(event) => startEdgeHold(event, rowIndex, 1)}
              onPointerUp={stopEdgeHold}
              onPointerCancel={stopEdgeHold}
              onPointerLeave={stopEdgeHold}
              onClick={(event) => {
                event.stopPropagation();
                nudgeRow(rowIndex, 1);
              }}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        );})}
        <div className="virtual-spacer" style={{ height: windowRange.bottom }} aria-hidden="true" />
      </section>

      {selected && stage > 0 && (
        <>
        <section
          className="reveal-band desktop-rotunda" style={styleVariables(marketplaceRows[selectedRow].tokens)} data-theme-row={marketplaceRows[selectedRow].row_id}
          aria-live="polite"
          aria-label={`${selected.title} enlarged view`}
          role="dialog"
          aria-modal="true"
        >
          <div className="band-line top-line" />
          <div className="family-rail" aria-label={`${marketplaceRows[selectedRow].title} collection`}>
            {family.slice(0, 2).map((work, index) => (
              <button className={`family-card family-left family-${index}`} key={work.product_id} onClick={() => setSelected(work)}>
                <ProductImage product={work} alt={work.media[0].alt} vendor={marketplaceRows[selectedRow].merchant_id} tokens={marketplaceRows[selectedRow].tokens} />
              </button>
            ))}
          </div>

          <div className={`hero-wrap ${selectedRow % 2 ? "preview-left" : "preview-right"}`}>
            <button
              className={`hero-nav hero-prev ${previousMove.label === "Ascend" ? "is-row-shift" : ""}`}
              onClick={() => selectRelative(-1)}
              aria-label={`${previousMove.label} image`}
              disabled={!previousMove.target}
            >
              <span>{previousMove.label === "Ascend" ? "↖" : "←"}</span><em>{previousMove.label}</em>
            </button>
            <button className="hero" onClick={advance} aria-label={stage === 1 ? `Preview website for ${selected.title}` : `Visit website for ${selected.title}`}>
              <ProductImage product={selected} alt={selected.media[0].alt} loading="eager" vendor={marketplaceRows[selectedRow].merchant_id} tokens={marketplaceRows[selectedRow].tokens} />
              <span className="hero-index">{String(rows[selectedRow].findIndex((p) => p.product_id === selected.product_id) + 1).padStart(2, "0")}</span>
              <span className="hero-action">{stage === 1 ? "Product details" : "Catalog details"} <i>↗</i></span>
            </button>

            <div className="work-copy">
              <p>{marketplaceRows[selectedRow].merchant_name} · {marketplaceRows[selectedRow].title}</p>
              <h1>{selected.title}</h1>
              <span>{formatPrice(selected.variants[0].retail_price.amount_minor, selected.variants[0].retail_price.currency)} · {displayLabel(selected.variants[0].availability.status)}</span>
            </div>

            {stage === 2 && (
              <div className="site-preview">
                <div className="preview-bar">
                  <span>NUME Product Preview</span>
                  <i>•••</i>
                </div>
                <div className="preview-page">
                  <span>NUME / SOURCE {String(rows[selectedRow].findIndex((p) => p.product_id === selected.product_id) + 1).padStart(2, "0")}</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                  <span className="demo-checkout">Demo catalog preview — checkout is not connected</span>
                </div>
              </div>
            )}
            <button
              className={`hero-nav hero-next ${nextMove.label === "Descend" ? "is-row-shift" : ""}`}
              onClick={() => selectRelative(1)}
              aria-label={`${nextMove.label} image`}
              disabled={!nextMove.target}
            >
              <em>{nextMove.label}</em><span>{nextMove.label === "Descend" ? "↘" : "→"}</span>
            </button>
          </div>

          <div className="family-rail family-rail-right">
            {family.slice(2, 4).map((work, index) => (
              <button className={`family-card family-right family-${index}`} key={work.product_id} onClick={() => setSelected(work)}>
                <ProductImage product={work} alt={work.media[0].alt} vendor={marketplaceRows[selectedRow].merchant_id} tokens={marketplaceRows[selectedRow].tokens} />
              </button>
            ))}
          </div>
          <div className="band-line bottom-line" />
        </section>

        <section
          className={`mobile-rotunda ${stage === 2 ? "is-previewing" : ""}`} style={styleVariables(marketplaceRows[selectedRow].tokens)} data-theme-row={marketplaceRows[selectedRow].row_id}
          aria-live="polite"
          aria-label={`${selected.title} enlarged mobile view`}
          role="dialog"
          aria-modal="true"
        >
          <div className="mobile-rotunda-meta">
            <div>
              <p>{marketplaceRows[selectedRow].merchant_name} · {marketplaceRows[selectedRow].title}</p>
              <h1>{selected.title}</h1>
            </div>
            <span>{formatPrice(selected.variants[0].retail_price.amount_minor, selected.variants[0].retail_price.currency)} · {displayLabel(selected.variants[0].availability.status)}</span>
          </div>

          <div className={`mobile-rotunda-stage ${selectedRow % 2 ? "preview-left" : "preview-right"}`}>
            <button
              className="mobile-hero"
              onClick={advance}
              aria-label={stage === 1 ? `Preview website for ${selected.title}` : `Visit website for ${selected.title}`}
            >
              <ProductImage product={selected} alt={selected.media[0].alt} loading="eager" vendor={marketplaceRows[selectedRow].merchant_id} tokens={marketplaceRows[selectedRow].tokens} />
              <span className="mobile-hero-index">{String(rows[selectedRow].findIndex((p) => p.product_id === selected.product_id) + 1).padStart(2, "0")}</span>
              <span className="mobile-hero-action">{stage === 1 ? "Product details" : "Catalog details"} <i>↗</i></span>
            </button>

            {stage === 2 && (
              <div className="mobile-site-preview">
                <div className="preview-bar">
                  <span>NUME Product Preview</span>
                  <i>•••</i>
                </div>
                <div className="preview-page">
                  <span>NUME / SOURCE {String(rows[selectedRow].findIndex((p) => p.product_id === selected.product_id) + 1).padStart(2, "0")}</span>
                  <h2>{selected.title}</h2>
                  <p>{selected.description}</p>
                  <span className="demo-checkout">Demo catalog preview — checkout is not connected</span>
                </div>
              </div>
            )}
          </div>

          <nav className="mobile-rotunda-nav" aria-label="Rotunda navigation">
            <button
              className={previousMove.label === "Ascend" ? "is-row-shift" : ""}
              onClick={() => selectRelative(-1)}
              aria-label={`${previousMove.label} image`}
              disabled={!previousMove.target}
            >
              <span aria-hidden="true">{previousMove.label === "Ascend" ? "↖" : "←"}</span>
              <em>{previousMove.label}</em>
            </button>
            <button
              className={nextMove.label === "Descend" ? "is-row-shift" : ""}
              onClick={() => selectRelative(1)}
              aria-label={`${nextMove.label} image`}
              disabled={!nextMove.target}
            >
              <em>{nextMove.label}</em>
              <span aria-hidden="true">{nextMove.label === "Descend" ? "↘" : "→"}</span>
            </button>
          </nav>
        </section>
        </>
      )}

      <footer>
        <span>Scroll to explore</span>
        <span>Five storefront rows / 050 products</span>
      </footer>
    </main>
  );
}
