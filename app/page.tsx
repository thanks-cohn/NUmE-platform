"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { displayLabel, formatPrice, imagePath, isPurchasable, localImagePath, marketplaceRows, productImageFallback, type Product, type StyleTokens } from "../lib/catalog";
import { movementConfiguration, wrapTickerPosition } from "../lib/movement.mjs";
import { activeTickerIndexes, headingComposition, makeStressRows, virtualWindow } from "../lib/virtualization.mjs";

const rows = marketplaceRows.map((row) => row.products);
const ROW_COPIES = 5;
const ROW_HEIGHT = 286;
const INITIAL_WINDOW = { start: 0, end: Math.min(5, marketplaceRows.length), top: 0, bottom: 0 };

type TickerState = {
  position: number;
  target: number;
  initialized: boolean;
};

function styleVariables(tokens: StyleTokens) {
  return {
    "--row-bg": tokens.color_background, "--row-surface": tokens.color_surface,
    "--row-fg": tokens.color_foreground, "--row-accent": tokens.color_accent,
    "--row-font": tokens.font_heading, "--row-radius": `${tokens.card_radius_px ?? 0}px`,
    "--row-rotunda": tokens.rotunda_surface, "--row-align": tokens.header_alignment,
    "--row-body-font": tokens.font_body, "--row-heading-size": tokens.heading_size,
    "--row-heading-weight": tokens.heading_weight, "--row-heading-tracking": tokens.heading_tracking,
    "--row-border": tokens.border_style, "--row-decoration": tokens.decoration,
  } as React.CSSProperties;
}

function ProductImage({ product, alt, loading }: { product: Product; alt: string; loading?: "eager" | "lazy" }) {
  // Native images preserve the required remote → local → SVG fallback chain.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imagePath(product)} alt={alt} loading={loading} decoding="async" width={660} height={500} className="is-loading" draggable={false} data-fallback="local" onLoad={(event) => event.currentTarget.classList.remove("is-loading")} onError={(event) => {
    const image = event.currentTarget;
    image.classList.add("is-loading");
    if (image.dataset.fallback === "local") { image.dataset.fallback = "final"; image.src = localImagePath(product); }
    else if (image.dataset.fallback === "final") { image.dataset.fallback = "done"; image.src = productImageFallback(); }
  }} />;
}

