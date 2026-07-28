"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { displayLabel, featuredPlacementData, formatPrice, isPurchasable, layoutData, marketplaceRows, type Product, type StyleTokens } from "../lib/catalog";
import { resolveFeaturedPlacement } from "../lib/featured-placement.mjs";
import { ProductImage } from "./product-image";
import { resolveRotundaMove } from "../lib/rotunda-navigation.mjs";
import { TickerEngine } from "../lib/motion/ticker-engine";

const rows = marketplaceRows.map((row) => row.products);
const ROW_COPIES = 2;

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
  const engine = useRef<TickerEngine | null>(null);
  const rowParts = useRef(new Map<number, { row?: HTMLElement; track?: HTMLElement; segment?: HTMLElement; cleanup?: () => void }>());
  const suppressOpenUntil = useRef(0);
  const edgeHoldDelay = useRef<number | null>(null);
  const edgeHoldRepeat = useRef<number | null>(null);
  const rotundaOpen = stage > 0;
  const initialCenterComplete = useRef(false);

  const family = useMemo(
    () => selected ? rows[selectedRow].filter((product) => product.product_id !== selected.product_id).slice(0, 4) : [],
    [selected, selectedRow],
  );

  const bindPart = useCallback((index: number, part: "row" | "track" | "segment", element: HTMLElement | null) => {
    const parts = rowParts.current.get(index) ?? {};
    parts.cleanup?.(); parts.cleanup = undefined;
    if (element) parts[part] = element; else delete parts[part];
    if (parts.row && parts.track && parts.segment && engine.current) {
      parts.cleanup = engine.current.register({ row: parts.row, track: parts.track, segment: parts.segment, direction: index % 2 ? 1 : -1 });
    }
    if (element) rowParts.current.set(index, parts); else if (!parts.row && !parts.track && !parts.segment) rowParts.current.delete(index);
  }, []);

  useEffect(() => {
    const partsMap = rowParts.current;
    engine.current = new TickerEngine();
    for (const [index, parts] of partsMap) if (parts.row && parts.track && parts.segment) {
      parts.cleanup = engine.current.register({ row: parts.row, track: parts.track, segment: parts.segment, direction: index % 2 ? 1 : -1 });
    }
    return () => { engine.current?.destroy(); engine.current = null; partsMap.clear(); };
  }, []);

  useLayoutEffect(() => {
    if (initialCenterComplete.current || location.hash) return;
    initialCenterComplete.current = true;
    const match = location.pathname.match(/^\/storefront\/([^/]+)\/?$/);
    const resolved = resolveFeaturedPlacement(featuredPlacementData, layoutData, { slug: match ? decodeURIComponent(match[1]) : undefined } as never);
    if (!resolved) return;
    const rowIndex = marketplaceRows.findIndex((row) => row.row_id === resolved.anchor_row_id);
    if (rowIndex < 0) return;
    document.querySelector<HTMLElement>(`[data-logical-index="${rowIndex}"]`)?.scrollIntoView({ block: "center" });
    document.documentElement.dataset.featuredResolution = resolved.reason;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && stage > 0) goBack();
      if (stage > 0 && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft") {
        if (stage > 0) selectRelative(-1);
        else return;
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        if (stage > 0) selectRelative(1);
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
    const row = rowParts.current.get(rowIndex)?.row;
    if (row) engine.current?.nudge(row, direction);
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
    const row = rowParts.current.get(rowIndex)?.row;
    if (row) engine.current?.pointerDown(event.nativeEvent, row);
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    engine.current?.pointerMove(event.nativeEvent);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (engine.current?.pointerUp(event.nativeEvent)) suppressOpenUntil.current = performance.now() + 180;
  }

  function focusLogicalRow(targetRow: number, itemIndex: number) {
    if (targetRow < 0 || targetRow >= marketplaceRows.length) return;
    document.querySelector<HTMLElement>(`[data-logical-index="${targetRow}"]`)?.scrollIntoView({ block: "center" });
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
        {marketplaceRows.map((logicalRow, rowIndex) => {
          const sourceIndex = rowIndex;
          const row = rows[sourceIndex];
          return (
          <div
            className={`gallery-row row-${sourceIndex + 1} heading-${logicalRow.heading_placement} ${sourceIndex < selectedRow ? "row-before" : sourceIndex > selectedRow ? "row-after" : "row-selected"}`}
            key={logicalRow.row_id}
            data-nume-row={logicalRow.row_id}
            data-nume-vendor={logicalRow.merchant_id}
            data-nume-entrepreneur={logicalRow.entrepreneur_group_id ?? undefined}
            data-nume-style={logicalRow.style_profile_id}
            data-logical-index={rowIndex}
            style={styleVariables(logicalRow.tokens)}
            ref={(element) => bindPart(rowIndex, "row", element)}
            onPointerDown={(event) => startDrag(event, rowIndex)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
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
              ref={(element) => bindPart(rowIndex, "track", element)}
            >
              {Array.from({ length: ROW_COPIES }, (_, copyIndex) => (
                <div
                  className="track-segment"
                  key={copyIndex}
                  ref={copyIndex === 0 ? (element) => bindPart(rowIndex, "segment", element) : undefined}
                  aria-hidden={copyIndex === 0 ? undefined : true}
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
                      tabIndex={copyIndex === 0 ? 0 : -1}
                      draggable={false}
                      data-product-id={work.product_id}
                    >
                      <ProductImage product={work} alt={copyIndex === 0 ? work.media[0].alt : ""} loading={rowIndex === 0 && copyIndex === 0 && itemIndex < 3 ? "eager" : "lazy"} vendor={logicalRow.merchant_id} tokens={logicalRow.tokens} />
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