export default function Home() {
  const [selected, setSelected] = useState<Product | null>(null);
  const [selectedRow, setSelectedRow] = useState(0);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [logicalRows, setLogicalRows] = useState(() => makeStressRows(marketplaceRows, marketplaceRows.length));
  const [windowRange, setWindowRange] = useState(INITIAL_WINDOW);
  const virtualMetrics = useRef({ offset: 0, viewport: 900 });
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

  const family = useMemo(
    () => selected ? rows[selectedRow].filter((product) => product.product_id !== selected.product_id).slice(0, 4) : [],
    [selected, selectedRow],
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const requested = Number(new URLSearchParams(window.location.search).get("numeStress"));
    if (requested >= 50 && requested <= 1000) queueMicrotask(() => setLogicalRows(makeStressRows(marketplaceRows, requested)));
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const galleryTop = 122;
      const offset = Math.max(0, window.scrollY - galleryTop);
      const viewport = window.innerHeight;
      virtualMetrics.current = { offset, viewport };
      for (const [index, segment] of rowSegments.current) cycleWidths.current.set(index, segment.getBoundingClientRect().width + 14);
      const next = virtualWindow(logicalRows.length, offset, viewport, ROW_HEIGHT);
      setWindowRange(current => current.start === next.start && current.end === next.end && current.bottom === next.bottom ? current : next);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
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
      const { offset, viewport } = virtualMetrics.current;
      const active = activeTickerIndexes(windowRange, offset, viewport, ROW_HEIGHT, activeCeiling);
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
        document.documentElement.dataset.numePerformance = JSON.stringify({ logicalRows: logicalRows.length, mountedRows: windowRange.end - windowRange.start, activeRows: active.length, window: [windowRange.start, windowRange.end] });
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
  }, [logicalRows.length, windowRange]);

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
    window.scrollTo({ top: 122 + targetRow * ROW_HEIGHT });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-logical-index="${targetRow}"]`);
      row?.querySelectorAll<HTMLButtonElement>('.track-segment[aria-hidden="false"] .tile, .track-segment:not([aria-hidden]) .tile')[itemIndex]?.focus();
    }));
  }

  function getRotundaMove(direction: -1 | 1) {
    if (!selected) return { target: null, label: direction < 0 ? "Previous" : "Next" };

    const rowIndex = rows.findIndex((row) => row.some((work) => work.product_id === selected.product_id));
    const itemIndex = rows[rowIndex]?.findIndex((work) => work.product_id === selected.product_id) ?? -1;
    if (rowIndex < 0 || itemIndex < 0) return { target: null, label: direction < 0 ? "Previous" : "Next" };

    if (direction < 0) {
      if (itemIndex > 0) return { target: rows[rowIndex][itemIndex - 1], label: "Previous" };
      if (rowIndex > 0) return { target: rows[rowIndex - 1].at(-1) ?? null, label: "Ascend" };
      return { target: null, label: "Ascend" };
    }

    if (itemIndex < rows[rowIndex].length - 1) {
      return { target: rows[rowIndex][itemIndex + 1], label: "Next" };
    }
    if (rowIndex < rows.length - 1) return { target: rows[rowIndex + 1][0], label: "Descend" };
    return { target: null, label: "Descend" };
  }

  function selectRelative(direction: -1 | 1) {
    const move = getRotundaMove(direction);
    if (move.target) {
      setSelected(move.target);
      setSelectedRow(rows.findIndex((row) => row.some((work) => work.product_id === move.target?.product_id)));
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
            className={`gallery-row row-${sourceIndex + 1} heading-${headingComposition(rowIndex)} ${sourceIndex < selectedRow ? "row-before" : sourceIndex > selectedRow ? "row-after" : "row-selected"}`}
            key={logicalRow.logicalKey}
            data-nume-row={logicalRow.row_id}
            data-nume-entrepreneur={logicalRow.entrepreneur_group_id ?? undefined}
            data-nume-style={logicalRow.style_profile_id}
            data-mobile-align={logicalRow.tokens.header_alignment}
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
            <div className="row-heading"><span>{logicalRow.title}<small>{logicalRow.subtitle}</small></span><em>{logicalRow.title}</em></div>
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
                      <ProductImage product={work} alt={copyIndex === 2 ? work.media[0].alt : ""} loading={rowIndex > 1 ? "lazy" : "eager"} />
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
          className="reveal-band desktop-rotunda" style={styleVariables(marketplaceRows[selectedRow].tokens)}
          aria-live="polite"
          aria-label={`${selected.title} enlarged view`}
          role="dialog"
          aria-modal="true"
        >
          <div className="band-line top-line" />
          <div className="family-rail" aria-label={`${marketplaceRows[selectedRow].title} collection`}>
            {family.slice(0, 2).map((work, index) => (
              <button className={`family-card family-left family-${index}`} key={work.product_id} onClick={() => setSelected(work)}>
                <ProductImage product={work} alt={work.media[0].alt} />
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
              <ProductImage product={selected} alt={selected.media[0].alt} />
              <span className="hero-index">{String(rows[selectedRow].findIndex((p) => p.product_id === selected.product_id) + 1).padStart(2, "0")}</span>
              <span className="hero-action">{stage === 1 ? "Product details" : "Catalog details"} <i>↗</i></span>
            </button>

            <div className="work-copy">
              <p>{marketplaceRows[selectedRow].title}</p>
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
                <ProductImage product={work} alt={work.media[0].alt} />
              </button>
            ))}
          </div>
          <div className="band-line bottom-line" />
        </section>

        <section
          className={`mobile-rotunda ${stage === 2 ? "is-previewing" : ""}`} style={styleVariables(marketplaceRows[selectedRow].tokens)}
          aria-live="polite"
          aria-label={`${selected.title} enlarged mobile view`}
          role="dialog"
          aria-modal="true"
        >
          <div className="mobile-rotunda-meta">
            <div className="mobile-rotunda-title">
              <p>{marketplaceRows[selectedRow].title}</p>
              <h1>{selected.title}</h1>
            </div>
            <div className="mobile-rotunda-details" aria-label="Price and availability">
              <span>{formatPrice(selected.variants[0].retail_price.amount_minor, selected.variants[0].retail_price.currency)}</span>
              <span>{displayLabel(selected.variants[0].availability.status)}</span>
            </div>
          </div>

          <div className={`mobile-rotunda-stage ${selectedRow % 2 ? "preview-left" : "preview-right"}`}>
            <button
              className="mobile-hero"
              onClick={advance}
              aria-label={stage === 1 ? `Preview website for ${selected.title}` : `Visit website for ${selected.title}`}
            >
              <ProductImage product={selected} alt={selected.media[0].alt} />
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
